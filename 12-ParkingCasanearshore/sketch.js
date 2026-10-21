// Contrôleur de la scène : initialisation, entrées, pas de simulation, rendu.
// Aucune formule de steering ici : les comportements sont dans les sous-classes,
// et l'ordre de mise à jour est documenté dans simulation.js.

let sim;
let temps;
let camera;
let sol;          // sol calculé par shader (groundShader.js)
let calqueDecor;  // décor dessiné une seule fois (mapRenderer.js)
let reglages;
let panneau;
let accueil;
let canvasElt;
let glissement = null;
let vueGarage = -1;   // -1 : surface ; sinon indice du garage affiché
let modeDebug = false;
let modeNoir = false; // « véhicules seuls » : fond noir, seulement ce qui bouge
let surbrillance = 0; // 0 : aucune ; 1 à 8 : comportement en surbrillance
let suivi = null;     // { entite, cle } : entité montrée par « Voir sur la carte »
let pauseAvantAccueil = false;
let bandeauFin = 0;   // instant (ms) où le bandeau se cache ; Infinity : permanent
let derniereHeure = "";

const GRAINE = 2026;
// Sous ce zoom, les entités sont dessinées en version simplifiée.
const ZOOM_DETAIL = 1.2;
// En vue d'ensemble, une voiture qui roule fait au moins 8 px de long à l'écran.
const LONGUEUR_MIN_ECRAN = 8;

function setup() {
  const canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent("scene");
  canvasElt = canvas.elt;
  randomSeed(GRAINE);
  reglages = creerReglages();
  SteeringAgent.settings = reglages;
  sim = new Simulation(CASANEARSHORE, GRAINE, optionsScene());
  temps = new TimeController();
  temps.config.autoFactor = reglages.scene.acceleration;
  panneau = creerPanneauReglages(reglages, DEFINITIONS_REGLAGES, appliquerReglage, {
    parentBouton: "barre",
    comportements: COMPORTEMENTS_A_LOCALISER,
    surLocaliser: localiser
  });
  // Le bouton « ? » reste le dernier de la barre.
  document.getElementById("barre").append(document.getElementById("bouton-aide"));

  // Décor : masques du sol pour le shader et calque de décor, une seule fois.
  // Les masques sont convertis en images (envoyées une seule fois à la carte graphique).
  const d = sim.campus.data;
  const masques = renderMasks(sim).map(g => {
    const img = g.get();
    g.remove();
    return img;
  });
  const arbres = generateTrees(sim.campus, sim.world, sim.esplanade, createRng(GRAINE + 7));
  calqueDecor = renderDecor(sim, arbres);
  sol = new GroundRenderer(masques[0], masques[1], d.width, d.height, d.projection.pxPerMeter);

  camera = new Camera(width, height);
  camera.maxZoom = 9;
  allerVers("ensemble");

  // Accueil : vignettes dessinées avec les fonctions des entités ; la
  // simulation attend « Commencer ».
  remplirGrilleComportements(document.getElementById("grille-comportements"));
  accueil = creerAccueil(document.getElementById("accueil"), fermerAccueil);
  temps.paused = true;
  initialiserControles();
  describe("Simulation vue de dessus du parc d'affaires Casanearshore à Casablanca (carte OpenStreetMap), de 8h30 à 9h05 : voitures de luxe qui entrent par les portes et se garent en surface ou dans six garages souterrains, tram à deux caisses, employés en tenue professionnelle sur les trottoirs, stands de café, bancs, gardiens en blanc, convoi de quatre véhicules G4S, chats qui chassent un papillon et oiseaux qui apprennent à attraper un morceau de pain. Les véhicules sont entourés d'un halo pour rester visibles ; un mode les montre seuls sur fond noir. À 9h05, une nouvelle matinée commence.");
}

// ---------- Contrôles (initialisés une seule fois) ----------

function initialiserControles() {
  document.getElementById("bouton-pause").addEventListener("click", basculerPause);
  document.getElementById("bouton-garage").addEventListener("click", garageSuivant);
  document.getElementById("bouton-noir").addEventListener("click", basculerModeNoir);
  document.getElementById("bouton-aide").addEventListener("click", ouvrirAccueil);
}

function fermerAccueil() {
  document.getElementById("barre").hidden = false;
  temps.paused = pauseAvantAccueil;
  majBoutonPause();
  canvasElt.focus();
}

