const STORAGE_KEY = "garage-social-demo-v1";

const seed = {
  auth: { mode: "demo", currentUserId: "user-1" },
  users: [
    { id: "user-1", name: "Alex", handle: "alex.routes", bio: "Trois voitures, suivi quotidien et partage en famille.", visibility: "public", followedUserIds: ["user-2"], followedCarIds: ["car-2"] },
    { id: "user-2", name: "Lea", handle: "lea.garage", bio: "Road trips, detailing et carnets d'entretien.", visibility: "public", followedUserIds: [], followedCarIds: [] },
  ],
  cars: [
    { id: "car-1", ownerId: "user-1", sharedWith: ["user-2"], name: "Peugeot 308 SW", brand: "Peugeot", model: "308 SW", year: 2018, plate: "AB-318-CD", fuelType: "Diesel", odometer: 128540, visibility: "private", color: "Bleu magnetique", notes: "Voiture principale pour les grands trajets." },
    { id: "car-2", ownerId: "user-1", sharedWith: [], name: "Renault Zoe", brand: "Renault", model: "Zoe", year: 2020, plate: "EF-920-GH", fuelType: "Electrique", odometer: 64200, visibility: "public", color: "Blanc nacre", notes: "Usage urbain et couts publics." },
    { id: "car-3", ownerId: "user-1", sharedWith: ["user-2"], name: "Volkswagen Golf GTI", brand: "Volkswagen", model: "Golf GTI", year: 2016, plate: "JK-456-LM", fuelType: "Essence", odometer: 98220, visibility: "followers", color: "Rouge tornado", notes: "Sorties plaisir et suivi conso detaille." },
  ],
  trips: [
    { id: "trip-1", carId: "car-1", userId: "user-1", title: "Bureau et clients", date: "2026-04-18", startKm: 128120, endKm: 128312, distanceKm: 192, durationMin: 180, routeType: "Travail", note: "Trafic fluide.", visibility: "private" },
    { id: "trip-2", carId: "car-2", userId: "user-1", title: "Courses et centre-ville", date: "2026-04-19", startKm: 64162, endKm: 64200, distanceKm: 38, durationMin: 62, routeType: "Ville", note: "Bonne regeneration.", visibility: "public" },
  ],
  fuels: [
    { id: "fuel-1", carId: "car-1", userId: "user-1", date: "2026-04-17", odometer: 128050, liters: 42.3, costTotal: 73.6, costPerUnit: 1.739, fuelType: "Diesel", station: "TotalEnergies", fullTank: true, visibility: "private" },
    { id: "fuel-2", carId: "car-3", userId: "user-1", date: "2026-04-10", odometer: 98010, liters: 36.5, costTotal: 68.2, costPerUnit: 1.868, fuelType: "SP98", station: "Shell", fullTank: true, visibility: "followers" },
  ],
  maintenance: [
    { id: "maint-1", carId: "car-1", userId: "user-1", date: "2026-04-05", odometer: 127880, type: "Revision", cost: 289, garage: "Garage du Centre", note: "Vidange et filtres.", nextDueKm: 142880, nextDueDate: "2027-04-05", visibility: "private" },
    { id: "maint-2", carId: "car-3", userId: "user-2", date: "2026-03-22", odometer: 97750, type: "Pneus", cost: 640, garage: "Michelin Service", note: "4 pneus sport route.", nextDueKm: 121000, nextDueDate: "", visibility: "followers" },
  ],
  notes: [
    { id: "note-1", carId: "car-1", userId: "user-1", date: "2026-04-19", category: "Observation", title: "Bruit leger a froid", content: "A surveiller au prochain demarrage.", visibility: "private" },
    { id: "note-2", carId: "car-2", userId: "user-1", date: "2026-04-16", category: "Recharge", title: "Charge publique rapide", content: "24 minutes pour passer de 22 a 78 pour cent.", visibility: "public" },
  ],
};

const $ = (s) => document.querySelector(s);
const state = loadState();
let feedFilter = "all";

