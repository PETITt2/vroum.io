/* ============================================================
   VROUM.IO — Live Driving Dashboard
   (Speedometer via GPS · G-Force via DeviceMotion · Trip recorder)
   ============================================================ */

let _speedWatchId  = null;
let _motionHandler = null;
let _drivingActive = false;

let _currentSpeed  = 0;    // km/h
let _maxSpeed      = 0;    // km/h
let _avgSpeed      = 0;    // km/h (rolling)
let _speedSamples  = [];
let _tripStartTime = null;
let _tripDistance  = 0;    // km (from GPS)

let _gLat  = 0;  // lateral G
let _gLong = 0;  // longitudinal G
let _gMax  = 0;  // max G magnitude

let _selectedCarId = null;

/* ---- Render driving page ---- */
function renderDriving() {
  const el   = document.getElementById('driving-content');
  const cars = getCars(getUser().id);

  const carOptions = cars.map(c =>
    `<option value="${c.id}" ${c.id === _selectedCarId ? 'selected' : ''}>${esc(c.name || `${c.brand} ${c.model}`)}</option>`
  ).join('');

  el.innerHTML = `
    <div class="driving-layout">

      <!-- Car selector -->
      <div class="car-selector">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v3"/>
          <rect x="9" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
        </svg>
        <div class="car-selector-info">
          <div class="car-selector-name">${cars.length === 0 ? 'Aucune voiture' : 'Voiture active'}</div>
          ${cars.length > 0
            ? `<select id="driving-car-select" onchange="_onDrivingCarChange(this.value)" style="background:none;border:none;color:var(--text-2);font-size:13px;padding:0;-webkit-appearance:none;appearance:none;width:100%">
                <option value="">Sans voiture</option>
                ${carOptions}
               </select>`
            : `<div class="car-selector-meta">Ajoute une voiture dans Garage</div>`}
        </div>
      </div>

      <!-- Speedometer card -->
      <div class="speedometer-card">
        <div class="speedometer-wrap">
          <svg class="speedometer-svg" viewBox="0 0 220 220">
            <!-- Background track -->
            <circle class="gauge-bg" cx="110" cy="110" r="90"
              stroke-dasharray="565 566"
              transform="rotate(135 110 110)"/>
            <!-- Speed fill -->
            <circle class="gauge-fill" id="gauge-fill" cx="110" cy="110" r="90"
              stroke-dasharray="0 566"
              transform="rotate(135 110 110)"/>
          </svg>
          <div class="speedometer-center">
            <div class="speed-value" id="speed-value">0</div>
            <div class="speed-unit">km/h</div>
            <div class="speed-status" id="speed-status" style="color:var(--text-3)">ARRÊTÉ</div>
          </div>
        </div>

        <div class="driving-stats">
          <div class="driving-stat">
            <div class="driving-stat-val text-blue" id="stat-avg">0</div>
            <div class="driving-stat-lbl">Moy.</div>
          </div>
          <div class="driving-stat">
            <div class="driving-stat-val text-accent" id="stat-max">0</div>
            <div class="driving-stat-lbl">Max</div>
          </div>
          <div class="driving-stat">
            <div class="driving-stat-val text-green" id="stat-dist">0</div>
            <div class="driving-stat-lbl">km</div>
          </div>
          <div class="driving-stat">
            <div class="driving-stat-val" id="stat-time">00:00</div>
            <div class="driving-stat-lbl">Durée</div>
          </div>
        </div>
      </div>

      <!-- G-Force card -->
      <div class="gforce-card">
        <div class="gforce-title">Accéléromètre · Forces G</div>
        <div class="gforce-layout">
          <div class="gforce-plot-wrap">
            <div class="gforce-plot" id="gforce-plot">
              <div class="gforce-cross-h"></div>
              <div class="gforce-cross-v"></div>
              <div class="gforce-ring" style="width:65%;height:65%"></div>
              <div class="gforce-ring" style="width:100%;height:100%"></div>
              <div class="gforce-dot" id="gforce-dot"></div>
            </div>
          </div>
          <div class="gforce-values">
            <div class="gforce-axis">
              <div class="gforce-axis-label">Latéral</div>
              <div class="gforce-axis-val" id="g-lat">0.00 <span style="font-size:14px;color:var(--text-2)">G</span></div>
            </div>
            <div class="gforce-axis">
              <div class="gforce-axis-label">Longitudinal</div>
              <div class="gforce-axis-val" id="g-long">0.00 <span style="font-size:14px;color:var(--text-2)">G</span></div>
            </div>
            <div class="gforce-axis">
              <div class="gforce-axis-label">Max enregistré</div>
              <div class="gforce-axis-val text-accent" id="g-max">0.00 <span style="font-size:14px;color:var(--text-2)">G</span></div>
            </div>
          </div>
        </div>
        <p class="text-xs text-muted mt-8" id="motion-status">En attente des capteurs...</p>
      </div>

      <!-- Record button -->
      <button id="record-btn" class="record-btn start" onclick="_toggleRecording()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/>
        </svg>
        Démarrer l'enregistrement
      </button>

      <!-- Permission hint -->
      <p class="text-xs text-muted" style="text-align:center">
        Le GPS et l'accéléromètre nécessitent les permissions de l'appareil.
      </p>

    </div>`;

  if (!_drivingActive) {
    _startDriving();
  }
}