function ouvrirAccueil() {
  pauseAvantAccueil = temps.paused;
  temps.paused = true;
  panneau.fermer();
  document.getElementById("barre").hidden = true;
  accueil.ouvrir();
}

function basculerPause() {
  temps.paused = !temps.paused;
  majBoutonPause();
}

function majBoutonPause() {
  const bouton = document.getElementById("bouton-pause");
  bouton.textContent = temps.paused ? "▶" : "⏸";
  const texte = temps.paused ? "Reprendre (Espace)" : "Pause (Espace)";
  bouton.setAttribute("aria-label", texte);
  bouton.title = texte;
}

// Mode « véhicules seuls » : la carte devient noire, il ne reste que ce qui bouge.
function basculerModeNoir() {
  modeNoir = !modeNoir;
  document.getElementById("bouton-noir").setAttribute("aria-pressed", String(modeNoir));
  afficherBandeau(modeNoir ? "Véhicules seuls (◐ ou B pour revenir à la carte)" : "Carte", 1800);
}

// Options de scène lues au démarrage de chaque matinée.
function optionsScene() {
  return { schedule: { ...SCHEDULE_CONFIG, cars: reglages.scene.voitures }, present: reglages.scene.presents };
}

// Appelée par le panneau pendant le glissement d'un curseur. Les réglages des
// comportements sont lus directement par les entités (SteeringAgent.settings).
function appliquerReglage(cle) {
  if (cle === "scene.acceleration") temps.config.autoFactor = reglages.scene.acceleration;
}

// Nouvelle matinée (à 9h05, ou touche R) : nouvelle graine, mêmes lieux.
function nouvelleMatinee() {
  suivi = null;
  sim.options = optionsScene();
  sim.reset(sim.seed + 1);
  afficherBandeau(`Matinée n° ${sim.morning} : il est 8h30`, 4000);
}

function afficherBandeau(texte, dureeMs = 2500) {
  const b = document.getElementById("bandeau");
  b.textContent = texte;
  b.hidden = false;
  bandeauFin = millis() + dureeMs;
}

// Surface → garage 1 → … → dernier garage → surface.
function garageSuivant() {
  suivi = null;
  vueGarage = vueGarage + 1 < sim.world.garages.length ? vueGarage + 1 : -1;
  if (vueGarage === -1) {
    allerVers("ensemble");
    afficherBandeau("Surface", 1200);
    return;
  }
  const g = sim.world.garages[vueGarage];
  camera.fit(g.bounds.x, g.bounds.y, g.bounds.w, g.bounds.h);
  afficherBandeau(`${g.lot.name} · ${vueGarage + 1}/${sim.world.garages.length} (G : suivant)`, Infinity);
}