const refs = {
  hero: $("#hero-stats"),
  dash: $("#dashboard-cards"),
  analytics: $("#analytics-grid"),
  cars: $("#cars-list"),
  profiles: $("#profiles-list"),
  feed: $("#feed-list"),
  modal: $("#modal-root"),
  filter: $("#dashboard-car-filter"),
};

const modals = {
  "profile-modal": ["Compte", "Creer ou modifier un profil", renderProfileForm],
  "car-modal": ["Vehicule", "Ajouter une voiture", renderCarForm],
  "trip-modal": ["Journal", "Ajouter un trajet", renderTripForm],
  "fuel-modal": ["Suivi conso", "Ajouter un plein", renderFuelForm],
  "maintenance-modal": ["Entretien", "Ajouter un entretien", renderMaintenanceForm],
  "note-modal": ["Observation", "Ajouter une note", renderNoteForm],
  "follow-modal": ["Social", "Suivre un profil ou une voiture", renderFollowForm],
  "auth-modal": ["Acces", "Connexion et mode collaboratif", renderAuthPanel],
};

document.addEventListener("click", (e) => {
  const open = e.target.closest("[data-open-modal]");
  const close = e.target.closest("[data-close-modal]");
  const action = e.target.closest("[data-action]");
  if (open) return openModal(open.dataset.openModal);
  if (close && (!close.classList.contains("modal-backdrop") || e.target === close)) return closeModal();
  if (action?.dataset.action === "toggle-visibility") return toggleCarVisibility(action.dataset.carId);
  if (action?.dataset.action === "toggle-follow") return toggleFollow(action.dataset.kind, action.dataset.id);
});

document.addEventListener("submit", (e) => {
  const form = e.target.closest("form");
  if (!form) return;
  e.preventDefault();
  const data = new FormData(form);
  ({
    "save-profile": saveProfile,
    "save-car": saveCar,
    "save-trip": saveTrip,
    "save-fuel": saveFuel,
    "save-maintenance": saveMaintenance,
    "save-note": saveNote,
    "save-follow": saveFollow,
  }[form.dataset.formAction] || (() => {}))(data);
});

$("#open-auth").addEventListener("click", () => openModal("auth-modal"));
refs.filter.addEventListener("change", renderAll);
$("#feed-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest("[data-feed]");
  if (!tab) return;
  feedFilter = tab.dataset.feed;
  document.querySelectorAll(".tab").forEach((n) => n.classList.toggle("is-active", n === tab));
  renderFeed();
});

renderAll();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }
  try { return JSON.parse(raw); } catch { return structuredClone(seed); }
}
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function me() { return state.users.find((u) => u.id === state.auth.currentUserId) || state.users[0]; }
function car(id) { return state.cars.find((c) => c.id === id); }
function user(id) { return state.users.find((u) => u.id === id); }
function esc(v) { return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
function eur(v) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(v || 0)); }
function day(v) { return v ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(v)) : "Date inconnue"; }
function sortDate(a, b) { return new Date(b.date).getTime() - new Date(a.date).getTime(); }
function metric(title, value, text) { return `<article class="metric-card"><h4>${esc(title)}</h4><p>${esc(value)}</p><small>${esc(text)}</small></article>`; }
function visTag(v) { return `<span class="status-pill ${v === "public" ? "is-public" : v === "private" ? "is-private" : ""}">${({ public: "Public", private: "Prive", followers: "Abonnes" }[v]) || v}</span>`; }
function visSelect(name, selected = "private") { return `<select class="surface-input" name="${name}"><option value="private" ${selected === "private" ? "selected" : ""}>Prive</option><option value="followers" ${selected === "followers" ? "selected" : ""}>Abonnes</option><option value="public" ${selected === "public" ? "selected" : ""}>Public</option></select>`; }
function carSelect(name) { return `<select class="surface-input" name="${name}" required>${state.cars.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select>`; }
function selectedCars() { return refs.filter.value && refs.filter.value !== "all" ? state.cars.filter((c) => c.id === refs.filter.value) : state.cars; }

