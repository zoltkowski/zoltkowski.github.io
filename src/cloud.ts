// Funkcjonalność zarządzania plikami w chmurze (Cloudflare KV), bibliotece i lokalnych

// === PANEL STATE ===
const DEBUG_PANEL_MARGIN = { x: 20, y: 20 };
const DEBUG_PANEL_TOP_MIN = 60;

let cloudPanel: HTMLElement | null = null;
let cloudPanelHeader: HTMLElement | null = null;
let cloudCloseBtn: HTMLButtonElement | null = null;
let localFileList: HTMLElement | null = null;
let libraryFileList: HTMLElement | null = null;
let cloudFileList: HTMLElement | null = null;
let currentTab: 'local' | 'library' | 'cloud' = 'local';
let cloudPanelPos: { x: number; y: number } | null = null;
let lastLoadedFile: { name: string; type: 'local' | 'library' | 'cloud' } | null = null;
let isCollapsedState = false;
let localDirectoryHandle: FileSystemDirectoryHandle | null = null;

type DragState = {
  pointerId: number;
  start: { x: number; y: number };
  panelStart: { x: number; y: number };
};
let cloudDragState: DragState | null = null;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

// === CLOUDFLARE KV ===
export async function listKeys(): Promise<string[]> {
  const res = await fetch("/api/json/list");
  const data = await res.json();
  return data.result.map((k: any) => k.name);
}

export async function loadFromKV(key: string): Promise<any> {
  const res = await fetch(`/api/json/${encodeURIComponent(key)}`);
  if (!res.ok) {
    throw new Error(`KV GET failed: ${res.status}`);
  }
  return await res.json();
}

export async function deleteFromKV(key: string): Promise<void> {
  const res = await fetch(`/api/json/${encodeURIComponent(key)}`, {
    method: "DELETE"
  });
  if (!res.ok) {
    throw new Error(`KV DELETE failed: ${res.status}`);
  }
}

