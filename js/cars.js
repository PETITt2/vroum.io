/* ============================================================
   VROUM.IO — Garage & Car Management (Supabase version)
   ============================================================ */

/* ---- Garage page ---- */
function renderGarage() {
  const el   = document.getElementById('garage-content');
  const cars = getCars();

  if (cars.length === 0) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
            <rect x="9" y="11" width="14" height="10" rx="2"/>
            <circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
          </svg>
        </div>
        <p class="empty-state-title">Aucune voiture</p>
        <p class="empty-state-desc">Ajoute ta première voiture pour commencer à tout suivre.</p>
        <button class="btn-primary mt-16" onclick="openAddCarModal()">Ajouter une voiture</button>
      </div>`;
    return;
  }

  el.innerHTML = `<div class="stack">${cars.map(renderCarCard).join('')}</div>`;
}

function renderCarCard(car) {
  const km           = getCurrentCarKm(car);
  const trips        = getTripsByCarId(car.id);
  const maintenances = getMaintenanceByCarId(car.id);
  const members      = getCarMembers(car.id);
  const color        = carColorHex(car.color);
  const isShared     = members.length > 1;

  return `
    <div class="car-card" onclick="openCarDetail('${car.id}')">
      <div class="car-card-accent" style="background:${color}"></div>
      <div class="car-card-body">
        <div class="flex flex-between flex-center mb-4">
          <div class="car-card-name">${esc(car.name || `${car.brand} ${car.model}`)}</div>
          ${isShared ? `<span class="pill pill-blue" style="font-size:10px">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${members.length} membres
          </span>` : ''}
        </div>
        <div class="car-card-meta">
          <span class="color-dot" style="background:${color}"></span>
          ${esc(car.brand)} ${esc(car.model)}${car.year ? ` · ${esc(car.year)}` : ''}
          ${car.plate ? ` · <span class="pill pill-grey" style="padding:2px 8px;font-size:11px">${esc(car.plate)}</span>` : ''}
        </div>
        <div class="car-card-stats">
          <div class="car-stat">
            <div class="car-stat-value text-accent">${Number(km).toLocaleString('fr-FR')}</div>
            <div class="car-stat-label">km</div>
          </div>
          <div class="car-stat">
            <div class="car-stat-value">${trips.length}</div>
            <div class="car-stat-label">trajets</div>
          </div>
          <div class="car-stat">
            <div class="car-stat-value">${maintenances.length}</div>
            <div class="car-stat-label">entretiens</div>
          </div>
        </div>
      </div>
    </div>`;
}

/* ---- Car Detail sub-page ---- */
function openCarDetail(carId) {
  const car = getCarById(carId);
  if (!car) return;
  pushSubPage(
    car.name || `${car.brand} ${car.model}`,
    (container) => _renderCarDetail(container, carId),
    `<button class="btn-ghost" onclick="_openEditCarModal('${carId}')">Modifier</button>`
  );
}

function _renderCarDetail(container, carId) {
  const car     = getCarById(carId);
  if (!car) return;
  const km      = getCurrentCarKm(car);
  const color   = carColorHex(car.color);
  const user    = getUser();
  const isOwner = car.userId === user.id;

  container.innerHTML = `
    <div class="car-hero">
      <div class="car-hero-banner" style="background:${color}"></div>
      <div class="car-hero-body">
        <div class="car-hero-name">${esc(car.name || `${car.brand} ${car.model}`)}</div>
        <div class="car-hero-meta">
          <span class="color-dot" style="background:${color}"></span>
          <span>${esc(car.brand)} ${esc(car.model)}</span>
          ${car.year ? `<span>·</span><span>${esc(car.year)}</span>` : ''}
          ${car.fuelType ? `<span>·</span><span class="pill pill-grey">${esc(car.fuelType)}</span>` : ''}
          ${car.plate ? `<span class="pill pill-grey">${esc(car.plate)}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="car-km-display">
      <div>
        <div class="car-km-value">${Number(km).toLocaleString('fr-FR')} <span style="font-size:18px;color:var(--text-2)">km</span></div>
        <div class="car-km-label">Kilométrage actuel</div>
      </div>
      <button class="btn-primary" onclick="_openUpdateKmModal('${carId}')">Mettre à jour</button>
    </div>

    <div class="tabs-bar" id="car-tabs">
      <button class="tab-btn active" onclick="switchCarTab('${carId}','km',this)">Km</button>
      <button class="tab-btn" onclick="switchCarTab('${carId}','maintenance',this)">Entretiens</button>
      <button class="tab-btn" onclick="switchCarTab('${carId}','fuel',this)">Pleins</button>
      <button class="tab-btn" onclick="switchCarTab('${carId}','notes',this)">Notes</button>
      <button class="tab-btn" onclick="switchCarTab('${carId}','members',this)">
        Membres <span class="pill pill-blue" style="padding:1px 6px;font-size:10px;margin-left:3px">${getCarMembers(carId).length}</span>
      </button>
    </div>

    <div id="car-tab-content"></div>

    ${isOwner ? `
    <div class="mt-16">
      <button class="btn-danger" onclick="_confirmDeleteCar('${carId}')">Supprimer cette voiture</button>
    </div>` : `
    <div class="mt-16">
      <button class="btn-danger" onclick="_confirmLeaveCar('${carId}')">Quitter cette voiture</button>
    </div>`}
  `;

  renderCarTabKm(carId);
}

function switchCarTab(carId, tab, btn) {
  document.querySelectorAll('#car-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  ({ km: renderCarTabKm, maintenance: renderCarTabMaintenance, fuel: renderCarTabFuel, notes: renderCarTabNotes, members: renderCarTabMembers })[tab]?.(carId);
}

/* ---- KM History tab ---- */
function renderCarTabKm(carId) {
  const car     = getCarById(carId);
  const history = [...(car?.kmHistory || [])].reverse();
  const el      = document.getElementById('car-tab-content');

  el.innerHTML = `
    <div class="flex flex-between flex-center mb-12">
      <p class="section-label">Historique kilométrage</p>
      <button class="btn-ghost" onclick="_openUpdateKmModal('${carId}')">+ Ajouter</button>
    </div>
    ${history.length === 0
      ? `<p class="text-muted text-sm">Aucune entrée. Met à jour le kilométrage.</p>`
      : `<div class="card"><div class="card-body" style="padding-top:12px">
          ${history.map((entry, i) => {
            const prev  = history[i + 1];
            const delta = prev ? entry.km - prev.km : null;
            return `
              <div class="entry-item">
                <div class="entry-dot" style="background:var(--accent)"></div>
                <div class="entry-content">
                  <div class="entry-title">${Number(entry.km).toLocaleString('fr-FR')} km
                    ${delta !== null ? `<span class="pill pill-green" style="margin-left:6px;font-size:11px">+${Number(delta).toLocaleString('fr-FR')} km</span>` : ''}
                  </div>
                  <div class="entry-meta">${fmtDate(entry.date)}${entry.note ? ` · ${esc(entry.note)}` : ''}</div>
                </div>
                <div class="entry-actions">
                  <button class="entry-action danger" onclick="_deleteKmEntry('${carId}','${entry.id}')">${ICONS.trash}</button>
                </div>
              </div>`;
          }).join('')}
        </div></div>`}`;
}

/* ---- Maintenance tab ---- */
function renderCarTabMaintenance(carId) {
  const entries = getMaintenanceByCarId(carId).sort((a, b) => b.date.localeCompare(a.date));
  const el      = document.getElementById('car-tab-content');

  el.innerHTML = `
    <div class="flex flex-between flex-center mb-12">
      <p class="section-label">Entretiens</p>
      <button class="btn-ghost" onclick="_openAddMaintenanceModal('${carId}')">+ Ajouter</button>
    </div>
    ${entries.length === 0
      ? `<p class="text-muted text-sm">Aucun entretien enregistré.</p>`
      : `<div class="card"><div class="card-body" style="padding-top:12px">
          ${entries.map(e => `
            <div class="entry-item">
              <div class="entry-dot" style="background:var(--yellow)"></div>
              <div class="entry-content">
                <div class="entry-title">${esc(e.type)}</div>
                <div class="entry-meta">${fmtDate(e.date)}${e.km ? ` · ${Number(e.km).toLocaleString('fr-FR')} km` : ''}${e.cost ? ` · ${fmtPrice(e.cost)}` : ''}</div>
                ${e.description ? `<div class="entry-meta mt-4">${esc(e.description)}</div>` : ''}
                ${e.nextKm ? `<span class="pill pill-grey mt-4">Prochain : ${Number(e.nextKm).toLocaleString('fr-FR')} km</span>` : ''}
              </div>
              <div class="entry-actions">
                <button class="entry-action danger" onclick="_deleteMaintEntry('${e.id}','${carId}')">${ICONS.trash}</button>
              </div>
            </div>`).join('')}
        </div></div>`}`;
}

/* ---- Fuel tab ---- */
function renderCarTabFuel(carId) {
  const entries      = getFuelsByCarId(carId).sort((a, b) => b.date.localeCompare(a.date));
  const el           = document.getElementById('car-tab-content');
  const avgConso     = _calcAvgConsumption(entries);

  el.innerHTML = `
    <div class="flex flex-between flex-center mb-12">
      <p class="section-label">Pleins</p>
      <button class="btn-ghost" onclick="_openAddFuelModal('${carId}')">+ Ajouter</button>
    </div>
    ${avgConso ? `<div class="kpi-card mb-12">
      <div class="kpi-value text-blue">${fmtConsumption(avgConso)}</div>
      <div class="kpi-label">Consommation moyenne</div>
    </div>` : ''}
    ${entries.length === 0
      ? `<p class="text-muted text-sm">Aucun plein enregistré.</p>`
      : `<div class="card"><div class="card-body" style="padding-top:12px">
          ${entries.map(e => `
            <div class="entry-item">
              <div class="entry-dot" style="background:var(--blue)"></div>
              <div class="entry-content">
                <div class="entry-title">${e.liters} L · ${fmtPrice(e.totalPrice)}</div>
                <div class="entry-meta">${fmtDate(e.date)}${e.km ? ` · ${Number(e.km).toLocaleString('fr-FR')} km` : ''}${e.consumption ? ` · ${fmtConsumption(e.consumption)}` : ''}</div>
              </div>
              <div class="entry-actions">
                <button class="entry-action danger" onclick="_deleteFuelEntry('${e.id}','${carId}')">${ICONS.trash}</button>
              </div>
            </div>`).join('')}
        </div></div>`}`;
}

/* ---- Notes tab ---- */
function renderCarTabNotes(carId) {
  const notes = getNotesByCarId(carId).sort((a, b) => b.date.localeCompare(a.date));
  const el    = document.getElementById('car-tab-content');

  el.innerHTML = `
    <div class="flex flex-between flex-center mb-12">
      <p class="section-label">Notes & Observations</p>
      <button class="btn-ghost" onclick="_openAddNoteModal('${carId}')">+ Ajouter</button>
    </div>
    ${notes.length === 0
      ? `<p class="text-muted text-sm">Aucune note.</p>`
      : `<div class="stack">
          ${notes.map(n => `
            <div class="card" style="padding:14px 16px">
              <div class="flex flex-between flex-center mb-8">
                <span class="text-xs text-muted">${fmtDate(n.date)}</span>
                <button class="entry-action danger" style="width:24px;height:24px" onclick="_deleteNoteEntry('${n.id}','${carId}')">${ICONS.trash}</button>
              </div>
              <p style="font-size:14px;line-height:1.6">${esc(n.text)}</p>
            </div>`).join('')}
        </div>`}`;
}

/* ---- Members tab (sharing) ---- */
function renderCarTabMembers(carId) {
  const car     = getCarById(carId);
  const user    = getUser();
  const isOwner = car.userId === user.id;
  const members = getCarMembers(carId);
  const el      = document.getElementById('car-tab-content');

  el.innerHTML = `
    <div class="flex flex-between flex-center mb-12">
      <p class="section-label">Membres (${members.length})</p>
      ${isOwner ? `<button class="btn-ghost" onclick="_openInviteModal('${carId}')">+ Inviter</button>` : ''}
    </div>
    <div class="card"><div class="card-body" style="padding-top:12px">
      ${members.map(m => `
        <div class="entry-item">
          <div class="profile-avatar" style="width:34px;height:34px;font-size:14px;flex-shrink:0">
            ${(m.username || '?')[0].toUpperCase()}
          </div>
          <div class="entry-content">
            <div class="entry-title">
              ${esc(m.username)}
              ${m.userId === user.id ? '<span class="pill pill-grey" style="margin-left:4px;font-size:10px">Moi</span>' : ''}
            </div>
            <div class="entry-meta">
              <span class="pill ${m.role === 'owner' ? 'pill-red' : 'pill-blue'}" style="font-size:10px;padding:2px 7px">
                ${m.role === 'owner' ? 'Propriétaire' : 'Membre'}
              </span>
            </div>
          </div>
          <div class="entry-actions">
            ${isOwner && m.role !== 'owner'
              ? `<button class="entry-action danger" onclick="_removeMember('${carId}','${m.userId}')" title="Retirer">${ICONS.trash}</button>`
              : ''}
            ${m.userId === user.id && m.role !== 'owner'
              ? `<button class="btn-ghost" style="font-size:12px;padding:4px 8px" onclick="_confirmLeaveCar('${carId}')">Quitter</button>`
              : ''}
          </div>
        </div>`).join('')}
    </div></div>
    ${isOwner ? `<p class="text-xs text-muted mt-12">Invite un utilisateur par son <strong>pseudo exact</strong>. Il verra cette voiture dans son garage.</p>` : ''}`;
}

/* ---- Invite modal ---- */
function _openInviteModal(carId) {
  openModal('Inviter un membre', `
    <p class="text-muted text-sm mb-12">Entre le pseudo exact de l'utilisateur à inviter.</p>
    <div class="field">
      <label>Pseudo</label>
      <input type="text" id="f-invite-username" placeholder="piloteduroute" autocomplete="off">
    </div>
    <div id="invite-result" style="min-height:20px"></div>
    <div class="form-actions">
      <button class="btn-primary" onclick="_searchAndInvite('${carId}')">Chercher & inviter</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`);
}

async function _searchAndInvite(carId) {
  const username = document.getElementById('f-invite-username')?.value.trim();
  if (!username) { toast('Entre un pseudo', 'error'); return; }

  const resultEl = document.getElementById('invite-result');
  if (resultEl) resultEl.innerHTML = `<p class="text-muted text-sm">Recherche de "${esc(username)}"...</p>`;

  const profile = await findUserByUsername(username);

  if (!profile) {
    if (resultEl) resultEl.innerHTML = `<p class="text-accent text-sm">Aucun utilisateur avec le pseudo "${esc(username)}".</p>`;
    return;
  }
  if (profile.id === getUser().id) {
    if (resultEl) resultEl.innerHTML = `<p class="text-accent text-sm">C'est toi ! Tu es déjà membre.</p>`;
    return;
  }
  if (getCarMembers(carId).find(m => m.userId === profile.id)) {
    if (resultEl) resultEl.innerHTML = `<p class="text-accent text-sm">${esc(profile.username)} est déjà membre.</p>`;
    return;
  }

  if (resultEl) resultEl.innerHTML = `<p class="text-muted text-sm">Ajout de ${esc(profile.username)}...</p>`;
  const ok = await addCarMember(carId, profile.id, profile.username, 'member');
  if (ok) {
    closeModal();
    renderCarTabMembers(carId);
    toast(`${profile.username} ajouté ✓`, 'success');
  }
}

async function _removeMember(carId, userId) {
  if (!confirmAction('Retirer ce membre de la voiture ?')) return;
  await removeCarMember(carId, userId);
  renderCarTabMembers(carId);
  toast('Membre retiré', 'info');
}

async function _confirmLeaveCar(carId) {
  if (!confirmAction('Quitter cette voiture ? Tu ne pourras plus y accéder.')) return;
  await removeCarMember(carId, getUser().id);
  popSubPage();
  renderGarage();
  toast('Tu as quitté la voiture', 'info');
}

/* ---- Add/Edit car modal ---- */
function openAddCarModal() {
  openModal('Nouvelle voiture', _carForm(null));
}

function _openEditCarModal(carId) {
  openModal('Modifier la voiture', _carForm(getCarById(carId)));
}

function _carForm(car) {
  const colorOptions = Object.keys(CAR_COLORS).map(c =>
    `<option value="${c}" ${car?.color === c ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`
  ).join('');

  return `
    <div class="field">
      <label>Surnom (ex: Ma 208)</label>
      <input type="text" id="f-name" placeholder="Ma Peugeot" value="${esc(car?.name || '')}">
    </div>
    <div class="field-row">
      <div class="field">
        <label>Marque *</label>
        <input type="text" id="f-brand" placeholder="Peugeot" value="${esc(car?.brand || '')}" required>
      </div>
      <div class="field">
        <label>Modèle *</label>
        <input type="text" id="f-model" placeholder="208" value="${esc(car?.model || '')}" required>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Année</label>
        <input type="number" id="f-year" placeholder="2020" value="${esc(car?.year || '')}" min="1900" max="2099">
      </div>
      <div class="field">
        <label>Couleur</label>
        <select id="f-color">${colorOptions}</select>
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Plaque</label>
        <input type="text" id="f-plate" placeholder="AB-123-CD" value="${esc(car?.plate || '')}">
      </div>
      <div class="field">
        <label>Carburant</label>
        <select id="f-fuel-type">
          ${['Essence','Diesel','Électrique','Hybride','GPL'].map(f =>
            `<option ${car?.fuelType === f ? 'selected' : ''}>${f}</option>`).join('')}
        </select>
      </div>
    </div>
    ${!car ? `<div class="field">
      <label>Kilométrage initial</label>
      <input type="number" id="f-km" placeholder="0" value="0" min="0">
    </div>` : ''}
    <div class="form-actions">
      <button class="btn-primary" onclick="_saveCar(${car ? `'${car.id}'` : 'null'})">${car ? 'Enregistrer' : 'Ajouter la voiture'}</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`;
}

async function _saveCar(carId) {
  const brand = document.getElementById('f-brand')?.value.trim();
  const model = document.getElementById('f-model')?.value.trim();
  if (!brand || !model) { toast('Marque et modèle obligatoires', 'error'); return; }

  const existing = carId ? getCarById(carId) : null;
  const car = {
    id:        carId || genId(),
    userId:    getUser().id,
    name:      document.getElementById('f-name')?.value.trim() || '',
    brand, model,
    year:      document.getElementById('f-year')?.value || '',
    color:     document.getElementById('f-color')?.value || 'autre',
    plate:     document.getElementById('f-plate')?.value.trim() || '',
    fuelType:  document.getElementById('f-fuel-type')?.value || 'Essence',
    initialKm: existing?.initialKm ?? 0,
    kmHistory: existing?.kmHistory || [],
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  await upsertCar(car);

  if (!carId) {
    const initKm = parseInt(document.getElementById('f-km')?.value || '0', 10);
    if (initKm > 0) {
      await addKmHistory(car.id, { id: genId(), date: todayISO(), km: initKm, note: 'Kilométrage initial' });
    }
  }

  closeModal();
  renderGarage();

  if (carId) {
    const sp = document.getElementById('sub-page-content');
    if (sp) _renderCarDetail(sp, carId);
  }

  toast(carId ? 'Voiture modifiée ✓' : 'Voiture ajoutée ✓', 'success');
}

/* ---- KM update modal ---- */
function _openUpdateKmModal(carId) {
  const car     = getCarById(carId);
  const current = getCurrentCarKm(car);
  openModal('Mettre à jour le kilométrage', `
    <div class="field">
      <label>Nouveau kilométrage</label>
      <input type="number" id="f-km-val" value="${current}" min="${current}">
    </div>
    <div class="field">
      <label>Note (optionnel)</label>
      <input type="text" id="f-km-note" placeholder="Retour de vacances...">
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick="_saveKmUpdate('${carId}')">Enregistrer</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`);
}

async function _saveKmUpdate(carId) {
  const val     = parseInt(document.getElementById('f-km-val')?.value, 10);
  const current = getCurrentCarKm(getCarById(carId));
  if (isNaN(val) || val < current) { toast('Valeur invalide (doit être ≥ kilométrage actuel)', 'error'); return; }

  const entry = { id: genId(), date: todayISO(), km: val, note: document.getElementById('f-km-note')?.value.trim() || '' };
  await addKmHistory(carId, entry);
  closeModal();
  const sp = document.getElementById('sub-page-content');
  if (sp) _renderCarDetail(sp, carId);
  toast('Kilométrage mis à jour ✓', 'success');
}

async function _deleteKmEntry(carId, entryId) {
  if (!confirmAction('Supprimer cette entrée ?')) return;
  await removeKmHistory(carId, entryId);
  renderCarTabKm(carId);
  toast('Entrée supprimée', 'info');
}

/* ---- Maintenance modal ---- */
function _openAddMaintenanceModal(carId) {
  const km = getCurrentCarKm(getCarById(carId));
  openModal('Ajouter un entretien', `
    <div class="field">
      <label>Type *</label>
      <select id="f-mtype">
        ${['Vidange','Révision','Freins','Pneus','Distribution','Batterie','Climatisation','Contrôle technique','Autre'].map(t => `<option>${t}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Description</label>
      <input type="text" id="f-mdesc" placeholder="Détails de l'entretien...">
    </div>
    <div class="field-row">
      <div class="field"><label>Date</label><input type="date" id="f-mdate" value="${todayISO()}"></div>
      <div class="field"><label>Kilométrage</label><input type="number" id="f-mkm" value="${km}" min="0"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Coût (€)</label><input type="number" id="f-mcost" placeholder="150" min="0" step="0.01"></div>
      <div class="field"><label>Prochain à (km)</label><input type="number" id="f-mnextkm" placeholder="${km + 10000}" min="0"></div>
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick="_saveMaintenance('${carId}')">Ajouter</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`);
}

async function _saveMaintenance(carId) {
  const type = document.getElementById('f-mtype')?.value;
  if (!type) { toast('Type obligatoire', 'error'); return; }
  const entry = {
    id: genId(), carId, userId: getUser().id,
    type,
    description: document.getElementById('f-mdesc')?.value.trim() || '',
    date:   document.getElementById('f-mdate')?.value || todayISO(),
    km:     parseInt(document.getElementById('f-mkm')?.value, 10) || 0,
    cost:   parseFloat(document.getElementById('f-mcost')?.value) || 0,
    nextKm: parseInt(document.getElementById('f-mnextkm')?.value, 10) || 0,
    createdAt: new Date().toISOString(),
  };
  await upsertMaintenance(entry);
  closeModal();
  renderCarTabMaintenance(carId);
  toast('Entretien ajouté ✓', 'success');
}

async function _deleteMaintEntry(entryId, carId) {
  if (!confirmAction('Supprimer cet entretien ?')) return;
  await deleteMaintenance(entryId);
  renderCarTabMaintenance(carId);
  toast('Entretien supprimé', 'info');
}

/* ---- Fuel modal ---- */
function _openAddFuelModal(carId) {
  const km = getCurrentCarKm(getCarById(carId));
  openModal('Ajouter un plein', `
    <div class="field-row">
      <div class="field"><label>Litres *</label><input type="number" id="f-fliters" placeholder="40" min="0" step="0.01"></div>
      <div class="field"><label>Prix/L (€)</label><input type="number" id="f-fppl" placeholder="1.80" min="0" step="0.001"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Total (€)</label><input type="number" id="f-ftotal" placeholder="72" min="0" step="0.01"></div>
      <div class="field"><label>Kilométrage</label><input type="number" id="f-fkm" value="${km}" min="0"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Date</label><input type="date" id="f-fdate" value="${todayISO()}"></div>
      <div class="field"><label>Conso (L/100)</label><input type="number" id="f-fconso" placeholder="auto" step="0.1" min="0"></div>
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick="_saveFuel('${carId}')">Ajouter</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`);
}

async function _saveFuel(carId) {
  const liters = parseFloat(document.getElementById('f-fliters')?.value);
  if (!liters || liters <= 0) { toast('Nombre de litres obligatoire', 'error'); return; }
  const ppl   = parseFloat(document.getElementById('f-fppl')?.value) || 0;
  const total = parseFloat(document.getElementById('f-ftotal')?.value) || (liters * ppl);
  const entry = {
    id: genId(), carId, userId: getUser().id,
    date:          document.getElementById('f-fdate')?.value || todayISO(),
    liters, pricePerLiter: ppl, totalPrice: total,
    km:          parseInt(document.getElementById('f-fkm')?.value, 10) || 0,
    consumption: parseFloat(document.getElementById('f-fconso')?.value) || 0,
    createdAt: new Date().toISOString(),
  };
  await upsertFuel(entry);
  closeModal();
  renderCarTabFuel(carId);
  toast('Plein ajouté ✓', 'success');
}

async function _deleteFuelEntry(entryId, carId) {
  if (!confirmAction('Supprimer ce plein ?')) return;
  await deleteFuel(entryId);
  renderCarTabFuel(carId);
  toast('Plein supprimé', 'info');
}

/* ---- Note modal ---- */
function _openAddNoteModal(carId) {
  openModal('Nouvelle note', `
    <div class="field"><label>Date</label><input type="date" id="f-ndate" value="${todayISO()}"></div>
    <div class="field">
      <label>Observation *</label>
      <textarea id="f-ntext" placeholder="Note, problème détecté, remarque..." rows="4"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick="_saveNote('${carId}')">Ajouter</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`);
}

async function _saveNote(carId) {
  const text = document.getElementById('f-ntext')?.value.trim();
  if (!text) { toast('La note est vide', 'error'); return; }
  const entry = {
    id: genId(), carId, userId: getUser().id,
    date: document.getElementById('f-ndate')?.value || todayISO(),
    text, createdAt: new Date().toISOString(),
  };
  await upsertNote(entry);
  closeModal();
  renderCarTabNotes(carId);
  toast('Note ajoutée ✓', 'success');
}

async function _deleteNoteEntry(entryId, carId) {
  if (!confirmAction('Supprimer cette note ?')) return;
  await deleteNote(entryId);
  renderCarTabNotes(carId);
  toast('Note supprimée', 'info');
}

/* ---- Delete car ---- */
async function _confirmDeleteCar(carId) {
  const car = getCarById(carId);
  if (!confirmAction(`Supprimer "${car?.name || 'cette voiture'}" et toutes ses données ?`)) return;
  await deleteCar(carId);
  popSubPage();
  renderGarage();
  toast('Voiture supprimée', 'info');
}

/* ---- Helpers ---- */
function _calcAvgConsumption(fuelEntries) {
  const withConso = fuelEntries.filter(e => e.consumption > 0);
  if (!withConso.length) return null;
  return withConso.reduce((s, e) => s + e.consumption, 0) / withConso.length;
}