function renderAll() {
  const previous = refs.filter.value || "all";
  refs.filter.innerHTML = [`<option value="all">Toutes les voitures</option>`, ...state.cars.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)].join("");
  refs.filter.value = state.cars.some((c) => c.id === previous) ? previous : "all";
  renderHero(); renderDashboard(); renderCars(); renderProfiles(); renderFeed(); renderAnalytics(); saveState();
}

function renderHero() {
  const totalDistance = state.trips.reduce((s, t) => s + Number(t.distanceKm || 0), 0);
  const fuelCost = state.fuels.reduce((s, f) => s + Number(f.costTotal || 0), 0);
  const maintCost = state.maintenance.reduce((s, m) => s + Number(m.cost || 0), 0);
  refs.hero.innerHTML = [
    metric("Voitures", state.cars.length, "Suivi multi-vehicules"),
    metric("Km traces", `${Math.round(totalDistance)} km`, "Journal cumule"),
    metric("Budget carburant", eur(fuelCost), "Pleins enregistres"),
    metric("Entretien", eur(maintCost), `${state.cars.filter((c) => c.sharedWith.length).length} voiture(s) partagee(s)`),
  ].join("");
}

function renderDashboard() {
  const ids = new Set(selectedCars().map((c) => c.id));
  const trips = state.trips.filter((t) => ids.has(t.carId));
  const fuels = state.fuels.filter((f) => ids.has(f.carId));
  const maintenance = state.maintenance.filter((m) => ids.has(m.carId));
  const dist = trips.reduce((s, t) => s + Number(t.distanceKm || 0), 0);
  const liters = fuels.reduce((s, f) => s + Number(f.liters || 0), 0);
  const fuelCost = fuels.reduce((s, f) => s + Number(f.costTotal || 0), 0);
  const maintCost = maintenance.reduce((s, m) => s + Number(m.cost || 0), 0);
  const conso = dist > 0 && liters > 0 ? (liters / dist) * 100 : 0;
  refs.dash.innerHTML = [
    metric("Distance", `${dist.toFixed(0)} km`, "Trajets filtres"),
    metric("Pleins", `${liters.toFixed(1)} L`, `${eur(fuelCost)} depenses`),
    metric("Conso estimee", `${conso.toFixed(1)} L/100`, "Ajustable avec plus de donnees"),
    metric("Entretien", eur(maintCost), `${maintenance.length} intervention(s)`),
  ].join("");
}

function renderCars() {
  if (!state.cars.length) return (refs.cars.innerHTML = `<div class="empty-state">Ajoute une premiere voiture pour commencer.</div>`);
  refs.cars.innerHTML = state.cars.map((c) => {
    const trips = state.trips.filter((t) => t.carId === c.id).length;
    const fuels = state.fuels.filter((f) => f.carId === c.id).length;
    const maintenance = state.maintenance.filter((m) => m.carId === c.id);
    const owner = user(c.ownerId);
    const totalTripKm = state.trips.filter((t) => t.carId === c.id).reduce((s, t) => s + Number(t.distanceKm || 0), 0);
    const totalCost = state.fuels.filter((f) => f.carId === c.id).reduce((s, f) => s + Number(f.costTotal || 0), 0) + maintenance.reduce((s, m) => s + Number(m.cost || 0), 0);
    const avgCost = totalTripKm ? `${(totalCost / totalTripKm).toFixed(2)} €/km` : "n/a";
    const lastMaint = [...maintenance].sort(sortDate)[0];
    const followed = me().followedCarIds.includes(c.id);
    return `<article class="car-card">
      <div class="card-header"><div><h4>${esc(c.name)}</h4><p class="muted">${esc(c.brand)} ${esc(c.model)} • ${c.year} • ${esc(c.color || "Couleur non precisee")}</p></div><div><button class="surface-link" data-action="toggle-follow" data-kind="car" data-id="${c.id}" type="button">${followed ? "Ne plus suivre" : "Suivre"}</button> <button class="surface-link" data-action="toggle-visibility" data-car-id="${c.id}" type="button">Visibilite</button></div></div>
      <div class="chip-row">${visTag(c.visibility)}<span class="tag">${c.odometer.toLocaleString("fr-FR")} km</span><span class="tag is-shared">${c.sharedWith.length + 1} contributeur(s)</span><span class="tag">${esc(c.fuelType)}</span></div>
      <div class="stat-row"><div><small class="muted">Proprietaire</small><p>${esc(owner?.name || "Inconnu")}</p></div><div><small class="muted">Cout moyen</small><p>${avgCost}</p></div></div>
      <div class="meta-row"><span class="tag">${trips} trajet(s)</span><span class="tag">${fuels} plein(s)</span><span class="tag">${maintenance.length} entretien(s)</span>${lastMaint ? `<span class="tag is-alert">Dernier entretien ${day(lastMaint.date)}</span>` : ""}</div>
      <p class="muted">${esc(c.notes || "Aucune note globale.")}</p>
    </article>`;
  }).join("");
}

