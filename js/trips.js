/* ============================================================
   VROUM.IO — Trips Management + GPS Recording
   ============================================================ */

let _gpsWatchId   = null;
let _recording    = false;
let _recRoute     = [];   // [[lat, lng, timestamp], ...]
let _recStart     = null; // Date.now()
let _recMaxSpeed  = 0;
let _recCarId     = null;
let _recIntervalId = null;

/* ---- Trips page ---- */
function renderTrips() {
  const user  = getUser();
  const trips = getTrips(user.id).sort((a, b) => b.date.localeCompare(a.date));
  const cars  = getCars(user.id);
  const el    = document.getElementById('trips-content');

  if (trips.length === 0 && !_recording) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
        <p class="empty-state-title">Aucun trajet</p>
        <p class="empty-state-desc">Enregistre un trajet en direct depuis l'onglet Conduite, ou ajoute-le manuellement.</p>
        <button class="btn-primary mt-16" onclick="openAddTripModal()">Ajouter un trajet</button>
      </div>`;
    return;
  }

  // Group trips by month
  const grouped = {};
  trips.forEach(t => {
    const key = t.date.slice(0, 7); // YYYY-MM
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  const carsMap = {};
  cars.forEach(c => carsMap[c.id] = c);

  el.innerHTML = Object.entries(grouped).map(([month, mTrips]) => {
    const d = new Date(month + '-01');
    const label = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return `
      <div class="mb-16">
        <p class="section-label">${label.charAt(0).toUpperCase() + label.slice(1)}</p>
        <div class="stack">
          ${mTrips.map(t => renderTripCard(t, carsMap[t.carId])).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderTripCard(trip, car) {
  const color = car ? carColorHex(car.color) : '#4cc9f0';
  const hasRoute = trip.route && trip.route.length > 0;

  return `
    <div class="trip-card" onclick="openTripDetail('${trip.id}')">
      <div class="trip-icon" style="background:${color}22;color:${color}">
        ${ICONS.trip}
      </div>
      <div class="trip-info">
        <div class="trip-name">${esc(trip.name || 'Trajet')}</div>
        <div class="trip-meta">
          ${fmtDate(trip.date)}
          ${car ? ` · ${esc(car.brand)} ${esc(car.model)}` : ''}
          ${hasRoute ? ` · <span class="pill pill-blue" style="padding:2px 7px;font-size:11px">GPS</span>` : ''}
        </div>
        <div class="trip-stats">
          ${trip.distance ? `<div class="trip-stat">
            <span class="trip-stat-val">${fmtDistance(trip.distance * 1000)}</span>
            <span class="trip-stat-lbl">Distance</span>
          </div>` : ''}
          ${trip.duration ? `<div class="trip-stat">
            <span class="trip-stat-val">${fmtDuration(trip.duration)}</span>
            <span class="trip-stat-lbl">Durée</span>
          </div>` : ''}
          ${trip.avgSpeed ? `<div class="trip-stat">
            <span class="trip-stat-val">${Math.round(trip.avgSpeed)}</span>
            <span class="trip-stat-lbl">km/h moy.</span>
          </div>` : ''}
        </div>
      </div>
      <div class="trip-chevron">${ICONS.chevron}</div>
    </div>`;
}

/* ---- Trip Detail ---- */
function openTripDetail(tripId) {
  const trip = getTripById(tripId);
  if (!trip) return;
  const car = trip.carId ? getCarById(trip.carId) : null;
  pushSubPage(
    trip.name || 'Trajet',
    (container) => _renderTripDetail(container, tripId),
    `<button class="entry-action danger" onclick="_confirmDeleteTrip('${tripId}')">${ICONS.trash}</button>`
  );
}

function _renderTripRoute(trip) {
  // Afficher l'itinéraire : depuis les waypoints si dispo, sinon start/end address
  const wps = trip.waypoints && trip.waypoints.length
    ? [
        ...trip.waypoints.filter(p => p.type === 'start'),
        ...trip.waypoints.filter(p => p.type === 'waypoint'),
        ...trip.waypoints.filter(p => p.type === 'end'),
      ]
    : [
        trip.startAddress ? { label: trip.startAddress, type: 'start' }   : null,
        trip.endAddress   ? { label: trip.endAddress,   type: 'end' }     : null,
      ].filter(Boolean);

  if (!wps.length) return '';
  return wps.map((p, i) => `
    <div class="waypoint-row" style="margin:2px 0">
      <span style="width:10px;height:10px;border-radius:50%;background:${_PICKER_COLORS[p.type] || '#4cc9f0'};flex-shrink:0;display:inline-block"></span>
      <span style="font-size:11px;color:var(--text-3);min-width:52px;flex-shrink:0">${_PICKER_LABELS[p.type] || 'Point'}</span>
      <span style="font-size:13px;color:var(--text-2)">${esc(p.label || '')}</span>
    </div>
    ${i < wps.length - 1 ? '<div class="waypoint-connector"></div>' : ''}
  `).join('');
}

function _renderTripDetail(container, tripId) {
  const trip = getTripById(tripId);
  if (!trip) return;
  const car   = trip.carId ? getCarById(trip.carId) : null;
  const color = car ? carColorHex(car.color) : '#4cc9f0';
  const hasRoute = trip.route && trip.route.length >= 2;

  container.innerHTML = `
    <div class="kpi-grid mb-16">
      ${trip.distance ? `<div class="kpi-card">
        <div class="kpi-icon" style="background:var(--blue-dim);color:var(--blue)">→</div>
        <div class="kpi-value">${fmtDistance(trip.distance * 1000)}</div>
        <div class="kpi-label">Distance</div>
      </div>` : ''}
      ${trip.duration ? `<div class="kpi-card">
        <div class="kpi-icon" style="background:var(--green-dim);color:var(--green)">⏱</div>
        <div class="kpi-value">${fmtDuration(trip.duration)}</div>
        <div class="kpi-label">Durée</div>
      </div>` : ''}
      ${trip.avgSpeed ? `<div class="kpi-card">
        <div class="kpi-icon" style="background:var(--yellow-dim);color:var(--yellow)">⚡</div>
        <div class="kpi-value">${Math.round(trip.avgSpeed)}<span style="font-size:14px"> km/h</span></div>
        <div class="kpi-label">Vitesse moy.</div>
      </div>` : ''}
      ${trip.maxSpeed ? `<div class="kpi-card">
        <div class="kpi-icon" style="background:var(--accent-dim);color:var(--accent)">▲</div>
        <div class="kpi-value">${Math.round(trip.maxSpeed)}<span style="font-size:14px"> km/h</span></div>
        <div class="kpi-label">Vitesse max.</div>
      </div>` : ''}
    </div>

    ${(trip.startAddress || trip.endAddress || car || (trip.waypoints && trip.waypoints.length)) ? `
    <div class="card mb-16" style="padding:12px 16px">
      ${car ? `<div class="flex flex-center gap-8 mb-8">
        <div class="color-dot" style="background:${color};width:10px;height:10px"></div>
        <span style="font-size:14px;font-weight:600">${esc(car.brand)} ${esc(car.model)}</span>
        ${trip.startKm ? `<span class="text-muted text-sm">· ${Number(trip.startKm).toLocaleString('fr-FR')} km</span>` : ''}
      </div>` : ''}
      ${_renderTripRoute(trip)}
    </div>` : ''}

    ${trip.notes ? `<div class="card mb-16" style="padding:14px 16px">
      <p class="section-label mb-8">Notes</p>
      <p style="font-size:14px;line-height:1.6">${esc(trip.notes)}</p>
    </div>` : ''}

    ${hasRoute ? `
      <p class="section-label mb-8">Itinéraire</p>
      <div id="trip-detail-map" style="height:280px;border-radius:var(--radius);overflow:hidden;margin-bottom:16px;border:1px solid var(--border)"></div>
    ` : ''}
  `;

  if (hasRoute) {
    requestAnimationFrame(() => _initTripDetailMap(tripId, color));
  }
}

function _initTripDetailMap(tripId, color) {
  const trip = getTripById(tripId);
  const el = document.getElementById('trip-detail-map');
  if (!el || !trip?.route?.length) return;

  const map = L.map('trip-detail-map', { zoomControl: false, attributionControl: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);

  const latlngs = trip.route.map(p => [p[0], p[1]]);
  const poly = L.polyline(latlngs, { color, weight: 3, opacity: 0.85 }).addTo(map);

  // Start/end markers
  if (latlngs.length > 0) {
    L.circleMarker(latlngs[0], { radius: 7, color: '#06d6a0', fillColor: '#06d6a0', fillOpacity: 1, weight: 2 }).addTo(map);
    L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, color: '#e63946', fillColor: '#e63946', fillOpacity: 1, weight: 2 }).addTo(map);
  }

  map.fitBounds(poly.getBounds(), { padding: [24, 24] });
}

function _confirmDeleteTrip(tripId) {
  if (!confirmAction('Supprimer ce trajet ?')) return;
  deleteTrip(tripId);
  popSubPage();
  renderTrips();
  toast('Trajet supprimé', 'info');
}

/* ================================================================
   MAP PICKER
   ================================================================ */

const _PICKER_COLORS = { start: '#06d6a0', waypoint: '#ffd60a', end: '#e63946' };
const _PICKER_LABELS = { start: 'Départ', waypoint: 'Étape', end: 'Arrivée' };

let _picker = { map: null, points: [], mode: 'start', onConfirm: null, line: null };
let _currentTripWaypoints = []; // waypoints sélectionnés via map picker

function _openMapPicker(existingPoints, onConfirm) {
  _picker.points    = existingPoints ? existingPoints.map(p => ({ ...p })) : [];
  _picker.onConfirm = onConfirm;
  _picker.mode      = 'start';
  _picker.map       = null;
  _picker.line      = null;

  const overlay = document.createElement('div');
  overlay.id        = 'map-picker-overlay';
  overlay.className = 'map-picker-overlay';
  overlay.innerHTML = `
    <div class="map-picker-header">
      <button class="icon-btn" onclick="_destroyMapPicker()" title="Annuler">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="picker-mode-group">
        <button class="picker-mode-btn active-start" id="pm-start"    onclick="_setPickerMode('start')">🟢 Départ</button>
        <button class="picker-mode-btn"              id="pm-waypoint" onclick="_setPickerMode('waypoint')">📍 Étape</button>
        <button class="picker-mode-btn"              id="pm-end"      onclick="_setPickerMode('end')">🔴 Arrivée</button>
      </div>
      <button class="btn-primary" style="white-space:nowrap" onclick="_confirmMapPicker()">Valider ✓</button>
    </div>
    <div class="picker-hint" id="picker-hint">Appuie sur la carte pour placer le point de <strong>départ</strong></div>
    <div id="picker-map-el"></div>
    <div class="picker-points-list" id="picker-points-list"><p class="text-muted text-xs">Aucun point placé</p></div>`;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    _picker.map = L.map('picker-map-el', { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(_picker.map);
    _picker.map.setView([46.6, 2.5], 6);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        p => _picker.map.setView([p.coords.latitude, p.coords.longitude], 13),
        () => {}
      );
    }

    // Restaurer les points existants
    _picker.points.forEach(p => { p.marker = _addPickerMarker(p); });
    _updatePickerLine();
    _renderPickerList();

    _picker.map.on('click', async e => {
      const { lat, lng } = e.latlng;
      const label = await _reverseGeocode(lat, lng) || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const point = { lat, lng, label, type: _picker.mode };

      // Départ/Arrivée : un seul autorisé → remplacer l'existant
      if (_picker.mode !== 'waypoint') {
        const idx = _picker.points.findIndex(p => p.type === _picker.mode);
        if (idx >= 0) { _picker.points[idx].marker?.remove(); _picker.points.splice(idx, 1); }
      }

      point.marker = _addPickerMarker(point);
      _picker.points.push(point);
      _updatePickerLine();
      _renderPickerList();
    });
  });
}

