// Contrôleur de la scène : initialisation, entrées, pas de simulation, rendu.
// Aucune formule de steering ici : les comportements sont dans les sous-classes,
// et l'ordre de mise à jour est documenté dans simulation.js.

let sim;
let temps;
let calqueCarte;
let camera;
let glissement = null;
let vueGarage = false;
let derniersPas = 1;
let reglages;
let panneau;
let modeDebug = false;
let surbrillance = 0; // 0 : aucune ; 1 à 8 : comportement en surbrillance

const GRAINE = 2026;
// Sous ce zoom, les entités sont dessinées en version simplifiée.
const ZOOM_DETAIL = 1.2;

// La barre d'outils peut passer sur plusieurs lignes : le canvas occupe le reste.
function hauteurBarre() {
  const h = document.getElementById("barre").offsetHeight;
  document.documentElement.style.setProperty("--hauteur-barre", `${h}px`);
  return h;
}

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight - hauteurBarre());
  canvas.parent("scene");
  randomSeed(GRAINE);
  reglages = creerReglages();
  SteeringAgent.settings = reglages;
  sim = new Simulation(CASANEARSHORE, GRAINE, optionsScene());
  temps = new TimeController();
  temps.config.autoFactor = reglages.scene.acceleration;
  panneau = creerPanneauReglages(reglages, DEFINITIONS_REGLAGES, appliquerReglage);
  calqueCarte = renderMapLayer(sim.campus, sim.world);
  camera = new Camera(width, height);
  camera.maxZoom = 9;
  allerVers("ensemble");
  initialiserControles();
  describe("Simulation vue de dessus du parc Casanearshore (carte OpenStreetMap) entre 8h30 et 9h05 : voitures de luxe qui entrent par les portes nord et sud et se garent en surface ou au garage souterrain, tram à deux caisses et navette G4S qui déposent des employés, employés en tenue professionnelle qui flânent, boivent un café, discutent en groupe puis entrent dans leurs bâtiments à 8h55.");
}

// ---------- Contrôles (initialisés une seule fois) ----------

function initialiserControles() {
  for (const bouton of document.querySelectorAll("[data-vue]")) {
    bouton.addEventListener("click", () => allerVers(bouton.dataset.vue));
  }
  for (const bouton of document.querySelectorAll("[data-vitesse]")) {
    bouton.addEventListener("click", () => {
      temps.manualFactor = Number(bouton.dataset.vitesse);
      majBoutonsVitesse();
    });
  }
  document.getElementById("bouton-pause").addEventListener("click", basculerPause);
  document.getElementById("bouton-recommencer").addEventListener("click", recommencer);
  document.getElementById("case-auto").addEventListener("input", e => {
    temps.auto = e.target.checked;
  });
  majBoutonsVitesse();
}

function majBoutonsVitesse() {
  for (const bouton of document.querySelectorAll("[data-vitesse]")) {
    bouton.setAttribute("aria-pressed", String(Number(bouton.dataset.vitesse) === temps.manualFactor));
  }
}

function basculerPause() {
  temps.paused = !temps.paused;
  document.getElementById("bouton-pause").textContent = temps.paused ? "▶ Lecture" : "⏸ Pause";
}

// Options de scène lues au (re)démarrage : nombre de voitures et d'employés présents.
function optionsScene() {
  return { schedule: { ...SCHEDULE_CONFIG, cars: reglages.scene.voitures }, present: reglages.scene.presents };
}

// Appelée par le panneau pendant le glissement d'un curseur. Les réglages des
// comportements sont lus directement par les entités (SteeringAgent.settings).
function appliquerReglage(cle) {
  if (cle === "scene.acceleration") temps.config.autoFactor = reglages.scene.acceleration;
}

function recommencer() {
  sim.options = optionsScene();
  sim.reset(GRAINE);
  randomSeed(GRAINE);
}

