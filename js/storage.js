/* ============================================================
   VROUM.IO — Storage (Supabase + in-memory store)
   ============================================================ */

const { createClient } = window.supabase;
const sb = createClient(
  'https://cmzspettqogqharrkuta.supabase.co',
  'sb_publishable_ceS3rbfRKwbEOnz_VofyIw_c5Lmshuf'
);

/* ---- In-memory store ---- */
let _store = {
  cars:        [],  // [{id, userId, name, brand, ..., kmHistory:[]}]
  trips:       [],  // [{id, userId, carId, ...}]
  maintenance: [],
  fuels:       [],
  notes:       [],
  carMembers:  {},  // {carId: [{userId, role, username}]}
};

function genId() { return crypto.randomUUID(); }

/* ============================================================
   CACHE localStorage (chargement instantané au démarrage)
   ============================================================ */

const CACHE_KEY = 'vroumio_cache_v1';

function saveCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      cars:        _store.cars,
      trips:       _store.trips,
      maintenance: _store.maintenance,
      fuels:       _store.fuels,
      notes:       _store.notes,
      carMembers:  _store.carMembers,
      savedAt:     Date.now(),
    }));
  } catch { /* quota dépassé — ignore */ }
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const c = JSON.parse(raw);
    _store.cars        = c.cars        || [];
    _store.trips       = c.trips       || [];
    _store.maintenance = c.maintenance || [];
    _store.fuels       = c.fuels       || [];
    _store.notes       = c.notes       || [];
    _store.carMembers  = c.carMembers  || {};
    return true;
  } catch { return false; }
}

function clearCache() {
  localStorage.removeItem(CACHE_KEY);
}

