const STORAGE_KEY = "garage-social-app-v3";
const runtimeConfig = window.GARAGE_SOCIAL_CONFIG || {};

const seed = {
  auth: { mode: "local", currentUserId: null },
  users: [],
  cars: [],
  trips: [],
  fuels: [],
  maintenance: [],
  notes: [],
};

const $ = (selector) => document.querySelector(selector);
const state = loadState();
let feedFilter = "all";

document.title = runtimeConfig.appName || "VROUM.IO";
document.body.classList.add("app-locked");
const titleNode = document.querySelector("h1");
if (titleNode && runtimeConfig.appName) titleNode.textContent = runtimeConfig.appName;

const refs = {
  authButton: $("#open-auth"),
  enterAppButton: $("#enter-app"),
  loadingScreen: $("#loading-screen"),
  appShell: $("#app-shell"),
  hero: $("#hero-stats"),
  dash: $("#dashboard-cards"),
  analytics: $("#analytics-grid"),
  cars: $("#cars-list"),
  profiles: $("#profiles-list"),
  feed: $("#feed-list"),
  routeMap: $("#route-map"),
  routeMapSummary: $("#route-map-summary"),
  modal: $("#modal-root"),
  filter: $("#dashboard-car-filter"),
  importInput: $("#import-file-input"),
};

let modalState = { id: null, message: "", meta: {} };
let routeMapState = { map: null, layerGroup: null };

const modals = {
  "profile-modal": ["Compte", "Creer ou modifier un profil", renderProfileForm],
  "car-modal": ["Vehicule", "Ajouter une voiture", renderCarForm],
  "trip-modal": ["Journal", "Ajouter un trajet", renderTripForm],
  "fuel-modal": ["Suivi conso", "Ajouter un plein", renderFuelForm],
  "maintenance-modal": ["Entretien", "Ajouter un entretien", renderMaintenanceForm],
  "note-modal": ["Observation", "Ajouter une note", renderNoteForm],
  "follow-modal": ["Social", "Suivre un profil ou une voiture", renderFollowForm],
  "auth-modal": ["Acces", "Connexion et comptes", renderAuthPanel],
};

document.addEventListener("click", (event) => {
  const open = event.target.closest("[data-open-modal]");
  const close = event.target.closest("[data-close-modal]");
  const action = event.target.closest("[data-action]");

  if (open) return openModal(open.dataset.openModal, "", { mode: open.dataset.mode, id: open.dataset.id });
  if (close && (!close.classList.contains("modal-backdrop") || event.target === close)) return closeModal();
  if (!action) return;

  if (action.dataset.action === "toggle-visibility") return toggleCarVisibility(action.dataset.carId);
  if (action.dataset.action === "toggle-follow") return toggleFollow(action.dataset.kind, action.dataset.id);
  if (action.dataset.action === "edit-car") return openModal("car-modal", "", { mode: "edit", id: action.dataset.id });
  if (action.dataset.action === "delete-car") return deleteCar(action.dataset.id);
  if (action.dataset.action === "edit-entry") return openModal(`${action.dataset.kind}-modal`, "", { mode: "edit", id: action.dataset.id });
  if (action.dataset.action === "delete-entry") return deleteEntry(action.dataset.kind, action.dataset.id);
  if (action.dataset.action === "reset-app") return resetAppData();
  if (action.dataset.action === "export-data") return exportData();
  if (action.dataset.action === "import-data") return refs.importInput?.click();
  if (action.dataset.action === "logout") return logout();
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("form");
  if (!form) return;

  event.preventDefault();
  const formData = new FormData(form);

  ({
    "save-profile": saveProfile,
    "save-car": saveCar,
    "save-trip": saveTrip,
    "save-fuel": saveFuel,
    "save-maintenance": saveMaintenance,
    "save-note": saveNote,
    "save-follow": saveFollow,
    "auth-login": handleLogin,
    "auth-register": handleRegister,
  }[form.dataset.formAction] || (() => {}))(formData);
});

refs.authButton.addEventListener("click", () => openModal("auth-modal"));
refs.filter.addEventListener("change", renderAll);
refs.importInput?.addEventListener("change", importData);
refs.enterAppButton?.addEventListener("click", unlockApp);

$("#feed-tabs").addEventListener("click", (event) => {
  const tab = event.target.closest("[data-feed]");
  if (!tab) return;
  feedFilter = tab.dataset.feed;
  document.querySelectorAll(".tab").forEach((node) => node.classList.toggle("is-active", node === tab));
  renderFeed();
});

renderAll();
window.setTimeout(unlockApp, 1800);

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }

  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return crypto.randomUUID();
}

function unlockApp() {
  document.body.classList.remove("app-locked");
  document.body.classList.add("app-ready");
  window.setTimeout(() => routeMapState.map?.invalidateSize(), 120);
}

function cloneSeed() {
  return structuredClone(seed);
}

function normalizeState(rawState) {
  const nextState = structuredClone(rawState);
  if (!nextState.auth) nextState.auth = { mode: "local", currentUserId: null };
  if (!Array.isArray(nextState.users)) nextState.users = [];
  if (!Array.isArray(nextState.cars)) nextState.cars = [];
  if (!Array.isArray(nextState.trips)) nextState.trips = [];
  if (!Array.isArray(nextState.fuels)) nextState.fuels = [];
  if (!Array.isArray(nextState.maintenance)) nextState.maintenance = [];
  if (!Array.isArray(nextState.notes)) nextState.notes = [];

  nextState.users = nextState.users.map((item) => ({
    followedUserIds: [],
    followedCarIds: [],
    ...item,
    followedUserIds: Array.isArray(item.followedUserIds) ? item.followedUserIds : [],
    followedCarIds: Array.isArray(item.followedCarIds) ? item.followedCarIds : [],
  }));

  nextState.cars = nextState.cars.map((item) => ({
    sharedWith: [],
    ...item,
    sharedWith: Array.isArray(item.sharedWith) ? item.sharedWith : [],
  }));

  nextState.trips = nextState.trips.map((item) => ({
    routePoints: [],
    ...item,
    routePoints: Array.isArray(item.routePoints) ? item.routePoints : [],
  }));

  return nextState;
}

function replaceState(nextState) {
  Object.keys(state).forEach((key) => delete state[key]);
  Object.assign(state, normalizeState(nextState));
}

function me() {
  return state.users.find((user) => user.id === state.auth.currentUserId) || null;
}

function car(id) {
  return state.cars.find((item) => item.id === id) || null;
}

function user(id) {
  return state.users.find((item) => item.id === id) || null;
}

function collectionByKind(kind) {
  return {
    trip: state.trips,
    fuel: state.fuels,
    maintenance: state.maintenance,
    note: state.notes,
  }[kind] || null;
}