function _addPickerMarker(point) {
  const color = _PICKER_COLORS[point.type] || '#4cc9f0';
  const icon  = L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.6)"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
  });
  return L.marker([point.lat, point.lng], { icon }).addTo(_picker.map)
    .bindPopup(`<strong>${_PICKER_LABELS[point.type]}</strong><br><small>${esc(point.label || '')}</small>`);
}

function _getOrderedPickerPoints() {
  return [
    ..._picker.points.filter(p => p.type === 'start'),
    ..._picker.points.filter(p => p.type === 'waypoint'),
    ..._picker.points.filter(p => p.type === 'end'),
  ];
}

function _updatePickerLine() {
  if (_picker.line) _picker.map.removeLayer(_picker.line);
  _picker.line = null;
  const ordered = _getOrderedPickerPoints();
  if (ordered.length >= 2) {
    _picker.line = L.polyline(ordered.map(p => [p.lat, p.lng]), {
      color: '#4cc9f0', weight: 3, dashArray: '6 4', opacity: 0.7,
    }).addTo(_picker.map);
  }
}

function _setPickerMode(mode) {
  _picker.mode = mode;
  ['start', 'waypoint', 'end'].forEach(m => {
    const btn = document.getElementById(`pm-${m}`);
    if (btn) btn.className = 'picker-mode-btn' + (m === mode ? ` active-${m === 'waypoint' ? 'wp' : m}` : '');
  });
  const names = { start: 'départ', waypoint: 'étape', end: 'arrivée' };
  const hint = document.getElementById('picker-hint');
  if (hint) hint.innerHTML = `Appuie sur la carte pour placer le point d'<strong>${names[mode]}</strong>`;
}

