/* =========================================================================
 * Urban PSI — Gestión de Incidencias v3
 * Notificaciones · Postulación con presupuesto · Chart.js
 * ========================================================================= */

'use strict';

/* ---------- Constantes ---------- */
const STORAGE_KEY = 'urban_psi_state_v5';
const SESSION_KEY = 'urban_psi_session_v5';

const CRITICALITIES  = ['Baja', 'Normal', 'Alta', 'Urgente'];
const STATUSES       = ['Pendiente', 'En Proceso', 'Finalizada', 'Requiere Revisión'];
const PROVIDER_TYPES = ['autonomo', 'empresa'];

const ROLE_LABELS = { admin: 'Administrador', provider: 'Proveedor' };
const TYPE_LABELS = { autonomo: 'Autónomo', empresa: 'Empresa' };

const DOC_STATUSES = {
  en_revision: 'En revisión',
  aprobado:    'Aprobado',
  rechazado:   'Rechazado'
};

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/* ---------- Datos por defecto (semilla) ---------- */
const NOW = Date.now();

/* ⚠️ DEMO — contraseñas de acceso ficticias solo para entorno de presentación */
const DEFAULT_USERS = [
  { id: 'u-admin', username: 'admin', password: '3016', role: 'admin',
    name: 'Administrador Demo', type: null, email: 'admin@demo-urbanpsi.test',
    phone: '', taxId: '', createdAt: NOW },
  { id: 'u-p1', username: 'instalaciones_acme', password: '1234', role: 'provider',
    name: 'Instalaciones ACME S.L.', type: 'empresa', email: 'contacto@acme-simulacion.test',
    phone: '+34 634 000 001', taxId: 'B00000001', createdAt: NOW },
  { id: 'u-p2', username: 'mantenimientos_omega', password: '1234', role: 'provider',
    name: 'Mantenimientos Omega S.A.', type: 'autonomo', email: 'info@omega-simulacion.test',
    phone: '+34 611 000 002', taxId: '00000002Z', createdAt: NOW }
];

/* ⚠️ DEMO — incidencias totalmente ficticias para entorno de presentación */
const DEFAULT_INCIDENTS = [
  {
    id: 'INC-001',
    title: 'Revisión de extintores CO₂ — Planta 2',
    address: 'Polígono Industrial de la Simulación, Nave 14-B',
    description: 'Verificación periódica de extintores CO₂ en Planta 2. Dos unidades presentan presión fuera de rango. Requiere recarga y precinto.',
    criticality: 'Urgente',
    status: 'Pendiente',
    assignedProviderId: null,
    createdBy: 'u-admin',
    createdAt: NOW - 86_400_000 * 2,
    updatedAt: NOW - 86_400_000 * 2,
    progress: 0,
    applicants: [],
    applications: [],
    messages: [],
    budgets: [],
    invoices: []
  },
  {
    id: 'INC-002',
    title: 'Detector de humos sin respuesta — Pasillo Norte',
    address: 'Calle de las Pruebas, 42, Edificio Demo — Planta Baja',
    description: 'Detector óptico ref. DH-204 sin señal en test manual. Posible fallo de sensor o pérdida de alimentación. Inspeccionar cableado y unidad central.',
    criticality: 'Normal',
    status: 'En Proceso',
    assignedProviderId: 'u-p2',
    createdBy: 'u-admin',
    createdAt: NOW - 86_400_000 * 5,
    updatedAt: NOW - 3_600_000,
    progress: 40,
    applicants: ['u-p2'],
    applications: [{ providerId: 'u-p2', amount: 480, note: 'Incluye sustitución de sensor y revisión de central.', appliedAt: NOW - 86_400_000 * 4 }],
    messages: [
      { from: 'u-admin', text: 'Verificar también el módulo de la central Notifier antes de reemplazar el detector.', at: NOW - 3_600_000 }
    ],
    budgets: [],
    invoices: []
  },
  {
    id: 'INC-003',
    title: 'Mantenimiento anual rociadores — Zona Almacén',
    address: 'Avda. de la Demostración, 99 — Nave Almacén Central',
    description: 'Revisión anual obligatoria del sistema de rociadores automáticos. Comprobar válvulas de control, cabezas rociadores y alarma de flujo.',
    criticality: 'Alta',
    status: 'Finalizada',
    assignedProviderId: 'u-p1',
    createdBy: 'u-admin',
    createdAt: NOW - 86_400_000 * 15,
    updatedAt: NOW - 86_400_000 * 3,
    progress: 100,
    applicants: ['u-p1'],
    applications: [{ providerId: 'u-p1', amount: 1200, note: 'Revisión completa según normativa UNE-EN 12845.', appliedAt: NOW - 86_400_000 * 14 }],
    messages: [
      { from: 'u-p1', text: 'Trabajo completado. Todas las cabezas verificadas. Certificado adjunto.', at: NOW - 86_400_000 * 3 }
    ],
    budgets: [],
    invoices: []
  }
];

/* ---------- Estado ---------- */
const state = {
  users: [],
  incidents: [],
  notifications: [],
  currentUser: null,
  filters: {
    admin:    { q: '', status: '', criticality: '', assigned: '' },
    provider: { q: '', criticality: '' }
  },
  ui: { adminTab: 'dashboard', providerTab: 'dashboard', editingUserId: null }
};

/* ---------- Persistencia ---------- */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      state.users         = Array.isArray(d.users)         ? d.users         : structuredClone(DEFAULT_USERS);
      state.incidents     = Array.isArray(d.incidents)     ? d.incidents     : structuredClone(DEFAULT_INCIDENTS);
      state.notifications = Array.isArray(d.notifications) ? d.notifications : [];
      state.incidents.forEach(i => {
        if (!Array.isArray(i.applicants))   i.applicants   = [];
        if (!Array.isArray(i.applications)) i.applications = [];
        if (!Array.isArray(i.budgets))      i.budgets      = [];
        if (!Array.isArray(i.invoices))     i.invoices     = [];
        if (typeof i.progress !== 'number') i.progress     = 0;
        if (!i.criticality && i.priority)   i.criticality  = i.priority;
      });
    } else {
      state.users         = structuredClone(DEFAULT_USERS);
      state.incidents     = structuredClone(DEFAULT_INCIDENTS);
      state.notifications = [];
      saveState();
    }
  } catch (err) {
    console.warn('Estado corrupto, usando semilla.', err);
    state.users         = structuredClone(DEFAULT_USERS);
    state.incidents     = structuredClone(DEFAULT_INCIDENTS);
    state.notifications = [];
  }

  try {
    const sid = sessionStorage.getItem(SESSION_KEY);
    if (sid) state.currentUser = state.users.find(u => u.id === sid) || null;
  } catch (_) {}
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      users: state.users, incidents: state.incidents, notifications: state.notifications
    }));
  } catch (err) {
    console.error('Error guardando:', err);
    toast('No se pudo guardar (cuota llena). Reduce archivos adjuntos.', 'error');
  }
}

function saveSession() {
  try {
    if (state.currentUser) sessionStorage.setItem(SESSION_KEY, state.currentUser.id);
    else                   sessionStorage.removeItem(SESSION_KEY);
  } catch (_) {}
}

