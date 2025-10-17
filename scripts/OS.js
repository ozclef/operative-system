 // OS.js - sistema principal
let zIndexCounter = 100, windowCount = 0;
const windowsStateKey = 'mi_os_windows_state';
let persistState = false;

// ------- Inicialización -------
document.addEventListener('DOMContentLoaded', () => {
  // reloj y fps
  setInterval(actualizarReloj, 1000);
  actualizarReloj();
  initFPS();

  // persist checkbox
  const chk = document.getElementById('persist-state');
  if (chk) {
    persistState = chk.checked;
    chk.addEventListener('change', () => {
      persistState = chk.checked;
      if (!persistState) localStorage.removeItem(windowsStateKey);
      savePositions();
    });
  }

  // registrar ventanas existentes en taskbar
  document.querySelectorAll('[data-window]').forEach(w => {
    if (!w.id) w.id = 'win-' + Math.random().toString(36).slice(2,8);
    registerWindowForTaskbar(w, { title: w.querySelector('.topbar span')?.textContent || w.id });
  });

  // restaurar posiciones
  const saved = localStorage.getItem(windowsStateKey);
  if (saved) {
    try {
      const obj = JSON.parse(saved);
      Object.keys(obj).forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.left = obj[id].left; el.style.top = obj[id].top; el.style.display = obj[id].display || ''; }
      });
    } catch (e) { console.warn('no se cargo estado', e) }
  }

  // terminal init
  initTerminal();
});

// ---------- Ventanas básicas ----------
function abrir(id){
  const el = document.getElementById(id);
  if (!el) return console.warn('No existe ventana', id);
  el.style.display = 'block';
  bringToFront(el);
  updateTaskActiveState();
}
function cerrar(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  savePositions();
  updateTaskActiveState();
}
function minimizar(id){
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  savePositions();
  updateTaskActiveState();
}
function bringToFront(el){ zIndexCounter++; el.style.zIndex = zIndexCounter; setActiveWindow(el.id); savePositions(); }