function _removePickerPoint(idx) {
  const ordered = _getOrderedPickerPoints();
  const point   = ordered[idx];
  if (!point) return;
  point.marker?.remove();
  const i = _picker.points.indexOf(point);
  if (i >= 0) _picker.points.splice(i, 1);
  _updatePickerLine();
  _renderPickerList();
}

function _renderPickerList() {
  const el = document.getElementById('picker-points-list');
  if (!el) return;
  const ordered = _getOrderedPickerPoints();
  if (!ordered.length) { el.innerHTML = '<p class="text-muted text-xs">Aucun point placé</p>'; return; }
  el.innerHTML = ordered.map((p, i) => `
    <div class="picker-point-item">
      <span class="picker-dot" style="background:${_PICKER_COLORS[p.type] || '#4cc9f0'}"></span>
      <span class="picker-point-type">${_PICKER_LABELS[p.type]}</span>
      <span class="picker-point-label">${esc(p.label || '')}</span>
      <button class="entry-action danger" style="width:22px;height:22px;flex-shrink:0" onclick="_removePickerPoint(${i})">${ICONS.trash}</button>
    </div>`).join('');
}

async function _confirmMapPicker() {
  const ordered = _getOrderedPickerPoints();
  if (!ordered.find(p => p.type === 'start')) { toast('Place un point de départ 🟢', 'error'); return; }
  if (!ordered.find(p => p.type === 'end'))   { toast('Place un point d\'arrivée 🔴', 'error'); return; }
  const points = ordered.map(p => ({ lat: p.lat, lng: p.lng, label: p.label, type: p.type }));
  _destroyMapPicker();
  if (_picker.onConfirm) _picker.onConfirm(points);
}

