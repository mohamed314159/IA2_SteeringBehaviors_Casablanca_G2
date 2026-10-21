// Affichage : halo des véhicules (brillance), « Voir sur la carte » par
// comportement, entités du mode « véhicules seuls ».
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";
import { FICHIERS_SIMULATION } from "./fichiers.mjs";

const NOMS = ["drawVehicleGlow", "drawAgentHalo", "COMPORTEMENTS_A_LOCALISER", "COMPORTEMENTS_TOUCHES", "entitesMobiles",
  "comptesParComportement", "prochaineEntite", "garageDe", "nomEntite", "SteeringAgent", "Simulation", "CASANEARSHORE",
  "SCHEDULE_CONFIG", "LuxuryCar", "G4SVehicle", "SecurityGuard", "DEFINITIONS_REGLAGES", "REGLAGES_INITIAUX", "stepsFor"];

function env() {
  return chargerExemple([...FICHIERS_SIMULATION, "debug.js"], { noms: NOMS });
}

const appels = (etat, nom) => etat.dessins.filter(([n]) => n === nom);

test("halo d'un véhicule : liseré clair et contour sombre d'épaisseur constante à l'écran, état graphique restauré", () => {
  const { drawVehicleGlow, etat, contexte } = env();
  drawVehicleGlow(10, 4, 2, 1);
  assert.equal(appels(etat, "push").length, appels(etat, "pop").length, "push / pop équilibrés");
  const rects = appels(etat, "rect");
  assert.equal(rects.length, 2, "liseré clair puis contour sombre");
  // Liseré : plus grand que la carrosserie de 3 px écran (1,5 px du monde à zoom 2).
  assert.equal(rects[0][1][2], 10 + 1.5);
  const epaisseurs = appels(etat, "strokeWeight").map(([, a]) => a[0]);
  assert.deepEqual(epaisseurs, [1, 0.5], "2 px puis 1 px à l'écran, quel que soit le zoom");
  assert.equal(contexte.drawingContext.shadowBlur, 0, "le flou d'ombre est remis à zéro");
  etat.dessins.length = 0;
  drawVehicleGlow(10, 4, 4, 1);
  assert.deepEqual(appels(etat, "strokeWeight").map(([, a]) => a[0]), [0.5, 0.25]);
});

test("halo : intensité 0 (réglage) ou valeurs invalides → rien n'est dessiné ; le réglage est borné", () => {
  const { drawVehicleGlow, drawAgentHalo, etat, DEFINITIONS_REGLAGES, REGLAGES_INITIAUX } = env();
  drawVehicleGlow(10, 4, 2, 0);
  drawVehicleGlow(10, 4, 0, 1);
  drawAgentHalo(1, 2, 0);
  drawAgentHalo(1, NaN, 1);
  assert.equal(etat.dessins.length, 0);
  const def = DEFINITIONS_REGLAGES.find(d => d.cle === "scene.brillance");
  assert.ok(def && def.min === 0 && def.max === 2);
  assert.equal(REGLAGES_INITIAUX.scene.brillance, 1);
});

test("halo d'un agent : au moins 5 px de rayon à l'écran", () => {
  const { drawAgentHalo, etat } = env();
  drawAgentHalo(0.5, 2, 1);
  const [[, [x, y, d]]] = appels(etat, "circle");
  assert.equal(x, 0);
  assert.equal(y, 0);
  assert.equal(d, 5, "rayon 2,5 px du monde = 5 px à l'écran au zoom 2");
  etat.dessins.length = 0;
  drawAgentHalo(10, 2, 1);
  assert.equal(appels(etat, "circle")[0][1][2], 36, "1,8 × r pour un grand agent");
});