/* ---------- Utilidades ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const uid = (prefix = 'id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function findUser(id)    { return state.users.find(u => u.id === id) || null; }
function findIncident(id){ return state.incidents.find(i => i.id === id) || null; }
function userName(id)    { return findUser(id)?.name || 'Usuario'; }
function providers()     { return state.users.filter(u => u.role === 'provider'); }
function isAdmin()       { return state.currentUser?.role === 'admin'; }
function myId()          { return state.currentUser?.id; }

function nextIncidentId() {
  const max = state.incidents
    .map(i => parseInt(String(i.id).replace('INC-', ''), 10))
    .filter(Number.isFinite)
    .reduce((a, b) => Math.max(a, b), 0);
  return `INC-${String(max + 1).padStart(3, '0')}`;
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function relativeTime(ts) {
  if (!ts) return '';
  const diff  = Date.now() - ts;
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  < 1)  return 'ahora';
  if (mins  < 60) return `hace ${mins} min`;
  if (hours < 24) return `hace ${hours} h`;
  if (days  < 30) return `hace ${days} d`;
  return formatDate(ts);
}

function ageDays(ts) {
  return ts ? Math.floor((Date.now() - ts) / 86_400_000) : 0;
}

function slug(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-');
}

function fmtBytes(n) {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsDataURL(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

/* ---------- Masking de datos sensibles (FASE 1) ---------- */
function maskEmail(email) {
  if (!email || !email.includes('@')) return '—';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 3)}***@${domain}`;
}

function maskPhone(phone) {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return phone.slice(0, 7) + '***' + phone.slice(-2);
}

/* ---------- Modal simulación de servidor (FASE 2) ---------- */
function showServerSimModal(action = 'Operación completada') {
  let overlay = $('#simModal');
  if (!overlay) return;
  $('#simModalMsg').textContent = `${action} con éxito en el entorno de pruebas.`;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  const close = () => {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  };
  $('#simModalClose').onclick = close;
  overlay.onclick = e => { if (e.target === overlay) close(); };
  clearTimeout(overlay._autoClose);
  overlay._autoClose = setTimeout(close, 6000);
}

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(message, type = 'info') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className   = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

/* ========================================================================
 * NOTIFICACIONES
 * ====================================================================== */
function addNotification(toUserId, message, type = 'info', incidentId = null) {
  state.notifications.unshift({
    id: uid('notif'), toUserId, message, type, incidentId, read: false, at: Date.now()
  });
  if (state.notifications.length > 60) state.notifications.length = 60;
  saveState();
  renderNotifBadge();
}

function myNotifications() {
  return state.notifications.filter(n => n.toUserId === myId());
}

function renderNotifBadge() {
  const badge = $('#notifBadge');
  if (!badge) return;
  const unread = myNotifications().filter(n => !n.read).length;
  if (unread > 0) {
    badge.textContent = unread > 9 ? '9+' : String(unread);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
  // Actualizar pill de la pestaña
  const total = myNotifications().length;
  const ap = $('#adminNotifCount');
  const pp = $('#providerNotifCount');
  if (ap) ap.textContent = unread > 0 ? String(unread) : String(total);
  if (pp) pp.textContent = unread > 0 ? String(unread) : String(total);
}

function renderNotifPanel() {
  const panel = $('#notifPanel');
  if (!panel) return;
  panel.innerHTML = '';
  const notifs = myNotifications();

  const header = document.createElement('div');
  header.className = 'notif-header';
  header.innerHTML = '<span>Notificaciones</span>';
  if (notifs.some(n => !n.read)) {
    const btn = document.createElement('button');
    btn.className   = 'notif-clear-btn';
    btn.textContent = 'Marcar todo como leído';
    btn.onclick = e => {
      e.stopPropagation();
      notifs.forEach(n => { n.read = true; });
      saveState(); renderNotifBadge(); renderNotifPanel();
    };
    header.appendChild(btn);
  }
  panel.appendChild(header);

  if (!notifs.length) {
    const em = document.createElement('div');
    em.className = 'notif-empty';
    em.textContent = 'No tienes notificaciones.';
    panel.appendChild(em);
    return;
  }

  notifs.forEach(n => {
    const item = document.createElement('div');
    item.className = `notif-item ${n.read ? '' : 'unread'}`;
    item.onclick   = () => {
      n.read = true; saveState(); renderNotifBadge(); renderNotifPanel();
      if (n.incidentId) navigateToIncident(n.incidentId);
      panel.classList.add('hidden');
    };
    const dot  = document.createElement('div');
    dot.className  = `notif-dot ${n.read ? 'read' : ''}`;
    const text = document.createElement('div'); text.className = 'notif-text';
    text.textContent = n.message;
    const time = document.createElement('div'); time.className = 'notif-time';
    time.textContent = relativeTime(n.at);
    text.appendChild(time);
    item.append(dot, text);
    panel.appendChild(item);
  });
}

function navigateToIncident(incidentId) {
  if (isAdmin()) {
    state.filters.admin.q = incidentId;
    switchAdminTab('incidents');
    const q = $('#adminFilterQ'); if (q) q.value = incidentId;
    renderAdminIncidents();
  } else {
    state.filters.provider.q = incidentId;
    const q = $('#providerFilterQ'); if (q) q.value = incidentId;
    switchProviderTab('mine');
    renderProviderLists();
  }
}

/* ========================================================================
 * PÁGINA COMPLETA DE NOTIFICACIONES (tab)
 * ====================================================================== */
function renderNotificationsTab(containerId) {
  const container = $('#' + containerId);
  container.innerHTML = '';

  const notifs = myNotifications();
  const unread = notifs.filter(n => !n.read).length;

  const wrap = document.createElement('div');
  wrap.className = 'notif-page';

  const header = document.createElement('div');
  header.className = 'notif-page-header';
  const title = document.createElement('h3');
  title.textContent = `Notificaciones${unread > 0 ? ` · ${unread} sin leer` : ''}`;
  header.appendChild(title);

  if (unread > 0) {
    const btn = document.createElement('button');
    btn.className   = 'btn btn-outline btn-sm';
    btn.textContent = 'Marcar todo como leído';
    btn.onclick = () => {
      notifs.forEach(n => { n.read = true; });
      saveState(); renderNotifBadge(); renderNotificationsTab(containerId);
    };
    header.appendChild(btn);
  }
  wrap.appendChild(header);

  if (!notifs.length) {
    wrap.appendChild(emptyState('No tienes notificaciones todavía.'));
    container.appendChild(wrap);
    return;
  }

  const list = document.createElement('div');
  list.className = 'notif-list';

  notifs.forEach(n => {
    const card = document.createElement('div');
    card.className = `notif-card ${n.read ? '' : 'unread-card'}`;
    card.onclick = () => {
      n.read = true; saveState(); renderNotifBadge();
      if (n.incidentId) { navigateToIncident(n.incidentId); }
      else { renderNotificationsTab(containerId); }
    };

    const dot  = document.createElement('div');
    dot.className = `notif-card-dot ${n.read ? 'read' : ''}`;

    const body = document.createElement('div'); body.className = 'notif-card-body';
    const msg  = document.createElement('div'); msg.className  = 'notif-card-msg';
    msg.textContent = n.message;
    const meta = document.createElement('div'); meta.className = 'notif-card-meta';
    const time = document.createElement('span'); time.className = 'notif-card-time';
    time.textContent = relativeTime(n.at); time.title = formatDate(n.at);
    meta.appendChild(time);
    if (n.incidentId) {
      const inc = document.createElement('span'); inc.className = 'notif-card-inc';
      inc.textContent = n.incidentId;
      meta.appendChild(inc);
    }
    body.append(msg, meta);
    card.append(dot, body);
    list.appendChild(card);
  });

  wrap.appendChild(list);
  container.appendChild(wrap);

  // Auto-leer tras 2 s
  setTimeout(() => {
    let changed = false;
    notifs.forEach(n => { if (!n.read) { n.read = true; changed = true; } });
    if (changed) { saveState(); renderNotifBadge(); }
  }, 2000);
}

/* ---------- Vistas ---------- */
const views = {
  login:    () => $('#loginView'),
  app:      () => $('#appView'),
  admin:    () => $('#adminView'),
  provider: () => $('#providerView'),
  session:  () => $('#sessionInfo')
};

/* ---------- Auth ---------- */
function login() {
  const username = $('#usernameInput').value.trim();
  const password = $('#passwordInput').value;
  if (!username || !password) return toast('Introduce usuario y contraseña', 'error');
  const user = state.users.find(u => u.username === username && u.password === password);
  if (!user) return toast('Credenciales inválidas', 'error');
  state.currentUser = user;
  saveSession();
  $('#passwordInput').value = '';
  state.ui.adminTab    = 'dashboard';
  state.ui.providerTab = 'dashboard';
  render();
  toast(`Bienvenido, ${user.name}`, 'success');
}

function logout() {
  state.currentUser = null;
  saveSession();
  render();
}

/* ---------- Gestión de usuarios (admin) ---------- */
function validateUserForm(data, ignoreId = null) {
  if (!data.name)     return 'Nombre obligatorio';
  if (!data.username) return 'Usuario obligatorio';
  if (!data.password) return 'Contraseña obligatoria';
  if (!PROVIDER_TYPES.includes(data.type)) return 'Tipo inválido';
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Email inválido';
  const dup = state.users.find(u => u.username === data.username && u.id !== ignoreId);
  if (dup) return 'Ese usuario ya existe';
  return null;
}

function submitUserForm(ev) {
  ev?.preventDefault();
  const id   = state.ui.editingUserId;
  const data = {
    name:     $('#userName').value.trim(),
    type:     $('#userType').value,
    username: $('#userUsername').value.trim(),
    password: $('#userPassword').value,
    email:    $('#userEmail').value.trim(),
    phone:    $('#userPhone').value.trim(),
    taxId:    $('#userTaxId').value.trim()
  };
  const err = validateUserForm(data, id);
  if (err) return toast(err, 'error');

  if (id) {
    const u = findUser(id);
    if (!u) return toast('Usuario no encontrado', 'error');
    Object.assign(u, data);
    showServerSimModal('Proveedor actualizado en el servidor simulado');
  } else {
    state.users.push({ id: uid('u'), role: 'provider', createdAt: Date.now(), ...data });
    showServerSimModal('Proveedor registrado en el servidor simulado');
  }
  saveState(); resetUserForm(); renderUsers();
}

function resetUserForm() {
  state.ui.editingUserId = null;
  ['#userName','#userUsername','#userPassword','#userEmail','#userPhone','#userTaxId']
    .forEach(s => { const el = $(s); if (el) el.value = ''; });
  if ($('#userType'))          $('#userType').value = 'autonomo';
  if ($('#userFormTitle'))     $('#userFormTitle').textContent = 'Nuevo proveedor';
  if ($('#cancelEditUserBtn')) $('#cancelEditUserBtn').classList.add('hidden');
  if ($('#submitUserBtn'))     $('#submitUserBtn').textContent = 'Crear proveedor';
}

function editUser(id) {
  const u = findUser(id); if (!u) return;
  state.ui.editingUserId   = id;
  $('#userName').value      = u.name     || '';
  $('#userType').value      = u.type     || 'autonomo';
  $('#userUsername').value  = u.username || '';
  $('#userPassword').value  = u.password || '';
  $('#userEmail').value     = u.email    || '';
  $('#userPhone').value     = u.phone    || '';
  $('#userTaxId').value     = u.taxId    || '';
  $('#userFormTitle').textContent = `Editar: ${u.name}`;
  $('#cancelEditUserBtn').classList.remove('hidden');
  $('#submitUserBtn').textContent = 'Guardar cambios';
  switchAdminTab('users');
  $('#userName').focus();
}

function deleteUser(id) {
  const u = findUser(id); if (!u) return;
  const assigned = state.incidents.filter(i => i.assignedProviderId === id);
  if (assigned.length) {
    if (!confirm(`${u.name} está asignado a ${assigned.length} incidencia(s). ¿Desasignar y eliminar?`)) return;
    assigned.forEach(i => { i.assignedProviderId = null; i.status = 'Pendiente'; i.updatedAt = Date.now(); });
  } else if (!confirm(`¿Eliminar a ${u.name}?`)) return;
  state.users = state.users.filter(x => x.id !== id);
  if (state.ui.editingUserId === id) resetUserForm();
  saveState(); renderUsers();
  toast('Usuario eliminado', 'success');
}

/* ---------- Filtros ---------- */
function applyAdminFilters(list) {
  const f = state.filters.admin;
  const q = f.q.toLowerCase();
  return list.filter(i => {
    if (q && !(i.title+' '+i.description+' '+i.address+' '+i.id).toLowerCase().includes(q)) return false;
    if (f.status      && i.status      !== f.status)      return false;
    if (f.criticality && i.criticality !== f.criticality) return false;
    if (f.assigned === 'unassigned' && i.assignedProviderId !== null) return false;
    if (f.assigned && f.assigned !== 'unassigned' && i.assignedProviderId !== f.assigned) return false;
    return true;
  });
}

function applyProviderFilters(list) {
  const f = state.filters.provider;
  const q = f.q.toLowerCase();
  return list.filter(i => {
    if (q && !(i.title+' '+i.description+' '+i.address+' '+i.id).toLowerCase().includes(q)) return false;
    if (f.criticality && i.criticality !== f.criticality) return false;
    return true;
  });
}

/* ---------- Render principal ---------- */
function render() {
  const u = state.currentUser;
  if (!u) {
    views.login().classList.remove('hidden');
    views.app().classList.add('hidden');
    views.session().classList.add('hidden');
    return;
  }
  views.login().classList.add('hidden');
  views.app().classList.remove('hidden');
  views.session().classList.remove('hidden');
  $('#sessionText').textContent = `${u.name} (${ROLE_LABELS[u.role]})`;
  renderNotifBadge();

  if (u.role === 'admin') {
    views.admin().classList.remove('hidden');
    views.provider().classList.add('hidden');
    switchAdminTab(state.ui.adminTab);
  } else {
    views.admin().classList.add('hidden');
    views.provider().classList.remove('hidden');
    switchProviderTab(state.ui.providerTab);
  }
}

/* ---------- Tabs ---------- */
function switchAdminTab(tab) {
  state.ui.adminTab = tab;
  $$('[data-admin-tab]').forEach(b => {
    const active = b.dataset.adminTab === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  ['dashboard','incidents','create','users','notif'].forEach(t => {
    $(`#admin${t[0].toUpperCase()+t.slice(1)}Tab`)?.classList.toggle('hidden', t !== tab);
  });
  if (tab === 'dashboard') renderAdminDashboard();
  if (tab === 'incidents') { renderAdminFilters(); renderAdminIncidents(); }
  if (tab === 'users')     renderUsers();
  if (tab === 'notif')     renderNotificationsTab('adminNotifTab');
}