function _destroyMapPicker() {
  if (_picker.map) { _picker.map.remove(); _picker.map = null; }
  document.getElementById('map-picker-overlay')?.remove();
}

/* ---- Geocoding helpers ---- */
async function _geocodeAddress(address) {
  if (!address || address.trim().length < 3) return null;
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&accept-language=fr`, { headers: { 'User-Agent': 'vroum.io/1.0' } });
    const data = await res.json();
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { }
  return null;
}

async function _reverseGeocode(lat, lng) {
  try {
    const res  = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=fr`, { headers: { 'User-Agent': 'vroum.io/1.0' } });
    const data = await res.json();
    if (data?.display_name) {
      // Raccourcir : garder rue + ville
      const parts = data.display_name.split(', ');
      return parts.slice(0, 3).join(', ');
    }
  } catch { }
  return null;
}

/* ---- OSRM — vraie route routière ---- */
async function _getRouteOSRM(points) {
  if (!points || points.length < 2) return null;
  try {
    const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
    const res    = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
    const data   = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;
    // GeoJSON : [lng, lat] → on inverse en [lat, lng]
    return {
      coords:   data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]),
      distance: data.routes[0].distance / 1000, // mètres → km
    };
  } catch { return null; }
}

/* ---- Add Trip Modal (manual) ---- */
function openAddTripModal() {
  _currentTripWaypoints = [];
  const cars = getCars();
  const carOptions = cars.map(c =>
    `<option value="${c.id}">${esc(c.name || `${c.brand} ${c.model}`)}</option>`
  ).join('');

  openModal('Nouveau trajet', `
    <div class="field">
      <label>Nom du trajet</label>
      <input type="text" id="f-tname" placeholder="Domicile → Travail">
    </div>
    <div class="field">
      <label>Voiture</label>
      <select id="f-tcar">
        <option value="">Sans voiture</option>
        ${carOptions}
      </select>
    </div>

    <div style="margin:12px 0 4px">
      <p class="section-label mb-8">Itinéraire</p>
      <button class="btn-secondary" style="width:100%;margin-bottom:8px" onclick="_openTripMapPicker()">
        🗺 Placer les points sur la carte
      </button>
      <div id="waypoints-preview"></div>
      <div id="addr-fields">
        <div class="field" style="margin-bottom:8px">
          <input type="text" id="f-tstart" placeholder="🟢 Adresse de départ (optionnel)">
        </div>
        <div class="field" style="margin-bottom:0">
          <input type="text" id="f-tend" placeholder="🔴 Adresse d'arrivée (optionnel)">
        </div>
      </div>
    </div>

    <div class="field-row" style="margin-top:12px">
      <div class="field">
        <label>Date</label>
        <input type="date" id="f-tdate" value="${todayISO()}">
      </div>
      <div class="field">
        <label>Durée (min)</label>
        <input type="number" id="f-tduration" placeholder="45" min="0">
      </div>
    </div>
    <div class="field-row">
      <div class="field">
        <label>Distance (km) <span class="text-muted" style="font-weight:400;font-size:11px">— auto si carte</span></label>
        <input type="number" id="f-tdist" placeholder="auto" min="0" step="0.1">
      </div>
      <div class="field">
        <label>Km départ</label>
        <input type="number" id="f-tstartkm" placeholder="0" min="0">
      </div>
    </div>
    <div class="field">
      <label>Notes</label>
      <textarea id="f-tnotes" placeholder="Conditions, remarques..." rows="2"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn-primary" id="btn-save-trip" onclick="_saveManualTrip()">Ajouter le trajet</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`);
}

