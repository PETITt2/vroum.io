/* ============================================================
   VROUM.IO — App Orchestrator
   ============================================================ */

let _currentTab = 'garage';
let _lastSync   = 0;

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', async () => {
  _wireGlobalEvents();

  // 1. Vérifier la session (rapide — cookie local)
  _showLoading('Connexion...');
  let user = null;
  try { user = await initAuth(); } catch { /* offline */ }
  _hideLoading();

  if (!user) { _showAuthScreen(); return; }

  // 2. Charger le cache localStorage instantanément
  const hasCached = loadCache();
  _showApp(hasCached); // Affiche l'app immédiatement si cache dispo

  // 3. Sync Supabase en arrière-plan (silencieux si cache dispo)
  if (!hasCached) _showLoading('Première connexion...');
  await _syncWithRetry(hasCached);
});

/* ---- Loading overlay ---- */
function _showLoading(msg = 'Chargement...') {
  let el = document.getElementById('loading-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading-overlay';
    el.className = 'loading-overlay';
    document.body.appendChild(el);
  }
  el.innerHTML = `
    <div class="app-logo-sm">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
        <rect x="9" y="11" width="14" height="10" rx="2"/>
        <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
      </svg>
    </div>
    <div class="spinner"></div>
    <p class="loading-msg">${msg}</p>`;
  el.classList.remove('hidden');
}

function _hideLoading() {
  document.getElementById('loading-overlay')?.classList.add('hidden');
}

/* ---- Sync with retry (cold start Supabase can take a few seconds) ---- */
async function _syncWithRetry(hasCached, maxAttempts = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await syncAll();
      _renderTab(_currentTab);
      _hideLoading();
      return; // succès
    } catch (err) {
      console.warn(`[vroum] Sync attempt ${attempt}/${maxAttempts} failed:`, err?.message || err);
      if (attempt < maxAttempts) {
        // Attendre avant de réessayer (cold start Supabase)
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        // Tous les essais épuisés
        _hideLoading();
        if (!hasCached) {
          toast('Impossible de joindre le serveur — vérifie ta connexion', 'error');
        }
        // Si on a un cache, on ne montre rien — l'app fonctionne en mode offline
      }
    }
  }
}

/* ---- Boot sequence (réutilisée par login / register / reload) ---- */
async function _bootApp() {
  const hasCached = loadCache();
  _showApp(hasCached);
  if (!hasCached) _showLoading('Chargement...');
  await _syncWithRetry(hasCached);
}

/* ---- Screen switching ---- */
function _showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function _showApp(immediate = false) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  _lastSync = Date.now();
  if (immediate || !document.getElementById('page-garage').classList.contains('active')) {
    navigate('garage');
  }
}

/* ---- Navigation ---- */
function navigate(tab) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });

  const page = document.getElementById(`page-${tab}`);
  if (page) { page.classList.remove('hidden'); page.classList.add('active'); }

  document.querySelectorAll('.nav-item[data-tab]').forEach(n => {
    n.classList.toggle('active', n.dataset.tab === tab);
  });

  clearSubPages();

  if (_currentTab === 'driving' && tab !== 'driving') stopDriving();
  _currentTab = tab;

  _renderTab(tab);
}

function _renderTab(tab) {
  switch (tab) {
    case 'garage':  renderGarage();      break;
    case 'trips':   renderTrips();       break;
    case 'map':     onMapTabSelected();  break;
    case 'driving': renderDriving();     break;
    case 'profile': renderProfile();     break;
  }
}

/* ---- Background sync (when app regains focus) ---- */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && isLoggedIn()) {
    if (Date.now() - _lastSync > 30000) { // 30s cooldown
      _lastSync = Date.now();
      try {
        await syncAll();
        _renderTab(_currentTab);
      } catch { /* silent */ }
    }
  }
});