test("comportements à retrouver : les 9 groupes de réglages, cohérents avec la surbrillance 1 à 8", () => {
  const { COMPORTEMENTS_A_LOCALISER: C, COMPORTEMENTS_TOUCHES: T, DEFINITIONS_REGLAGES } = env();
  const groupes = new Set(DEFINITIONS_REGLAGES.map(d => d.cle.split(".")[0]).filter(g => g !== "scene"));
  assert.deepEqual([...groupes].sort(), Object.keys(C).sort());
  const entites = ["seek", "neuro", "pursue", "evade", "arrive", "wander", "path", "boids", "leader", "file", "idle"]
    .map(b => ({ behavior: b }));
  entites.push({ behavior: "path", evadeState: { active: true } }, { behavior: "path", debugInfo: { avoid: { active: true } } });
  const paires = [["seek", 1], ["arrive", 3], ["wander", 4], ["path", 5], ["avoid", 6], ["boids", 7], ["leader", 8]];
  for (const [cle, touche] of paires) {
    for (const e of entites) assert.equal(C[cle].test(e), T[touche].test(e), `${cle} / touche ${touche} / ${e.behavior}`);
  }
  // La touche 2 regroupe pursue et evade.
  for (const e of entites) assert.equal(C.pursue.test(e) || C.evade.test(e), T[2].test(e));
  assert.equal(C.leader.test({ behavior: "file" }), false, "la file des voitures n'est pas du suivi de leader");
});

test("comptage et entité suivante : on fait le tour des entités, null si personne", () => {
  const { SteeringAgent, comptesParComportement, prochaineEntite } = env();
  const agents = ["wander", "path", "wander", "arrive", "wander"].map((b, i) => {
    const a = new SteeringAgent(i, 0);
    a.setBehavior(b);
    return a;
  });
  const comptes = comptesParComportement(agents);
  assert.equal(comptes.wander, 3);
  assert.equal(comptes.path, 1);
  assert.equal(comptes.boids, 0);
  const premier = prochaineEntite(agents, "wander");
  assert.equal(premier.entite, agents[0]);
  assert.deepEqual([premier.rang, premier.total], [1, 3]);
  const deuxieme = prochaineEntite(agents, "wander", premier.entite);
  assert.equal(deuxieme.entite, agents[2]);
  const troisieme = prochaineEntite(agents, "wander", deuxieme.entite);
  assert.equal(troisieme.entite, agents[4]);
  assert.equal(prochaineEntite(agents, "wander", troisieme.entite).entite, agents[0], "retour au premier");
  assert.equal(prochaineEntite(agents, "wander", agents[1]).entite, agents[0], "précédente d'un autre comportement");
  assert.equal(prochaineEntite(agents, "boids"), null);
  assert.equal(prochaineEntite(agents, "inconnu"), null);
  assert.ok(agents.every((a, i) => a.pos.x === i && a.pos.y === 0), "lecture seule : rien n'a bougé");
});

test("entités mobiles (mode « véhicules seuls » et recherche) : voitures en route, convoi, gardiens, faune, employés ; pas les voitures garées", () => {
  const { Simulation, CASANEARSHORE, SCHEDULE_CONFIG, LuxuryCar, G4SVehicle, SecurityGuard, entitesMobiles, comptesParComportement, garageDe, nomEntite, stepsFor } = env();
  const sim = new Simulation(CASANEARSHORE, 6, { schedule: { ...SCHEDULE_CONFIG, firstCar: { h: 8, m: 30, s: 10 } }, present: 12 });
  for (let i = 0; i < stepsFor(4 * 60); i++) sim.step();
  const mobiles = entitesMobiles(sim);
  assert.ok(mobiles.filter(e => e instanceof G4SVehicle).length === 4, "le convoi");
  assert.equal(mobiles.filter(e => e instanceof SecurityGuard).length, sim.guards.length);
  assert.ok(sim.wildlife.entities().every(e => mobiles.includes(e)));
  assert.ok(sim.crowd.employees.every(e => mobiles.includes(e)));
  assert.ok(!mobiles.some(e => e.state === "parked" || e.state === "gone"));
  assert.ok(sim.traffic.cars.filter(c => c instanceof LuxuryCar && c.state !== "parked").every(c => mobiles.includes(c)));
  const comptes = comptesParComportement(mobiles);
  assert.ok(comptes.leader >= 3, "trois suiveurs du convoi");
  assert.ok(comptes.pursue >= 1, "un chat chasse");
  assert.equal(nomEntite(sim.transit.convoy[0]), "véhicule G4S");
  assert.equal(nomEntite(sim.guards[0]), "gardien");
  // garageDe : surface → -1 ; une position dans le plan d'un garage → son indice.
  assert.equal(garageDe(sim.world, sim.guards[0].pos), -1);
  const g = sim.world.garages[3];
  assert.equal(garageDe(sim.world, new Vector(g.bounds.x + 5, g.bounds.y + 5)), 3);
});