function _openTripMapPicker() {
  _openMapPicker(_currentTripWaypoints, points => {
    _currentTripWaypoints = points;
    _renderWaypointsPreview();
  });
}

function _renderWaypointsPreview() {
  const el = document.getElementById('waypoints-preview');
  if (!el) return;
  if (!_currentTripWaypoints.length) { el.innerHTML = ''; return; }

  const ordered = [
    ..._currentTripWaypoints.filter(p => p.type === 'start'),
    ..._currentTripWaypoints.filter(p => p.type === 'waypoint'),
    ..._currentTripWaypoints.filter(p => p.type === 'end'),
  ];
  el.innerHTML = `
    <div class="waypoints-preview">
      ${ordered.map((p, i) => `
        <div class="waypoint-row">
          <span style="width:10px;height:10px;border-radius:50%;background:${_PICKER_COLORS[p.type]};flex-shrink:0;display:inline-block"></span>
          <span style="font-size:11px;color:var(--text-3);min-width:52px;flex-shrink:0">${_PICKER_LABELS[p.type]}</span>
          <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(p.label || '')}</span>
        </div>
        ${i < ordered.length - 1 ? '<div class="waypoint-connector"></div>' : ''}
      `).join('')}
    </div>
    <button class="btn-ghost" style="font-size:12px;margin-top:6px;width:100%" onclick="_openTripMapPicker()">✏️ Modifier les points</button>`;

  // Masquer les champs d'adresse texte si on a des points carte
  const addrFields = document.getElementById('addr-fields');
  if (addrFields) addrFields.style.display = 'none';
}