function renderProfiles() {
  refs.profiles.innerHTML = state.users.map((u) => {
    const mine = u.id === me().id;
    const followed = me().followedUserIds.includes(u.id);
    return `<article class="profile-card">
      <div class="profile-row"><div><h4>${esc(u.name)} ${mine ? "(toi)" : ""}</h4><p class="muted">@${esc(u.handle)}</p></div>${mine ? `<span class="status-pill">Profil actif</span>` : `<button class="surface-link" data-action="toggle-follow" data-kind="user" data-id="${u.id}" type="button">${followed ? "Ne plus suivre" : "Suivre"}</button>`}</div>
      <div class="chip-row">${visTag(u.visibility)}<span class="tag">${state.cars.filter((c) => c.ownerId === u.id).length} voiture(s)</span><span class="tag">${u.followedUserIds.length} profil(s) suivi(s)</span><span class="tag">${u.followedCarIds.length} voiture(s) suivie(s)</span></div>
      <p class="muted">${esc(u.bio || "Pas encore de bio.")}</p>
    </article>`;
  }).join("");
}

function buildFeed() {
  const trips = state.trips.map((t) => ({ type: "trip", date: t.date, visibility: t.visibility, title: t.title, subtitle: `${t.distanceKm} km • ${t.durationMin} min • ${t.routeType}`, description: t.note || "Aucune note.", carName: car(t.carId)?.name || "Voiture inconnue", author: user(t.userId)?.name || "Profil inconnu" }));
  const fuels = state.fuels.map((f) => ({ type: "fuel", date: f.date, visibility: f.visibility, title: `Plein ${f.fullTank ? "complet" : "partiel"}`, subtitle: `${f.liters} L • ${eur(f.costTotal)} • ${f.station}`, description: `${f.fuelType} a ${f.costPerUnit} €/L, compteur ${f.odometer} km.`, carName: car(f.carId)?.name || "Voiture inconnue", author: user(f.userId)?.name || "Profil inconnu" }));
  const maintenance = state.maintenance.map((m) => ({ type: "maintenance", date: m.date, visibility: m.visibility, title: m.type, subtitle: `${eur(m.cost)} • ${m.garage || "Garage non precise"}`, description: m.note || "Aucune note.", carName: car(m.carId)?.name || "Voiture inconnue", author: user(m.userId)?.name || "Profil inconnu" }));
  const notes = state.notes.map((n) => ({ type: "note", date: n.date, visibility: n.visibility, title: n.title, subtitle: n.category, description: n.content, carName: car(n.carId)?.name || "Voiture inconnue", author: user(n.userId)?.name || "Profil inconnu" }));
  return [...trips, ...fuels, ...maintenance, ...notes].sort(sortDate);
}