/* ---- Global event wiring ---- */
function _wireGlobalEvents() {
  // Auth tabs
  document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.authTab;
      document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
      document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    });
  });

  // Auth forms
  document.querySelector('[data-form="login"]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Connexion...';
    const fd = new FormData(e.target);
    const result = await login(fd.get('email'), fd.get('password'));
    btn.disabled = false; btn.textContent = 'Se connecter';
    if (result.error) { toast(result.error, 'error'); return; }
    await _bootApp();
  });

  document.querySelector('[data-form="register"]')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Création...';
    const fd = new FormData(e.target);
    const result = await register(fd.get('username'), fd.get('email'), fd.get('password'));
    btn.disabled = false; btn.textContent = 'Créer mon compte';
    if (result.error) { toast(result.error, result.user ? 'info' : 'error'); return; }
    await _bootApp();
  });

  // Bottom nav
  document.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.tab));
  });

  // Add car button
  document.getElementById('btn-add-car')?.addEventListener('click', openAddCarModal);

  // Add trip button
  document.getElementById('btn-add-trip')?.addEventListener('click', openAddTripModal);

  // Modal close
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Sub-page back
  document.getElementById('back-btn')?.addEventListener('click', popSubPage);

  // Import file
  document.getElementById('import-file')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        toast('Import en cours...', 'info');
        await _importData(data);
        await syncAll();
        _renderTab(_currentTab);
        toast('Données importées ✓', 'success');
      } catch { toast('Fichier invalide', 'error'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  // Prevent pinch-zoom on mobile
  document.addEventListener('touchmove', e => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
}

/* ---- Basic import (best-effort) ---- */
async function _importData(data) {
  const user = getUser();
  for (const car of (data.cars || [])) {
    const newCar = { ...car, userId: user.id, id: genId(), kmHistory: [] };
    await upsertCar(newCar);
    for (const km of (car.kmHistory || [])) {
      await addKmHistory(newCar.id, { ...km, id: genId() });
    }
  }
}

/* ---- Profile page ---- */
function renderProfile() {
  const user  = getUser();
  const cars  = getCars();
  const trips = getTrips();
  const el    = document.getElementById('profile-content');
  const init  = (user.username || 'U')[0].toUpperCase();

  const totalDist = trips.reduce((s, t) => s + (t.distance || 0), 0);
  const totalTime = trips.reduce((s, t) => s + (t.duration || 0), 0);

  el.innerHTML = `
    <div class="profile-info">
      <div class="profile-avatar">${init}</div>
      <div>
        <div class="profile-name">${esc(user.username)}</div>
        <div class="profile-email">${esc(user.email)}</div>
      </div>
    </div>

    <div class="kpi-grid mb-16">
      <div class="kpi-card">
        <div class="kpi-value text-accent">${cars.length}</div>
        <div class="kpi-label">Voitures</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value text-blue">${trips.length}</div>
        <div class="kpi-label">Trajets</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value text-green" style="font-size:18px">${fmtDistance(totalDist * 1000)}</div>
        <div class="kpi-label">Distance totale</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value" style="font-size:18px">${fmtDuration(totalTime)}</div>
        <div class="kpi-label">Temps au volant</div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-item" onclick="_openEditProfileModal()">
        <div class="settings-item-icon" style="background:var(--accent-dim)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </div>
        <div class="settings-item-text">
          <div class="settings-item-label">Modifier le profil</div>
          <div class="settings-item-desc">Pseudo</div>
        </div>
        <div class="settings-item-chevron">${ICONS.chevron}</div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-item" onclick="exportAll()">
        <div class="settings-item-icon" style="background:var(--blue-dim)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </div>
        <div class="settings-item-text">
          <div class="settings-item-label">Exporter mes données</div>
          <div class="settings-item-desc">Backup JSON local</div>
        </div>
        <div class="settings-item-chevron">${ICONS.chevron}</div>
      </div>
      <div class="settings-item" onclick="document.getElementById('import-file').click()">
        <div class="settings-item-icon" style="background:var(--green-dim)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        </div>
        <div class="settings-item-text">
          <div class="settings-item-label">Importer une sauvegarde</div>
          <div class="settings-item-desc">Restaurer un backup JSON</div>
        </div>
        <div class="settings-item-chevron">${ICONS.chevron}</div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-item" onclick="_confirmLogout()">
        <div class="settings-item-icon" style="background:var(--accent-dim)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </div>
        <div class="settings-item-text">
          <div class="settings-item-label" style="color:var(--accent)">Se déconnecter</div>
        </div>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-item" onclick="_confirmNuke()">
        <div class="settings-item-icon" style="background:var(--accent-dim)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </div>
        <div class="settings-item-text">
          <div class="settings-item-label" style="color:var(--accent)">Effacer toutes mes données</div>
          <div class="settings-item-desc">Irréversible — supprime de Supabase</div>
        </div>
      </div>
    </div>

    <p class="text-xs text-muted mt-16" style="text-align:center">
      VROUM.IO · Données synchronisées sur <strong style="color:var(--green)">Supabase</strong>
    </p>`;
}

function _openEditProfileModal() {
  const user = getUser();
  openModal('Modifier le profil', `
    <div class="field">
      <label>Pseudo</label>
      <input type="text" id="f-pname" value="${esc(user.username)}" required minlength="2">
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick="_saveProfile()">Enregistrer</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`);
}

async function _saveProfile() {
  const username = document.getElementById('f-pname')?.value.trim();
  if (!username || username.length < 2) { toast('Pseudo trop court', 'error'); return; }
  const ok = await updateProfile({ username });
  if (ok) { closeModal(); renderProfile(); toast('Profil mis à jour ✓', 'success'); }
}

async function _confirmLogout() {
  if (!confirmAction('Se déconnecter ?')) return;
  await logout();
  _showAuthScreen();
}

async function _confirmNuke() {
  if (!confirmAction('Effacer TOUTES tes données sur Supabase ? Cette action est irréversible.')) return;
  _showLoading('Suppression...');
  await nukeDB();
  await logout();
  _hideLoading();
  _showAuthScreen();
  toast('Données effacées', 'info');
}