function allerVers(vue) {
  suivi = null;
  if (vueGarage !== -1) {
    vueGarage = -1;
    document.getElementById("bandeau").hidden = true;
  }
  if (vue === "ensemble") {
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

// ---------- Retrouver un comportement (panneau ⚙, « Voir sur la carte ») ----------

// Centre la vue sur une entité qui exécute ce comportement (la suivante à
// chaque clic) ; ensuite la caméra la suit, jusqu'à ce qu'on déplace la vue.
function localiser(cle) {
  const c = COMPORTEMENTS_A_LOCALISER[cle];
  const precedente = suivi && suivi.cle === cle ? suivi.entite : null;
  const r = prochaineEntite(entitesMobiles(sim), cle, precedente);
  if (!r) {
    suivi = null;
    afficherBandeau(`${c.nom} : personne en ce moment`);
    return;
  }
  suivi = { entite: r.entite, cle };
  camera.setZoom(Math.max(camera.zoom, 4));
  placerCameraSur(r.entite, 1);
  afficherBandeau(`${c.nom} : ${nomEntite(r.entite)} ${r.rang}/${r.total} — suivi par la caméra (glisser ou Échap pour arrêter)`, 5000);
}

// Vue sur l'entité (et sur son garage si elle est au sous-sol). `doux` : part
// du chemin parcourue à cette image (1 : saut direct).
function placerCameraSur(e, doux) {
  const garage = e.level === -1 ? garageDe(sim.world, e.pos) : -1;
  if (garage !== vueGarage) {
    vueGarage = garage;
    doux = 1;
  }
  camera.x += (e.pos.x - camera.x) * doux;
  camera.y += (e.pos.y - camera.y) * doux;
}

// À chaque image : la caméra suit l'entité tant qu'elle bouge encore.
function suivreEntite() {
  const e = suivi.entite;
  if (!entitesMobiles(sim).includes(e)) {
    afficherBandeau(`${COMPORTEMENTS_A_LOCALISER[suivi.cle].nom} : fin du suivi, ${nomEntite(e)} plus en mouvement`);
    suivi = null;
    return;
  }
  placerCameraSur(e, 0.25);
}

function arreterSuivi() {
  if (!suivi) return;
  suivi = null;
  afficherBandeau("Suivi arrêté", 1200);
}

// ---------- Boucle ----------

function draw() {
  // À 9h05, une autre matinée commence toute seule.
  if (sim.isFinished()) nouvelleMatinee();
  const facteur = temps.factor(sim.isQuiet(), sim.secondsToNextEvent());
  if (facteur > 0) runSimulationSteps(() => sim.step(), facteur);
  if (suivi) suivreEntite();
  dessinerScene();
  majAffichage();
}

function dessinerScene() {
  const garage = vueGarage >= 0 ? sim.world.garages[vueGarage] : null;
  const niveau = garage ? -1 : 0;
  const visible = camera.visibleRect(40);
  const detail = camera.zoom >= ZOOM_DETAIL;
  if (modeNoir) background(0);
  else if (garage) background(MAP_COLORS.garage);
  else sol.draw(camera, millis() / 1000);
  push();
  camera.apply();
  if (modeNoir) dessinerAgentsSeuls(niveau, visible, detail);
  else if (garage) dessinerGarage(garage, visible);
  else dessinerSurface(visible, detail);
  dessinerSuivi(niveau);
  pop();
}

function dessinerSurface(visible, detail) {
  image(calqueDecor, 0, 0);
  // Le marquage des places est dans le calque ; seules les places réservées changent.
  for (const lot of sim.world.lots) for (const s of lot.spots) if (s.state === "reserved" && dansLeRectangle(s.pos, visible)) s.showState();
  for (const a of sim.esplanade.assemblyPoints) if (dansLeRectangle(a.pos, visible)) a.show(camera.zoom);
  dessinerListe(sim.decorObstacles, visible);
  for (const b of sim.campus.buildings) b.show();
  for (const g of sim.world.garages) drawGarageEntrance(g, camera.zoom);
  dessinerVehicules(0, visible, detail);
  for (const t of sim.transit.trams) dessinerTram(t);
  dessinerPietons(0, visible, detail);
  dessinerListe(sim.guards, visible);
  dessinerListe(sim.wildlife.entities(), visible);
  for (const g of Object.values(sim.world.gates)) g.show(camera.zoom);
  for (const b of sim.campus.buildings) b.showLabel(camera.zoom);
  dessinerDebug(0);
}

function dessinerGarage(garage, visible) {
  garage.showPlan();
  dessinerListe(garage.lot.spots, visible);
  for (const p of garage.pillars) p.show();
  dessinerVehicules(-1, visible, true);
  dessinerPietons(-1, visible, true);
  dessinerDebug(-1);
}

// Mode « véhicules seuls » : sur fond noir, seulement ce qui bouge, chacun
// avec son halo (voitures, convoi, tram, piétons, gardiens, animaux).
function dessinerAgentsSeuls(niveau, visible, detail) {
  dessinerVehicules(niveau, visible, detail);
  if (niveau === 0) for (const t of sim.transit.trams) dessinerTram(t);
  const agents = sim.crowd.employees.filter(e => e.level === niveau);
  if (niveau === 0) agents.push(...sim.guards, ...sim.wildlife.entities());
  const intensite = Math.max(0.6, reglages.scene.brillance);
  for (const e of agents) {
    if (!dansLeRectangle(e.pos, visible)) continue;
    push();
    translate(e.pos.x, e.pos.y);
    drawAgentHalo(e.r, camera.zoom, intensite);
    pop();
    if (detail) {
      e.show(camera.zoom);
    } else {
      push();
      noStroke();
      fill(e.look ? e.look.outfit.shirt : e.color ?? "#f0e0c0");
      circle(e.pos.x, e.pos.y, Math.max(e.r * 2, 3 / camera.zoom));
      pop();
    }
  }
  dessinerDebug(niveau);
}

// Anneau pulsé autour de l'entité suivie (si elle est au niveau affiché).
function dessinerSuivi(niveau) {
  if (!suivi || (suivi.entite.level ?? 0) !== niveau) return;
  const e = suivi.entite;
  const rayon = Math.max(e.r * 3, (e.length ?? 0) * 0.7, 16 / camera.zoom) * (1 + 0.12 * Math.sin(millis() / 180));
  push();
  noFill();
  stroke(255, 213, 79);
  strokeWeight(3 / camera.zoom);
  circle(e.pos.x, e.pos.y, rayon * 2);
  stroke(20, 24, 30, 200);
  strokeWeight(1 / camera.zoom);
  circle(e.pos.x, e.pos.y, rayon * 2 + 4 / camera.zoom);
  pop();
}

// Debug (D) et surbrillance (1 à 8) : lecture seule des entités du niveau affiché.
function dessinerDebug(niveau) {
  if (!modeDebug && !surbrillance) return;
  const entites = [...sim.traffic.cars.filter(c => c.level === niveau && c.state !== "parked"), ...sim.crowd.employees.filter(e => e.level === niveau)];
  if (niveau === 0) entites.push(...sim.transit.trams, ...sim.guards, ...sim.wildlife.entities());
  if (modeDebug) drawDebugOverlay(entites, camera.zoom);
  if (surbrillance) drawHighlight(entites, surbrillance, camera.zoom);
}

function dansLeRectangle(p, r) {
  return p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
}

function dessinerListe(entites, visible) {
  for (const e of entites) if (dansLeRectangle(e.pos, visible)) e.show();
}

// Halo d'un véhicule (voiture, G4S, caisse de tram), dans son repère et à
// sa taille de dessin. Intensité : réglage « Brillance des véhicules ».
function dessinerHaloVehicule(v, agrandissement = 1) {
  const k = (v.sizeScale ?? (v.sizeFactor ? v.sizeFactor() : 1)) * agrandissement;
  push();
  translate(v.pos.x, v.pos.y);
  rotate(v.heading.heading());
  scale(k);
  drawVehicleGlow(v.length, v.widthPx, camera.zoom * k, reglages.scene.brillance);
  pop();
}

function dessinerTram(t) {
  for (const caisse of t.cars()) dessinerHaloVehicule(caisse);
  t.show();
}

function dessinerVehicules(niveau, visible, detail) {
  for (const c of sim.traffic.cars) {
    if (c.level !== niveau || !dansLeRectangle(c.pos, visible)) continue;
    if (detail) {
      dessinerHaloVehicule(c);
      c.show();
    } else {
      // Vue d'ensemble : un rectangle orienté, agrandi s'il roule (au moins
      // LONGUEUR_MIN_ECRAN px à l'écran), avec son halo.
      const k = c.state === "parked" ? 1 : Math.max(1, LONGUEUR_MIN_ECRAN / (c.length * camera.zoom));
      dessinerHaloVehicule(c, k);
      push();
      translate(c.pos.x, c.pos.y);
      rotate(c.heading.heading());
      scale(k);
      noStroke();
      fill(c.spec ? c.spec.color : "#f8f8f8");
      rectMode(CENTER);
      rect(0, 0, c.length, c.widthPx, c.widthPx * 0.3);
      pop();
    }
  }
}

function dessinerPietons(niveau, visible, detail) {
  for (const e of sim.crowd.employees) {
    if (e.level !== niveau || !dansLeRectangle(e.pos, visible)) continue;
    if (detail) {
      e.show(camera.zoom);
    } else {
      push();
      noStroke();
      fill(e.look.outfit.jacket ?? e.look.outfit.shirt);
      circle(e.pos.x, e.pos.y, e.r * 2);
      pop();
    }
  }
}

// Heure HH:MM, état du temps, bandeau, et informations du panneau.
function majAffichage() {
  const heure = sim.clock.label().slice(0, 5);
  if (heure !== derniereHeure) {
    document.getElementById("horloge").textContent = heure;
    derniereHeure = heure;
  }
  if (millis() > bandeauFin) document.getElementById("bandeau").hidden = true;
  if (frameCount % 15 !== 0) return;
  const etat = temps.paused ? "pause" : temps.accelerating ? "⏩ tous au travail" : "";
  const zone = document.getElementById("etat-temps");
  if (zone.textContent !== etat) zone.textContent = etat;
  if (panneau.estOuvert()) {
    panneau.afficherInfos(infosScene());
    panneau.majComptes(comptesParComportement(entitesMobiles(sim)));
  }
}

function infosScene() {
  const s = sim.stats();
  const ligne = (nom, c) => `<tr><td>${nom}</td><td>${c.free} / ${c.all}</td></tr>`;
  const surface = sim.world.lots.map(l => ligne(l.name, countSpots([l]))).join("");
  const garages = sim.world.garages.map(g => ligne(g.lot.name, countSpots([g.lot]))).join("");
  return `
    <h3>Places libres</h3>
    <table class="places">
      <tr class="total"><td>Surface</td><td>${s.surfaceFree} / ${s.surfaceAll}</td></tr>${surface}
      <tr class="total"><td>Garages souterrains</td><td>${s.garageFree} / ${s.garageAll}</td></tr>${garages}
    </table>
    <h3>Matinée n° ${s.morning}</h3>
    <p>Voitures en route : ${s.carsMoving} · garées : ${s.carsParked} · contacts : ${s.collisions}<br>
    Employés dehors : ${s.employeesOutside} · entrés au travail : ${s.entered}</p>
    <h3>Faune</h3>
    <p>Oiseaux : génération ${s.birdsGeneration} · pain attrapé ${s.breadCaught} fois<br>
    Papillons attrapés par les chats : ${s.butterfliesCaught}</p>`;
}

// ---------- Entrées ----------

function mousePressed(event) {
  if (accueil.estOuvert() || !event || event.target !== canvasElt) return;
  glissement = { x: mouseX, y: mouseY };
}

function mouseDragged() {
  if (!glissement) return;
  // Déplacer la vue à la main arrête le suivi d'une entité.
  if (mouseX !== glissement.x || mouseY !== glissement.y) arreterSuivi();
  camera.pan(mouseX - glissement.x, mouseY - glissement.y);
  glissement = { x: mouseX, y: mouseY };
}

function mouseReleased() {
  glissement = null;
}

// La molette ne zoome que sur la carte : l'accueil et le panneau défilent normalement.
function mouseWheel(event) {
  if (accueil.estOuvert() || event.target !== canvasElt) return;
  // Pendant un suivi, on zoome autour de l'entité suivie (centre de la vue).
  const x = suivi ? width / 2 : mouseX;
  const y = suivi ? height / 2 : mouseY;
  camera.zoomAt(x, y, event.delta > 0 ? 1 / 1.15 : 1.15);
  return false;
}

function keyPressed() {
  if (accueil.estOuvert()) return;
  const actif = document.activeElement;
  // Ne pas détourner les touches quand on écrit dans un contrôle ; Espace et
  // Entrée sur un bouton gardent leur effet normal (un seul clic).
  if (actif && ["INPUT", "SELECT", "TEXTAREA"].includes(actif.tagName)) return;
  if (actif && actif.tagName === "BUTTON" && (key === " " || keyCode === ENTER)) return;
  if (key === " ") {
    basculerPause();
    return false;
  }
  const k = key.toLowerCase();
  if (key === "+" || key === "=") camera.zoomAt(width / 2, height / 2, 1.2);
  if (key === "-") camera.zoomAt(width / 2, height / 2, 1 / 1.2);
  if (k === "g") garageSuivant();
  if (k === "b") basculerModeNoir();
  if (k === "d") modeDebug = !modeDebug;
  if (k === "p") panneau.basculer();
  if (k === "h") ouvrirAccueil();
  if (k === "r") nouvelleMatinee();
  if (k === "v") allerVers("ensemble");
  if (k === "n") allerVers("nord");
  if (k === "s") allerVers("sud");
  if (k === "t") allerVers("station");
  if (keyCode === ESCAPE) {
    if (panneau.estOuvert()) panneau.fermer();
    arreterSuivi();
  }
  if (key >= "1" && key <= "8") {
    surbrillance = surbrillance === Number(key) ? 0 : Number(key);
    afficherBandeau(surbrillance ? `Surbrillance : ${COMPORTEMENTS_TOUCHES[surbrillance].nom}` : "Surbrillance retirée");
  }
  const pas = 80;
  if ([LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW].includes(keyCode)) arreterSuivi();
  if (keyCode === LEFT_ARROW) camera.pan(pas, 0);
  if (keyCode === RIGHT_ARROW) camera.pan(-pas, 0);
  if (keyCode === UP_ARROW) camera.pan(0, pas);
  if (keyCode === DOWN_ARROW) camera.pan(0, -pas);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  camera.resize(width, height);
  sol.resize(width, height);
}