export async function saveToKV(key: string, data: any): Promise<void> {
  const res = await fetch(`/api/json/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    throw new Error(`KV PUT failed: ${res.status}`);
  }
}

// === BIBLIOTEKA (content folder) ===
export async function listLibraryFiles(): Promise<string[]> {
  try {
    // Próbuj pobrać listę plików z folderu content
    const res = await fetch('/content/');
    const text = await res.text();
    
    // Prosta ekstrakcja linków do plików .json z HTML directory listing
    const matches = text.matchAll(/href="([^"]+\.json)"/g);
    const files: string[] = [];
    for (const match of matches) {
      files.push(match[1]);
    }
    
    if (files.length > 0) {
      return files;
    }
    
    // Fallback - znane pliki
    return ['test.json'];
  } catch (err) {
    console.error('Nie udało się pobrać listy biblioteki:', err);
    // Fallback
    return ['test.json'];
  }
}

export async function loadFromLibrary(filename: string): Promise<any> {
  const res = await fetch(`/content/${filename}`);
  if (!res.ok) {
    throw new Error(`Library GET failed: ${res.status}`);
  }
  return await res.json();
}

// === PANEL MANAGEMENT ===
function applyCloudPanelPosition() {
  if (!cloudPanel || !cloudPanelPos) return;
  cloudPanel.style.left = `${cloudPanelPos.x}px`;
  cloudPanel.style.top = `${cloudPanelPos.y}px`;
}

function ensureCloudPanelPosition() {
  if (!cloudPanel) return;
  const rect = cloudPanel.getBoundingClientRect();
  const width = rect.width || cloudPanel.offsetWidth || 320;
  const height = rect.height || cloudPanel.offsetHeight || 240;
  const maxX = Math.max(DEBUG_PANEL_MARGIN.x, window.innerWidth - width - DEBUG_PANEL_MARGIN.x);
  const maxY = Math.max(DEBUG_PANEL_TOP_MIN, window.innerHeight - height - DEBUG_PANEL_MARGIN.y);
  if (!cloudPanelPos) {
    cloudPanelPos = {
      x: clamp(window.innerWidth - width - DEBUG_PANEL_MARGIN.x - 20, DEBUG_PANEL_MARGIN.x, maxX),
      y: clamp(100, DEBUG_PANEL_TOP_MIN, maxY)
    };
  } else {
    cloudPanelPos = {
      x: clamp(cloudPanelPos.x, DEBUG_PANEL_MARGIN.x, maxX),
      y: clamp(cloudPanelPos.y, DEBUG_PANEL_TOP_MIN, maxY)
    };
  }
  applyCloudPanelPosition();
}

function endCloudPanelDrag(pointerId?: number) {
  if (!cloudDragState) return;
  if (pointerId !== undefined && cloudDragState.pointerId !== pointerId) return;
  try {
    cloudPanelHeader?.releasePointerCapture(cloudDragState.pointerId);
  } catch (err) {
    // ignore
  }
  cloudPanel?.classList.remove('debug-panel--dragging');
  cloudDragState = null;
}

export function initCloudPanel() {
  cloudPanel = document.getElementById('cloudPanel');
  cloudPanelHeader = document.getElementById('cloudPanelHandle');
  cloudCloseBtn = document.getElementById('cloudCloseBtn') as HTMLButtonElement | null;
  localFileList = document.getElementById('localFileList');
  libraryFileList = document.getElementById('libraryFileList');
  cloudFileList = document.getElementById('cloudFileList');
  
  if (!cloudPanel || !cloudPanelHeader || !localFileList || !libraryFileList || !cloudFileList) {
    console.error('Cloud panel elements not found');
    return;
  }

  // Close button
  cloudCloseBtn?.addEventListener('click', () => {
    if (cloudPanel) cloudPanel.style.display = 'none';
  });

  // Drag handling
  const handleCloudPointerDown = (ev: PointerEvent) => {
    if (!cloudPanel || !cloudPanelHeader) return;
    const target = ev.target as HTMLElement | null;
    if (target && (target.closest('#cloudCloseBtn') || target.closest('.cloud-toolbar') || target.closest('.cloud-toolbar-btn'))) return;
    cloudPanelHeader.setPointerCapture(ev.pointerId);
    const rect = cloudPanel.getBoundingClientRect();
    if (!cloudPanelPos) {
      cloudPanelPos = { x: rect.left, y: rect.top };
    }
    cloudDragState = {
      pointerId: ev.pointerId,
      start: { x: ev.clientX, y: ev.clientY },
      panelStart: { x: cloudPanelPos!.x, y: cloudPanelPos!.y }
    };
    cloudPanel.classList.add('debug-panel--dragging');
    ev.preventDefault();
  };

  cloudPanelHeader.addEventListener('pointerdown', handleCloudPointerDown);
  cloudPanelHeader.addEventListener('pointermove', (ev) => {
    if (!cloudDragState || cloudDragState.pointerId !== ev.pointerId || !cloudPanel) return;
    const dx = ev.clientX - cloudDragState.start.x;
    const dy = ev.clientY - cloudDragState.start.y;
    const rect = cloudPanel.getBoundingClientRect();
    const width = rect.width || cloudPanel.offsetWidth || 320;
    const height = rect.height || cloudPanel.offsetHeight || 240;
    const maxX = Math.max(DEBUG_PANEL_MARGIN.x, window.innerWidth - width - DEBUG_PANEL_MARGIN.x);
    const maxY = Math.max(DEBUG_PANEL_TOP_MIN, window.innerHeight - height - DEBUG_PANEL_MARGIN.y);
    cloudPanelPos = {
      x: clamp(cloudDragState.panelStart.x + dx, DEBUG_PANEL_MARGIN.x, maxX),
      y: clamp(cloudDragState.panelStart.y + dy, DEBUG_PANEL_TOP_MIN, maxY)
    };
    applyCloudPanelPosition();
  });
  
  const releaseCloudPointer = (ev: PointerEvent) => {
    if (!cloudDragState || cloudDragState.pointerId !== ev.pointerId) return;
    endCloudPanelDrag(ev.pointerId);
  };
  
  cloudPanelHeader.addEventListener('pointerup', releaseCloudPointer);
  cloudPanelHeader.addEventListener('pointercancel', releaseCloudPointer);

  // Resize handling
  window.addEventListener('resize', () => {
    if (cloudPanel && cloudPanel.style.display !== 'none') {
      ensureCloudPanelPosition();
    }
  });
  
  // Event delegation dla przycisków toggle
  cloudPanel.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    
    // Sprawdź czy kliknięto w toggle button lub jego dzieci (SVG)
    let toggleBtn = target.closest('[data-toggle-local], [data-toggle-library], [data-toggle-cloud]') as HTMLElement;
    
    // Jeśli to SVG/path, sprawdź czy rodzic ma data-toggle
    if (!toggleBtn && (target.tagName === 'svg' || target.tagName === 'path')) {
      const parent = target.closest('button');
      if (parent?.hasAttribute('data-toggle-local') || parent?.hasAttribute('data-toggle-library') || parent?.hasAttribute('data-toggle-cloud')) {
        toggleBtn = parent as HTMLElement;
      }
    }
    
    if (!toggleBtn) return;
    
    const panelContent = document.querySelector('#cloudPanel .debug-panel__content') as HTMLElement;
    const panelTitle = document.getElementById('cloudPanelTitle') as HTMLElement;
    const toolbarHeader = document.getElementById('cloudToolbarHeader') as HTMLElement;
    
    const isCurrentlyCollapsed = panelContent?.style.display === 'none';
    
    if (isCurrentlyCollapsed) {
      // Rozwiń
      if (panelContent) panelContent.style.display = '';
      if (panelTitle) {
        panelTitle.style.display = '';
        panelTitle.style.pointerEvents = '';
      }
      const closeBtn = cloudPanel.querySelector('.debug-panel__close') as HTMLElement;
      if (closeBtn) closeBtn.style.pointerEvents = '';
      if (toolbarHeader) {
        const toolbar = toolbarHeader.querySelector('.cloud-toolbar');
        // Sprawdź która zakładka jest aktywna
        const tabLocal = cloudPanel.querySelector('[data-tab="local"]');
        const tabLibrary = cloudPanel.querySelector('[data-tab="library"]');
        const tabCloud = cloudPanel.querySelector('[data-tab="cloud"]');
        const isLocalActive = tabLocal?.classList.contains('cloud-tab--active');
        const isLibraryActive = tabLibrary?.classList.contains('cloud-tab--active');
        const targetList = isLocalActive ? localFileList : (isLibraryActive ? libraryFileList : cloudFileList);
        
        if (toolbar && targetList) {
          // Jeśli lista jest pusta lub pierwszy element to już toolbar, użyj appendChild
          if (!targetList.firstChild || targetList.firstChild.classList?.contains('cloud-toolbar')) {
            targetList.appendChild(toolbar);
          } else {
            targetList.insertBefore(toolbar, targetList.firstChild);
          }
        }
        toolbarHeader.style.display = 'none';
      }
      const refreshBtn = cloudPanel.querySelector('.cloud-toolbar button:nth-child(4)') as HTMLElement;
      if (refreshBtn) refreshBtn.style.display = '';
      const toolbar = cloudPanel.querySelector('.cloud-toolbar') as HTMLElement;
      if (toolbar) toolbar.style.borderBottom = '';
      isCollapsedState = false;
      toggleBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>`;
    } else {
      // Zwiń
      if (panelContent) panelContent.style.display = 'none';
      if (panelTitle) {
        panelTitle.style.display = 'none';
        panelTitle.style.pointerEvents = 'none';
      }
      const closeBtn = cloudPanel.querySelector('.debug-panel__close') as HTMLElement;
      if (closeBtn) closeBtn.style.pointerEvents = 'none';
      if (toolbarHeader) {
        // Znajdź toolbar z AKTYWNEJ listy, nie pierwszy w DOM
        const tabLocal = cloudPanel.querySelector('[data-tab="local"]');
        const tabLibrary = cloudPanel.querySelector('[data-tab="library"]');
        const isLocalActive = tabLocal?.classList.contains('cloud-tab--active');
        const isLibraryActive = tabLibrary?.classList.contains('cloud-tab--active');
        const activeList = isLocalActive ? localFileList : (isLibraryActive ? libraryFileList : cloudFileList);
        const toolbar = activeList?.querySelector('.cloud-toolbar');
        
        if (toolbar && toolbar.parentElement !== toolbarHeader) {
          toolbarHeader.appendChild(toolbar);
          toolbarHeader.style.display = 'flex';
          toolbarHeader.style.pointerEvents = 'auto';
          toolbar.querySelectorAll('button').forEach(btn => {
            (btn as HTMLElement).style.pointerEvents = 'auto';
          });
        }
      }
      const refreshBtn = cloudPanel.querySelector('.cloud-toolbar button:nth-child(4)') as HTMLElement;
      if (refreshBtn) refreshBtn.style.display = 'none';
      const toolbar = cloudPanel.querySelector('.cloud-toolbar') as HTMLElement;
      if (toolbar) toolbar.style.borderBottom = 'none';
      isCollapsedState = true;
      toggleBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>`;
    }
  });
}

export function initCloudUI(onLoadCallback: (data: any) => void) {
  if (!cloudPanel || !localFileList || !libraryFileList || !cloudFileList) {
    console.error('Cloud panel not initialized. Call initCloudPanel() first.');
    return;
  }
  
  // Reset do stanu rozwiniętego
  isCollapsedState = false;
  const panelContent = document.querySelector('#cloudPanel .debug-panel__content') as HTMLElement;
  const panelTitle = document.getElementById('cloudPanelTitle') as HTMLElement;
  const toolbarHeader = document.getElementById('cloudToolbarHeader') as HTMLElement;
  if (panelContent) panelContent.style.display = '';
  if (panelTitle) panelTitle.style.display = '';
  if (toolbarHeader) toolbarHeader.style.display = 'none';
  
  // Setup tabs if not already done
  const tabs = cloudPanel.querySelectorAll('.cloud-tab');
  if (tabs.length > 0) {
    // Remove old listeners by cloning (simple approach)
    tabs.forEach(tab => {
      const newTab = tab.cloneNode(true) as HTMLElement;
      tab.parentNode?.replaceChild(newTab, tab);
      newTab.addEventListener('click', () => {
        const tabName = newTab.getAttribute('data-tab') as 'local' | 'library' | 'cloud';
        switchTab(tabName, onLoadCallback);
      });
    });
  }
  
  // Show panel and load files
  cloudPanel.style.display = 'flex';
  ensureCloudPanelPosition();
  currentTab = 'local';
  switchTab('local', onLoadCallback);
}

export function closeCloudPanel() {
  if (cloudPanel) {
    cloudPanel.style.display = 'none';
  }
}

function switchTab(tab: 'local' | 'library' | 'cloud', onLoadCallback: (data: any) => void) {
  currentTab = tab;
  
  // Aktualizuj wygląd zakładek
  const tabs = cloudPanel?.querySelectorAll('.cloud-tab');
  tabs?.forEach(t => {
    if (t.getAttribute('data-tab') === tab) {
      t.classList.add('cloud-tab--active');
    } else {
      t.classList.remove('cloud-tab--active');
    }
  });
  
  // Pokaż odpowiednią listę
  if (localFileList && libraryFileList && cloudFileList) {
    if (tab === 'local') {
      localFileList.style.display = '';
      libraryFileList.style.display = 'none';
      cloudFileList.style.display = 'none';
      loadLocalList(onLoadCallback);
    } else if (tab === 'library') {
      localFileList.style.display = 'none';
      libraryFileList.style.display = '';
      cloudFileList.style.display = 'none';
      loadLibraryList(onLoadCallback);
    } else {
      localFileList.style.display = 'none';
      libraryFileList.style.display = 'none';
      cloudFileList.style.display = '';
      loadCloudList(onLoadCallback);
    }
  }
}

async function loadLocalList(onLoadCallback: (data: any) => void) {
  if (!localFileList) return;
  
  try {
    // Wyczyść toolbar z nagłówka jeśli tam jest
    const toolbarHeader = document.getElementById('cloudToolbarHeader');
    if (toolbarHeader) toolbarHeader.innerHTML = '';
    
    localFileList.innerHTML = '<div class="cloud-loading">Ładowanie...</div>';
    
    // Sprawdź czy mamy dostęp do folderu
    if (!localDirectoryHandle) {
      localFileList.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <p style="margin-bottom: 10px;">Nie wybrano folderu z plikami</p>
          <button id="selectLocalFolder" style="padding: 8px 16px; cursor: pointer;">
            Wybierz folder
          </button>
        </div>
      `;
      
      const selectBtn = document.getElementById('selectLocalFolder');
      selectBtn?.addEventListener('click', async () => {
        try {
          // @ts-ignore - File System Access API
          localDirectoryHandle = await window.showDirectoryPicker();
          loadLocalList(onLoadCallback);
        } catch (err) {
          console.error('Nie wybrano folderu:', err);
        }
      });
      return;
    }
    
    // Pobierz pliki JSON z folderu
    const files: { name: string; handle: FileSystemFileHandle }[] = [];
    // @ts-ignore
    for await (const entry of localDirectoryHandle.values()) {
      if (entry.kind === 'file' && entry.name.toLowerCase().endsWith('.json')) {
        files.push({ name: entry.name, handle: entry });
      }
    }
    
    if (files.length === 0) {
      localFileList.innerHTML = '<div class="cloud-empty">Brak plików JSON w folderze</div>';
      return;
    }
    
    // Sortuj pliki po nazwie
    files.sort((a, b) => a.name.localeCompare(b.name));
    
    localFileList.innerHTML = '';
    
    // Pasek nawigacji
    const toolbar = document.createElement('div');
    toolbar.className = 'cloud-toolbar';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'cloud-toolbar-btn';
    prevBtn.title = 'Poprzedni plik';
    prevBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>`;
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'cloud-toolbar-btn';
    nextBtn.title = 'Następny plik';
    nextBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'cloud-toolbar-btn';
    toggleBtn.title = 'Zwiń/rozwiń listę';
    toggleBtn.setAttribute('data-toggle-local', 'true');
    toggleBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>`;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'cloud-toolbar-btn';
    refreshBtn.title = 'Odśwież listę';
    refreshBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`;
    
    toolbar.appendChild(prevBtn);
    toolbar.appendChild(nextBtn);
    toolbar.appendChild(toggleBtn);
    toolbar.appendChild(refreshBtn);
    
    localFileList.appendChild(toolbar);
    
    // Lista plików
    const fileListContainer = document.createElement('div');
    fileListContainer.className = 'cloud-file-list-container';
    
    for (const { name, handle } of files) {
      const item = document.createElement('div');
      item.className = 'cloud-file-item';
      
      // Zaznacz ostatnio wczytany plik
      if (lastLoadedFile?.type === 'local' && lastLoadedFile?.name === name) {
        item.classList.add('cloud-file-item--active');
      }
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'cloud-file-item__name';
      nameSpan.textContent = name.replace(/\.json$/, '');
      item.appendChild(nameSpan);
      
      const actions = document.createElement('div');
      actions.className = 'cloud-file-item__actions';
      
      const loadBtn = document.createElement('button');
      loadBtn.className = 'cloud-file-item__btn';
      loadBtn.title = 'Wczytaj';
      loadBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21V9"/>
          <path d="m7 13 5-5 5 5"/>
          <path d="M5 5h14"/>
        </svg>
      `;
      loadBtn.addEventListener('click', async () => {
        try {
          const file = await handle.getFile();
          const text = await file.text();
          const data = JSON.parse(text);
          lastLoadedFile = { name, type: 'local' };
          
          // Usuń zaznaczenie ze wszystkich elementów
          localFileList?.querySelectorAll('.cloud-file-item--active').forEach(el => {
            el.classList.remove('cloud-file-item--active');
          });
          // Zaznacz aktualny element
          item.classList.add('cloud-file-item--active');
          
          onLoadCallback(data);
        } catch (err) {
          console.error('Nie udało się wczytać pliku:', err);
          alert('Nie udało się wczytać pliku lokalnego.');
        }
      });
      
      actions.appendChild(loadBtn);
      item.appendChild(actions);
      
      fileListContainer.appendChild(item);
    }
    
    localFileList.appendChild(fileListContainer);
    
    // Obsługa nawigacji
    const navigateFile = (direction: number) => {
      const currentIndex = lastLoadedFile?.type === 'local' 
        ? files.findIndex(f => f.name === lastLoadedFile.name) 
        : -1;
      const newIndex = currentIndex + direction;
      
      if (newIndex >= 0 && newIndex < files.length) {
        const loadBtn = fileListContainer.children[newIndex]?.querySelector('.cloud-file-item__btn') as HTMLButtonElement;
        loadBtn?.click();
      }
    };
    
    prevBtn.addEventListener('click', () => navigateFile(-1));
    nextBtn.addEventListener('click', () => navigateFile(1));
    
    refreshBtn.addEventListener('click', () => loadLocalList(onLoadCallback));
    
  } catch (err) {
    console.error('Nie udało się pobrać listy plików lokalnych:', err);
    localFileList.innerHTML = '<div class="cloud-error">Nie udało się pobrać listy plików</div>';
  }
}