function findEntry(kind, id) {
  return collectionByKind(kind)?.find((item) => item.id === id) || null;
}

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function eur(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function day(value) {
  if (!value) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function sortDate(a, b) {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function requireText(value, label) {
  if (String(value || "").trim()) return null;
  return `${label} est requis.`;
}

function requireDate(value, label) {
  if (String(value || "").trim()) return null;
  return `${label} est requise.`;
}

function requirePositiveNumber(value, label) {
  if (!isFiniteNumber(value) || Number(value) < 0) return `${label} doit etre superieur ou egal a 0.`;
  return null;
}

function parseRoutePoints(value) {
  const raw = String(value || "").trim();
  if (!raw) return { points: [], error: null };

  const points = raw
    .split("|")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [latRaw, lngRaw] = chunk.split(",").map((item) => item.trim());
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    });

  if (points.some((point) => !point)) {
    return { points: [], error: "Le trace de route doit respecter le format lat,lng | lat,lng." };
  }

  if (points.length < 2) {
    return { points: [], error: "Ajoute au moins deux points pour afficher un trajet sur la carte." };
  }

  return { points, error: null };
}

function serializeRoutePoints(points) {
  if (!Array.isArray(points) || !points.length) return "";
  return points.map((point) => `${point[0]}, ${point[1]}`).join(" | ");
}

function routeUsageColor(count, min, max) {
  if (max === min) return "#ffb36b";
  const ratio = (count - min) / (max - min);
  const red = Math.round(45 + ratio * (255 - 45));
  const green = Math.round(212 - ratio * (212 - 90));
  const blue = Math.round(191 - ratio * (191 - 90));
  return `rgb(${red}, ${green}, ${blue})`;
}

function routeKey(points) {
  return points.map((point) => `${point[0].toFixed(3)},${point[1].toFixed(3)}`).join("|");
}

function refreshCarOdometer(carId) {
  const vehicle = car(carId);
  if (!vehicle) return;

  const maxTrip = state.trips.filter((item) => item.carId === carId).reduce((max, item) => Math.max(max, Number(item.endKm || 0)), 0);
  const maxFuel = state.fuels.filter((item) => item.carId === carId).reduce((max, item) => Math.max(max, Number(item.odometer || 0)), 0);
  const maxMaintenance = state.maintenance.filter((item) => item.carId === carId).reduce((max, item) => Math.max(max, Number(item.odometer || 0)), 0);
  vehicle.odometer = Math.max(Number(vehicle.odometer || 0), maxTrip, maxFuel, maxMaintenance);
}

function metric(title, value, text) {
  return `<article class="metric-card"><h4>${esc(title)}</h4><p>${esc(value)}</p><small>${esc(text)}</small></article>`;
}

function visTag(visibility) {
  const labels = { public: "Public", private: "Prive", followers: "Abonnes" };
  const classes = { public: "is-public", private: "is-private", followers: "" };
  return `<span class="status-pill ${classes[visibility] || ""}">${labels[visibility] || visibility}</span>`;
}

function visSelect(name, selected = "private") {
  return `
    <select class="surface-input" name="${name}">
      <option value="private" ${selected === "private" ? "selected" : ""}>Prive</option>
      <option value="followers" ${selected === "followers" ? "selected" : ""}>Abonnes</option>
      <option value="public" ${selected === "public" ? "selected" : ""}>Public</option>
    </select>
  `;
}

function requireAuth() {
  if (me()) return true;
  openModal("auth-modal", "Connecte-toi pour utiliser cette action.");
  return false;
}

function canAccessProfile(profile) {
  const current = me();
  if (profile.visibility === "public") return true;
  if (!current) return false;
  if (current.id === profile.id) return true;
  if (profile.visibility === "followers") return current.followedUserIds.includes(profile.id);
  return false;
}

function canAccessCar(vehicle) {
  if (!vehicle) return false;
  const current = me();
  const sharedWith = Array.isArray(vehicle?.sharedWith) ? vehicle.sharedWith : [];
  if (vehicle.visibility === "public") return true;
  if (!current) return false;
  if (vehicle.ownerId === current.id) return true;
  if (sharedWith.includes(current.id)) return true;
  if (vehicle.visibility === "followers") return current.followedCarIds.includes(vehicle.id);
  return false;
}

function canEditCar(vehicle) {
  const current = me();
  if (!current || !vehicle || !Array.isArray(vehicle.sharedWith)) return false;
  return vehicle.ownerId === current.id || vehicle.sharedWith.includes(current.id);
}

function canAccessRecord(record) {
  const relatedCar = car(record.carId);
  if (!relatedCar || !canAccessCar(relatedCar)) return false;
  if (record.visibility === "public") return true;
  const current = me();
  if (!current) return false;
  if (record.userId === current.id) return true;
  if (record.visibility === "followers") {
    return current.followedCarIds.includes(relatedCar.id) || current.followedUserIds.includes(record.userId);
  }
  return relatedCar.ownerId === current.id || relatedCar.sharedWith.includes(current.id);
}

function visibleUsers() {
  return state.users.filter((item) => canAccessProfile(item));
}

function visibleCars() {
  return state.cars.filter((item) => canAccessCar(item));
}

function editableCars() {
  return visibleCars().filter((item) => canEditCar(item));
}

function selectedCars() {
  const cars = visibleCars();
  if (!refs.filter.value || refs.filter.value === "all") return cars;
  return cars.filter((item) => item.id === refs.filter.value);
}

function updateAuthButton() {
  const current = me();
  refs.authButton.textContent = current ? current.name : state.users.length ? "Connexion" : "Creer mon espace";
}

function renderAll() {
  const previous = refs.filter.value || "all";
  const cars = visibleCars();
  refs.filter.innerHTML = [`<option value="all">Toutes les voitures visibles</option>`, ...cars.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`)].join("");
  refs.filter.value = cars.some((item) => item.id === previous) ? previous : "all";
  updateAuthButton();
  renderHero();
  renderDashboard();
  renderCars();
  renderProfiles();
  renderFeed();
  renderRouteMap();
  renderAnalytics();
  saveState();
}

function renderHero() {
  const cars = visibleCars();
  const ids = new Set(cars.map((item) => item.id));
  const trips = state.trips.filter((item) => ids.has(item.carId) && canAccessRecord(item));
  const fuels = state.fuels.filter((item) => ids.has(item.carId) && canAccessRecord(item));
  const maintenance = state.maintenance.filter((item) => ids.has(item.carId) && canAccessRecord(item));

  const totalDistance = trips.reduce((sum, item) => sum + Number(item.distanceKm || 0), 0);
  const fuelCost = fuels.reduce((sum, item) => sum + Number(item.costTotal || 0), 0);
  const maintenanceCost = maintenance.reduce((sum, item) => sum + Number(item.cost || 0), 0);

   if (!cars.length && !me()) {
    refs.hero.innerHTML = `
      <article class="metric-card">
        <h4>Bienvenue</h4>
        <p>0 voiture</p>
        <small>Cree ton compte puis ajoute ta premiere voiture.</small>
      </article>
      <article class="metric-card">
        <h4>Configuration locale</h4>
        <p>100%</p>
        <small>Tes donnees restent dans ce navigateur tant que tu ne les exportes pas.</small>
      </article>
    `;
    return;
  }

  refs.hero.innerHTML = [
    metric("Voitures", cars.length, "Suivi multi-vehicules"),
    metric("Km traces", `${Math.round(totalDistance)} km`, "Journal cumule"),
    metric("Budget carburant", eur(fuelCost), "Pleins visibles"),
    metric("Entretien", eur(maintenanceCost), `${cars.filter((item) => item.sharedWith.length).length} voiture(s) partagee(s)`),
  ].join("");
}

function renderDashboard() {
  const ids = new Set(selectedCars().map((item) => item.id));
  const trips = state.trips.filter((item) => ids.has(item.carId) && canAccessRecord(item));
  const fuels = state.fuels.filter((item) => ids.has(item.carId) && canAccessRecord(item));
  const maintenance = state.maintenance.filter((item) => ids.has(item.carId) && canAccessRecord(item));

  const distance = trips.reduce((sum, item) => sum + Number(item.distanceKm || 0), 0);
  const liters = fuels.reduce((sum, item) => sum + Number(item.liters || 0), 0);
  const fuelCost = fuels.reduce((sum, item) => sum + Number(item.costTotal || 0), 0);
  const maintenanceCost = maintenance.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const averageConsumption = distance > 0 && liters > 0 ? (liters / distance) * 100 : 0;

  refs.dash.innerHTML = [
    metric("Distance", `${distance.toFixed(0)} km`, "Trajets filtres"),
    metric("Pleins", `${liters.toFixed(1)} L`, `${eur(fuelCost)} depenses`),
    metric("Conso estimee", `${averageConsumption.toFixed(1)} L/100`, "Ajustable avec plus de donnees"),
    metric("Entretien", eur(maintenanceCost), `${maintenance.length} intervention(s)`),
  ].join("");
}

function renderCars() {
  const cars = visibleCars();
  if (!cars.length) {
    refs.cars.innerHTML = `<div class="empty-state">Aucune voiture visible. Connecte-toi ou cree un compte pour commencer.</div>`;
    return;
  }

  refs.cars.innerHTML = cars.map((item) => {
    const trips = state.trips.filter((entry) => entry.carId === item.id && canAccessRecord(entry)).length;
    const fuels = state.fuels.filter((entry) => entry.carId === item.id && canAccessRecord(entry)).length;
    const maintenanceEntries = state.maintenance.filter((entry) => entry.carId === item.id && canAccessRecord(entry));
    const owner = user(item.ownerId);
    const totalTripKm = state.trips
      .filter((entry) => entry.carId === item.id && canAccessRecord(entry))
      .reduce((sum, entry) => sum + Number(entry.distanceKm || 0), 0);
    const totalCost =
      state.fuels.filter((entry) => entry.carId === item.id && canAccessRecord(entry)).reduce((sum, entry) => sum + Number(entry.costTotal || 0), 0) +
      maintenanceEntries.reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
    const averageCost = totalTripKm ? `${(totalCost / totalTripKm).toFixed(2)} EUR/km` : "n/a";
    const lastMaintenance = [...maintenanceEntries].sort(sortDate)[0];
    const current = me();
    const followed = current ? current.followedCarIds.includes(item.id) : false;
    const editable = canEditCar(item);

    return `
      <article class="car-card">
        <div class="card-header">
          <div>
            <h4>${esc(item.name)}</h4>
            <p class="muted">${esc(item.brand)} ${esc(item.model)} - ${item.year} - ${esc(item.color || "Couleur non precisee")}</p>
          </div>
          <div>
            ${current ? `<button class="surface-link" data-action="toggle-follow" data-kind="car" data-id="${item.id}" type="button">${followed ? "Ne plus suivre" : "Suivre"}</button>` : ""}
            ${editable ? `<button class="surface-link" data-action="toggle-visibility" data-car-id="${item.id}" type="button">Visibilite</button>` : ""}
          </div>
        </div>
        <div class="chip-row">
          ${visTag(item.visibility)}
          <span class="tag">${item.odometer.toLocaleString("fr-FR")} km</span>
          <span class="tag is-shared">${item.sharedWith.length + 1} contributeur(s)</span>
          <span class="tag">${esc(item.fuelType)}</span>
        </div>
        <div class="stat-row">
          <div>
            <small class="muted">Proprietaire</small>
            <p>${esc(owner?.name || "Inconnu")}</p>
          </div>
          <div>
            <small class="muted">Cout moyen</small>
            <p>${averageCost}</p>
          </div>
        </div>
        <div class="meta-row">
          <span class="tag">${trips} trajet(s)</span>
          <span class="tag">${fuels} plein(s)</span>
          <span class="tag">${maintenanceEntries.length} entretien(s)</span>
          ${lastMaintenance ? `<span class="tag is-alert">Dernier entretien ${day(lastMaintenance.date)}</span>` : ""}
        </div>
        <p class="muted">${esc(item.notes || "Aucune note globale.")}</p>
        ${editable ? `
          <div class="card-actions">
            <button class="surface-link" data-action="edit-car" data-id="${item.id}" type="button">Modifier</button>
            <button class="surface-link danger-button" data-action="delete-car" data-id="${item.id}" type="button">Supprimer</button>
          </div>
        ` : ""}
      </article>
    `;
  }).join("");
}

function renderProfiles() {
  const profiles = visibleUsers();
  if (!profiles.length) {
    refs.profiles.innerHTML = `<div class="empty-state">Aucun profil visible actuellement.</div>`;
    return;
  }

  refs.profiles.innerHTML = profiles.map((item) => {
    const current = me();
    const mine = current ? item.id === current.id : false;
    const followed = current ? current.followedUserIds.includes(item.id) : false;

    return `
      <article class="profile-card">
        <div class="profile-row">
          <div>
            <h4>${esc(item.name)} ${mine ? "(toi)" : ""}</h4>
            <p class="muted">@${esc(item.handle)}</p>
          </div>
          ${
            mine
              ? `<span class="status-pill">Profil actif</span>`
              : current
                ? `<button class="surface-link" data-action="toggle-follow" data-kind="user" data-id="${item.id}" type="button">${followed ? "Ne plus suivre" : "Suivre"}</button>`
                : ""
          }
        </div>
        <div class="chip-row">
          ${visTag(item.visibility)}
          <span class="tag">${state.cars.filter((entry) => entry.ownerId === item.id).length} voiture(s)</span>
          <span class="tag">${item.followedUserIds.length} profil(s) suivi(s)</span>
          <span class="tag">${item.followedCarIds.length} voiture(s) suivie(s)</span>
        </div>
        <p class="muted">${esc(item.bio || "Pas encore de bio.")}</p>
      </article>
    `;
  }).join("");
}

function buildFeed() {
  const trips = state.trips
    .filter((item) => canAccessRecord(item))
    .map((item) => ({
      id: item.id,
      type: "trip",
      date: item.date,
      visibility: item.visibility,
      title: item.title,
      subtitle: `${item.distanceKm} km - ${item.durationMin} min - ${item.routeType || "Trajet"}${item.routePoints?.length ? " - carte active" : ""}`,
      description: item.note || "Aucune note.",
      carName: car(item.carId)?.name || "Voiture inconnue",
      author: user(item.userId)?.name || "Profil inconnu",
      editable: canEditCar(car(item.carId) || {}),
    }));

  const fuels = state.fuels
    .filter((item) => canAccessRecord(item))
    .map((item) => ({
      id: item.id,
      type: "fuel",
      date: item.date,
      visibility: item.visibility,
      title: `Plein ${item.fullTank ? "complet" : "partiel"}`,
      subtitle: `${item.liters} L - ${eur(item.costTotal)} - ${item.station || "Station inconnue"}`,
      description: `${item.fuelType} a ${item.costPerUnit} EUR/L, compteur ${item.odometer} km.`,
      carName: car(item.carId)?.name || "Voiture inconnue",
      author: user(item.userId)?.name || "Profil inconnu",
      editable: canEditCar(car(item.carId) || {}),
    }));

  const maintenance = state.maintenance
    .filter((item) => canAccessRecord(item))
    .map((item) => ({
      id: item.id,
      type: "maintenance",
      date: item.date,
      visibility: item.visibility,
      title: item.type,
      subtitle: `${eur(item.cost)} - ${item.garage || "Garage non precise"}`,
      description: item.note || "Aucune note.",
      carName: car(item.carId)?.name || "Voiture inconnue",
      author: user(item.userId)?.name || "Profil inconnu",
      editable: canEditCar(car(item.carId) || {}),
    }));

  const notes = state.notes
    .filter((item) => canAccessRecord(item))
    .map((item) => ({
      id: item.id,
      type: "note",
      date: item.date,
      visibility: item.visibility,
      title: item.title,
      subtitle: item.category,
      description: item.content,
      carName: car(item.carId)?.name || "Voiture inconnue",
      author: user(item.userId)?.name || "Profil inconnu",
      editable: canEditCar(car(item.carId) || {}),
    }));

  return [...trips, ...fuels, ...maintenance, ...notes].sort(sortDate);
}

function renderFeed() {
  const items = buildFeed().filter((item) => feedFilter === "all" || item.type === feedFilter);
  if (!items.length) {
    refs.feed.innerHTML = `<div class="empty-state">Aucune activite dans ce filtre.</div>`;
    return;
  }

  refs.feed.innerHTML = items.map((item) => `
    <article class="timeline-item" data-type="${item.type}">
      <div class="card-header">
        <div>
          <h4>${esc(item.title)}</h4>
          <p>${esc(item.subtitle)}</p>
        </div>
        ${visTag(item.visibility)}
      </div>
      <div class="chip-row">
        <span class="tag">${esc(item.carName)}</span>
        <span class="tag">${day(item.date)}</span>
        <span class="tag">${esc(item.author)}</span>
      </div>
      <p>${esc(item.description)}</p>
      ${item.editable ? `
        <div class="card-actions">
          <button class="surface-link" data-action="edit-entry" data-kind="${item.type}" data-id="${item.id}" type="button">Modifier</button>
          <button class="surface-link danger-button" data-action="delete-entry" data-kind="${item.type}" data-id="${item.id}" type="button">Supprimer</button>
        </div>
      ` : ""}
    </article>
  `).join("");
}

function ensureRouteMap() {
  if (routeMapState.map || !refs.routeMap || typeof window.L === "undefined") return;

  routeMapState.map = window.L.map(refs.routeMap, {
    zoomControl: true,
    attributionControl: true,
  }).setView([48.8566, 2.3522], 5);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors",
  }).addTo(routeMapState.map);

  routeMapState.layerGroup = window.L.layerGroup().addTo(routeMapState.map);
}

function renderRouteMap() {
  if (!refs.routeMap || !refs.routeMapSummary) return;
  ensureRouteMap();

  const trips = state.trips.filter((item) => canAccessRecord(item) && Array.isArray(item.routePoints) && item.routePoints.length >= 2);

  if (!routeMapState.map || !routeMapState.layerGroup) {
    refs.routeMapSummary.innerHTML = `<div class="empty-state">Leaflet n'est pas disponible. La carte ne peut pas etre affichee.</div>`;
    return;
  }

  routeMapState.layerGroup.clearLayers();

  if (!trips.length) {
    refs.routeMapSummary.innerHTML = `
      <div class="empty-state">
        Ajoute un trajet avec des points GPS pour afficher tes routes sur la carte.
        Exemple: <code>48.8566,2.3522 | 48.8606,2.3376</code>
      </div>
    `;
    routeMapState.map.setView([48.8566, 2.3522], 5);
    window.setTimeout(() => routeMapState.map.invalidateSize(), 80);
    return;
  }

  const usage = new Map();
  trips.forEach((trip) => {
    const key = routeKey(trip.routePoints);
    usage.set(key, (usage.get(key) || 0) + 1);
  });

  const counts = [...usage.values()];
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  const bounds = [];

  trips.forEach((trip) => {
    const key = routeKey(trip.routePoints);
    const count = usage.get(key) || 1;
    const color = routeUsageColor(count, min, max);
    const polyline = window.L.polyline(trip.routePoints, {
      color,
      weight: 5,
      opacity: 0.88,
    }).addTo(routeMapState.layerGroup);

    polyline.bindPopup(`
      <strong>${esc(trip.title || "Trajet")}</strong><br />
      ${esc(car(trip.carId)?.name || "Voiture inconnue")}<br />
      ${count} passage(s)<br />
      ${esc(day(trip.date))}
    `);

    trip.routePoints.forEach((point) => bounds.push(point));
  });

  refs.routeMapSummary.innerHTML = Object.entries(
    trips.reduce((acc, trip) => {
      const key = routeKey(trip.routePoints);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([, count], index) => `<span class="tag">Route ${index + 1}: ${count} passage(s)</span>`)
    .join("");

  if (bounds.length) {
    routeMapState.map.fitBounds(bounds, { padding: [24, 24] });
  }

  window.setTimeout(() => routeMapState.map.invalidateSize(), 80);
}

function renderAnalytics() {
  const cars = visibleCars();
  if (!cars.length) {
    refs.analytics.innerHTML = `<div class="empty-state">Connecte-toi pour voir des indicateurs detailes.</div>`;
    return;
  }

  refs.analytics.innerHTML = cars.map((item) => {
    const trips = state.trips.filter((entry) => entry.carId === item.id && canAccessRecord(entry));
    const fuels = state.fuels.filter((entry) => entry.carId === item.id && canAccessRecord(entry));
    const maintenance = state.maintenance.filter((entry) => entry.carId === item.id && canAccessRecord(entry));
    const notes = state.notes.filter((entry) => entry.carId === item.id && canAccessRecord(entry));
    const distance = trips.reduce((sum, entry) => sum + Number(entry.distanceKm || 0), 0);
    const fuelCost = fuels.reduce((sum, entry) => sum + Number(entry.costTotal || 0), 0);
    const maintenanceCost = maintenance.reduce((sum, entry) => sum + Number(entry.cost || 0), 0);
    const nextMaintenance = maintenance
      .filter((entry) => entry.nextDueKm || entry.nextDueDate)
      .sort((a, b) => (a.nextDueKm || Number.MAX_SAFE_INTEGER) - (b.nextDueKm || Number.MAX_SAFE_INTEGER))[0];
    const alert = nextMaintenance
      ? `Prochain ${nextMaintenance.type.toLowerCase()} avant ${nextMaintenance.nextDueKm?.toLocaleString("fr-FR") || "?"} km${nextMaintenance.nextDueDate ? ` ou le ${day(nextMaintenance.nextDueDate)}` : ""}`
      : "Aucun rappel d'entretien planifie.";

    return `
      <article class="metric-card">
        <h4>${esc(item.name)}</h4>
        <div class="list-row"><small class="muted">Distance tracee</small><strong>${distance.toFixed(0)} km</strong></div>
        <div class="list-row"><small class="muted">Depenses carburant</small><strong>${eur(fuelCost)}</strong></div>
        <div class="list-row"><small class="muted">Depenses entretien</small><strong>${eur(maintenanceCost)}</strong></div>
        <div class="list-row"><small class="muted">Observations</small><strong>${notes.length}</strong></div>
        <small>${esc(alert)}</small>
      </article>
    `;
  }).join("");
}

function openModal(id, message = "", meta = {}) {
  const config = modals[id];
  if (!config) return;
  modalState = { id, message, meta };

  const template = $("#modal-template").content.cloneNode(true);
  template.querySelector(".modal-eyebrow").textContent = config[0];
  template.querySelector(".modal-title").textContent = config[1];
  template.querySelector(".modal-body").innerHTML = config[2](message);
  refs.modal.replaceChildren(template);
}

function closeModal() {
  modalState = { id: null, message: "", meta: {} };
  refs.modal.replaceChildren();
}

function renderProfileForm() {
  if (!me()) return renderAuthPanel("Connecte-toi pour modifier ton profil.");

  const current = me();
  return `
    <form class="form-grid" data-form-action="save-profile">
      <label><span class="field-label">Nom</span><input class="surface-input" name="name" value="${esc(current.name)}" required /></label>
      <label><span class="field-label">Pseudo</span><input class="surface-input" name="handle" value="${esc(current.handle)}" required /></label>
      <label><span class="field-label">Visibilite du profil</span>${visSelect("visibility", current.visibility)}</label>
      <label><span class="field-label">Bio</span><textarea class="surface-textarea" name="bio">${esc(current.bio || "")}</textarea></label>
      <div class="form-actions">
        <button class="secondary-button" type="button" data-close-modal="true">Annuler</button>
        <button class="primary-button" type="submit">Enregistrer</button>
      </div>
    </form>
  `;
}

function renderCarForm() {
  if (!me()) return renderAuthPanel("Connecte-toi pour creer une voiture.");
  const editing = modalState.meta.mode === "edit" ? car(modalState.meta.id) : null;
  if (modalState.meta.mode === "edit" && (!editing || !canEditCar(editing))) {
    return renderAuthPanel("Tu n'as pas acces a cette voiture.");
  }

  return `
    <form class="form-grid" data-form-action="save-car">
      <label><span class="field-label">Nom de la voiture</span><input class="surface-input" name="name" placeholder="Ex: Peugeot 308 SW" value="${esc(editing?.name || "")}" required /></label>
      <div class="inline-grid">
        <label><span class="field-label">Marque</span><input class="surface-input" name="brand" value="${esc(editing?.brand || "")}" required /></label>
        <label><span class="field-label">Modele</span><input class="surface-input" name="model" value="${esc(editing?.model || "")}" required /></label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Annee</span><input class="surface-input" name="year" type="number" min="1950" max="2100" value="${esc(editing?.year || "")}" required /></label>
        <label><span class="field-label">Kilometrage</span><input class="surface-input" name="odometer" type="number" min="0" value="${esc(editing?.odometer || 0)}" required /></label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Carburant</span><input class="surface-input" name="fuelType" value="${esc(editing?.fuelType || "")}" required /></label>
        <label><span class="field-label">Plaque</span><input class="surface-input" name="plate" value="${esc(editing?.plate || "")}" /></label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Couleur</span><input class="surface-input" name="color" value="${esc(editing?.color || "")}" /></label>
        <label><span class="field-label">Visibilite</span>${visSelect("visibility", editing?.visibility || "private")}</label>
      </div>
      <label>
        <span class="field-label">Partager avec</span>
        <select class="surface-input" name="sharedWith" multiple>
          ${state.users.filter((item) => item.id !== me().id).map((item) => `<option value="${item.id}" ${editing?.sharedWith?.includes(item.id) ? "selected" : ""}>${esc(item.name)} (@${esc(item.handle)})</option>`).join("")}
        </select>
      </label>
      <label><span class="field-label">Notes globales</span><textarea class="surface-textarea" name="notes">${esc(editing?.notes || "")}</textarea></label>
      <div class="form-actions">
        <button class="secondary-button" type="button" data-close-modal="true">Annuler</button>
        <button class="primary-button" type="submit">${editing ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </form>
  `;
}

function renderCarSelect(name, selected = "") {
  const cars = editableCars();
  if (!cars.length) {
    return `<div class="empty-state">Aucune voiture editable. Cree une voiture ou connecte-toi avec un profil ayant acces.</div>`;
  }
  return `<select class="surface-input" name="${name}" required>${cars.map((item) => `<option value="${item.id}" ${item.id === selected ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select>`;
}

function renderTripForm() {
  if (!me()) return renderAuthPanel("Connecte-toi pour ajouter un trajet.");
  const editing = modalState.meta.mode === "edit" ? findEntry("trip", modalState.meta.id) : null;
  if (modalState.meta.mode === "edit" && (!editing || !canEditCar(car(editing.carId)))) {
    return renderAuthPanel("Tu n'as pas acces a ce trajet.");
  }
  return `
    <form class="form-grid" data-form-action="save-trip">
      <label><span class="field-label">Voiture</span>${renderCarSelect("carId", editing?.carId || "")}</label>
      <label><span class="field-label">Titre</span><input class="surface-input" name="title" value="${esc(editing?.title || "")}" required /></label>
      <div class="inline-grid">
        <label><span class="field-label">Date</span><input class="surface-input" name="date" type="date" value="${esc(editing?.date || "")}" required /></label>
        <label><span class="field-label">Type</span><input class="surface-input" name="routeType" placeholder="Ville, Travail..." value="${esc(editing?.routeType || "")}" /></label>
      </div>
      <label><span class="field-label">Trace GPS optionnelle</span><textarea class="surface-textarea" name="routePoints" placeholder="48.8566,2.3522 | 48.8606,2.3376 | 48.8667,2.3333">${esc(serializeRoutePoints(editing?.routePoints || []))}</textarea></label>
      <div class="inline-grid">
        <label><span class="field-label">Compteur depart</span><input class="surface-input" name="startKm" type="number" min="0" value="${esc(editing?.startKm || 0)}" required /></label>
        <label><span class="field-label">Compteur arrivee</span><input class="surface-input" name="endKm" type="number" min="0" value="${esc(editing?.endKm || 0)}" required /></label>
      </div>
      <label><span class="field-label">Duree (minutes)</span><input class="surface-input" name="durationMin" type="number" min="0" value="${esc(editing?.durationMin || 0)}" required /></label>
      <label><span class="field-label">Note</span><textarea class="surface-textarea" name="note">${esc(editing?.note || "")}</textarea></label>
      <label><span class="field-label">Visibilite</span>${visSelect("visibility", editing?.visibility || "private")}</label>
      <div class="form-actions">
        <button class="secondary-button" type="button" data-close-modal="true">Annuler</button>
        <button class="primary-button" type="submit">${editing ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </form>
  `;
}

function renderFuelForm() {
  if (!me()) return renderAuthPanel("Connecte-toi pour ajouter un plein.");
  const editing = modalState.meta.mode === "edit" ? findEntry("fuel", modalState.meta.id) : null;
  if (modalState.meta.mode === "edit" && (!editing || !canEditCar(car(editing.carId)))) {
    return renderAuthPanel("Tu n'as pas acces a ce plein.");
  }
  return `
    <form class="form-grid" data-form-action="save-fuel">
      <label><span class="field-label">Voiture</span>${renderCarSelect("carId", editing?.carId || "")}</label>
      <div class="inline-grid">
        <label><span class="field-label">Date</span><input class="surface-input" name="date" type="date" value="${esc(editing?.date || "")}" required /></label>
        <label><span class="field-label">Compteur</span><input class="surface-input" name="odometer" type="number" min="0" value="${esc(editing?.odometer || 0)}" required /></label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Litres / kWh</span><input class="surface-input" name="liters" type="number" step="0.01" min="0" value="${esc(editing?.liters || 0)}" required /></label>
        <label><span class="field-label">Prix total</span><input class="surface-input" name="costTotal" type="number" step="0.01" min="0" value="${esc(editing?.costTotal || 0)}" required /></label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Prix unitaire</span><input class="surface-input" name="costPerUnit" type="number" step="0.001" min="0" value="${esc(editing?.costPerUnit || 0)}" required /></label>
        <label><span class="field-label">Type carburant</span><input class="surface-input" name="fuelType" value="${esc(editing?.fuelType || "")}" required /></label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Station</span><input class="surface-input" name="station" value="${esc(editing?.station || "")}" /></label>
        <label><span class="field-label">Visibilite</span>${visSelect("visibility", editing?.visibility || "private")}</label>
      </div>
      <label><span class="field-label">Type de plein</span><select class="surface-input" name="fullTank"><option value="true" ${editing?.fullTank !== false ? "selected" : ""}>Plein complet</option><option value="false" ${editing?.fullTank === false ? "selected" : ""}>Plein partiel</option></select></label>
      <div class="form-actions">
        <button class="secondary-button" type="button" data-close-modal="true">Annuler</button>
        <button class="primary-button" type="submit">${editing ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </form>
  `;
}

function renderMaintenanceForm() {
  if (!me()) return renderAuthPanel("Connecte-toi pour ajouter un entretien.");
  const editing = modalState.meta.mode === "edit" ? findEntry("maintenance", modalState.meta.id) : null;
  if (modalState.meta.mode === "edit" && (!editing || !canEditCar(car(editing.carId)))) {
    return renderAuthPanel("Tu n'as pas acces a cet entretien.");
  }
  return `
    <form class="form-grid" data-form-action="save-maintenance">
      <label><span class="field-label">Voiture</span>${renderCarSelect("carId", editing?.carId || "")}</label>
      <div class="inline-grid">
        <label><span class="field-label">Date</span><input class="surface-input" name="date" type="date" value="${esc(editing?.date || "")}" required /></label>
        <label><span class="field-label">Compteur</span><input class="surface-input" name="odometer" type="number" min="0" value="${esc(editing?.odometer || 0)}" required /></label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Type d'entretien</span><input class="surface-input" name="type" value="${esc(editing?.type || "")}" required /></label>
        <label><span class="field-label">Cout</span><input class="surface-input" name="cost" type="number" step="0.01" min="0" value="${esc(editing?.cost || 0)}" required /></label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Garage</span><input class="surface-input" name="garage" value="${esc(editing?.garage || "")}" /></label>
        <label><span class="field-label">Visibilite</span>${visSelect("visibility", editing?.visibility || "private")}</label>
      </div>
      <div class="inline-grid">
        <label><span class="field-label">Prochain kilometrage</span><input class="surface-input" name="nextDueKm" type="number" min="0" value="${esc(editing?.nextDueKm || "")}" /></label>
        <label><span class="field-label">Prochaine date</span><input class="surface-input" name="nextDueDate" type="date" value="${esc(editing?.nextDueDate || "")}" /></label>
      </div>
      <label><span class="field-label">Details</span><textarea class="surface-textarea" name="note">${esc(editing?.note || "")}</textarea></label>
      <div class="form-actions">
        <button class="secondary-button" type="button" data-close-modal="true">Annuler</button>
        <button class="primary-button" type="submit">${editing ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </form>
  `;
}

function renderNoteForm() {
  if (!me()) return renderAuthPanel("Connecte-toi pour ajouter une observation.");
  const editing = modalState.meta.mode === "edit" ? findEntry("note", modalState.meta.id) : null;
  if (modalState.meta.mode === "edit" && (!editing || !canEditCar(car(editing.carId)))) {
    return renderAuthPanel("Tu n'as pas acces a cette observation.");
  }
  return `
    <form class="form-grid" data-form-action="save-note">
      <label><span class="field-label">Voiture</span>${renderCarSelect("carId", editing?.carId || "")}</label>
      <div class="inline-grid">
        <label><span class="field-label">Date</span><input class="surface-input" name="date" type="date" value="${esc(editing?.date || "")}" required /></label>
        <label><span class="field-label">Categorie</span><input class="surface-input" name="category" value="${esc(editing?.category || "")}" required /></label>
      </div>
      <label><span class="field-label">Titre</span><input class="surface-input" name="title" value="${esc(editing?.title || "")}" required /></label>
      <label><span class="field-label">Contenu</span><textarea class="surface-textarea" name="content" required>${esc(editing?.content || "")}</textarea></label>
      <label><span class="field-label">Visibilite</span>${visSelect("visibility", editing?.visibility || "private")}</label>
      <div class="form-actions">
        <button class="secondary-button" type="button" data-close-modal="true">Annuler</button>
        <button class="primary-button" type="submit">${editing ? "Enregistrer" : "Ajouter"}</button>
      </div>
    </form>
  `;
}

function renderFollowForm() {
  if (!me()) return renderAuthPanel("Connecte-toi pour suivre un profil ou une voiture.");
  return `
    <form class="form-grid" data-form-action="save-follow">
      <label>
        <span class="field-label">Suivre un profil</span>
        <select class="surface-input" name="userId">
          <option value="">Aucun</option>
          ${state.users.filter((item) => item.id !== me().id).map((item) => `<option value="${item.id}">${esc(item.name)} (@${esc(item.handle)})</option>`).join("")}
        </select>
      </label>
      <label>
        <span class="field-label">Suivre une voiture</span>
        <select class="surface-input" name="carId">
          <option value="">Aucune</option>
          ${state.cars.map((item) => `<option value="${item.id}">${esc(item.name)}</option>`).join("")}
        </select>
      </label>
      <p class="muted">En mode local, ces suivis restent dans ton navigateur. Tu peux les exporter a tout moment.</p>
      <div class="form-actions">
        <button class="secondary-button" type="button" data-close-modal="true">Annuler</button>
        <button class="primary-button" type="submit">Enregistrer</button>
      </div>
    </form>
  `;
}

function renderAuthPanel(message = "") {
  const current = me();
  const mode = runtimeConfig.storageMode || state.auth.mode || "local";
  const hasUsers = state.users.length > 0;

  return `
    <div class="form-grid">
      <article class="metric-card">
        <h4>Mode actuel: ${esc(mode)}</h4>
        <p>${esc(current?.name || "Invite")}</p>
        <small>${current ? `@${esc(current.handle)}` : "Non connecte"}</small>
      </article>
      ${message ? `<div class="empty-state">${esc(message)}</div>` : ""}
      <div class="empty-state">
        Configuration: <code>${esc(runtimeConfig.environment || "local")}</code><br />
        Support: <code>${esc(runtimeConfig.supportEmail || "non renseigne")}</code><br /><br />
        ${hasUsers ? "Connecte-toi avec un compte existant ou cree un nouveau profil." : "Aucun compte precharge. Cree ton premier espace personnel pour commencer."}
      </div>
      ${hasUsers ? `
        <form class="form-grid" data-form-action="auth-login">
          <label><span class="field-label">Email</span><input class="surface-input" name="email" type="email" required /></label>
          <label><span class="field-label">Mot de passe</span><input class="surface-input" name="password" type="password" required /></label>
          <div class="form-actions">
            <button class="primary-button" type="submit">Se connecter</button>
          </div>
        </form>
      ` : ""}
      <form class="form-grid" data-form-action="auth-register">
        <label><span class="field-label">Nom</span><input class="surface-input" name="name" required /></label>
        <label><span class="field-label">Pseudo</span><input class="surface-input" name="handle" required /></label>
        <label><span class="field-label">Email</span><input class="surface-input" name="email" type="email" required /></label>
        <label><span class="field-label">Mot de passe</span><input class="surface-input" name="password" type="password" minlength="6" required /></label>
        <label><span class="field-label">Visibilite</span>${visSelect("visibility", "public")}</label>
        <div class="form-actions">
          <button class="primary-button" type="submit">${hasUsers ? "Creer un compte" : "Creer mon espace"}</button>
        </div>
      </form>
      <div class="form-grid">
        <div class="form-actions">
          ${current ? `<button class="secondary-button" data-action="logout" type="button">Se deconnecter</button>` : ""}
          <button class="secondary-button" type="button" data-close-modal="true">Fermer</button>
        </div>
      </div>
    </div>
  `;
}

function saveProfile(formData) {
  if (!requireAuth()) return;
  const name = String(formData.get("name") || "").trim();
  const handle = String(formData.get("handle") || "").trim().toLowerCase();
  const nameError = requireText(name, "Le nom");
  if (nameError) return openModal("profile-modal", nameError);
  const handleError = requireText(handle, "Le pseudo");
  if (handleError) return openModal("profile-modal", handleError);
  const duplicate = state.users.find((item) => item.handle.toLowerCase() === handle && item.id !== me().id);
  if (duplicate) return openModal("profile-modal", "Ce pseudo est deja utilise.");

  Object.assign(me(), {
    name,
    handle,
    bio: String(formData.get("bio") || "").trim(),
    visibility: String(formData.get("visibility") || "private"),
  });

  closeModal();
  renderAll();
}

function saveCar(formData) {
  if (!requireAuth()) return;
  const editing = modalState.meta.mode === "edit" ? car(modalState.meta.id) : null;
  if (editing && !canEditCar(editing)) return openModal("car-modal", "Tu n'as pas le droit de modifier cette voiture.");

  const payload = {
    ownerId: editing?.ownerId || me().id,
    sharedWith: [...new Set(formData.getAll("sharedWith").filter(Boolean))],
    name: String(formData.get("name") || "").trim(),
    brand: String(formData.get("brand") || "").trim(),
    model: String(formData.get("model") || "").trim(),
    year: Number(formData.get("year") || 0),
    plate: String(formData.get("plate") || "").trim(),
    fuelType: String(formData.get("fuelType") || "").trim(),
    odometer: Number(formData.get("odometer") || 0),
    visibility: String(formData.get("visibility") || "private"),
    color: String(formData.get("color") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
  };

  const message =
    requireText(payload.name, "Le nom de la voiture") ||
    requireText(payload.brand, "La marque") ||
    requireText(payload.model, "Le modele") ||
    requireText(payload.fuelType, "Le carburant") ||
    requirePositiveNumber(payload.odometer, "Le kilometrage");
  if (message) return openModal("car-modal", message, modalState.meta);

  if (editing) {
    Object.assign(editing, payload);
  } else {
    state.cars.unshift({ id: uid(), ...payload });
  }

  refreshCarOdometer(editing?.id || state.cars[0]?.id);
  closeModal();
  renderAll();
}

function saveTrip(formData) {
  if (!requireAuth()) return;
  const editing = modalState.meta.mode === "edit" ? findEntry("trip", modalState.meta.id) : null;
  const previousCarId = editing?.carId;
  const carId = String(formData.get("carId") || "");
  const vehicle = car(carId);
  if (!vehicle || !canEditCar(vehicle)) return openModal("trip-modal", "Tu n'as pas le droit de modifier cette voiture.");

  const startKm = Number(formData.get("startKm") || 0);
  const endKm = Number(formData.get("endKm") || 0);
  if (endKm < startKm) return openModal("trip-modal", "Le compteur d'arrivee doit etre superieur ou egal au depart.", modalState.meta);
  const parsedRoute = parseRoutePoints(formData.get("routePoints"));
  if (parsedRoute.error) return openModal("trip-modal", parsedRoute.error, modalState.meta);

  const payload = {
    carId,
    userId: editing?.userId || me().id,
    title: String(formData.get("title") || "").trim(),
    date: String(formData.get("date") || ""),
    startKm,
    endKm,
    distanceKm: Math.max(0, endKm - startKm),
    durationMin: Number(formData.get("durationMin") || 0),
    routeType: String(formData.get("routeType") || "").trim(),
    routePoints: parsedRoute.points,
    note: String(formData.get("note") || "").trim(),
    visibility: String(formData.get("visibility") || "private"),
  };

  const message =
    requireText(payload.title, "Le titre") ||
    requireDate(payload.date, "La date") ||
    requirePositiveNumber(payload.startKm, "Le compteur de depart") ||
    requirePositiveNumber(payload.endKm, "Le compteur d'arrivee") ||
    requirePositiveNumber(payload.durationMin, "La duree");
  if (message) return openModal("trip-modal", message, modalState.meta);

  if (editing) {
    Object.assign(editing, payload);
  } else {
    state.trips.unshift({ id: uid(), ...payload });
  }

  if (previousCarId && previousCarId !== carId) refreshCarOdometer(previousCarId);
  refreshCarOdometer(carId);
  closeModal();
  renderAll();
}

function saveFuel(formData) {
  if (!requireAuth()) return;
  const editing = modalState.meta.mode === "edit" ? findEntry("fuel", modalState.meta.id) : null;
  const previousCarId = editing?.carId;
  const carId = String(formData.get("carId") || "");
  const vehicle = car(carId);
  if (!vehicle || !canEditCar(vehicle)) return openModal("fuel-modal", "Tu n'as pas le droit de modifier cette voiture.");

  const odometer = Number(formData.get("odometer") || 0);
  const payload = {
    carId,
    userId: editing?.userId || me().id,
    date: String(formData.get("date") || ""),
    odometer,
    liters: Number(formData.get("liters") || 0),
    costTotal: Number(formData.get("costTotal") || 0),
    costPerUnit: Number(formData.get("costPerUnit") || 0),
    fuelType: String(formData.get("fuelType") || "").trim(),
    station: String(formData.get("station") || "").trim(),
    fullTank: String(formData.get("fullTank") || "true") === "true",
    visibility: String(formData.get("visibility") || "private"),
  };

  const message =
    requireDate(payload.date, "La date") ||
    requirePositiveNumber(payload.odometer, "Le compteur") ||
    requirePositiveNumber(payload.liters, "La quantite") ||
    requirePositiveNumber(payload.costTotal, "Le prix total") ||
    requirePositiveNumber(payload.costPerUnit, "Le prix unitaire") ||
    requireText(payload.fuelType, "Le type de carburant");
  if (message) return openModal("fuel-modal", message, modalState.meta);

  if (editing) {
    Object.assign(editing, payload);
  } else {
    state.fuels.unshift({ id: uid(), ...payload });
  }

  if (previousCarId && previousCarId !== carId) refreshCarOdometer(previousCarId);
  refreshCarOdometer(carId);
  closeModal();
  renderAll();
}

function saveMaintenance(formData) {
  if (!requireAuth()) return;
  const editing = modalState.meta.mode === "edit" ? findEntry("maintenance", modalState.meta.id) : null;
  const previousCarId = editing?.carId;
  const carId = String(formData.get("carId") || "");
  const vehicle = car(carId);
  if (!vehicle || !canEditCar(vehicle)) return openModal("maintenance-modal", "Tu n'as pas le droit de modifier cette voiture.");

  const odometer = Number(formData.get("odometer") || 0);
  const payload = {
    carId,
    userId: editing?.userId || me().id,
    date: String(formData.get("date") || ""),
    odometer,
    type: String(formData.get("type") || "").trim(),
    cost: Number(formData.get("cost") || 0),
    garage: String(formData.get("garage") || "").trim(),
    note: String(formData.get("note") || "").trim(),
    nextDueKm: Number(formData.get("nextDueKm") || 0),
    nextDueDate: String(formData.get("nextDueDate") || ""),
    visibility: String(formData.get("visibility") || "private"),
  };

  const message =
    requireDate(payload.date, "La date") ||
    requirePositiveNumber(payload.odometer, "Le compteur") ||
    requireText(payload.type, "Le type d'entretien") ||
    requirePositiveNumber(payload.cost, "Le cout") ||
    (payload.nextDueKm ? requirePositiveNumber(payload.nextDueKm, "Le prochain kilometrage") : null);
  if (message) return openModal("maintenance-modal", message, modalState.meta);

  if (editing) {
    Object.assign(editing, payload);
  } else {
    state.maintenance.unshift({ id: uid(), ...payload });
  }

  if (previousCarId && previousCarId !== carId) refreshCarOdometer(previousCarId);
  refreshCarOdometer(carId);
  closeModal();
  renderAll();
}

function saveNote(formData) {
  if (!requireAuth()) return;
  const editing = modalState.meta.mode === "edit" ? findEntry("note", modalState.meta.id) : null;
  const carId = String(formData.get("carId") || "");
  const vehicle = car(carId);
  if (!vehicle || !canEditCar(vehicle)) return openModal("note-modal", "Tu n'as pas le droit de modifier cette voiture.");

  const payload = {
    carId,
    userId: editing?.userId || me().id,
    date: String(formData.get("date") || ""),
    category: String(formData.get("category") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    content: String(formData.get("content") || "").trim(),
    visibility: String(formData.get("visibility") || "private"),
  };

  const message =
    requireDate(payload.date, "La date") ||
    requireText(payload.category, "La categorie") ||
    requireText(payload.title, "Le titre") ||
    requireText(payload.content, "Le contenu");
  if (message) return openModal("note-modal", message, modalState.meta);

  if (editing) {
    Object.assign(editing, payload);
  } else {
    state.notes.unshift({ id: uid(), ...payload });
  }

  closeModal();
  renderAll();
}

function saveFollow(formData) {
  if (!requireAuth()) return;
  const userId = String(formData.get("userId") || "");
  const carId = String(formData.get("carId") || "");

  if (userId && !me().followedUserIds.includes(userId)) me().followedUserIds.push(userId);
  if (carId && !me().followedCarIds.includes(carId)) me().followedCarIds.push(carId);

  closeModal();
  renderAll();
}

function deleteCar(id) {
  if (!requireAuth()) return;
  const vehicle = car(id);
  if (!vehicle || !canEditCar(vehicle)) return;
  if (!window.confirm(`Supprimer ${vehicle.name} et tout son historique ?`)) return;

  state.cars = state.cars.filter((item) => item.id !== id);
  state.trips = state.trips.filter((item) => item.carId !== id);
  state.fuels = state.fuels.filter((item) => item.carId !== id);
  state.maintenance = state.maintenance.filter((item) => item.carId !== id);
  state.notes = state.notes.filter((item) => item.carId !== id);
  state.users.forEach((item) => {
    item.followedCarIds = item.followedCarIds.filter((carId) => carId !== id);
  });

  renderAll();
}

function deleteEntry(kind, id) {
  if (!requireAuth()) return;
  const collection = collectionByKind(kind);
  const entry = findEntry(kind, id);
  if (!collection || !entry) return;
  const vehicle = car(entry.carId);
  if (!vehicle || !canEditCar(vehicle)) return;
  if (!window.confirm("Supprimer cet element du journal ?")) return;

  const nextCollection = collection.filter((item) => item.id !== id);
  if (kind === "trip") state.trips = nextCollection;
  if (kind === "fuel") state.fuels = nextCollection;
  if (kind === "maintenance") state.maintenance = nextCollection;
  if (kind === "note") state.notes = nextCollection;
  refreshCarOdometer(entry.carId);
  renderAll();
}

function resetAppData() {
  if (!window.confirm("Supprimer toutes les donnees locales de cette application ?")) return;
  replaceState(cloneSeed());
  closeModal();
  renderAll();
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `garage-social-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function isValidStateShape(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      value.auth &&
      Array.isArray(value.users) &&
      Array.isArray(value.cars) &&
      Array.isArray(value.trips) &&
      Array.isArray(value.fuels) &&
      Array.isArray(value.maintenance) &&
      Array.isArray(value.notes),
  );
}

async function importData(event) {
  const [file] = event.target.files || [];
  if (!file) return;

  try {
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    if (!isValidStateShape(parsed)) throw new Error("Format invalide");
    replaceState(parsed);
    closeModal();
    renderAll();
  } catch {
    openModal("auth-modal", "Le fichier JSON importe n'est pas valide.");
  } finally {
    event.target.value = "";
  }
}

function toggleCarVisibility(id) {
  if (!requireAuth()) return;
  const vehicle = car(id);
  if (!vehicle || !canEditCar(vehicle)) return;
  const order = ["private", "followers", "public"];
  vehicle.visibility = order[(order.indexOf(vehicle.visibility) + 1) % order.length];
  renderAll();
}

function toggleFollow(kind, id) {
  if (!requireAuth()) return;
  if (kind === "user") {
    me().followedUserIds = me().followedUserIds.includes(id)
      ? me().followedUserIds.filter((value) => value !== id)
      : [...me().followedUserIds, id];
  }
  if (kind === "car") {
    me().followedCarIds = me().followedCarIds.includes(id)
      ? me().followedCarIds.filter((value) => value !== id)
      : [...me().followedCarIds, id];
  }
  renderAll();
}

function handleLogin(formData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return openModal("auth-modal", "Renseigne ton email et ton mot de passe.");
  const existing = state.users.find((item) => item.email.toLowerCase() === email && item.password === password);

  if (!existing) return openModal("auth-modal", "Email ou mot de passe invalide.");

  state.auth.mode = "local";
  state.auth.currentUserId = existing.id;
  closeModal();
  renderAll();
}

function handleRegister(formData) {
  const name = String(formData.get("name") || "").trim();
  const handle = String(formData.get("handle") || "").trim().toLowerCase();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const visibility = String(formData.get("visibility") || "public");

  const message =
    requireText(name, "Le nom") ||
    requireText(handle, "Le pseudo") ||
    requireText(email, "L'email") ||
    (email.includes("@") ? null : "L'email doit etre valide.") ||
    (password.length >= 6 ? null : "Le mot de passe doit contenir au moins 6 caracteres.");
  if (message) return openModal("auth-modal", message);

  if (state.users.some((item) => item.email.toLowerCase() === email)) {
    return openModal("auth-modal", "Cet email existe deja.");
  }
  if (state.users.some((item) => item.handle.toLowerCase() === handle)) {
    return openModal("auth-modal", "Ce pseudo existe deja.");
  }

  const newUser = {
    id: crypto.randomUUID(),
    name,
    handle,
    email,
    password,
    bio: "",
    visibility,
    followedUserIds: [],
    followedCarIds: [],
  };

  state.users.unshift(newUser);
  state.auth.mode = "local";
  state.auth.currentUserId = newUser.id;
  closeModal();
  renderAll();
}

function logout() {
  state.auth.currentUserId = null;
  closeModal();
  renderAll();
}