function _onDrivingCarChange(carId) {
  _selectedCarId = carId || null;
}

/* ---- Start / stop sensors ---- */
function _startDriving() {
  _drivingActive = true;
  _startSpeedometer();
  _startMotion();
  _startUIUpdate();
}

function stopDriving() {
  _drivingActive = false;
  if (_speedWatchId != null) {
    navigator.geolocation.clearWatch(_speedWatchId);
    _speedWatchId = null;
  }
  if (_motionHandler) {
    window.removeEventListener('devicemotion', _motionHandler);
    _motionHandler = null;
  }
  clearInterval(_uiIntervalId);
}

/* ---- Speedometer (GPS) ---- */
function _startSpeedometer() {
  if (!navigator.geolocation) return;
  _speedWatchId = navigator.geolocation.watchPosition(
    pos => {
      const spd = pos.coords.speed;  // m/s or null
      _currentSpeed = spd != null ? spd * 3.6 : 0;
      if (_currentSpeed > _maxSpeed) _maxSpeed = _currentSpeed;
      _speedSamples.push(_currentSpeed);
      if (_speedSamples.length > 100) _speedSamples.shift();
      _avgSpeed = _speedSamples.reduce((a, b) => a + b, 0) / _speedSamples.length;
    },
    err => { console.warn('GPS:', err.message); },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 8000 }
  );
}

/* ---- G-Force (DeviceMotion) ---- */
function _startMotion() {
  const statusEl = document.getElementById('motion-status');

  const _doListen = () => {
    _motionHandler = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      // Convert m/s² to G (divide by 9.81)
      // lateral = x-axis, longitudinal = y-axis (device orientation dependent)
      _gLat  = (acc.x || 0) / 9.81;
      _gLong = (acc.y || 0) / 9.81;

      const mag = Math.sqrt(_gLat**2 + _gLong**2);
      if (mag > _gMax) _gMax = mag;

      if (statusEl) statusEl.textContent = 'Accéléromètre actif';
    };
    window.addEventListener('devicemotion', _motionHandler);
  };

  // iOS 13+ requires permission
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    if (statusEl) statusEl.textContent = 'Appuie pour activer le capteur de mouvement';
    statusEl?.addEventListener('click', async () => {
      try {
        const perm = await DeviceMotionEvent.requestPermission();
        if (perm === 'granted') _doListen();
        else if (statusEl) statusEl.textContent = 'Permission refusée';
      } catch { if (statusEl) statusEl.textContent = 'Capteur non disponible'; }
    }, { once: true });
  } else if (typeof DeviceMotionEvent !== 'undefined') {
    _doListen();
    if (statusEl) statusEl.textContent = 'Accéléromètre en attente...';
  } else {
    if (statusEl) statusEl.textContent = 'Accéléromètre non disponible';
  }
}

/* ---- UI update loop ---- */
let _uiIntervalId = null;

function _startUIUpdate() {
  clearInterval(_uiIntervalId);
  _uiIntervalId = setInterval(_updateDrivingUI, 200);
}