async function loadLibraryList(onLoadCallback: (data: any) => void) {
  if (!libraryFileList) return;
  
  try {
    // Wyczyść toolbar z nagłówka jeśli tam jest
    const toolbarHeader = document.getElementById('cloudToolbarHeader');
    if (toolbarHeader) toolbarHeader.innerHTML = '';
    
    libraryFileList.innerHTML = '<div class="cloud-loading">Ładowanie...</div>';
    
    const files = await listLibraryFiles();
    
    if (files.length === 0) {
      libraryFileList.innerHTML = '<div class="cloud-empty">Brak plików w bibliotece</div>';
      return;
    }
    
    // Sortuj pliki po nazwie
    files.sort();
    
    libraryFileList.innerHTML = '';
    
    // Pasek nawigacji
    const toolbar = document.createElement('div');
    toolbar.className = 'cloud-toolbar';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'cloud-toolbar-btn';
    prevBtn.title = 'Poprzedni plik';
    prevBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>`;
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'cloud-toolbar-btn';
    nextBtn.title = 'Nast\u0119pny plik';
    nextBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'cloud-toolbar-btn';
    toggleBtn.title = 'Zwiń/rozwiń listę';
    toggleBtn.setAttribute('data-toggle-library', 'true');
    toggleBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>`;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'cloud-toolbar-btn';
    refreshBtn.title = 'Od\u015bwie\u017c list\u0119';
    refreshBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`;
    
    toolbar.appendChild(prevBtn);
    toolbar.appendChild(nextBtn);
    toolbar.appendChild(toggleBtn);
    toolbar.appendChild(refreshBtn);
    
    libraryFileList.appendChild(toolbar);
    
    // Lista plik\u00f3w
    const fileListContainer = document.createElement('div');
    fileListContainer.className = 'cloud-file-list-container';
    
    for (const filename of files) {
      const item = document.createElement('div');
      item.className = 'cloud-file-item';
      
      // Zaznacz ostatnio wczytany plik
      if (lastLoadedFile?.type === 'library' && lastLoadedFile?.name === filename) {
        item.classList.add('cloud-file-item--active');
      }
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'cloud-file-item__name';
      nameSpan.textContent = filename.replace(/\.json$/, '');
      item.appendChild(nameSpan);
      
      const actions = document.createElement('div');
      actions.className = 'cloud-file-item__actions';
      
      const loadBtn = document.createElement('button');
      loadBtn.className = 'cloud-file-item__btn';
      loadBtn.title = 'Wczytaj';
      loadBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21V9"/>
          <path d="m7 13 5-5 5 5"/>
          <path d="M5 5h14"/>
        </svg>
      `;
      loadBtn.addEventListener('click', async () => {
        try {
          const data = await loadFromLibrary(filename);
          lastLoadedFile = { name: filename, type: 'library' };
          
          // Usuń zaznaczenie ze wszystkich elementów
          libraryFileList?.querySelectorAll('.cloud-file-item--active').forEach(el => {
            el.classList.remove('cloud-file-item--active');
          });
          // Zaznacz aktualny element
          item.classList.add('cloud-file-item--active');
          
          onLoadCallback(data);
        } catch (err) {
          console.error('Nie udało się wczytać pliku:', err);
          alert('Nie udało się wczytać pliku z biblioteki.');
        }
      });
      
      actions.appendChild(loadBtn);
      item.appendChild(actions);
      
      fileListContainer.appendChild(item);
    }
    
    libraryFileList.appendChild(fileListContainer);
    
    // Obs\u0142uga nawigacji
    const navigateFile = (direction: number) => {
      const currentIndex = lastLoadedFile?.type === 'library' 
        ? files.indexOf(lastLoadedFile.name) 
        : -1;
      const newIndex = currentIndex + direction;
      
      if (newIndex >= 0 && newIndex < files.length) {
        const loadBtn = fileListContainer.children[newIndex]?.querySelector('.cloud-file-item__btn') as HTMLButtonElement;
        loadBtn?.click();
      }
    };
    
    prevBtn.addEventListener('click', () => navigateFile(-1));
    nextBtn.addEventListener('click', () => navigateFile(1));
    
    // toggleBtn obsługiwany przez event delegation w initCloudPanel
    
    refreshBtn.addEventListener('click', () => loadLibraryList(onLoadCallback));
    
  } catch (err) {
    console.error('Nie udało się pobrać listy biblioteki:', err);
    libraryFileList.innerHTML = '<div class="cloud-error">Nie udało się pobrać listy plików</div>';
  }
}