async function _saveManualTrip() {
  const btn = document.getElementById('btn-save-trip');
  if (btn) { btn.disabled = true; btn.textContent = 'Calcul itinéraire...'; }

  const name         = document.getElementById('f-tname')?.value.trim() || 'Trajet';
  const carId        = document.getElementById('f-tcar')?.value || null;
  const date         = document.getElementById('f-tdate')?.value || todayISO();
  const duration     = parseInt(document.getElementById('f-tduration')?.value, 10) || 0;
  const manualDist   = parseFloat(document.getElementById('f-tdist')?.value) || 0;
  const startKm      = parseInt(document.getElementById('f-tstartkm')?.value, 10) || 0;
  const notes        = document.getElementById('f-tnotes')?.value.trim() || '';
  const startAddrTxt = document.getElementById('f-tstart')?.value.trim() || '';
  const endAddrTxt   = document.getElementById('f-tend')?.value.trim() || '';

  let route        = [];
  let distance     = manualDist;
  let waypoints    = _currentTripWaypoints;
  let startAddress = _currentTripWaypoints.find(p => p.type === 'start')?.label || startAddrTxt;
  let endAddress   = _currentTripWaypoints.find(p => p.type === 'end')?.label   || endAddrTxt;

  if (waypoints.length >= 2) {
    // Points placés sur la carte → OSRM
    const ordered = [
      ...waypoints.filter(p => p.type === 'start'),
      ...waypoints.filter(p => p.type === 'waypoint'),
      ...waypoints.filter(p => p.type === 'end'),
    ];
    const osrm = await _getRouteOSRM(ordered);
    route    = osrm?.coords  || ordered.map(p => [p.lat, p.lng]);
    distance = manualDist    || osrm?.distance || _calcRouteDistance(route);
  } else if (startAddrTxt || endAddrTxt) {
    // Adresses texte → géocodage → OSRM
    const [sc, ec] = await Promise.all([_geocodeAddress(startAddrTxt), _geocodeAddress(endAddrTxt)]);
    const pts = [sc && { lat: sc[0], lng: sc[1] }, ec && { lat: ec[0], lng: ec[1] }].filter(Boolean);
    if (pts.length >= 2) {
      const osrm = await _getRouteOSRM(pts);
      route    = osrm?.coords  || pts.map(p => [p.lat, p.lng]);
      distance = manualDist    || osrm?.distance || _calcRouteDistance(route);
    } else if (pts.length === 1) {
      route = [pts[0]].map(p => [p.lat, p.lng]);
    }
  }

  const trip = {
    id: genId(), userId: getUser().id, carId: carId || null,
    name, date,
    duration:  duration * 60,
    distance,
    startKm,
    endKm:     startKm + Math.round(distance),
    avgSpeed:  duration > 0 ? (distance / (duration / 60)) : 0,
    maxSpeed:  0,
    route,
    notes,
    startAddress,
    endAddress,
    waypoints,
    createdAt: new Date().toISOString(),
    manual:    true,
  };

  await upsertTrip(trip);
  _currentTripWaypoints = [];
  closeModal();
  renderTrips();
  toast('Trajet ajouté ✓', 'success');
}

/* ---- GPS Recording (used from driving.js) ---- */
function startGPSRecording(carId) {
  if (_recording) return;
  if (!navigator.geolocation) {
    toast('GPS non disponible sur cet appareil', 'error');
    return false;
  }

  _recording   = true;
  _recRoute    = [];
  _recStart    = Date.now();
  _recMaxSpeed = 0;
  _recCarId    = carId;

  _gpsWatchId = navigator.geolocation.watchPosition(
    pos => {
      const { latitude, longitude, speed } = pos.coords;
      _recRoute.push([latitude, longitude, Date.now()]);
      const kmh = speed != null ? speed * 3.6 : 0;
      if (kmh > _recMaxSpeed) _recMaxSpeed = kmh;
    },
    err => { console.warn('GPS error:', err.message); },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );

  return true;
}

function stopGPSRecording(tripName) {
  if (!_recording) return null;

  navigator.geolocation.clearWatch(_gpsWatchId);
  _gpsWatchId = null;
  _recording  = false;

  const duration  = Math.round((Date.now() - _recStart) / 1000);
  const distance  = _calcRouteDistance(_recRoute);
  const avgSpeed  = duration > 0 ? (distance / (duration / 3600)) : 0;
  const car       = _recCarId ? getCarById(_recCarId) : null;
  const startKm   = car ? getCurrentCarKm(car) : 0;

  const trip = {
    id:        genId(),
    userId:    getUser().id,
    carId:     _recCarId || null,
    name:      tripName || `Trajet du ${new Date().toLocaleDateString('fr-FR')}`,
    date:      new Date().toISOString().slice(0, 10),
    duration,
    distance,
    startKm,
    endKm:     startKm + Math.round(distance),
    avgSpeed,
    maxSpeed:  _recMaxSpeed,
    route:     _recRoute,
    notes:     '',
    createdAt: new Date().toISOString(),
    manual:    false,
  };

  upsertTrip(trip);
  _recRoute   = [];
  _recStart   = null;
  _recCarId   = null;

  return trip;
}

function isRecording()         { return _recording; }
function getRecordingRoute()   { return _recRoute; }
function getRecordingDuration(){ return _recStart ? Math.round((Date.now() - _recStart) / 1000) : 0; }
function getRecordingDistance(){ return _calcRouteDistance(_recRoute); }

function _calcRouteDistance(route) {
  let dist = 0;
  for (let i = 1; i < route.length; i++) {
    dist += _haversine(route[i-1][0], route[i-1][1], route[i][0], route[i][1]);
  }
  return dist; // km
}

function _haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
