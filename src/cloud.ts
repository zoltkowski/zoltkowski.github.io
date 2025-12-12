// Funkcjonalność zarządzania plikami w chmurze (Cloudflare KV) i bibliotece

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

let cloudDialog: HTMLDialogElement | null = null;
let cloudFileList: HTMLElement | null = null;
let libraryFileList: HTMLElement | null = null;
let currentTab: 'library' | 'cloud' = 'library';

export function initCloudUI(onLoadCallback: (data: any) => void) {
  // Stwórz dialog jeśli nie istnieje
  if (!cloudDialog) {
    cloudDialog = document.createElement('dialog');
    cloudDialog.id = 'cloudDialog';
    cloudDialog.className = 'cloud-dialog';
    cloudDialog.innerHTML = `
      <div class="cloud-dialog__header">
        <h2>Pliki</h2>
        <button class="cloud-dialog__close" type="button" aria-label="Zamknij">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div class="cloud-dialog__tabs">
        <button class="cloud-dialog__tab cloud-dialog__tab--active" data-tab="library">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>
          </svg>
          Biblioteka
        </button>
        <button class="cloud-dialog__tab" data-tab="cloud">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
          </svg>
          Chmura
        </button>
      </div>
      <div class="cloud-dialog__content">
        <div class="cloud-dialog__list" id="libraryFileList">
          <div class="cloud-dialog__loading">Ładowanie...</div>
        </div>
        <div class="cloud-dialog__list" id="cloudFileList" style="display: none;">
          <div class="cloud-dialog__loading">Ładowanie...</div>
        </div>
      </div>
    `;
    document.body.appendChild(cloudDialog);
    
    const closeBtn = cloudDialog.querySelector('.cloud-dialog__close');
    closeBtn?.addEventListener('click', () => {
      cloudDialog?.close();
    });
    
    cloudDialog.addEventListener('click', (e) => {
      // Zamknij przy kliknięciu poza dialogiem
      if (e.target === cloudDialog) {
        cloudDialog?.close();
      }
    });
    
    // Obsługa zakładek
    const tabs = cloudDialog.querySelectorAll('.cloud-dialog__tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab') as 'library' | 'cloud';
        switchTab(tabName, onLoadCallback);
      });
    });
    
    libraryFileList = document.getElementById('libraryFileList');
    cloudFileList = document.getElementById('cloudFileList');
  }
  
  // Otwórz dialog i załaduj listę plików
  cloudDialog.showModal();
  currentTab = 'library';
  switchTab('library', onLoadCallback);
}

function switchTab(tab: 'library' | 'cloud', onLoadCallback: (data: any) => void) {
  currentTab = tab;
  
  // Aktualizuj wygląd zakładek
  const tabs = cloudDialog?.querySelectorAll('.cloud-dialog__tab');
  tabs?.forEach(t => {
    if (t.getAttribute('data-tab') === tab) {
      t.classList.add('cloud-dialog__tab--active');
    } else {
      t.classList.remove('cloud-dialog__tab--active');
    }
  });
  
  // Pokaż odpowiednią listę
  if (libraryFileList && cloudFileList) {
    if (tab === 'library') {
      libraryFileList.style.display = '';
      cloudFileList.style.display = 'none';
      loadLibraryList(onLoadCallback);
    } else {
      libraryFileList.style.display = 'none';
      cloudFileList.style.display = '';
      loadCloudList(onLoadCallback);
    }
  }
}

async function loadLibraryList(onLoadCallback: (data: any) => void) {
  if (!libraryFileList) return;
  
  try {
    libraryFileList.innerHTML = '<div class="cloud-dialog__loading">Ładowanie...</div>';
    
    const files = await listLibraryFiles();
    
    if (files.length === 0) {
      libraryFileList.innerHTML = '<div class="cloud-dialog__empty">Brak plików w bibliotece</div>';
      return;
    }
    
    // Sortuj pliki po nazwie
    files.sort();
    
    libraryFileList.innerHTML = '';
    
    for (const filename of files) {
      const item = document.createElement('div');
      item.className = 'cloud-file-item';
      
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
          onLoadCallback(data);
          cloudDialog?.close();
        } catch (err) {
          console.error('Nie udało się wczytać pliku:', err);
          alert('Nie udało się wczytać pliku z biblioteki.');
        }
      });
      
      actions.appendChild(loadBtn);
      item.appendChild(actions);
      
      libraryFileList.appendChild(item);
    }
  } catch (err) {
    console.error('Nie udało się pobrać listy biblioteki:', err);
    libraryFileList.innerHTML = '<div class="cloud-dialog__error">Nie udało się pobrać listy plików</div>';
  }
}

async function loadCloudList(onLoadCallback: (data: any) => void) {
  if (!cloudFileList) return;
  
  try {
    cloudFileList.innerHTML = '<div class="cloud-dialog__loading">Ładowanie...</div>';
    
    const keys = await listKeys();
    
    if (keys.length === 0) {
      cloudFileList.innerHTML = '<div class="cloud-dialog__empty">Brak plików w chmurze</div>';
      return;
    }
    
    // Sortuj pliki po nazwie
    keys.sort().reverse(); // Odwrotnie, żeby najnowsze były na górze
    
    cloudFileList.innerHTML = '';
    
    for (const key of keys) {
      const item = document.createElement('div');
      item.className = 'cloud-file-item';
      
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
          onLoadCallback(data);
          cloudDialog?.close();
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
      
      cloudFileList.appendChild(item);
    }
  } catch (err) {
    console.error('Nie udało się pobrać listy plików:', err);
    cloudFileList.innerHTML = '<div class="cloud-dialog__error">Nie udało się pobrać listy plików</div>';
  }
}