function allerVers(vue) {
  if (vue === "garage") {
    vueGarage = !vueGarage;
    if (!vueGarage) vue = "ensemble";
  } else {
    vueGarage = false;
  }
  document.getElementById("bouton-garage").textContent = vueGarage ? "Retour à la surface" : "Voir le garage";
  if (vueGarage) {
    const b = sim.world.garage.bounds;
    camera.fit(b.x, b.y, b.w, b.h);
  } else if (vue === "ensemble") {
    const xs = sim.campus.site.map(p => p.x);
    const ys = sim.campus.site.map(p => p.y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    camera.fit(x0, y0, Math.max(...xs) - x0, Math.max(...ys) - y0);
  } else if (vue === "station") {
    const quai = sim.transit.lines.ouest.station;
    camera.focus(quai.x, quai.y + 30, 2.5);
  } else if (sim.world.gates[vue]) {
    camera.focus(sim.world.gates[vue].pos.x, sim.world.gates[vue].pos.y, 3);
  }
}

// ---------- Boucle ----------

function draw() {
  const facteur = sim.isFinished() ? 0 : temps.factor(sim.isQuiet(), sim.secondsToNextEvent());
  derniersPas = facteur > 0 ? runSimulationSteps(() => sim.step(), facteur) : 0;
  dessinerScene();
  majAffichage(facteur);
}

function dessinerScene() {
  background(vueGarage ? "#2b2f35" : MAP_COLORS.ground);
  const visible = camera.visibleRect(40);
  const detail = camera.zoom >= ZOOM_DETAIL;
  push();
  camera.apply();
  if (!vueGarage) {
    image(calqueCarte, 0, 0);
    // Le marquage des places est dans le calque ; seules les places réservées changent.
    for (const lot of sim.world.lots) for (const s of lot.spots) if (s.state === "reserved" && dansLeRectangle(s.pos, visible)) s.showState();
    dessinerListe(sim.decorObstacles, visible);
    for (const b of sim.campus.buildings) b.show();
    drawGarageEntrance(sim.world.garage, camera.zoom);
    dessinerVehicules(0, visible, detail);
    for (const t of sim.transit.trams) t.show();
    dessinerPietons(0, visible, detail);
    for (const g of Object.values(sim.world.gates)) g.show(camera.zoom);
    for (const b of sim.campus.buildings) b.showLabel(camera.zoom);
    dessinerDebug(0);
  } else {
    sim.world.garage.showPlan();
    dessinerListe(sim.world.garage.lot.spots, visible);
    for (const p of sim.world.garage.pillars) p.show();
    dessinerVehicules(-1, visible, true);
    dessinerPietons(-1, visible, true);
    dessinerDebug(-1);
  }
  pop();
}

// Debug (D) et surbrillance (1 à 8) : lecture seule des entités du niveau affiché.
function dessinerDebug(niveau) {
  const entites = [...sim.traffic.cars.filter(c => c.level === niveau && c.state !== "parked"), ...sim.crowd.employees.filter(e => e.level === niveau)];
  if (niveau === 0) entites.push(...sim.transit.trams);
  if (modeDebug) drawDebugOverlay(entites, camera.zoom);
  if (surbrillance) drawHighlight(entites, surbrillance, camera.zoom);
}

function dansLeRectangle(p, r) {
  return p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
}

function dessinerListe(entites, visible) {
  for (const e of entites) if (dansLeRectangle(e.pos, visible)) e.show();
}

function dessinerVehicules(niveau, visible, detail) {
  for (const c of sim.traffic.cars) {
    if (c.level !== niveau || !dansLeRectangle(c.pos, visible)) continue;
    if (detail) {
      c.show();
    } else {
      // Version simplifiée en vue d'ensemble : un rectangle orienté.
      push();
      translate(c.pos.x, c.pos.y);
      rotate(c.heading.heading());
      noStroke();
      fill(c.spec ? c.spec.color : "#ffffff");
      rectMode(CENTER);
      rect(0, 0, c.length, c.widthPx);
      pop();
    }
  }
}

function dessinerPietons(niveau, visible, detail) {
  for (const e of sim.crowd.employees) {
    if (e.level !== niveau || !dansLeRectangle(e.pos, visible)) continue;
    if (detail) {
      e.show();
    } else {
      push();
      noStroke();
      fill(e.look.outfit.jacket ?? e.look.outfit.shirt);
      circle(e.pos.x, e.pos.y, e.r * 2);
      pop();
    }
  }
}

function majAffichage(facteur) {
  document.getElementById("horloge").textContent = sim.clock.label();
  if (frameCount % 10 !== 0) return;
  const s = sim.stats();
  document.getElementById("vitesse").textContent = sim.isFinished() ? "■ 9h05 : fin de la matinée" : temps.label(facteur);
  document.getElementById("compteur-places").textContent =
    `Places libres : surface ${s.surfaceFree}/${s.surfaceAll} · garage ${s.garageFree}/${s.garageAll} · ` +
    `voitures en route ${s.carsMoving} · garées ${s.carsParked} · piétons dehors ${s.employeesOutside} · ` +
    `entrés au travail ${s.entered} · contacts ${s.collisions}`;
}

// ---------- Entrées ----------

function sourisDansLeCanvas() {
  return mouseX >= 0 && mouseY >= 0 && mouseX <= width && mouseY <= height;
}

function mousePressed() {
  if (!sourisDansLeCanvas()) return;
  glissement = { x: mouseX, y: mouseY };
}

function mouseDragged() {
  if (!glissement) return;
  camera.pan(mouseX - glissement.x, mouseY - glissement.y);
  glissement = { x: mouseX, y: mouseY };
}

function mouseReleased() {
  glissement = null;
}

function mouseWheel(event) {
  if (!sourisDansLeCanvas()) return;
  camera.zoomAt(mouseX, mouseY, event.delta > 0 ? 1 / 1.15 : 1.15);
  return false;
}

function keyPressed() {
  // Ne pas détourner les touches quand on écrit dans un contrôle.
  if (document.activeElement && ["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
  if (key === " ") {
    basculerPause();
    return false;
  }
  if (key === "+" || key === "=") camera.zoomAt(width / 2, height / 2, 1.2);
  if (key === "-") camera.zoomAt(width / 2, height / 2, 1 / 1.2);
  if (key === "g" || key === "G") allerVers("garage");
  if (key === "d" || key === "D") modeDebug = !modeDebug;
  if (key === "p" || key === "P") panneau.basculer();
  if (keyCode === ESCAPE && panneau.estOuvert()) panneau.fermer();
  if (key >= "1" && key <= "8") {
    surbrillance = surbrillance === Number(key) ? 0 : Number(key);
    document.getElementById("surbrillance").textContent = surbrillance ? `Surbrillance : ${COMPORTEMENTS_TOUCHES[surbrillance].nom}` : "";
  }
  if (key === "r" || key === "R") recommencer();
  const pas = 80;
  if (keyCode === LEFT_ARROW) camera.pan(pas, 0);
  if (keyCode === RIGHT_ARROW) camera.pan(-pas, 0);
  if (keyCode === UP_ARROW) camera.pan(0, pas);
  if (keyCode === DOWN_ARROW) camera.pan(0, -pas);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight - hauteurBarre());
  camera.resize(width, height);
}