function renderFeed() {
  const items = buildFeed().filter((i) => feedFilter === "all" || i.type === feedFilter);
  if (!items.length) return (refs.feed.innerHTML = `<div class="empty-state">Aucune activite dans ce filtre.</div>`);
  refs.feed.innerHTML = items.map((i) => `<article class="timeline-item" data-type="${i.type}"><div class="card-header"><div><h4>${esc(i.title)}</h4><p>${esc(i.subtitle)}</p></div>${visTag(i.visibility)}</div><div class="chip-row"><span class="tag">${esc(i.carName)}</span><span class="tag">${day(i.date)}</span><span class="tag">${esc(i.author)}</span></div><p>${esc(i.description)}</p></article>`).join("");
}

function renderAnalytics() {
  refs.analytics.innerHTML = state.cars.map((c) => {
    const trips = state.trips.filter((t) => t.carId === c.id);
    const fuels = state.fuels.filter((f) => f.carId === c.id);
    const maintenance = state.maintenance.filter((m) => m.carId === c.id);
    const notes = state.notes.filter((n) => n.carId === c.id);
    const distance = trips.reduce((s, t) => s + Number(t.distanceKm || 0), 0);
    const fuelCost = fuels.reduce((s, f) => s + Number(f.costTotal || 0), 0);
    const maintenanceCost = maintenance.reduce((s, m) => s + Number(m.cost || 0), 0);
    const next = maintenance.filter((m) => m.nextDueKm || m.nextDueDate).sort((a, b) => (a.nextDueKm || 9e15) - (b.nextDueKm || 9e15))[0];
    const alert = next ? `Prochain ${next.type.toLowerCase()} avant ${next.nextDueKm?.toLocaleString("fr-FR") || "?"} km${next.nextDueDate ? ` ou le ${day(next.nextDueDate)}` : ""}` : "Aucun rappel d'entretien planifie.";
    return `<article class="metric-card"><h4>${esc(c.name)}</h4><div class="list-row"><small class="muted">Distance tracee</small><strong>${distance.toFixed(0)} km</strong></div><div class="list-row"><small class="muted">Depenses carburant</small><strong>${eur(fuelCost)}</strong></div><div class="list-row"><small class="muted">Depenses entretien</small><strong>${eur(maintenanceCost)}</strong></div><div class="list-row"><small class="muted">Observations</small><strong>${notes.length}</strong></div><small>${esc(alert)}</small></article>`;
  }).join("");
}

function openModal(id) {
  const cfg = modals[id]; if (!cfg) return;
  const tpl = $("#modal-template").content.cloneNode(true);
  tpl.querySelector(".modal-eyebrow").textContent = cfg[0];
  tpl.querySelector(".modal-title").textContent = cfg[1];
  tpl.querySelector(".modal-body").innerHTML = cfg[2]();
  refs.modal.replaceChildren(tpl);
}
function closeModal() { refs.modal.replaceChildren(); }