async function loadCloudList(onLoadCallback: (data: any) => void) {
  if (!cloudFileList) return;
  
  try {
    // Wyczyść toolbar z nagłówka jeśli tam jest
    const toolbarHeader = document.getElementById('cloudToolbarHeader');
    if (toolbarHeader) toolbarHeader.innerHTML = '';
    
    cloudFileList.innerHTML = '<div class="cloud-loading">Ładowanie...</div>';
    
    const keys = await listKeys();
    
    if (keys.length === 0) {
      cloudFileList.innerHTML = '<div class="cloud-empty">Brak plików w chmurze</div>';
      return;
    }
    
    // Sortuj pliki po nazwie
    keys.sort().reverse(); // Odwrotnie, żeby najnowsze były na górze
    
    cloudFileList.innerHTML = '';
        // Pasek nawigacji
    const toolbar = document.createElement('div');
    toolbar.className = 'cloud-toolbar';
    
    const prevBtn = document.createElement('button');
    prevBtn.className = 'cloud-toolbar-btn';
    prevBtn.title = 'Poprzedni plik';
    prevBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>`;
    
    const nextBtn = document.createElement('button');
    nextBtn.className = 'cloud-toolbar-btn';
    nextBtn.title = 'Nast\u0119pny plik';
    nextBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>`;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'cloud-toolbar-btn';
    toggleBtn.title = 'Zwi\u0144/rozwi\u0144 list\u0119';    toggleBtn.setAttribute('data-toggle-cloud', 'true');    toggleBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M18 15l-6-6-6 6"/></svg>`;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'cloud-toolbar-btn';
    refreshBtn.title = 'Od\u015bwie\u017c list\u0119';
    refreshBtn.innerHTML = `<svg class="icon" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`;
    
    toolbar.appendChild(prevBtn);
    toolbar.appendChild(nextBtn);
    toolbar.appendChild(toggleBtn);
    toolbar.appendChild(refreshBtn);
    
    cloudFileList.appendChild(toolbar);
    
    // Lista plik\u00f3w
    const fileListContainer = document.createElement('div');
    fileListContainer.className = 'cloud-file-list-container';
        for (const key of keys) {
      const item = document.createElement('div');
      item.className = 'cloud-file-item';
      
      // Zaznacz ostatnio wczytany plik
      if (lastLoadedFile?.type === 'cloud' && lastLoadedFile?.name === key) {
        item.classList.add('cloud-file-item--active');
      }
      
      const nameSpan = document.createElement('span');
      nameSpan.className = 'cloud-file-item__name';
      nameSpan.textContent = key;
      item.appendChild(nameSpan);
      
      const actions = document.createElement('div');
      actions.className = 'cloud-file-item__actions';
      
      const loadBtn = document.createElement('button');
      loadBtn.className = 'cloud-file-item__btn';
      loadBtn.title = 'Wczytaj';
      loadBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21V9"/>
          <path d="m7 13 5-5 5 5"/>
          <path d="M5 5h14"/>
        </svg>
      `;
      loadBtn.addEventListener('click', async () => {
        try {
          const data = await loadFromKV(key);
          lastLoadedFile = { name: key, type: 'cloud' };
          
          // Usuń zaznaczenie ze wszystkich elementów
          cloudFileList?.querySelectorAll('.cloud-file-item--active').forEach(el => {
            el.classList.remove('cloud-file-item--active');
          });
          // Zaznacz aktualny element
          item.classList.add('cloud-file-item--active');
          
          onLoadCallback(data);
        } catch (err) {
          console.error('Nie udało się wczytać pliku:', err);
          alert('Nie udało się wczytać pliku z chmury.');
        }
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'cloud-file-item__btn cloud-file-item__btn--delete';
      deleteBtn.title = 'Usuń';
      deleteBtn.innerHTML = `
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 6h14"/>
          <path d="M10 10v8"/>
          <path d="M14 10v8"/>
          <path d="M7 6 8 4h8l1 2"/>
          <path d="M6 6v14h12V6"/>
        </svg>
      `;
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Czy na pewno chcesz usunąć plik "${key}" z chmury?`)) {
          return;
        }
        try {
          await deleteFromKV(key);
          // Odśwież listę
          loadCloudList(onLoadCallback);
        } catch (err) {
          console.error('Nie udało się usunąć pliku:', err);
          alert('Nie udało się usunąć pliku z chmury.');
        }
      });
      
      actions.appendChild(loadBtn);
      actions.appendChild(deleteBtn);
      item.appendChild(actions);
      
      fileListContainer.appendChild(item);
    }
    
    cloudFileList.appendChild(fileListContainer);
    
    // Obsługa nawigacji
    const navigateFile = (direction: number) => {
      const currentIndex = lastLoadedFile?.type === 'cloud' 
        ? keys.indexOf(lastLoadedFile.name) 
        : -1;
      const newIndex = currentIndex + direction;
      
      if (newIndex >= 0 && newIndex < keys.length) {
        const loadBtn = fileListContainer.children[newIndex]?.querySelector('.cloud-file-item__btn') as HTMLButtonElement;
        loadBtn?.click();
      }
    };
    
    prevBtn.addEventListener('click', () => navigateFile(-1));
    nextBtn.addEventListener('click', () => navigateFile(1));
    

    refreshBtn.addEventListener('click', () => loadCloudList(onLoadCallback));
    
  } catch (err) {
    console.error('Nie udało się pobrać listy plików:', err);
    cloudFileList.innerHTML = '<div class="cloud-error">Nie udało się pobrać listy plików</div>';
  }
}