function _updateDrivingUI() {
  const maxArc    = 424; // 270° of r=90 circle: 2π×90×(270/360)≈424
  const maxSpeed  = 240;
  const fill      = Math.min(_currentSpeed / maxSpeed, 1) * maxArc;
  const arcColor  = _currentSpeed < 80 ? '#06d6a0' : _currentSpeed < 130 ? '#ffd60a' : '#e63946';

  const gaugeFill = document.getElementById('gauge-fill');
  if (gaugeFill) {
    gaugeFill.setAttribute('stroke-dasharray', `${fill.toFixed(1)} 566`);
    gaugeFill.style.stroke = arcColor;
  }

  const speedEl = document.getElementById('speed-value');
  if (speedEl) speedEl.textContent = Math.round(_currentSpeed);

  const statusEl = document.getElementById('speed-status');
  if (statusEl) {
    if (_currentSpeed < 2)        { statusEl.textContent = 'ARRÊTÉ';    statusEl.style.color = 'var(--text-3)'; }
    else if (_currentSpeed < 50)  { statusEl.textContent = 'EN VILLE';  statusEl.style.color = 'var(--green)'; }
    else if (_currentSpeed < 110) { statusEl.textContent = 'ROUTE';     statusEl.style.color = 'var(--yellow)'; }
    else                          { statusEl.textContent = 'AUTOROUTE'; statusEl.style.color = 'var(--accent)'; }
  }

  const avgEl = document.getElementById('stat-avg');
  if (avgEl) avgEl.textContent = Math.round(_avgSpeed);

  const maxEl = document.getElementById('stat-max');
  if (maxEl) maxEl.textContent = Math.round(_maxSpeed);

  // Distance from GPS recording or trip recorder
  const recDist = isRecording() ? getRecordingDistance() : _tripDistance;
  const distEl = document.getElementById('stat-dist');
  if (distEl) distEl.textContent = recDist.toFixed(1);

  // Timer
  const timeEl = document.getElementById('stat-time');
  if (timeEl && isRecording()) {
    const dur = getRecordingDuration();
    const m = Math.floor(dur / 60);
    const s = dur % 60;
    timeEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  // G-force dot position
  const plot = document.getElementById('gforce-plot');
  const dot  = document.getElementById('gforce-dot');
  if (plot && dot) {
    const size    = plot.clientWidth || 130;
    const half    = size / 2;
    const maxG    = 1.5;
    const x = half + (_gLat  / maxG) * half;
    const y = half - (_gLong / maxG) * half;
    dot.style.left = `${Math.max(7, Math.min(size - 7, x))}px`;
    dot.style.top  = `${Math.max(7, Math.min(size - 7, y))}px`;
  }

  const gLatEl  = document.getElementById('g-lat');
  const gLongEl = document.getElementById('g-long');
  const gMaxEl  = document.getElementById('g-max');
  if (gLatEl)  gLatEl.firstChild.textContent  = Math.abs(_gLat).toFixed(2) + ' ';
  if (gLongEl) gLongEl.firstChild.textContent = Math.abs(_gLong).toFixed(2) + ' ';
  if (gMaxEl)  gMaxEl.firstChild.textContent  = _gMax.toFixed(2) + ' ';
}

/* ---- Recording toggle ---- */
function _toggleRecording() {
  if (!isRecording()) {
    const ok = startGPSRecording(_selectedCarId);
    if (!ok) return;
    const btn = document.getElementById('record-btn');
    if (btn) {
      btn.classList.remove('start');
      btn.classList.add('stop');
      btn.innerHTML = `<div class="record-dot"></div> Arrêter l'enregistrement`;
    }
    toast('Enregistrement démarré', 'success');
  } else {
    _promptSaveTrip();
  }
}

function _promptSaveTrip() {
  openModal('Sauvegarder le trajet', `
    <div class="field">
      <label>Nom du trajet</label>
      <input type="text" id="f-recname" placeholder="Trajet du ${new Date().toLocaleDateString('fr-FR')}"
             value="Trajet du ${new Date().toLocaleDateString('fr-FR')}">
    </div>
    <div class="form-actions">
      <button class="btn-primary" onclick="_finishRecording()">Sauvegarder</button>
      <button class="btn-danger" onclick="_cancelRecording()">Annuler l'enregistrement</button>
    </div>`);
}

function _finishRecording() {
  const name = document.getElementById('f-recname')?.value.trim() || '';
  const trip = stopGPSRecording(name);
  closeModal();
  const btn = document.getElementById('record-btn');
  if (btn) {
    btn.classList.remove('stop');
    btn.classList.add('start');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg> Démarrer l'enregistrement`;
  }
  if (trip) toast(`Trajet "${trip.name}" sauvegardé ✓`, 'success');
  // Reset stats
  _maxSpeed = 0; _avgSpeed = 0; _speedSamples = []; _tripDistance = 0;
}

function _cancelRecording() {
  stopGPSRecording('__discard__');
  // Remove the discarded trip
  const trips = getTrips(getUser().id);
  const last  = trips[trips.length - 1];
  if (last?.name === '__discard__') deleteTrip(last.id);
  closeModal();
  const btn = document.getElementById('record-btn');
  if (btn) {
    btn.classList.remove('stop');
    btn.classList.add('start');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg> Démarrer l'enregistrement`;
  }
  toast('Enregistrement annulé', 'info');
}
