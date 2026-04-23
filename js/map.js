/* ============================================================
   VROUM.IO — Heatmap & Route Visualization
   ============================================================ */

let _mapInstance    = null;
let _heatLayer      = null;
let _polylineLayer  = null;
let _mapInited      = false;

function initMap() {
  if (_mapInited) {
    _mapInstance.invalidateSize();
    _refreshMapLayer();
    return;
  }

  const el = document.getElementById('main-map');
  if (!el) return;

  _mapInstance = L.map('main-map', {
    center: [46.2276, 2.2137], // France center
    zoom: 6,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
  }).addTo(_mapInstance);

  _mapInited = true;
  _refreshMapLayer();
  _populateMapFilter();
}

function _populateMapFilter() {
  const user  = getUser();
  const trips = getTrips(user.id).filter(t => t.route && t.route.length > 1);
  const cars  = getCars(user.id);
  const carsMap = {};
  cars.forEach(c => carsMap[c.id] = c);

  const select = document.getElementById('map-filter');
  if (!select) return;

  const options = [`<option value="all">Tous les trajets (${trips.length})</option>`];
  trips.forEach(t => {
    const car  = t.carId ? carsMap[t.carId] : null;
    const label = `${t.name || 'Trajet'} – ${fmtDate(t.date)}${car ? ` (${car.brand})` : ''}`;
    options.push(`<option value="${t.id}">${esc(label)}</option>`);
  });
  select.innerHTML = options.join('');

  select.onchange = () => _refreshMapLayer();
}

function _refreshMapLayer() {
  const user   = getUser();
  const filter = document.getElementById('map-filter')?.value || 'all';

  // Clear previous layers
  if (_heatLayer)     { _mapInstance.removeLayer(_heatLayer);     _heatLayer = null; }
  if (_polylineLayer) { _mapInstance.removeLayer(_polylineLayer); _polylineLayer = null; }

  if (filter === 'all') {
    _showHeatmap(user);
  } else {
    _showSingleTrip(filter);
  }
}

function _showHeatmap(user) {
  const trips = getTrips(user.id).filter(t => t.route && t.route.length > 1);

  if (trips.length === 0) {
    _showNoDataOverlay();
    return;
  }

  // Collect all GPS points for heatmap
  const points = [];
  trips.forEach(trip => {
    trip.route.forEach(pt => {
      points.push([pt[0], pt[1], 0.6]);
    });
  });

  _heatLayer = L.heatLayer(points, {
    radius:    18,
    blur:      15,
    maxZoom:   16,
    gradient:  { 0.0: '#06d6a0', 0.3: '#ffd60a', 0.65: '#f77f00', 1.0: '#e63946' },
  }).addTo(_mapInstance);

  // Fit bounds to all routes
  const allLatlngs = trips.flatMap(t => t.route.map(p => [p[0], p[1]]));
  if (allLatlngs.length > 0) {
    _mapInstance.fitBounds(L.latLngBounds(allLatlngs), { padding: [40, 40] });
  }
}

function _showSingleTrip(tripId) {
  const trip = getTripById(tripId);
  if (!trip || !trip.route || trip.route.length < 2) return;

  const car   = trip.carId ? getCarById(trip.carId) : null;
  const color = car ? carColorHex(car.color) : '#4cc9f0';
  const latlngs = trip.route.map(p => [p[0], p[1]]);

  // Draw polyline with gradient (speed-colored if possible)
  _polylineLayer = L.layerGroup();

  // Segment-by-segment coloring based on speed
  if (trip.route[0].length >= 4) {
    // route has speed data: [lat, lng, timestamp, speed]
    for (let i = 1; i < latlngs.length; i++) {
      const spd   = trip.route[i][3] || 0; // km/h
      const segColor = _speedColor(spd, trip.maxSpeed || 130);
      L.polyline([latlngs[i-1], latlngs[i]], { color: segColor, weight: 5, opacity: 0.85 }).addTo(_polylineLayer);
    }
  } else {
    L.polyline(latlngs, { color, weight: 5, opacity: 0.85 }).addTo(_polylineLayer);
  }

  // Start / end markers
  L.circleMarker(latlngs[0], {
    radius: 9, color: '#06d6a0', fillColor: '#06d6a0', fillOpacity: 1, weight: 3,
  }).bindPopup('Départ').addTo(_polylineLayer);

  L.circleMarker(latlngs[latlngs.length - 1], {
    radius: 9, color: '#e63946', fillColor: '#e63946', fillOpacity: 1, weight: 3,
  }).bindPopup('Arrivée').addTo(_polylineLayer);

  _polylineLayer.addTo(_mapInstance);

  const poly = L.polyline(latlngs);
  _mapInstance.fitBounds(poly.getBounds(), { padding: [40, 40] });
}

function _speedColor(speed, maxSpeed) {
  const ratio = Math.min(speed / (maxSpeed || 130), 1);
  if (ratio < 0.4) return '#06d6a0';
  if (ratio < 0.7) return '#ffd60a';
  return '#e63946';
}

function _showNoDataOverlay() {
  // Just keep default zoom
}

/* ---- Called when map tab is selected ---- */
function onMapTabSelected() {
  setTimeout(() => {
    initMap();
    _populateMapFilter();
  }, 50);
}
