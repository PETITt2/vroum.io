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

function _renderTripDetail(container, tripId) {
  const trip = getTripById(tripId);
  if (!trip) return;
  const car   = trip.carId ? getCarById(trip.carId) : null;
  const color = car ? carColorHex(car.color) : '#4cc9f0';
  const hasRoute = trip.route && trip.route.length > 1;

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

    ${car ? `<div class="card mb-16" style="padding:12px 16px">
      <div class="flex flex-center gap-8">
        <div class="color-dot" style="background:${color};width:10px;height:10px"></div>
        <span style="font-size:14px;font-weight:600">${esc(car.brand)} ${esc(car.model)}</span>
        ${trip.startKm ? `<span class="text-muted text-sm">· ${Number(trip.startKm).toLocaleString('fr-FR')} km</span>` : ''}
      </div>
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
  const poly = L.polyline(latlngs, { color, weight: 4, opacity: 0.9 }).addTo(map);

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

/* ---- Add Trip Modal (manual) ---- */
function openAddTripModal() {
  const cars = getCars(getUser().id);
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
    <div class="field-row">
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
        <label>Distance (km)</label>
        <input type="number" id="f-tdist" placeholder="25" min="0" step="0.1">
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
      <button class="btn-primary" onclick="_saveManualTrip()">Ajouter le trajet</button>
      <button class="btn-secondary" onclick="closeModal()">Annuler</button>
    </div>`);
}

function _saveManualTrip() {
  const name     = document.getElementById('f-tname')?.value.trim() || 'Trajet';
  const carId    = document.getElementById('f-tcar')?.value || null;
  const date     = document.getElementById('f-tdate')?.value || todayISO();
  const duration = parseInt(document.getElementById('f-tduration')?.value, 10) || 0;
  const distance = parseFloat(document.getElementById('f-tdist')?.value) || 0;
  const startKm  = parseInt(document.getElementById('f-tstartkm')?.value, 10) || 0;
  const notes    = document.getElementById('f-tnotes')?.value.trim() || '';

  const trip = {
    id: genId(), userId: getUser().id, carId: carId || null,
    name, date,
    duration:  duration * 60,
    distance,
    startKm, endKm: startKm + Math.round(distance),
    avgSpeed:  duration > 0 ? (distance / (duration / 60)) : 0,
    maxSpeed:  0,
    route:     [],
    notes,
    createdAt: new Date().toISOString(),
    manual:    true,
  };

  upsertTrip(trip);
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