/* ---- Sync all data from Supabase ---- */
async function syncAll() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;

  try {
    // Cars the current user is member of (RLS filters this automatically)
    // We select nested km_history and car_members+profiles in one query
    const { data: carsRaw, error: carsErr } = await sb
      .from('cars')
      .select(`
        *,
        km_history ( * ),
        car_members ( user_id, role, profiles ( username ) )
      `)
      .order('created_at', { ascending: true });

    if (carsErr) throw carsErr;

    const carIds = (carsRaw || []).map(c => c.id);

    // Parallel fetch
    const [tripsRes, maintRes, fuelsRes, notesRes] = await Promise.all([
      sb.from('trips').select('*').eq('user_id', user.id).order('date', { ascending: false }),
      carIds.length
        ? sb.from('maintenance').select('*').in('car_id', carIds).order('date', { ascending: false })
        : Promise.resolve({ data: [] }),
      carIds.length
        ? sb.from('fuels').select('*').in('car_id', carIds).order('date', { ascending: false })
        : Promise.resolve({ data: [] }),
      carIds.length
        ? sb.from('notes').select('*').in('car_id', carIds).order('date', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    // Map cars
    _store.cars = (carsRaw || []).map(row => ({
      id:        row.id,
      userId:    row.owner_id,
      name:      row.name || '',
      brand:     row.brand,
      model:     row.model,
      year:      row.year || '',
      color:     row.color || 'autre',
      plate:     row.plate || '',
      fuelType:  row.fuel_type || 'Essence',
      initialKm: row.initial_km || 0,
      createdAt: row.created_at,
      kmHistory: (row.km_history || [])
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(k => ({ id: k.id, date: k.date, km: k.km, note: k.note || '' })),
    }));

    // Map car members (for sharing UI)
    _store.carMembers = {};
    (carsRaw || []).forEach(row => {
      _store.carMembers[row.id] = (row.car_members || []).map(m => ({
        userId:   m.user_id,
        role:     m.role,
        username: m.profiles?.username || '…',
      }));
    });

    // Map trips
    _store.trips = (tripsRes.data || []).map(row => ({
      id:        row.id,
      userId:    row.user_id,
      carId:     row.car_id,
      name:      row.name || 'Trajet',
      date:      row.date,
      duration:  row.duration || 0,
      distance:  row.distance || 0,
      startKm:   row.start_km || 0,
      endKm:     row.end_km || 0,
      avgSpeed:  row.avg_speed || 0,
      maxSpeed:  row.max_speed || 0,
      route:     row.route || [],
      notes:     row.notes || '',
      manual:    row.manual || false,
      createdAt: row.created_at,
    }));

    // Map maintenance
    _store.maintenance = (maintRes.data || []).map(row => ({
      id:          row.id,
      carId:       row.car_id,
      userId:      row.user_id,
      type:        row.type,
      description: row.description || '',
      date:        row.date,
      km:          row.km || 0,
      cost:        row.cost || 0,
      nextKm:      row.next_km || 0,
      createdAt:   row.created_at,
    }));

    // Map fuels
    _store.fuels = (fuelsRes.data || []).map(row => ({
      id:            row.id,
      carId:         row.car_id,
      userId:        row.user_id,
      date:          row.date,
      liters:        row.liters || 0,
      pricePerLiter: row.price_per_liter || 0,
      totalPrice:    row.total_price || 0,
      km:            row.km || 0,
      consumption:   row.consumption || 0,
      createdAt:     row.created_at,
    }));

    // Map notes
    _store.notes = (notesRes.data || []).map(row => ({
      id:        row.id,
      carId:     row.car_id,
      userId:    row.user_id,
      date:      row.date,
      text:      row.text,
      createdAt: row.created_at,
    }));

    saveCache(); // Sauvegarde pour le prochain démarrage

  } catch (err) {
    console.error('syncAll error:', err);
    throw err;
  }
}

/* ============================================================
   READ — synchronous (from _store)
   ============================================================ */

function getCars()              { return _store.cars; }
function getCarById(id)         { return _store.cars.find(c => c.id === id) || null; }
function getCarMembers(carId)   { return _store.carMembers[carId] || []; }

function getTrips()             { return _store.trips; }
function getTripsByCarId(carId) { return _store.trips.filter(t => t.carId === carId); }
function getTripById(id)        { return _store.trips.find(t => t.id === id) || null; }

function getMaintenanceByCarId(carId) { return _store.maintenance.filter(m => m.carId === carId); }
function getMaintenanceById(id)        { return _store.maintenance.find(m => m.id === id) || null; }

function getFuelsByCarId(carId) { return _store.fuels.filter(f => f.carId === carId); }
function getNotesByCarId(carId) { return _store.notes.filter(n => n.carId === carId); }

/* ============================================================
   CARS — write
   ============================================================ */

async function upsertCar(car) {
  const idx = _store.cars.findIndex(c => c.id === car.id);
  if (idx >= 0) _store.cars[idx] = { ..._store.cars[idx], ...car };
  else           _store.cars.push(car);

  const { error } = await sb.from('cars').upsert({
    id:         car.id,
    owner_id:   car.userId,
    name:       car.name || '',
    brand:      car.brand,
    model:      car.model,
    year:       car.year || '',
    color:      car.color || 'autre',
    plate:      car.plate || '',
    fuel_type:  car.fuelType || 'Essence',
    initial_km: car.initialKm || 0,
  });
  if (error) { toast('Erreur sync voiture', 'error'); console.error(error); }
  return car;
}

async function deleteCar(id) {
  _store.cars        = _store.cars.filter(c => c.id !== id);
  _store.trips       = _store.trips.filter(t => t.carId !== id);
  _store.maintenance = _store.maintenance.filter(m => m.carId !== id);
  _store.fuels       = _store.fuels.filter(f => f.carId !== id);
  _store.notes       = _store.notes.filter(n => n.carId !== id);
  delete _store.carMembers[id];

  const { error } = await sb.from('cars').delete().eq('id', id);
  if (error) { toast('Erreur suppression voiture', 'error'); console.error(error); }
}

/* ============================================================
   KM HISTORY — separate table
   ============================================================ */

async function addKmHistory(carId, entry) {
  const car = getCarById(carId);
  if (car) {
    car.kmHistory = [...(car.kmHistory || []), entry].sort((a, b) => a.date.localeCompare(b.date));
  }
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from('km_history').insert({
    id:      entry.id,
    car_id:  carId,
    user_id: user.id,
    km:      entry.km,
    note:    entry.note || '',
    date:    entry.date,
  });
  if (error) { toast('Erreur sync kilométrage', 'error'); console.error(error); }
}

async function removeKmHistory(carId, entryId) {
  const car = getCarById(carId);
  if (car) car.kmHistory = (car.kmHistory || []).filter(e => e.id !== entryId);
  const { error } = await sb.from('km_history').delete().eq('id', entryId);
  if (error) { toast('Erreur suppression kilométrage', 'error'); console.error(error); }
}

/* ============================================================
   TRIPS — write
   ============================================================ */

async function upsertTrip(trip) {
  const idx = _store.trips.findIndex(t => t.id === trip.id);
  if (idx >= 0) _store.trips[idx] = trip;
  else           _store.trips.unshift(trip);

  const { error } = await sb.from('trips').upsert({
    id:        trip.id,
    car_id:    trip.carId || null,
    user_id:   trip.userId,
    name:      trip.name || 'Trajet',
    date:      trip.date,
    duration:  trip.duration || 0,
    distance:  trip.distance || 0,
    start_km:  trip.startKm || 0,
    end_km:    trip.endKm || 0,
    avg_speed: trip.avgSpeed || 0,
    max_speed: trip.maxSpeed || 0,
    route:     trip.route || [],
    notes:     trip.notes || '',
    manual:    trip.manual || false,
  });
  if (error) { toast('Erreur sync trajet', 'error'); console.error(error); }
  return trip;
}

async function deleteTrip(id) {
  _store.trips = _store.trips.filter(t => t.id !== id);
  const { error } = await sb.from('trips').delete().eq('id', id);
  if (error) console.error(error);
}

/* ============================================================
   MAINTENANCE — write
   ============================================================ */

async function upsertMaintenance(entry) {
  const idx = _store.maintenance.findIndex(m => m.id === entry.id);
  if (idx >= 0) _store.maintenance[idx] = entry;
  else           _store.maintenance.unshift(entry);

  const { error } = await sb.from('maintenance').upsert({
    id:          entry.id,
    car_id:      entry.carId,
    user_id:     entry.userId,
    type:        entry.type,
    description: entry.description || '',
    date:        entry.date,
    km:          entry.km || 0,
    cost:        entry.cost || 0,
    next_km:     entry.nextKm || 0,
  });
  if (error) { toast('Erreur sync entretien', 'error'); console.error(error); }
  return entry;
}

async function deleteMaintenance(id) {
  _store.maintenance = _store.maintenance.filter(m => m.id !== id);
  const { error } = await sb.from('maintenance').delete().eq('id', id);
  if (error) console.error(error);
}

/* ============================================================
   FUELS — write
   ============================================================ */

async function upsertFuel(entry) {
  const idx = _store.fuels.findIndex(f => f.id === entry.id);
  if (idx >= 0) _store.fuels[idx] = entry;
  else           _store.fuels.unshift(entry);

  const { error } = await sb.from('fuels').upsert({
    id:              entry.id,
    car_id:          entry.carId,
    user_id:         entry.userId,
    date:            entry.date,
    liters:          entry.liters || 0,
    price_per_liter: entry.pricePerLiter || 0,
    total_price:     entry.totalPrice || 0,
    km:              entry.km || 0,
    consumption:     entry.consumption || 0,
  });
  if (error) { toast('Erreur sync plein', 'error'); console.error(error); }
  return entry;
}

async function deleteFuel(id) {
  _store.fuels = _store.fuels.filter(f => f.id !== id);
  const { error } = await sb.from('fuels').delete().eq('id', id);
  if (error) console.error(error);
}

/* ============================================================
   NOTES — write
   ============================================================ */

async function upsertNote(entry) {
  const idx = _store.notes.findIndex(n => n.id === entry.id);
  if (idx >= 0) _store.notes[idx] = entry;
  else           _store.notes.unshift(entry);

  const { error } = await sb.from('notes').upsert({
    id:      entry.id,
    car_id:  entry.carId,
    user_id: entry.userId,
    date:    entry.date,
    text:    entry.text,
  });
  if (error) { toast('Erreur sync note', 'error'); console.error(error); }
  return entry;
}

async function deleteNote(id) {
  _store.notes = _store.notes.filter(n => n.id !== id);
  const { error } = await sb.from('notes').delete().eq('id', id);
  if (error) console.error(error);
}

/* ============================================================
   CAR SHARING — members
   ============================================================ */

async function addCarMember(carId, userId, username, role = 'member') {
  if (!_store.carMembers[carId]) _store.carMembers[carId] = [];
  _store.carMembers[carId].push({ userId, role, username });

  const { error } = await sb.from('car_members').insert({ car_id: carId, user_id: userId, role });
  if (error) {
    _store.carMembers[carId] = _store.carMembers[carId].filter(m => m.userId !== userId);
    toast('Erreur invitation', 'error');
    console.error(error);
    return false;
  }
  return true;
}

async function removeCarMember(carId, userId) {
  if (_store.carMembers[carId]) {
    _store.carMembers[carId] = _store.carMembers[carId].filter(m => m.userId !== userId);
  }
  const { error } = await sb.from('car_members').delete().eq('car_id', carId).eq('user_id', userId);
  if (error) { toast('Erreur suppression membre', 'error'); console.error(error); }
}

async function findUserByUsername(username) {
  const { data, error } = await sb.from('profiles').select('id, username').eq('username', username).maybeSingle();
  if (error) { console.error(error); return null; }
  return data; // {id, username} or null
}

/* ============================================================
   HELPERS
   ============================================================ */

function getCurrentCarKm(car) {
  if (!car.kmHistory || car.kmHistory.length === 0) return car.initialKm || 0;
  return car.kmHistory[car.kmHistory.length - 1].km;
}

function getCarTotalDistance(carId) {
  return getTripsByCarId(carId).reduce((s, t) => s + (t.distance || 0), 0);
}

/* ============================================================
   EXPORT / NUKE
   ============================================================ */

function exportAll() {
  const data = {
    exportedAt:  new Date().toISOString(),
    cars:        _store.cars,
    trips:       _store.trips,
    maintenance: _store.maintenance,
    fuels:       _store.fuels,
    notes:       _store.notes,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `vroumio-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function nukeDB() {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return;
  // Delete owned cars (CASCADE handles maintenance/fuels/notes/km_history/car_members)
  for (const car of _store.cars.filter(c => c.userId === user.id)) {
    await sb.from('cars').delete().eq('id', car.id);
  }
  // Leave shared cars
  for (const car of _store.cars.filter(c => c.userId !== user.id)) {
    await sb.from('car_members').delete().eq('car_id', car.id).eq('user_id', user.id);
  }
  // Delete own trips
  await sb.from('trips').delete().eq('user_id', user.id);
  _store = { cars: [], trips: [], maintenance: [], fuels: [], notes: [], carMembers: {} };
}