function switchProviderTab(tab) {
  state.ui.providerTab = tab;
  $$('[data-provider-tab]').forEach(b => {
    const active = b.dataset.providerTab === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  ['dashboard','available','mine','notif'].forEach(t => {
    $(`#provider${t[0].toUpperCase()+t.slice(1)}Tab`)?.classList.toggle('hidden', t !== tab);
  });
  if (tab === 'dashboard')                   renderProviderDashboard();
  if (tab === 'available' || tab === 'mine') { renderProviderFilters(); renderProviderLists(); }
  if (tab === 'notif')                       renderNotificationsTab('providerNotifTab');
}

/* ---------- Crear incidencia ---------- */
function createIncident() {
  const title       = $('#newTitle').value.trim();
  const address     = $('#newAddress').value.trim();
  const description = $('#newDescription').value.trim();
  const criticality = $('#newCriticality').value;
  const rgpd        = $('#rgpdCheck');

  if (!title || !address || !description) return toast('Completa todos los campos', 'error');
  if (title.length > 120) return toast('Título demasiado largo', 'error');
  if (!CRITICALITIES.includes(criticality)) return toast('Criticidad inválida', 'error');
  if (rgpd && !rgpd.checked) return toast('Debes aceptar los términos de privacidad (RGPD) para continuar', 'error');

  const now    = Date.now();
  const newInc = {
    id: nextIncidentId(), title, address, description, criticality,
    status: 'Pendiente', assignedProviderId: null,
    createdBy: myId(), createdAt: now, updatedAt: now,
    progress: 0, applicants: [], applications: [], messages: [], budgets: [], invoices: []
  };
  state.incidents.unshift(newInc);

  providers().forEach(p => addNotification(
    p.id, `Nueva incidencia disponible: ${title} (${criticality})`, 'info', newInc.id
  ));

  saveState();
  ['#newTitle','#newAddress','#newDescription'].forEach(s => { $(s).value = ''; });
  $('#newCriticality').value = 'Normal';
  if (rgpd) rgpd.checked = false;

  showServerSimModal('Incidencia registrada en el servidor simulado');
  switchAdminTab('incidents');
}

/* ========================================================================
 * DASHBOARDS
 * ====================================================================== */
let adminCharts   = {};
let providerCharts = {};

function destroyCharts(obj) {
  Object.values(obj).forEach(c => { try { c.destroy(); } catch (_) {} });
  Object.keys(obj).forEach(k => delete obj[k]);
}

function renderAdminDashboard() {
  destroyCharts(adminCharts);
  const container = $('#adminDashboardTab');
  container.innerHTML = '';

  const all = state.incidents;
  const byStatus = {}; STATUSES.forEach(s => byStatus[s] = 0);
  const byCrit   = {}; CRITICALITIES.forEach(c => byCrit[c] = 0);
  all.forEach(i => {
    byStatus[i.status]       = (byStatus[i.status]       || 0) + 1;
    byCrit[i.criticality]    = (byCrit[i.criticality]    || 0) + 1;
  });

  const pending     = all.filter(i => i.status === 'Pendiente').length;
  const inProgress  = all.filter(i => i.status === 'En Proceso').length;
  const finished    = all.filter(i => i.status === 'Finalizada').length;
  const needsReview = all.filter(i => i.status === 'Requiere Revisión').length;
  const unassigned  = all.filter(i => !i.assignedProviderId).length;
  const urgentOpen  = all.filter(i => i.criticality === 'Urgente' && i.status !== 'Finalizada').length;
  const avgAge      = all.length ? Math.round(all.reduce((s,i)=>s+ageDays(i.createdAt),0)/all.length) : 0;
  const pendingDocs = all.reduce((sum,i) =>
    sum + i.budgets.filter(b=>b.status==='en_revision').length
        + i.invoices.filter(v=>v.status==='en_revision').length, 0);
  const pendingApps = all.reduce((sum,i) =>
    sum + (i.assignedProviderId === null ? i.applications.length : 0), 0);

  // KPIs
  const kpis = document.createElement('div');
  kpis.className = 'kpi-grid';
  kpis.append(
    kpiCard('Total',              all.length,         'all'),
    kpiCard('Pendientes',         pending,            'pending'),
    kpiCard('En proceso',         inProgress,         'progress'),
    kpiCard('Finalizadas',        finished,           'done'),
    kpiCard('Req. revisión',      needsReview,        'review'),
    kpiCard('Sin asignar',        unassigned,         'unassigned'),
    kpiCard('Urgentes abiertas',  urgentOpen,         'urgent'),
    kpiCard('Docs por revisar',   pendingDocs,        'docs'),
    kpiCard('Postulaciones',      pendingApps,        'providers'),
    kpiCard('Antigüedad media',   `${avgAge} d`,      'age'),
    kpiCard('Proveedores',        providers().length, 'providers')
  );
  container.appendChild(kpis);

  // Charts (Chart.js)
  const charts = document.createElement('div');
  charts.className = 'dash-charts';

  const sec1 = document.createElement('section'); sec1.className = 'dash-section';
  const h1   = document.createElement('h3');      h1.textContent = 'Por estado';
  const w1   = document.createElement('div');     w1.className   = 'chart-wrap';
  const c1   = document.createElement('canvas');  c1.id = 'chartStatus';
  w1.appendChild(c1); sec1.append(h1, w1);

  const sec2 = document.createElement('section'); sec2.className = 'dash-section';
  const h2   = document.createElement('h3');      h2.textContent = 'Por criticidad';
  const w2   = document.createElement('div');     w2.className   = 'chart-wrap';
  const c2   = document.createElement('canvas');  c2.id = 'chartCrit';
  w2.appendChild(c2); sec2.append(h2, w2);

  charts.append(sec1, sec2);
  container.appendChild(charts);

  requestAnimationFrame(() => {
    const legendOpts = { position: 'bottom', labels: { font: { family: 'Inter', size: 12 }, padding: 14, usePointStyle: true } };
    const animOpts   = { duration: 700, easing: 'easeOutQuart' };

    adminCharts.status = new Chart(c1, {
      type: 'doughnut',
      data: {
        labels: STATUSES,
        datasets: [{ data: STATUSES.map(s => byStatus[s]),
          backgroundColor: ['#94a3b8','#3b82f6','#22c55e','#f59e0b'],
          borderWidth: 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff',
          hoverOffset: 10
        }]
      },
      options: { plugins: { legend: legendOpts }, animation: animOpts, cutout: '65%' }
    });

    adminCharts.crit = new Chart(c2, {
      type: 'doughnut',
      data: {
        labels: CRITICALITIES,
        datasets: [{ data: CRITICALITIES.map(c => byCrit[c]),
          backgroundColor: ['#7fb77e','#3b82f6','#f59e0b','#ef4444'],
          borderWidth: 2, borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#fff',
          hoverOffset: 10
        }]
      },
      options: { plugins: { legend: legendOpts }, animation: animOpts, cutout: '65%' }
    });
  });

  // Watch list
  const watchList = [...all]
    .filter(i => i.status !== 'Finalizada')
    .sort((a, b) => {
      const d = critRank(b.criticality) - critRank(a.criticality);
      return d !== 0 ? d : a.createdAt - b.createdAt;
    })
    .slice(0, 6);

  const watch = document.createElement('section'); watch.className = 'dash-section';
  const wh = document.createElement('h3'); wh.textContent = 'Requieren atención';
  watch.appendChild(wh);
  if (!watchList.length) {
    watch.appendChild(emptyState('No hay incidencias abiertas. ¡Todo en orden!'));
  } else {
    const wl = document.createElement('div'); wl.className = 'dash-watch-list';
    watchList.forEach(i => wl.appendChild(watchRow(i)));
    watch.appendChild(wl);
  }
  container.appendChild(watch);

  // Postulaciones pendientes
  const withApps = all.filter(i => i.assignedProviderId === null && i.applications.length > 0);
  if (withApps.length) {
    const sec = document.createElement('section'); sec.className = 'dash-section';
    const ah = document.createElement('h3');
    ah.textContent = `Postulaciones sin aprobar (${withApps.length})`;
    sec.appendChild(ah);
    const al = document.createElement('div'); al.className = 'dash-watch-list';
    withApps.forEach(i => {
      const row = document.createElement('div'); row.className = 'watch-row';
      const id  = document.createElement('span'); id.className = 'watch-id';   id.textContent = i.id;
      const tit = document.createElement('span'); tit.className = 'watch-title'; tit.textContent = i.title;
      const cnt = document.createElement('span'); cnt.className = 'status-badge status-pendiente';
      cnt.textContent = `${i.applications.length} postulaci${i.applications.length===1?'ón':'ones'}`;
      const go  = button('Revisar','btn btn-primary btn-sm');
      go.onclick = () => {
        state.filters.admin.q = i.id; switchAdminTab('incidents');
        const q = $('#adminFilterQ'); if (q) { q.value = i.id; } renderAdminIncidents();
      };
      row.append(id, tit, cnt, go); al.appendChild(row);
    });
    sec.appendChild(al); container.appendChild(sec);
  }
}

function critRank(c) { return CRITICALITIES.indexOf(c); }

function kpiCard(label, value, tone) {
  const el = document.createElement('div');
  el.className = `kpi kpi-${tone}`;
  const v = document.createElement('div'); v.className = 'kpi-value'; v.textContent = String(value);
  const l = document.createElement('div'); l.className = 'kpi-label'; l.textContent = label;
  el.append(v, l);
  return el;
}

function watchRow(i) {
  const row  = document.createElement('div'); row.className = 'watch-row';
  const id   = document.createElement('span'); id.className = 'watch-id';   id.textContent = i.id;
  const tit  = document.createElement('span'); tit.className = 'watch-title'; tit.textContent = i.title;
  const crit = document.createElement('span'); crit.className = `priority-badge crit-${slug(i.criticality)}`; crit.textContent = i.criticality;
  const st   = document.createElement('span'); st.className = `status-badge status-${slug(i.status)}`; st.textContent = i.status;
  const age  = document.createElement('span'); age.className = 'watch-age'; age.textContent = `${ageDays(i.createdAt)} d`;
  const go   = button('Abrir','btn btn-outline btn-sm');
  go.onclick = () => {
    switchAdminTab('incidents');
    state.filters.admin.q = i.id;
    const q = $('#adminFilterQ'); if (q) q.value = i.id;
    renderAdminIncidents();
  };
  row.append(id, tit, crit, st, age, go);
  return row;
}

function renderProviderDashboard() {
  destroyCharts(providerCharts);
  const container = $('#providerDashboardTab');
  container.innerHTML = '';

  const mine      = state.incidents.filter(i => i.assignedProviderId === myId());
  const available = state.incidents.filter(i => i.assignedProviderId === null);
  const mineActive = mine.filter(i => i.status !== 'Finalizada');
  const mineDone   = mine.filter(i => i.status === 'Finalizada');
  const myApplied  = state.incidents.filter(i => i.applicants.includes(myId()) && i.assignedProviderId === null);
  const avgProgress = mineActive.length
    ? Math.round(mineActive.reduce((s,i) => s+(i.progress||0), 0) / mineActive.length) : 0;

  const myDocs = mine.flatMap(i => [
    ...i.budgets.filter(b=>b.providerId===myId()).map(d=>({...d,kind:'budget'})),
    ...i.invoices.filter(v=>v.providerId===myId()).map(d=>({...d,kind:'invoice'}))
  ]);

  const kpis = document.createElement('div'); kpis.className = 'kpi-grid';
  kpis.append(
    kpiCard('Activas',          mineActive.length,                            'progress'),
    kpiCard('Finalizadas',      mineDone.length,                              'done'),
    kpiCard('Disponibles',      available.length,                             'all'),
    kpiCard('Mis solicitudes',  myApplied.length,                            'pending'),
    kpiCard('Avance medio',     `${avgProgress}%`,                            'age'),
    kpiCard('Docs en revisión', myDocs.filter(d=>d.status==='en_revision').length, 'docs'),
    kpiCard('Docs aprobados',   myDocs.filter(d=>d.status==='aprobado').length,    'done'),
    kpiCard('Docs rechazados',  myDocs.filter(d=>d.status==='rechazado').length,   'urgent')
  );
  container.appendChild(kpis);

  // Chart: progreso de trabajos activos
  if (mineActive.length > 0) {
    const sec = document.createElement('section'); sec.className = 'dash-section';
    const h   = document.createElement('h3');     h.textContent = 'Progreso de mis trabajos';
    const w   = document.createElement('div');    w.className   = 'chart-wrap';
    const c   = document.createElement('canvas'); c.id = 'chartProvProgress';
    w.appendChild(c); sec.append(h, w);
    container.appendChild(sec);

    requestAnimationFrame(() => {
      providerCharts.progress = new Chart(c, {
        type: 'bar',
        data: {
          labels: mineActive.map(i => i.id),
          datasets: [{
            label: 'Avance (%)',
            data: mineActive.map(i => i.progress || 0),
            backgroundColor: mineActive.map(i => {
              const p = i.progress || 0;
              return p >= 80 ? '#22c55e' : p >= 40 ? '#3b82f6' : '#f59e0b';
            }),
            borderRadius: 6, borderSkipped: false
          }]
        },
        options: {
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            x: { min: 0, max: 100, ticks: { callback: v => v+'%' }, grid: { color: 'rgba(0,0,0,.04)' } },
            y: { grid: { display: false } }
          },
          animation: { duration: 600, easing: 'easeOutQuart' }
        }
      });
    });
  }

  // Mis trabajos en curso
  const watch = document.createElement('section'); watch.className = 'dash-section';
  const wh = document.createElement('h3'); wh.textContent = 'Mis trabajos en curso';
  watch.appendChild(wh);
  if (!mineActive.length) {
    watch.appendChild(emptyState('No tienes trabajos en curso.'));
  } else {
    const wl = document.createElement('div'); wl.className = 'dash-watch-list';
    [...mineActive].sort((a,b) => critRank(b.criticality)-critRank(a.criticality))
      .forEach(i => wl.appendChild(progressRow(i)));
    watch.appendChild(wl);
  }
  container.appendChild(watch);
}

function progressRow(i) {
  const row  = document.createElement('div'); row.className = 'watch-row';
  const id   = document.createElement('span'); id.className = 'watch-id';   id.textContent = i.id;
  const tit  = document.createElement('span'); tit.className = 'watch-title'; tit.textContent = i.title;
  const crit = document.createElement('span'); crit.className = `priority-badge crit-${slug(i.criticality)}`; crit.textContent = i.criticality;
  const prog = document.createElement('div'); prog.className = 'inline-progress';
  const ptr  = document.createElement('div'); ptr.className = 'bar-track';
  const pfl  = document.createElement('div'); pfl.className = 'bar-fill bar-progress'; pfl.style.width = (i.progress||0)+'%';
  ptr.appendChild(pfl);
  const pct = document.createElement('span'); pct.className = 'progress-pct'; pct.textContent = `${i.progress||0}%`;
  prog.append(ptr, pct);
  const go = button('Abrir','btn btn-outline btn-sm');
  go.onclick = () => {
    switchProviderTab('mine');
    state.filters.provider.q = i.id;
    const q = $('#providerFilterQ'); if (q) q.value = i.id;
    renderProviderLists();
  };
  row.append(id, tit, crit, prog, go);
  return row;
}

/* ========================================================================
 * USUARIOS
 * ====================================================================== */
function renderUsers() {
  const list = $('#usersList'); list.innerHTML = '';
  if (!providers().length) {
    list.appendChild(emptyState('No hay proveedores registrados.')); return;
  }
  const tpl = $('#userRowTemplate');
  providers().forEach(u => {
    const row     = tpl.content.firstElementChild.cloneNode(true);
    $('.user-name',row).textContent  = u.name;
    const typeEl  = $('.user-type',row);
    typeEl.textContent = TYPE_LABELS[u.type] || '—';
    typeEl.className   = `user-type type-${u.type||'na'}`;
    $('.user-username',row).textContent = u.username;
    $('.user-password',row).textContent = '•'.repeat(u.password.length);
    $('.user-email',row).textContent    = maskEmail(u.email);
    $('.user-phone',row).textContent    = maskPhone(u.phone);
    $('.user-taxid',row).textContent    = u.taxId || '—';
    const assigned = state.incidents.filter(i => i.assignedProviderId === u.id).length;
    $('.user-assigned',row).textContent = `${assigned} asignada(s)`;
    $('.user-edit-btn',row).onclick   = () => editUser(u.id);
    $('.user-delete-btn',row).onclick = () => deleteUser(u.id);
    list.appendChild(row);
  });
}

/* ========================================================================
 * FILTROS (UI)
 * ====================================================================== */
function renderAdminFilters() {
  const container = $('#adminFilters');
  if (!container || container.dataset.built === '1') return;
  container.dataset.built = '1';
  const q = $('#adminFilterQ'), status = $('#adminFilterStatus'),
        crit = $('#adminFilterCriticality'), assigned = $('#adminFilterAssigned');
  fillSelect(status, ['', ...STATUSES], v => v || 'Todos los estados');
  fillSelect(crit,   ['', ...CRITICALITIES], v => v || 'Toda la criticidad');
  fillSelectPairs(assigned, [
    ['','Todas las asignaciones'], ['unassigned','Sin asignar'],
    ...providers().map(p => [p.id, p.name])
  ]);
  const onChange = () => {
    state.filters.admin.q           = q.value;
    state.filters.admin.status      = status.value;
    state.filters.admin.criticality = crit.value;
    state.filters.admin.assigned    = assigned.value;
    renderAdminIncidents();
  };
  q.addEventListener('input', onChange);
  [status, crit, assigned].forEach(s => s.addEventListener('change', onChange));
}

function renderProviderFilters() {
  const container = $('#providerFilters');
  if (!container || container.dataset.built === '1') return;
  container.dataset.built = '1';
  const q = $('#providerFilterQ'), crit = $('#providerFilterCriticality');
  fillSelect(crit, ['', ...CRITICALITIES], v => v || 'Toda la criticidad');
  const onChange = () => {
    state.filters.provider.q           = q.value;
    state.filters.provider.criticality = crit.value;
    renderProviderLists();
  };
  q.addEventListener('input', onChange);
  crit.addEventListener('change', onChange);
}

function fillSelect(sel, values, labelFn = v => v) {
  sel.innerHTML = '';
  values.forEach(v => {
    const o = document.createElement('option'); o.value = v; o.textContent = labelFn(v);
    sel.appendChild(o);
  });
}
function fillSelectPairs(sel, pairs) {
  sel.innerHTML = '';
  pairs.forEach(([v,t]) => {
    const o = document.createElement('option'); o.value = v; o.textContent = t;
    sel.appendChild(o);
  });
}

/* ========================================================================
 * LISTAS DE INCIDENCIAS
 * ====================================================================== */
function renderAdminIncidents() {
  const list = applyAdminFilters(state.incidents);
  const container = $('#adminIncidentsList'); container.innerHTML = '';
  if (!list.length) {
    container.appendChild(emptyState('No hay incidencias con esos filtros.'));
    $('#adminCount').textContent = `0 / ${state.incidents.length}`;
    return;
  }
  const frag = document.createDocumentFragment();
  list.forEach(i => frag.appendChild(buildIncidentCard(i, 'admin')));
  container.appendChild(frag);
  $('#adminCount').textContent = `${list.length} / ${state.incidents.length}`;
}

function renderProviderLists() {
  const myUid   = myId();
  const available = applyProviderFilters(state.incidents.filter(i => i.assignedProviderId === null));
  const mine      = applyProviderFilters(state.incidents.filter(i => i.assignedProviderId === myUid));

  const availEl = $('#providerAvailableList'); availEl.innerHTML = '';
  const mineEl  = $('#providerMineList');      mineEl.innerHTML  = '';

  if (!available.length) availEl.appendChild(emptyState('No hay incidencias disponibles.'));
  else available.forEach(i => availEl.appendChild(buildIncidentCard(i, 'provider-available')));

  if (!mine.length) mineEl.appendChild(emptyState('No tienes incidencias adjudicadas.'));
  else mine.forEach(i => mineEl.appendChild(buildIncidentCard(i, 'provider-mine')));

  $('#providerAvailableCount').textContent = String(available.length);
  $('#providerMineCount').textContent      = String(mine.length);
}

function emptyState(text) {
  const el = document.createElement('div'); el.className = 'empty-state'; el.textContent = text; return el;
}

/* ========================================================================
 * TARJETA DE INCIDENCIA
 * ====================================================================== */
function buildIncidentCard(incident, mode) {
  const tpl  = $('#incidentTemplate');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id   = incident.id;
  node.dataset.crit = incident.criticality;

  $('.incident-title',node).textContent       = `${incident.id} · ${incident.title}`;
  $('.incident-address',node).textContent     = incident.address;
  $('.incident-description',node).textContent = incident.description;

  const pb = $('.priority-badge',node);
  pb.textContent = incident.criticality;
  pb.className   = `priority-badge crit-${slug(incident.criticality)}`;

  const sb = $('.status-badge',node);
  sb.textContent = incident.status;
  sb.className   = `status-badge status-${slug(incident.status)}`;

  const assignedName = incident.assignedProviderId
    ? (findUser(incident.assignedProviderId)?.name || 'Asignado')
    : incident.applications.length > 0
      ? `${incident.applications.length} postulaci${incident.applications.length===1?'ón':'ones'} pendientes`
      : 'Sin asignar';
  $('.assigned',node).textContent = `Asignación: ${assignedName}`;

  const meta = $('.incident-meta',node);
  meta.textContent = `Creada ${relativeTime(incident.createdAt)} · ${ageDays(incident.createdAt)} d · Actualizada ${relativeTime(incident.updatedAt)}`;
  meta.title = `Creada: ${formatDate(incident.createdAt)}\nActualizada: ${formatDate(incident.updatedAt)}`;

  const pw = $('.progress-wrap',node);
  if (pw) {
    $('.bar-fill',pw).style.width = (incident.progress||0)+'%';
    $('.progress-pct',pw).textContent = `${incident.progress||0}%`;
  }

  buildActions(node, incident, mode);
  buildDocsSection(node, incident, mode);
  buildMessages(node, incident);
  return node;
}

/* ---------- Acciones ---------- */
function buildActions(node, incident, mode) {
  const actions = $('.incident-actions',node);
  actions.innerHTML = '';

  if (mode === 'admin') {
    // Estado
    const statusSel = document.createElement('select');
    statusSel.setAttribute('aria-label','Cambiar estado');
    STATUSES.forEach(s => {
      const o = document.createElement('option'); o.value = s; o.textContent = s;
      if (incident.status === s) o.selected = true;
      statusSel.appendChild(o);
    });
    statusSel.onchange = () => {
      const prev = incident.status;
      incident.status = statusSel.value;
      if (statusSel.value === 'Finalizada') incident.progress = 100;
      incident.updatedAt = Date.now();
      saveState();
      if (incident.assignedProviderId) addNotification(
        incident.assignedProviderId,
        `${incident.id} cambió de estado: ${prev} → ${incident.status}`,
        'info', incident.id
      );
      renderAdminIncidents();
      toast('Estado actualizado','success');
    };

    // Criticidad
    const critSel = document.createElement('select');
    critSel.setAttribute('aria-label','Cambiar criticidad');
    CRITICALITIES.forEach(c => {
      const o = document.createElement('option'); o.value = c; o.textContent = c;
      if (incident.criticality === c) o.selected = true;
      critSel.appendChild(o);
    });
    critSel.onchange = () => {
      incident.criticality = critSel.value; incident.updatedAt = Date.now();
      saveState(); renderAdminIncidents(); toast('Criticidad actualizada','success');
    };

    const editBtn = button('Editar','btn btn-outline btn-sm');
    editBtn.onclick = () => openEditIncidentDialog(incident);

    const delBtn = button('Eliminar','btn btn-danger btn-sm');
    delBtn.onclick = () => {
      if (!confirm(`¿Eliminar la incidencia ${incident.id}?`)) return;
      state.incidents = state.incidents.filter(i => i.id !== incident.id);
      saveState(); renderAdminIncidents(); toast('Incidencia eliminada','success');
    };

    actions.append(critSel, statusSel, editBtn, delBtn);

    // Postulaciones con presupuesto
    if (incident.applications.length > 0 && !incident.assignedProviderId) {
      const sec = document.createElement('div'); sec.className = 'applicants-section';
      const h5  = document.createElement('h5');
      h5.textContent = `Postulaciones recibidas (${incident.applications.length})`;
      sec.appendChild(h5);
      incident.applications.forEach(app => {
        const prov = findUser(app.providerId); if (!prov) return;
        const row  = document.createElement('div'); row.className = 'applicant-row';
        const info = document.createElement('div');
        const name = document.createElement('div'); name.className = 'applicant-name'; name.textContent = prov.name;
        const date = document.createElement('div'); date.className = 'applicant-date'; date.textContent = relativeTime(app.appliedAt);
        info.append(name, date);
        if (app.note) {
          const note = document.createElement('div'); note.className = 'applicant-date'; note.textContent = `Nota: ${app.note}`;
          info.appendChild(note);
        }
        const amt = document.createElement('div'); amt.className = 'applicant-amount';
        amt.textContent = app.amount != null ? `${Number(app.amount).toFixed(2)} €` : 'Sin importe';
        const apv = button('Aprobar','btn btn-success btn-sm');
        apv.onclick = () => {
          incident.assignedProviderId = app.providerId;
          if (incident.status === 'Pendiente') incident.status = 'En Proceso';
          incident.updatedAt = Date.now(); saveState();
          addNotification(app.providerId,
            `Tu postulación para ${incident.id} fue APROBADA. ¡Estás asignado!`, 'success', incident.id);
          incident.applications
            .filter(a => a.providerId !== app.providerId)
            .forEach(a => addNotification(a.providerId,
              `La incidencia ${incident.id} fue asignada a otro proveedor.`, 'info', incident.id));
          renderAdminIncidents(); renderNotifBadge();
          toast(`Asignado a ${prov.name}`,'success');
        };
        row.append(info, amt, apv); sec.appendChild(row);
      });
      actions.appendChild(sec);
    } else if (incident.assignedProviderId) {
      // Reasignar
      const sel = document.createElement('select'); sel.setAttribute('aria-label','Reasignar proveedor');
      const ph  = document.createElement('option'); ph.value = ''; ph.textContent = '— Reasignar... —';
      sel.appendChild(ph);
      providers().forEach(p => {
        const o = document.createElement('option'); o.value = p.id; o.textContent = p.name;
        if (incident.assignedProviderId === p.id) o.selected = true;
        sel.appendChild(o);
      });
      const btn2 = button('Reasignar','btn btn-outline btn-sm');
      btn2.onclick = () => {
        if (!sel.value) return toast('Selecciona un proveedor','error');
        incident.assignedProviderId = sel.value; incident.updatedAt = Date.now(); saveState();
        addNotification(sel.value, `Has sido asignado/a a ${incident.id}: ${incident.title}`, 'info', incident.id);
        renderAdminIncidents(); toast('Reasignado','success');
      };
      actions.append(sel, btn2);
    } else {
      // Asignación directa
      const sel = document.createElement('select'); sel.setAttribute('aria-label','Asignar proveedor');
      const ph  = document.createElement('option'); ph.value = ''; ph.textContent = '— Asignar directamente —';
      sel.appendChild(ph);
      providers().forEach(p => {
        const o = document.createElement('option'); o.value = p.id; o.textContent = p.name;
        sel.appendChild(o);
      });
      const btn2 = button('Asignar','btn btn-primary btn-sm');
      btn2.onclick = () => {
        if (!sel.value) return toast('Selecciona un proveedor','error');
        incident.assignedProviderId = sel.value;
        if (incident.status === 'Pendiente') incident.status = 'En Proceso';
        incident.updatedAt = Date.now(); saveState();
        addNotification(sel.value, `Has sido asignado/a a ${incident.id}: ${incident.title}`, 'info', incident.id);
        renderAdminIncidents(); toast('Incidencia asignada','success');
      };
      actions.append(sel, btn2);
    }
  }

  if (mode === 'provider-available') {
    const myApp = incident.applications.find(a => a.providerId === myId());
    if (myApp) {
      const badge = document.createElement('div');
      badge.className = 'status-badge status-en-proceso';
      badge.textContent = `Postulación enviada · ${myApp.amount!=null?myApp.amount.toFixed(2)+' €':'Sin importe'}`;
      actions.appendChild(badge);
    } else {
      const form = document.createElement('div'); form.className = 'apply-form';
      const lbl  = document.createElement('label'); lbl.textContent = 'Tu presupuesto:';
      const amtIn = document.createElement('input');
      amtIn.type = 'number'; amtIn.step = '0.01'; amtIn.min = '0'; amtIn.placeholder = 'Importe (€)';
      const noteIn = document.createElement('input');
      noteIn.type = 'text'; noteIn.placeholder = 'Nota opcional'; noteIn.maxLength = 200;
      noteIn.style.cssText = 'flex:2;min-width:120px;max-width:200px;padding:7px 10px;font-size:13px';
      const applyBtn = button('Postularme','btn btn-primary btn-sm');
      applyBtn.onclick = () => {
        const amount = amtIn.value ? parseFloat(amtIn.value) : null;
        if (amount === null || isNaN(amount) || amount < 0)
          return toast('Introduce un presupuesto válido','error');
        incident.applicants.push(myId());
        incident.applications.push({ providerId: myId(), amount, note: noteIn.value.trim(), appliedAt: Date.now() });
        incident.messages.push({
          from: myId(),
          text: `Me postulo. Presupuesto: ${amount.toFixed(2)} €${noteIn.value.trim()?' — '+noteIn.value.trim():''}`,
          at: Date.now()
        });
        incident.updatedAt = Date.now(); saveState();
        const admin = state.users.find(u => u.role === 'admin');
        if (admin) addNotification(admin.id,
          `${userName(myId())} se postuló para ${incident.id} — Presupuesto: ${amount.toFixed(2)} €`,
          'info', incident.id);
        renderProviderLists(); toast('Postulación enviada','success');
      };
      form.append(lbl, amtIn, noteIn, applyBtn);
      actions.appendChild(form);
    }
  }

  if (mode === 'provider-mine') {
    const progBox = document.createElement('div'); progBox.className = 'progress-control';
    const lbl     = document.createElement('label'); lbl.textContent = 'Avance:';
    const slider  = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '100'; slider.step = '5';
    slider.value = String(incident.progress||0);
    slider.setAttribute('aria-label','Porcentaje de avance');
    const out = document.createElement('output'); out.textContent = `${slider.value}%`;
    slider.addEventListener('input',  () => out.textContent = `${slider.value}%`);
    slider.addEventListener('change', () => {
      incident.progress = parseInt(slider.value, 10);
      if (incident.progress === 100 && incident.status !== 'Finalizada') incident.status = 'Finalizada';
      else if (incident.progress > 0 && incident.status === 'Pendiente') incident.status = 'En Proceso';
      incident.updatedAt = Date.now(); saveState(); renderProviderLists();
      toast(`Avance: ${incident.progress}%`,'success');
    });
    progBox.append(lbl, slider, out);

    const finBtn = button('Finalizar','btn btn-success btn-sm');
    finBtn.disabled = incident.status === 'Finalizada';
    finBtn.onclick = () => {
      incident.status = 'Finalizada'; incident.progress = 100; incident.updatedAt = Date.now(); saveState();
      const admin = state.users.find(u => u.role === 'admin');
      if (admin) addNotification(admin.id, `${incident.id} marcada Finalizada por ${userName(myId())}`, 'success', incident.id);
      renderProviderLists(); toast('Marcada como finalizada','success');
    };

    const revBtn = button('Requiere revisión','btn btn-outline btn-sm');
    revBtn.onclick = () => {
      incident.status = 'Requiere Revisión'; incident.updatedAt = Date.now(); saveState();
      const admin = state.users.find(u => u.role === 'admin');
      if (admin) addNotification(admin.id, `${incident.id} requiere revisión (${incident.title})`, 'info', incident.id);
      renderProviderLists(); toast('Marcada para revisión','info');
    };

    actions.append(progBox, finBtn, revBtn);
  }
}

function openEditIncidentDialog(incident) {
  const title = prompt('Título:', incident.title); if (title === null) return;
  const address = prompt('Dirección:', incident.address); if (address === null) return;
  const description = prompt('Descripción:', incident.description); if (description === null) return;
  if (!title.trim()||!address.trim()||!description.trim()) return toast('Campos obligatorios','error');
  incident.title = title.trim(); incident.address = address.trim(); incident.description = description.trim();
  incident.updatedAt = Date.now(); saveState(); renderAdminIncidents();
  toast('Incidencia actualizada','success');
}

/* ========================================================================
 * DOCUMENTOS
 * ====================================================================== */
function buildDocsSection(node, incident, mode) {
  const section = $('.docs-section',node); if (!section) return;
  section.innerHTML = '';
  const canUpload = mode === 'provider-mine' && incident.assignedProviderId === myId();
  const canReview = mode === 'admin';
  if (!canUpload && !canReview && !incident.budgets.length && !incident.invoices.length) {
    section.classList.add('hidden'); return;
  }
  section.classList.remove('hidden');
  const h = document.createElement('h4'); h.textContent = 'Documentos'; section.appendChild(h);
  renderDocList(section, incident, 'budgets',  'Presupuestos', canUpload, canReview);
  renderDocList(section, incident, 'invoices', 'Facturas',     canUpload, canReview);
}

function renderDocList(parent, incident, key, title, canUpload, canReview) {
  const wrap = document.createElement('div'); wrap.className = 'docs-group';
  const h = document.createElement('h5'); h.textContent = title; wrap.appendChild(h);

  if (!incident[key].length) {
    const em = document.createElement('div'); em.className = 'message-empty'; em.textContent = 'Sin documentos.';
    wrap.appendChild(em);
  } else {
    incident[key].forEach(doc => wrap.appendChild(docRow(incident, key, doc, canReview)));
  }

  if (canUpload) {
    const form    = document.createElement('div'); form.className = 'doc-upload';
    const fileLbl = document.createElement('label'); fileLbl.className = 'btn btn-outline btn-sm';
    fileLbl.textContent = `+ Subir ${title.toLowerCase().slice(0,-1)} `;
    const fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = '.pdf,.jpg,.jpeg,.png,.webp'; fileIn.style.display = 'none';
    fileLbl.appendChild(fileIn);
    const amount = document.createElement('input');
    amount.type = 'number'; amount.step = '0.01'; amount.min = '0';
    amount.placeholder = 'Importe (€)'; amount.className = 'doc-amount';

    fileIn.onchange = async () => {
      const file = fileIn.files?.[0]; if (!file) return;
      if (file.size > MAX_FILE_BYTES) {
        toast(`Archivo demasiado grande (máx. ${fmtBytes(MAX_FILE_BYTES)})`,'error');
        fileIn.value = ''; return;
      }
      try {
        const dataUrl = await readFileAsDataURL(file);
        incident[key].push({
          id: uid('doc'), providerId: myId(), filename: file.name,
          size: file.size, mime: file.type, dataUrl,
          amount: amount.value ? parseFloat(amount.value) : null,
          status: 'en_revision', uploadedAt: Date.now(), reviewedAt: null, reviewNote: ''
        });
        incident.updatedAt = Date.now(); saveState();
        amount.value = ''; fileIn.value = '';
        const admin = state.users.find(u => u.role === 'admin');
        if (admin) addNotification(admin.id, `Nuevo documento en ${incident.id}: ${file.name}`, 'info', incident.id);
        renderProviderLists(); toast(`${title.slice(0,-1)} subida`,'success');
      } catch (err) { console.error(err); toast('Error leyendo el archivo','error'); }
    };

    form.append(fileLbl, amount); wrap.appendChild(form);
  }
  parent.appendChild(wrap);
}

function docRow(incident, key, doc, canReview) {
  const row  = document.createElement('div'); row.className = `doc-row doc-${doc.status}`;
  const info = document.createElement('div'); info.className = 'doc-info';
  const link = document.createElement('a');
  link.href = doc.dataUrl; link.download = doc.filename; link.textContent = doc.filename;
  link.target = '_blank'; link.rel = 'noopener';
  const meta = document.createElement('span'); meta.className = 'doc-meta';
  meta.textContent = `${userName(doc.providerId)} · ${fmtBytes(doc.size||0)} · ${relativeTime(doc.uploadedAt)}${doc.amount!=null?` · ${doc.amount.toFixed(2)} €`:''}`;
  info.append(link, meta);
  const status = document.createElement('span');
  status.className = `doc-status doc-status-${doc.status}`;
  status.textContent = DOC_STATUSES[doc.status];
  row.append(info, status);

  if (canReview) {
    const acts = document.createElement('div'); acts.className = 'doc-actions';
    const approve = button('Aprobar','btn btn-sm btn-success');
    approve.disabled = doc.status === 'aprobado';
    approve.onclick  = () => updateDocStatus(incident, doc, 'aprobado');
    const reject = button('Rechazar','btn btn-sm btn-danger');
    reject.disabled = doc.status === 'rechazado';
    reject.onclick  = () => updateDocStatus(incident, doc, 'rechazado');
    const reset = button('Revisar','btn btn-sm btn-outline');
    reset.disabled = doc.status === 'en_revision';
    reset.onclick  = () => updateDocStatus(incident, doc, 'en_revision');
    const del = button('×','btn btn-sm btn-ghost'); del.title = 'Eliminar documento';
    del.onclick = () => {
      if (!confirm('¿Eliminar este documento?')) return;
      incident[key] = incident[key].filter(d => d.id !== doc.id);
      incident.updatedAt = Date.now(); saveState(); renderAdminIncidents();
    };
    acts.append(approve, reject, reset, del); row.appendChild(acts);
  }
  return row;
}

function updateDocStatus(incident, doc, newStatus) {
  doc.status = newStatus; doc.reviewedAt = Date.now(); incident.updatedAt = Date.now(); saveState();
  if (doc.providerId) addNotification(doc.providerId,
    `Tu documento "${doc.filename}" en ${incident.id} fue ${DOC_STATUSES[newStatus].toLowerCase()}`,
    newStatus === 'aprobado' ? 'success' : 'info', incident.id);
  if (isAdmin()) renderAdminIncidents(); else renderProviderLists();
  toast(`Documento ${DOC_STATUSES[newStatus].toLowerCase()}`,'success');
}

/* ========================================================================
 * MENSAJES
 * ====================================================================== */
function buildMessages(node, incident) {
  const messagesEl = $('.messages',node); messagesEl.innerHTML = '';
  if (!incident.messages.length) {
    const em = document.createElement('div'); em.className = 'message-empty'; em.textContent = 'Sin mensajes todavía.';
    messagesEl.appendChild(em);
  } else {
    incident.messages.forEach(m => {
      const item = document.createElement('div');
      item.className = `message-item ${m.from === myId() ? 'mine' : ''}`;
      const who  = document.createElement('b');    who.textContent  = userName(m.from);
      const txt  = document.createElement('span'); txt.textContent  = ` ${m.text}`;
      const time = document.createElement('time'); time.className   = 'message-time';
      time.textContent = relativeTime(m.at); time.title = formatDate(m.at);
      item.append(who, txt, time); messagesEl.appendChild(item);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  const input = $('.message-input',node);
  const send  = $('.send-message-btn',node);
  const sendHandler = () => {
    const text = input.value.trim(); if (!text) return;
    if (text.length > 500) return toast('Mensaje demasiado largo','error');
    incident.messages.push({ from: myId(), text, at: Date.now() });
    incident.updatedAt = Date.now(); saveState();
    // Notificar a la otra parte
    let recipientId = null;
    if (isAdmin() && incident.assignedProviderId) recipientId = incident.assignedProviderId;
    else if (!isAdmin()) {
      const admin = state.users.find(u => u.role === 'admin');
      if (admin) recipientId = admin.id;
    }
    if (recipientId) addNotification(recipientId,
      `Nuevo mensaje en ${incident.id}: "${text.length>60?text.slice(0,60)+'…':text}"`, 'info', incident.id);
    input.value = '';
    if (isAdmin()) renderAdminIncidents(); else renderProviderLists();
  };
  send.onclick = sendHandler;
  input.addEventListener('keydown', e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendHandler(); } });
}

function button(label, className = 'btn btn-outline') {
  const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = label; return b;
}

/* ========================================================================
 * EVENTOS
 * ====================================================================== */
function bindEvents() {
  $('#loginBtn').addEventListener('click', login);
  $('#logoutBtn').addEventListener('click', logout);
  $('#createIncidentBtn').addEventListener('click', createIncident);

  ['usernameInput','passwordInput'].forEach(id =>
    $('#'+id).addEventListener('keydown', e => { if (e.key==='Enter') login(); })
  );

  $$('[data-admin-tab]').forEach(btn =>
    btn.addEventListener('click', () => switchAdminTab(btn.dataset.adminTab))
  );
  $$('[data-provider-tab]').forEach(btn =>
    btn.addEventListener('click', () => switchProviderTab(btn.dataset.providerTab))
  );

  const userForm = $('#userForm');
  if (userForm) userForm.addEventListener('submit', submitUserForm);
  const cancelEdit = $('#cancelEditUserBtn');
  if (cancelEdit) cancelEdit.addEventListener('click', () => { resetUserForm(); toast('Edición cancelada','info'); });

  // Campana notificaciones
  const notifBtn = $('#notifBtn');
  if (notifBtn) {
    notifBtn.addEventListener('click', e => {
      e.stopPropagation();
      const panel = $('#notifPanel');
      const isOpen = !panel.classList.contains('hidden');
      if (isOpen) { panel.classList.add('hidden'); }
      else {
        renderNotifPanel(); panel.classList.remove('hidden');
        setTimeout(() => {
          myNotifications().filter(n=>!n.read).forEach(n=>{n.read=true;});
          saveState(); renderNotifBadge();
        }, 1500);
      }
    });
  }
  document.addEventListener('click', () => $('#notifPanel')?.classList.add('hidden'));

  // Reset
  const resetBtn = $('#resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (!confirm('¿Restablecer todos los datos a la demo?')) return;
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(SESSION_KEY);
      state.currentUser   = null;
      state.users         = structuredClone(DEFAULT_USERS);
      state.incidents     = structuredClone(DEFAULT_INCIDENTS);
      state.notifications = [];
      saveState(); render(); toast('Datos restablecidos','success');
    });
  }
}

function init() { loadState(); bindEvents(); render(); }

document.addEventListener('DOMContentLoaded', init);