function renderProfileForm() {
  const u = me();
  return `<form class="form-grid" data-form-action="save-profile"><label><span class="field-label">Nom</span><input class="surface-input" name="name" value="${esc(u.name)}" required /></label><label><span class="field-label">Pseudo</span><input class="surface-input" name="handle" value="${esc(u.handle)}" required /></label><label><span class="field-label">Visibilite du profil</span>${visSelect("visibility", u.visibility)}</label><label><span class="field-label">Bio</span><textarea class="surface-textarea" name="bio">${esc(u.bio || "")}</textarea></label><div class="form-actions"><button class="secondary-button" type="button" data-close-modal="true">Annuler</button><button class="primary-button" type="submit">Enregistrer</button></div></form>`;
}
function renderCarForm() {
  return `<form class="form-grid" data-form-action="save-car"><label><span class="field-label">Nom de la voiture</span><input class="surface-input" name="name" placeholder="Ex: Peugeot 308 SW" required /></label><div class="inline-grid"><label><span class="field-label">Marque</span><input class="surface-input" name="brand" required /></label><label><span class="field-label">Modele</span><input class="surface-input" name="model" required /></label></div><div class="inline-grid"><label><span class="field-label">Annee</span><input class="surface-input" name="year" type="number" min="1950" max="2100" required /></label><label><span class="field-label">Kilometrage</span><input class="surface-input" name="odometer" type="number" min="0" required /></label></div><div class="inline-grid"><label><span class="field-label">Carburant</span><input class="surface-input" name="fuelType" required /></label><label><span class="field-label">Plaque</span><input class="surface-input" name="plate" /></label></div><div class="inline-grid"><label><span class="field-label">Couleur</span><input class="surface-input" name="color" /></label><label><span class="field-label">Visibilite</span>${visSelect("visibility")}</label></div><label><span class="field-label">Partager avec</span><select class="surface-input" name="sharedWith" multiple>${state.users.filter((u) => u.id !== me().id).map((u) => `<option value="${u.id}">${esc(u.name)} (@${esc(u.handle)})</option>`).join("")}</select></label><label><span class="field-label">Notes globales</span><textarea class="surface-textarea" name="notes"></textarea></label><div class="form-actions"><button class="secondary-button" type="button" data-close-modal="true">Annuler</button><button class="primary-button" type="submit">Ajouter</button></div></form>`;
}
function renderTripForm() {
  return `<form class="form-grid" data-form-action="save-trip"><label><span class="field-label">Voiture</span>${carSelect("carId")}</label><label><span class="field-label">Titre</span><input class="surface-input" name="title" required /></label><div class="inline-grid"><label><span class="field-label">Date</span><input class="surface-input" name="date" type="date" required /></label><label><span class="field-label">Type</span><input class="surface-input" name="routeType" placeholder="Ville, Travail..." /></label></div><div class="inline-grid"><label><span class="field-label">Compteur depart</span><input class="surface-input" name="startKm" type="number" min="0" required /></label><label><span class="field-label">Compteur arrivee</span><input class="surface-input" name="endKm" type="number" min="0" required /></label></div><label><span class="field-label">Duree (minutes)</span><input class="surface-input" name="durationMin" type="number" min="0" required /></label><label><span class="field-label">Note</span><textarea class="surface-textarea" name="note"></textarea></label><label><span class="field-label">Visibilite</span>${visSelect("visibility")}</label><div class="form-actions"><button class="secondary-button" type="button" data-close-modal="true">Annuler</button><button class="primary-button" type="submit">Ajouter</button></div></form>`;
}
function renderFuelForm() {
  return `<form class="form-grid" data-form-action="save-fuel"><label><span class="field-label">Voiture</span>${carSelect("carId")}</label><div class="inline-grid"><label><span class="field-label">Date</span><input class="surface-input" name="date" type="date" required /></label><label><span class="field-label">Compteur</span><input class="surface-input" name="odometer" type="number" min="0" required /></label></div><div class="inline-grid"><label><span class="field-label">Litres / kWh</span><input class="surface-input" name="liters" type="number" step="0.01" min="0" required /></label><label><span class="field-label">Prix total</span><input class="surface-input" name="costTotal" type="number" step="0.01" min="0" required /></label></div><div class="inline-grid"><label><span class="field-label">Prix unitaire</span><input class="surface-input" name="costPerUnit" type="number" step="0.001" min="0" required /></label><label><span class="field-label">Type carburant</span><input class="surface-input" name="fuelType" required /></label></div><div class="inline-grid"><label><span class="field-label">Station</span><input class="surface-input" name="station" /></label><label><span class="field-label">Visibilite</span>${visSelect("visibility")}</label></div><label><span class="field-label">Type de plein</span><select class="surface-input" name="fullTank"><option value="true">Plein complet</option><option value="false">Plein partiel</option></select></label><div class="form-actions"><button class="secondary-button" type="button" data-close-modal="true">Annuler</button><button class="primary-button" type="submit">Ajouter</button></div></form>`;
}
function renderMaintenanceForm() {
  return `<form class="form-grid" data-form-action="save-maintenance"><label><span class="field-label">Voiture</span>${carSelect("carId")}</label><div class="inline-grid"><label><span class="field-label">Date</span><input class="surface-input" name="date" type="date" required /></label><label><span class="field-label">Compteur</span><input class="surface-input" name="odometer" type="number" min="0" required /></label></div><div class="inline-grid"><label><span class="field-label">Type d'entretien</span><input class="surface-input" name="type" required /></label><label><span class="field-label">Cout</span><input class="surface-input" name="cost" type="number" step="0.01" min="0" required /></label></div><div class="inline-grid"><label><span class="field-label">Garage</span><input class="surface-input" name="garage" /></label><label><span class="field-label">Visibilite</span>${visSelect("visibility")}</label></div><div class="inline-grid"><label><span class="field-label">Prochain kilometrage</span><input class="surface-input" name="nextDueKm" type="number" min="0" /></label><label><span class="field-label">Prochaine date</span><input class="surface-input" name="nextDueDate" type="date" /></label></div><label><span class="field-label">Details</span><textarea class="surface-textarea" name="note"></textarea></label><div class="form-actions"><button class="secondary-button" type="button" data-close-modal="true">Annuler</button><button class="primary-button" type="submit">Ajouter</button></div></form>`;
}
function renderNoteForm() {
  return `<form class="form-grid" data-form-action="save-note"><label><span class="field-label">Voiture</span>${carSelect("carId")}</label><div class="inline-grid"><label><span class="field-label">Date</span><input class="surface-input" name="date" type="date" required /></label><label><span class="field-label">Categorie</span><input class="surface-input" name="category" required /></label></div><label><span class="field-label">Titre</span><input class="surface-input" name="title" required /></label><label><span class="field-label">Contenu</span><textarea class="surface-textarea" name="content" required></textarea></label><label><span class="field-label">Visibilite</span>${visSelect("visibility")}</label><div class="form-actions"><button class="secondary-button" type="button" data-close-modal="true">Annuler</button><button class="primary-button" type="submit">Ajouter</button></div></form>`;
}
function renderFollowForm() {
  return `<form class="form-grid" data-form-action="save-follow"><label><span class="field-label">Suivre un profil</span><select class="surface-input" name="userId"><option value="">Aucun</option>${state.users.filter((u) => u.id !== me().id).map((u) => `<option value="${u.id}">${esc(u.name)} (@${esc(u.handle)})</option>`).join("")}</select></label><label><span class="field-label">Suivre une voiture</span><select class="surface-input" name="carId"><option value="">Aucune</option>${state.cars.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label><p class="muted">En mode demo, ces suivis restent dans ton navigateur. Le schema Supabase permet de les synchroniser ensuite.</p><div class="form-actions"><button class="secondary-button" type="button" data-close-modal="true">Annuler</button><button class="primary-button" type="submit">Enregistrer</button></div></form>`;
}
function renderAuthPanel() {
  const u = me();
  return `<div class="form-grid"><article class="metric-card"><h4>Mode actuel: ${state.auth.mode === "demo" ? "demo local" : "supabase"}</h4><p>${esc(u.name)}</p><small>@${esc(u.handle)}</small></article><div class="empty-state">Le site fonctionne deja sans serveur pour tester. Pour le vrai collaboratif, branche Supabase avec <code>supabase-schema.sql</code> puis remplace le stockage local par l'API.</div><div class="form-actions"><button class="secondary-button" type="button" data-close-modal="true">Fermer</button></div></div>`;
}