// ---------- Drag ----------
let dragData = null;
function startDrag(e,id){
  const el = document.getElementById(id); if(!el) return;
  bringToFront(el);
  const rect = el.getBoundingClientRect();
  dragData = { el, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
  e.preventDefault();
}
function onDrag(e){ if(!dragData) return; const {el,offsetX,offsetY} = dragData; el.style.left = (e.clientX - offsetX) + 'px'; el.style.top = (e.clientY - offsetY) + 'px'; }
function stopDrag(){ if(!dragData) return; document.removeEventListener('mousemove', onDrag); document.removeEventListener('mouseup', stopDrag); dragData = null; savePositions(); }
window.startDrag = startDrag;

// ---------- Dinámicas ----------
function crearVentana(titulo, htmlContenido){
  windowCount++;
  const id = 'vent-' + windowCount;
  const win = document.createElement('div'); win.className = 'ventana small'; win.id = id; win.setAttribute('data-window',''); win.style.display='block';
  win.style.left = (100 + windowCount*18) + 'px'; win.style.top = (100 + windowCount*18) + 'px'; win.style.zIndex = ++zIndexCounter;
  const top = document.createElement('div'); top.className='topbar'; top.onmousedown = e => startDrag(e,id);
  const span = document.createElement('span'); span.textContent = titulo;
  const ctr = document.createElement('div'); ctr.className='topbar-controls';
  const bMin = document.createElement('button'); bMin.textContent='—'; bMin.onclick = () => { win.style.display='none'; savePositions(); };
  const bClose = document.createElement('button'); bClose.textContent='✖'; bClose.onclick = () => { win.remove(); removeTaskButton(id); savePositions(); };
  ctr.append(bMin,bClose); top.append(span,ctr);
  const cont = document.createElement('div'); cont.className='contenido'; cont.innerHTML = htmlContenido;
  win.append(top,cont); document.body.appendChild(win);
  registerWindowForTaskbar(win,{title});
  savePositions();
  return id;
}
window.crearVentana = crearVentana;

// ---------- Taskbar ----------
const taskbarContainer = () => document.getElementById('taskbar-windows');
function registerWindowForTaskbar(winEl, opts = {}) {
  if (!winEl || !winEl.id) return;
  if (document.getElementById('task-btn-' + winEl.id)) return;
  const btn = document.createElement('button'); btn.className='task-btn'; btn.id = 'task-btn-' + winEl.id;
  const iconSpan = document.createElement('span'); iconSpan.className='icon'; iconSpan.innerHTML = opts.icon || '▣';
  const label = document.createElement('span'); label.className='label'; label.textContent = opts.title || (winEl.querySelector('.topbar span')?.textContent || winEl.id);
  btn.append(iconSpan,label);
  btn.onclick = () => toggleMinimize(winEl.id);
  btn.oncontextmenu = (e) => { e.preventDefault(); const choice = confirm('Cerrar "'+label.textContent+'"? Aceptar=cerrar, Cancelar=minimizar/restaurar'); if(choice){ cerrar(winEl.id); removeTaskButton(winEl.id);} else toggleMinimize(winEl.id); };
  taskbarContainer().appendChild(btn);
  updateTaskActiveState();
}
function removeTaskButton(winId){ const btn = document.getElementById('task-btn-' + winId); if(btn) btn.remove(); }
function toggleMinimize(winId){ const el=document.getElementById(winId); if(!el) return; if(el.style.display==='none' || getComputedStyle(el).display==='none'){ el.style.display='block'; bringToFront(el); setActiveWindow(winId); } else { el.style.display='none'; clearActiveWindow(winId); } savePositions(); updateTaskActiveState();}
function setActiveWindow(winId){ document.querySelectorAll('.task-btn').forEach(b=>b.classList.remove('active')); const b=document.getElementById('task-btn-'+winId); if(b) b.classList.add('active'); }
function clearActiveWindow(winId){ const b=document.getElementById('task-btn-'+winId); if(b) b.classList.remove('active'); }
function updateTaskActiveState(){ document.querySelectorAll('[data-window]').forEach(w=>{ if(!w.id) return; if(!document.getElementById('task-btn-'+w.id)) registerWindowForTaskbar(w,{title:w.querySelector('.topbar span')?.textContent||w.id}); }); const maxZ = getMaxZIndex(); document.querySelectorAll('[data-window]').forEach(w=>{ if(parseInt(w.style.zIndex||0,10)===maxZ) setActiveWindow(w.id); }); }
function getMaxZIndex(){ let max=0; document.querySelectorAll('[data-window]').forEach(w=>{ const z=parseInt(w.style.zIndex||0,10); if(z>max) max=z; }); return max; }
function mostrarEscritorio(){ const wins = document.querySelectorAll('[data-window]'); let anyVisible=false; wins.forEach(w=>{ if(w.style.display !== 'none' && getComputedStyle(w).display !== 'none') anyVisible=true; }); if(anyVisible){ wins.forEach(w=>{ w.dataset.prevDisplay = w.style.display || ''; w.style.display='none'; }); } else { wins.forEach(w=>{ w.style.display = w.dataset.prevDisplay || 'block'; delete w.dataset.prevDisplay; }); } updateTaskActiveState(); }

// ---------- Save / Restore ----------
function savePositions(){
  const nodes = document.querySelectorAll('[data-window]');
  const obj = {};
  nodes.forEach(n=>{ if(!n.id) return; obj[n.id] = { left: n.style.left || '', top: n.style.top || '', display: n.style.display || '' }; });
  if (persistState) localStorage.setItem(windowsStateKey, JSON.stringify(obj)); else sessionStorage.setItem(windowsStateKey, JSON.stringify(obj));
}

// ---------- Buscador rápido ----------
function quickSearch(){
  const q = document.getElementById('buscador').value.trim(); if(!q) return;
  const isUrl
</script>
</body>
</html>
### OS.js — versión completa y comentada
---->
   <script>
/* OS.js - Sistema principal completo
   Incluye:
   - Gestión de ventanas (abrir, cerrar, minimizar, crear dinámicas)
   - Drag con Pointer Events (compatible mouse/táctil)
   - Taskbar dinámico (botones por ventana, minimizar/restaurar)
   - Persistencia de posiciones (localStorage / sessionStorage)
   - Reloj zona Centro México y contador FPS
   - Navegador simple (iframe), buscador rápido
   - Lector de archivos (File API) y reproductor multimedia (audio/video)
   - Terminal emulada con comandos básicos
   - Hooks para registrar ventanas dinámicas en el taskbar
*/

/* ---------------------------
   Config y estado global
   --------------------------- */
let zIndexCounter = 100;
let windowCount = 0;
const windowsStateKey = 'mi_os_windows_state';
let persistState = false;
let dragData = null;

/* ---------------------------
   Inicialización DOMContentLoaded
   --------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  // Reloj y FPS
  setInterval(actualizarReloj, 1000);
  actualizarReloj();
  initFPS();

  // Persistencia: checkbox
  const chk = document.getElementById('persist-state');
  if (chk) {
    persistState = chk.checked;
    chk.addEventListener('change', () => {
      persistState = chk.checked;
      if (!persistState) localStorage.removeItem(windowsStateKey);
      savePositions();
    });
  }

  // Registrar ventanas estáticas en taskbar
  document.querySelectorAll('[data-window]').forEach(w => {
    if (!w.id) w.id = 'win-' + Math.random().toString(36).slice(2,8);
    registerWindowForTaskbar(w, { title: w.querySelector('.topbar span')?.textContent || w.id });
  });

  // Restaurar posiciones si existen
  const saved = localStorage.getItem(windowsStateKey) || sessionStorage.getItem(windowsStateKey);
  if (saved) {
    try {
      const obj = JSON.parse(saved);
      Object.keys(obj).forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.left = obj[id].left; el.style.top = obj[id].top; el.style.display = obj[id].display || ''; }
      });
    } catch (e) { console.warn('No se cargó estado:', e); }
  }

  // Inicializar terminal si existe
  initTerminal();
});

/* ---------------------------
   Ventanas: abrir / cerrar / minimizar
   --------------------------- */
function abrir(id) {
  const el = document.getElementById(id);
  if (!el) return console.warn('No existe ventana', id);
  el.style.display = 'block';
  bringToFront(el);
  updateTaskActiveState();
}
function cerrar(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  savePositions();
  updateTaskActiveState();
}
function minimizar(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.display = 'none';
  savePositions();
  updateTaskActiveState();
}
function bringToFront(el) {
  zIndexCounter++;
  el.style.zIndex = zIndexCounter;
  setActiveWindow(el.id);
  savePositions();
}

/* ---------------------------
   Drag universal (Pointer Events)
   - startDrag -> on pointerdown on topbar
   - onDrag -> pointermove
   - stopDrag -> pointerup/pointercancel
   --------------------------- */
function startDrag(e, id) {
  const evt = e.type.startsWith('touch') && e.touches ? e.touches[0] : e;
  const el = document.getElementById(id);
  if (!el) return;
  bringToFront(el);
  const rect = el.getBoundingClientRect();
  dragData = {
    el,
    startX: evt.clientX,
    startY: evt.clientY,
    origLeft: rect.left,
    origTop: rect.top
  };
  document.addEventListener('pointermove', onDrag);
  document.addEventListener('pointerup', stopDrag);
  document.addEventListener('pointercancel', stopDrag);
  e.preventDefault();
}
function onDrag(e) {
  if (!dragData) return;
  const dx = e.clientX - dragData.startX;
  const dy = e.clientY - dragData.startY;
  dragData.el.style.left = (dragData.origLeft + dx) + 'px';
  dragData.el.style.top  = (dragData.origTop  + dy) + 'px';
}
function stopDrag() {
  if (!dragData) return;
  document.removeEventListener('pointermove', onDrag);
  document.removeEventListener('pointerup', stopDrag);
  document.removeEventListener('pointercancel', stopDrag);
  dragData = null;
  savePositions();
}
// Exponer para HTML inline
window.startDrag = startDrag;

/* ---------------------------
   Crear ventanas dinámicas
   --------------------------- */
function crearVentana(titulo, htmlContenido) {
  windowCount++;
  const id = 'vent-' + windowCount;
  const win = document.createElement('div');
  win.className = 'ventana small';
  win.id = id;
  win.setAttribute('data-window','');
  win.style.display = 'block';
  win.style.left = (100 + windowCount * 18) + 'px';
  win.style.top = (100 + windowCount * 18) + 'px';
  win.style.zIndex = ++zIndexCounter;

  // Topbar
  const top = document.createElement('div');
  top.className = 'topbar';
  top.onpointerdown = e => startDrag(e, id);

  const span = document.createElement('span');
  span.textContent = titulo;

  const controls = document.createElement('div');
  controls.className = 'topbar-controls';

  const btnMin = document.createElement('button');
  btnMin.className = 'minimizar';
  btnMin.textContent = '—';
  btnMin.onclick = () => { win.style.display = 'none'; savePositions(); };

  const btnClose = document.createElement('button');
  btnClose.className = 'cerrar';
  btnClose.textContent = '✖';
  btnClose.onclick = () => { win.remove(); removeTaskButton(id); savePositions(); };

  controls.append(btnMin, btnClose);
  top.append(span, controls);

  const cont = document.createElement('div');
  cont.className = 'contenido';
  cont.innerHTML = htmlContenido;

  win.append(top, cont);
  document.body.appendChild(win);

  registerWindowForTaskbar(win, { title: titulo });
  savePositions();
  return id;
}
window.crearVentana = crearVentana;

/* ---------------------------
   Taskbar: registro y botones
   --------------------------- */
function taskbarContainer() { return document.getElementById('taskbar-windows'); }

function registerWindowForTaskbar(winEl, opts = {}) {
  if (!winEl || !winEl.id) return;
  if (document.getElementById('task-btn-' + winEl.id)) return;

  const btn = document.createElement('button');
  btn.className = 'task-btn';
  btn.id = 'task-btn-' + winEl.id;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'icon';
  iconSpan.innerHTML = opts.icon || '▣';

  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = opts.title || (winEl.querySelector('.topbar span')?.textContent || winEl.id);

  btn.append(iconSpan, label);
  btn.onclick = () => toggleMinimize(winEl.id);
  btn.oncontextmenu = (e) => {
    e.preventDefault();
    const choice = confirm('¿Cerrar ventana "' + label.textContent + '"? Aceptar = cerrar, Cancelar = minimizar/restaurar');
    if (choice) { cerrar(winEl.id); removeTaskButton(winEl.id); }
    else toggleMinimize(winEl.id);
  };

  taskbarContainer().appendChild(btn);
  updateTaskActiveState();
}

function removeTaskButton(winId) {
  const btn = document.getElementById('task-btn-' + winId);
  if (btn) btn.remove();
}
function toggleMinimize(winId) {
  const el = document.getElementById(winId);
  if (!el) return;
  if (el.style.display === 'none' || getComputedStyle(el).display === 'none') {
    el.style.display = 'block';
    bringToFront(el);
    setActiveWindow(winId);
  } else {
    el.style.display = 'none';
    clearActiveWindow(winId);
  }
  savePositions();
  updateTaskActiveState();
}
function setActiveWindow(winId) {
  document.querySelectorAll('.task-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('task-btn-' + winId);
  if (btn) btn.classList.add('active');
}
function clearActiveWindow(winId) {
  const btn = document.getElementById('task-btn-' + winId);
  if (btn) btn.classList.remove('active');
}
function updateTaskActiveState() {
  document.querySelectorAll('[data-window]').forEach(w => {
    if (!w.id) return;
    if (!document.getElementById('task-btn-' + w.id)) registerWindowForTaskbar(w, { title: w.querySelector('.topbar span')?.textContent || w.id });
  });
  const maxZ = getMaxZIndex();
  document.querySelectorAll('[data-window]').forEach(w => {
    if (parseInt(w.style.zIndex || 0, 10) === maxZ) setActiveWindow(w.id);
  });
}
function getMaxZIndex() {
  let max = 0;
  document.querySelectorAll('[data-window]').forEach(w => { const z = parseInt(w.style.zIndex || 0, 10); if (z > max) max = z; });
  return max;
}
function mostrarEscritorio() {
  const windows = document.querySelectorAll('[data-window]');
  let anyVisible = false;
  windows.forEach(w => { if (w.style.display !== 'none' && getComputedStyle(w).display !== 'none') anyVisible = true; });
  if (anyVisible) {
    windows.forEach(w => { w.dataset.prevDisplay = w.style.display || ''; w.style.display = 'none'; });
  } else {
    windows.forEach(w => { w.style.display = w.dataset.prevDisplay || 'block'; delete w.dataset.prevDisplay; });
  }
  updateTaskActiveState();
}

/* ---------------------------
   Save / Restore posiciones
   --------------------------- */
function savePositions() {
  const nodes = document.querySelectorAll('[data-window]');
  const obj = {};
  nodes.forEach(n => {
    if (!n.id) return;
    obj[n.id] = { left: n.style.left || '', top: n.style.top || '', display: n.style.display || '' };
  });
  if (persistState) localStorage.setItem(windowsStateKey, JSON.stringify(obj));
  else sessionStorage.setItem(windowsStateKey, JSON.stringify(obj));
}

/* ---------------------------
   Buscador rapido y navegador (iframe)
   --------------------------- */
function quickSearch() {
  const q = document.getElementById('buscador').value.trim();
  if (!q) return;
  const isUrl = /^[a-zA-Z0-9\-]+\./.test(q) || /^https?:\/\//i.test(q);
  abrir('browser');
  const input = document.getElementById('url-browser');
  input.value = isUrl ? (q.startsWith('http') ? q : 'https://' + q) : ('https://www.google.com/search?q=' + encodeURIComponent(q));
  cargarSitio();
}
function cargarSitio() {
  const input = document.getElementById('url-browser');
  const visor  = document.getElementById('visor-browser');
  if (!input || !visor) return;
  let url = input.value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  // carga con ligero delay para evitar bloqueo inmediato
  visor.src = 'about:blank';
  setTimeout(() => { try { visor.src = url; } catch (e) { visor.src = 'about:blank'; } }, 50);
}
window.quickSearch = quickSearch;
window.cargarSitio = cargarSitio;

/* ---------------------------
   File API: leer archivos y directorios (si soportado)
   --------------------------- */
function leerArchivos(e) {
  const files = e.target.files;
  const list = document.getElementById('file-list');
  if (!list) return;
  list.innerHTML = '';
  Array.from(files).forEach(f => {
    const item = document.createElement('div');
    item.className = 'file-item';
    const meta = document.createElement('div');
    meta.innerHTML = `${f.name} <small style="color:#9aa">(${Math.round(f.size/1024)} KB)</small>`;
    const btns = document.createElement('div');
    const btnView = document.createElement('button');
    btnView.textContent = 'Abrir';
    btnView.onclick = () => {
      if (f.type.startsWith('video/')) {
        cargarMediaFromFile(f);
        abrir('media');
      } else if (f.type.startsWith('audio/')) {
        cargarMediaFromFile(f);
        abrir('media');
      } else if (f.type.startsWith('text/') || f.name.endsWith('.md') || f.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = () => crearVentana(f.name, `<pre style="white-space:pre-wrap;max-height:240px;overflow:auto;">${escapeHtml(reader.result)}</pre>`);
        reader.readAsText(f);
      } else {
        alert('Tipo no soportado para vista previa. Puedes reproducir audio/video desde Reproductor.');
      }
    };
    btns.appendChild(btnView);
    item.append(meta, btns);
    list.appendChild(item);
  });
}
window.leerArchivos = leerArchivos;

async function openDirectory() {
  // File System Access API (experimental)
  if (!window.showDirectoryPicker) return alert('Abrir carpeta no soportado en este navegador');
  try {
    const dir = await window.showDirectoryPicker();
    const list = document.getElementById('file-list');
    list.innerHTML = '';
    for await (const [name, handle] of dir) {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.textContent = name;
      list.appendChild(item);
    }
  } catch (e) {
    console.warn('Directorio no abierto', e);
  }
}

/* ---------------------------
   Reproductor multimedia (playlist + object URLs)
   --------------------------- */
const playlist = [];
function cargarMedia(e) {
  const files = e.target.files;
  Array.from(files).forEach(f => {
    const url = URL.createObjectURL(f);
    playlist.push({ src: url, name: f.name, type: f.type, file: f });
  });
  renderPlaylist();
}
function renderPlaylist() {
  const container = document.getElementById('playlist');
  if (!container) return;
  container.innerHTML = '';
  playlist.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = 'play-item';
    el.innerHTML = `<div>${escapeHtml(item.name)}</div>`;
    const controls = document.createElement('div');
    const btnPlay = document.createElement('button');
    btnPlay.textContent = '▶';
    btnPlay.onclick = () => playIndex(idx);
    const btnRemove = document.createElement('button');
    btnRemove.textContent = '✖';
    btnRemove.onclick = () => { URL.revokeObjectURL(item.src); playlist.splice(idx,1); renderPlaylist(); };
    controls.append(btnPlay, btnRemove);
    el.appendChild(controls);
    container.appendChild(el);
  });
}
function playIndex(i) {
  const item = playlist[i];
  if (!item) return;
  const video = document.getElementById('video-player');
  const audio = document.getElementById('audio-player');
  if (item.type.startsWith('video/')) {
    audio.style.display = 'none';
    video.style.display = 'block';
    video.src = item.src;
    video.play();
  } else {
    video.style.display = 'none';
    audio.style.display = 'block';
    audio.src = item.src;
    audio.play();
  }
}
// helper: cargar un solo archivo en media desde file-object
function cargarMediaFromFile(file) {
  playlist.length = 0;
  const url = URL.createObjectURL(file);
  playlist.push({ src: url, name: file.name, type: file.type, file });
  renderPlaylist();
  playIndex(0);
}
window.cargarMedia = cargarMedia;

/* ---------------------------
   Terminal emulada simple
   - comandos: help, echo, date, ls, cat, touch, rm, clear, runjs, save, load, ssh (placeholder)
   --------------------------- */
const virtualFS = { '/home/user/readme.txt': 'Bienvenido a tu OS Web\n' };
let termHistory = [], histIndex = 0;

function initTerminal() {
  const input = document.getElementById('term-input');
  if (!input) return;
  appendLine('Bienvenido a la terminal emulada. escribe "help" para ver comandos.');
  input.focus();
  input.addEventListener('keydown', onTermKey);
}
function onTermKey(e) {
  const input = document.getElementById('term-input');
  if (!input) return;
  if (e.key === 'Enter') {
    const raw = input.value;
    input.value = '';
    termHistory.push(raw);
    histIndex = termHistory.length;
    appendLine('user@webos:~$ ' + raw);
    handleCommand(raw.trim());
  } else if (e.key === 'ArrowUp') {
    if (termHistory.length && histIndex > 0) input.value = termHistory[--histIndex];
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (termHistory.length && histIndex < termHistory.length - 1) input.value = termHistory[++histIndex] || '';
    e.preventDefault();
  }
}
function appendLine(txt) {
  const o = document.getElementById('term-output');
  if (!o) return;
  const el = document.createElement('div');
  el.className = 'term-line';
  el.textContent = txt;
  o.appendChild(el);
  o.scrollTop = o.scrollHeight;
}
async function handleCommand(input) {
  if (!input) return;
  const parts = input.split(' ').filter(Boolean);
  const cmd = parts[0];
  const args = parts.slice(1);

  switch (cmd) {
    case 'help':
      appendLine('Comandos: help, echo, date, ls, cat, touch, rm, clear, runjs, save, load, ssh');
      break;
    case 'echo':
      appendLine(args.join(' '));
      break;
    case 'date':
      appendLine(new Date().toString());
      break;
    case 'ls': {
      const path = args[0] || '/home/user';
      const list = Object.keys(virtualFS).filter(p => p.startsWith(path)).map(p => p.replace(path + '/', '')).filter(Boolean);
      appendLine(list.length ? list.join('  ') : '(vacío)');
      break;
    }
    case 'cat': {
      const file = resolvePath(args[0]);
      if (virtualFS[file]) appendLine(virtualFS[file]);
      else appendLine('cat: archivo no encontrado: ' + file);
      break;
    }
    case 'touch': {
      const file = resolvePath(args[0] || ('/home/user/nuevo' + Date.now() + '.txt'));
      virtualFS[file] = virtualFS[file] || '';
      appendLine('Archivo creado: ' + file);
      break;
    }
    case 'rm': {
      const file = resolvePath(args[0]||'');
      if (virtualFS[file]) { delete virtualFS[file]; appendLine('Eliminado ' + file); }
      else appendLine('rm: archivo no existe');
      break;
    }
    case 'clear':
      document.getElementById('term-output').innerHTML = '';
      break;
    case 'runjs': {
      const code = args.join(' ');
      try { const res = eval(code); appendLine(String(res)); }
      catch (err) { appendLine('Error JS: ' + err.message); }
      break;
    }
    case 'save': {
      const key = args[0] || 'fs';
      localStorage.setItem(key, JSON.stringify(virtualFS));
      appendLine('FS guardado en localStorage key=' + key);
      break;
    }
    case 'load': {
      const key = args[0] || 'fs';
      const data = localStorage.getItem(key);
      if (data) { Object.assign(virtualFS, JSON.parse(data)); appendLine('FS cargado desde ' + key); }
      else appendLine('No existe key ' + key);
      break;
    }
    case 'ssh':
      appendLine('ssh: esta acción requiere un backend. Ver opciones: WebContainer o WebSocket+Docker.');
      break;
    default:
      appendLine('comando no encontrado: ' + cmd);
  }
}
function resolvePath(p) {
  if (!p) return '/home/user';
  if (p.startsWith('/')) return p;
  return '/home/user/' + p;
}

/* ---------------------------
   Reloj (México Centro)
   --------------------------- */
function actualizarReloj() {
  const opts = { timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12:false, day:'2-digit', month:'2-digit', year:'numeric' };
  const ahora = new Intl.DateTimeFormat('es-MX', opts).format(new Date());
  const el = document.getElementById('reloj');
  if (el) el.textContent = ahora;
}

/* ---------------------------
   FPS contador ligero
   --------------------------- */
let fps = 0;
function initFPS() {
  let last = performance.now(), frames = 0;
  function raf(t) {
    frames++;
    if (t - last >= 1000) { fps = frames; frames = 0; last = t; const e = document.getElementById('fps'); if (e) e.textContent = fps + ' FPS'; }
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);
}

/* ---------------------------
   Helpers
   --------------------------- */
function escapeHtml(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ---------------------------
   Ejemplo: llamada remota (placeholder)
   - runRemoteExample() muestra cómo invocar un backend WebSocket
   --------------------------- */
function runRemoteExample() {
  appendLine('Intentando ejecutar "npm --version" de forma remota (ejemplo).');
  // Este es solo un ejemplo: tu backend debe implementar la API WebSocket adecuada.
  // Aquí mostramos el flujo de cliente
  try {
    const ws = new WebSocket('wss://tu-backend.example/exec'); // reemplazar por tu endpoint
    ws.onopen = () => {
      ws.send(JSON.stringify({ exec: { cmd: 'npm --version', cwd: '/workspace' } }));
    };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === 'stdout' || m.type === 'stderr') appendLine(m.data);
      if (m.type === 'exit') appendLine('Proceso finalizado con código ' + m.code);
    };
    ws.onerror = err => appendLine('WebSocket error: ' + String(err));
  } catch (e) {
    appendLine('No hay backend conectado. Configura WebSocket+Docker o usa WebContainers.');
  }
}
window.runRemoteExample = runRemoteExample;

/* ---------------------------
   Exportar funciones globales usadas en HTML inline
   --------------------------- */
window.abrir = abrir;
window.cerrar = cerrar;
window.minimizar = minimizar;
window.crearVentana = crearVentana;
window.mostrarEscritorio = mostrarEscritorio;

/* ---------------------------
   Registrar override de crearVentana si ya existía (compat)
   --------------------------- */
if (window.crearVentana && window.crearVentana._wrapped !== true) {
  // si otro crearVentana existía, no sobrescribimos; lo dejamos.
  // (En nuestra versión ya hemos definido crearVentana arriba.)
}
