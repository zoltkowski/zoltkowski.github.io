// Funkcjonalność zarządzania plikami w chmurze (Cloudflare KV)

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

let cloudDialog: HTMLDialogElement | null = null;
let cloudFileList: HTMLElement | null = null;

export function initCloudUI(onLoadCallback: (data: any) => void) {
  // Stwórz dialog jeśli nie istnieje
  if (!cloudDialog) {
    cloudDialog = document.createElement('dialog');
    cloudDialog.id = 'cloudDialog';
    cloudDialog.className = 'cloud-dialog';
    cloudDialog.innerHTML = `
      <div class="cloud-dialog__header">
        <h2>Pliki w chmurze</h2>
        <button class="cloud-dialog__close" type="button" aria-label="Zamknij">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div class="cloud-dialog__content">
        <div class="cloud-dialog__list" id="cloudFileList">
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
    
    cloudFileList = document.getElementById('cloudFileList');
  }
  
  // Otwórz dialog i załaduj listę plików
  cloudDialog.showModal();
  loadFileList(onLoadCallback);
}

async function loadFileList(onLoadCallback: (data: any) => void) {
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
          loadFileList(onLoadCallback);
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
