/* ============================================================
   VROUM.IO — UI Utilities
   ============================================================ */

/* ---- Toast ---- */
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-10px)';
    el.style.transition = 'all 0.3s';
    setTimeout(() => el.remove(), 300);
  }, 2800);
}

/* ---- Modal ---- */
function openModal(title, contentHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = contentHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

/* ---- Sub-page ---- */
let _subPageStack = [];

function pushSubPage(title, renderFn, actionsHTML = '') {
  _subPageStack.push({ title, renderFn, actionsHTML });
  _renderSubPage();
}

function popSubPage() {
  _subPageStack.pop();
  if (_subPageStack.length > 0) {
    _renderSubPage();
  } else {
    const sp = document.getElementById('sub-page');
    sp.classList.remove('visible');
    setTimeout(() => sp.classList.add('hidden'), 300);
  }
}

function clearSubPages() {
  _subPageStack = [];
  const sp = document.getElementById('sub-page');
  sp.classList.remove('visible');
  setTimeout(() => sp.classList.add('hidden'), 300);
}

function _renderSubPage() {
  const sp = document.getElementById('sub-page');
  const current = _subPageStack[_subPageStack.length - 1];
  document.getElementById('sub-page-title').textContent = current.title;
  document.getElementById('sub-page-actions').innerHTML = current.actionsHTML || '';
  document.getElementById('sub-page-content').innerHTML = '';
  current.renderFn(document.getElementById('sub-page-content'));
  sp.classList.remove('hidden');
  requestAnimationFrame(() => sp.classList.add('visible'));
}

/* ---- Formatting ---- */
function fmtKm(km) {
  if (!km && km !== 0) return '—';
  return Number(km).toLocaleString('fr-FR') + ' km';
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDuration(seconds) {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h${String(m).padStart(2,'0')}`;
  if (m > 0) return `${m}min${String(s).padStart(2,'0')}`;
  return `${s}s`;
}

function fmtDistance(meters) {
  if (!meters && meters !== 0) return '—';
  if (meters >= 1000) return (meters / 1000).toFixed(1) + ' km';
  return Math.round(meters) + ' m';
}

function fmtSpeed(kmh) {
  if (!kmh && kmh !== 0) return '—';
  return Math.round(kmh) + ' km/h';
}

function fmtPrice(eur) {
  if (!eur && eur !== 0) return '—';
  return Number(eur).toFixed(2) + ' €';
}

function fmtConsumption(l100) {
  if (!l100) return '—';
  return Number(l100).toFixed(1) + ' L/100';
}

function fmtRelative(iso) {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)   return "à l'instant";
  if (mins < 60)  return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `il y a ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `il y a ${days} j`;
  return fmtDate(iso);
}

function todayISO() { return new Date().toISOString().slice(0, 10); }

/* ---- Car color mapping ---- */
const CAR_COLORS = {
  blanc: '#f0f0f0', noir: '#1a1a1a', gris: '#888888',
  rouge: '#e63946', bleu: '#4361ee', vert: '#06d6a0',
  jaune: '#ffd60a', orange: '#f77f00', argent: '#c0c0c0',
  marron: '#8b5e3c', violet: '#7b2d8b', autre: '#4cc9f0'
};

function carColorHex(colorName) {
  return CAR_COLORS[colorName?.toLowerCase()] || '#4cc9f0';
}

/* ---- Icon SVGs ---- */
const ICONS = {
  wrench: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
  fuel:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="22" x2="15" y2="22"/><line x1="4" y1="9" x2="14" y2="9"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L19 6"/></svg>`,
  note:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  trip:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`,
  edit:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash:  `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
  chevron: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
};

/* ---- Confirm dialog ---- */
function confirmAction(message) {
  return confirm(message);
}

/* ---- HTML escape ---- */
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