function saveProfile(fd) { Object.assign(me(), { name: String(fd.get("name") || ""), handle: String(fd.get("handle") || ""), bio: String(fd.get("bio") || ""), visibility: String(fd.get("visibility") || "private") }); closeModal(); renderAll(); }
function saveCar(fd) { state.cars.unshift({ id: crypto.randomUUID(), ownerId: me().id, sharedWith: fd.getAll("sharedWith"), name: String(fd.get("name") || ""), brand: String(fd.get("brand") || ""), model: String(fd.get("model") || ""), year: Number(fd.get("year") || 0), plate: String(fd.get("plate") || ""), fuelType: String(fd.get("fuelType") || ""), odometer: Number(fd.get("odometer") || 0), visibility: String(fd.get("visibility") || "private"), color: String(fd.get("color") || ""), notes: String(fd.get("notes") || "") }); closeModal(); renderAll(); }
function saveTrip(fd) { const startKm = Number(fd.get("startKm") || 0), endKm = Number(fd.get("endKm") || 0), carId = String(fd.get("carId") || ""); state.trips.unshift({ id: crypto.randomUUID(), carId, userId: me().id, title: String(fd.get("title") || ""), date: String(fd.get("date") || ""), startKm, endKm, distanceKm: Math.max(0, endKm - startKm), durationMin: Number(fd.get("durationMin") || 0), routeType: String(fd.get("routeType") || ""), note: String(fd.get("note") || ""), visibility: String(fd.get("visibility") || "private") }); if (car(carId)) car(carId).odometer = Math.max(car(carId).odometer, endKm); closeModal(); renderAll(); }
function saveFuel(fd) { const carId = String(fd.get("carId") || ""), odo = Number(fd.get("odometer") || 0); state.fuels.unshift({ id: crypto.randomUUID(), carId, userId: me().id, date: String(fd.get("date") || ""), odometer: odo, liters: Number(fd.get("liters") || 0), costTotal: Number(fd.get("costTotal") || 0), costPerUnit: Number(fd.get("costPerUnit") || 0), fuelType: String(fd.get("fuelType") || ""), station: String(fd.get("station") || ""), fullTank: String(fd.get("fullTank") || "true") === "true", visibility: String(fd.get("visibility") || "private") }); if (car(carId)) car(carId).odometer = Math.max(car(carId).odometer, odo); closeModal(); renderAll(); }
function saveMaintenance(fd) { const carId = String(fd.get("carId") || ""), odo = Number(fd.get("odometer") || 0); state.maintenance.unshift({ id: crypto.randomUUID(), carId, userId: me().id, date: String(fd.get("date") || ""), odometer: odo, type: String(fd.get("type") || ""), cost: Number(fd.get("cost") || 0), garage: String(fd.get("garage") || ""), note: String(fd.get("note") || ""), nextDueKm: Number(fd.get("nextDueKm") || 0), nextDueDate: String(fd.get("nextDueDate") || ""), visibility: String(fd.get("visibility") || "private") }); if (car(carId)) car(carId).odometer = Math.max(car(carId).odometer, odo); closeModal(); renderAll(); }
function saveNote(fd) { state.notes.unshift({ id: crypto.randomUUID(), carId: String(fd.get("carId") || ""), userId: me().id, date: String(fd.get("date") || ""), category: String(fd.get("category") || ""), title: String(fd.get("title") || ""), content: String(fd.get("content") || ""), visibility: String(fd.get("visibility") || "private") }); closeModal(); renderAll(); }
function saveFollow(fd) { const uid = String(fd.get("userId") || ""), cid = String(fd.get("carId") || ""); if (uid && !me().followedUserIds.includes(uid)) me().followedUserIds.push(uid); if (cid && !me().followedCarIds.includes(cid)) me().followedCarIds.push(cid); closeModal(); renderAll(); }
function toggleCarVisibility(id) { const c = car(id), order = ["private", "followers", "public"]; if (!c) return; c.visibility = order[(order.indexOf(c.visibility) + 1) % order.length]; renderAll(); }
function toggleFollow(kind, id) {
  if (kind === "user") me().followedUserIds = me().followedUserIds.includes(id) ? me().followedUserIds.filter((v) => v !== id) : [...me().followedUserIds, id];
  if (kind === "car") me().followedCarIds = me().followedCarIds.includes(id) ? me().followedCarIds.filter((v) => v !== id) : [...me().followedCarIds, id];
  renderAll();
}
