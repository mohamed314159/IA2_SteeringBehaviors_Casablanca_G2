// Étape 10 : horloge, programme de la matinée, temps accéléré, simulation.
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple } from "./adaptateur-p5.mjs";
import { FICHIERS_SIMULATION } from "./fichiers.mjs";

const FICHIERS = FICHIERS_SIMULATION;
const NOMS = ["G4SVehicle", "LuxuryCar", "CASANEARSHORE", "SimClock", "buildSchedule", "SCHEDULE_CONFIG", "TimeController", "runSimulationSteps",
  "Simulation", "createRng", "SIM_STEP_SECONDS", "stepsFor"];

function env(graine = 1) {
  return chargerExemple(FICHIERS, { noms: NOMS, graine });
}

test("horloge : 8h30 au départ, 8h55 au pas exact, fin à 9h05", () => {
  const { SimClock, stepsFor } = env();
  const h = new SimClock();
  assert.equal(h.label(), "08:30:00");
  const pas855 = stepsFor(25 * 60);
  for (let i = 0; i < pas855 - 1; i++) h.tick();
  assert.equal(h.isWorkTime(), false);
  h.tick();
  assert.equal(h.isWorkTime(), true);
  assert.equal(h.label(), "08:55:00");
  assert.equal(h.at(8, 55), 25 * 60);
  for (let i = 0; i < stepsFor(10 * 60); i++) h.tick();
  assert.equal(h.isOver(), true);
});

test("programme : reproductible, trié, dans les bornes, avec 8h55", () => {
  const { buildSchedule, SimClock, createRng, SCHEDULE_CONFIG } = env();
  const h = new SimClock();
  const a = buildSchedule(createRng(5), h);
  const b = buildSchedule(createRng(5), h);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  for (let i = 1; i < a.length; i++) assert.ok(a[i].time >= a[i - 1].time);
  const voitures = a.filter(e => e.type === "car");
  assert.equal(voitures.length, SCHEDULE_CONFIG.cars);
  assert.ok(voitures.every(e => e.time >= h.at(8, 31) && e.time <= h.at(8, 55)));
  // pic d'arrivée : plus de voitures entre 8h41 et 8h49 qu'entre 8h31 et 8h39
  const entre = (x, y) => voitures.filter(e => e.time >= x && e.time < y).length;
  assert.ok(entre(h.at(8, 41), h.at(8, 49)) > entre(h.at(8, 31), h.at(8, 39)));
  // dernier tram à 8h44 : ses passagers ont le temps d'entrer avant 9h05
  assert.ok(a.filter(e => e.type === "tram").every(e => e.time <= h.at(8, 44)));
  assert.equal(a.filter(e => e.type === "work").length, 1);
  assert.equal(a.find(e => e.type === "work").time, 25 * 60);
  assert.ok(a.filter(e => e.type === "tram").every(e => e.passengers >= 12 && e.passengers <= 22));
  assert.equal(a.filter(e => e.type === "shuttle").length, 0, "navette remplacée par le convoi G4S");
});

test("temps accéléré : ×auto seulement au calme et loin du prochain événement", () => {
  const { TimeController } = env();
  const t = new TimeController();
  assert.equal(t.factor(true, 100), 8);
  assert.equal(t.accelerating, true);
  assert.equal(t.factor(true, 10), 1, "retour à ×1 avant l'événement");
  assert.equal(t.factor(false, 100), 1, "pas d'accélération s'il se passe quelque chose");
  t.manualFactor = 2;
  assert.equal(t.factor(true, 100), 16);
  t.auto = false;
  assert.equal(t.factor(true, 100), 2);
  t.paused = true;
  assert.equal(t.factor(true, 100), 0);
  assert.ok(t.label(0).includes("pause"));
});

test("runSimulationSteps : N pas, budget de temps respecté, au moins un pas", () => {
  const { runSimulationSteps } = env();
  let n = 0;
  assert.equal(runSimulationSteps(() => { n++; return true; }, 8, () => 0), 8);
  let horloge = 0;
  const pas = runSimulationSteps(() => { horloge += 5; return true; }, 8, () => horloge, 14);
  assert.equal(pas, 3, "arrêt dès que 14 ms sont dépassés");
  assert.equal(runSimulationSteps(() => false, 8, () => 0), 1);
});

test("simulation : 8h55 déclenche le départ au travail au bon pas ; pas d'accélération avant", () => {
  const { Simulation, CASANEARSHORE, stepsFor } = env();
  const sim = new Simulation(CASANEARSHORE, 7, { present: 10 });
  assert.equal(sim.isQuiet(), false, "à 8h30 personne n'est encore entré travailler");
  assert.ok(sim.secondsToNextEvent() > 0);
  const pas855 = stepsFor(25 * 60);
  for (let i = 0; i < pas855; i++) sim.step();
  assert.equal(sim.crowd.workStarted, false);
  sim.step();
  assert.equal(sim.crowd.workStarted, true);
});

test("simulation : déterminisme (même graine, même état) et accélération sans effet sur le résultat", () => {
  const a = env(3);
  const b = env(3);
  const s1 = new a.Simulation(a.CASANEARSHORE, 11, { present: 8 });
  const s2 = new b.Simulation(b.CASANEARSHORE, 11, { present: 8 });
  // s1 avance pas à pas (×1), s2 par paquets de 8 (×8) : même nombre de pas.
  for (let i = 0; i < 1600; i++) s1.step();
  for (let i = 0; i < 200; i++) b.runSimulationSteps(() => s2.step(), 8, () => 0);
  assert.deepEqual(JSON.parse(JSON.stringify(s1.stats())), JSON.parse(JSON.stringify(s2.stats())));
  const p1 = s1.crowd.employees.map(e => [e.pos.x, e.pos.y]);
  const p2 = s2.crowd.employees.map(e => [e.pos.x, e.pos.y]);
  assert.deepEqual(JSON.parse(JSON.stringify(p1)), JSON.parse(JSON.stringify(p2)));
});

test("simulation : nouvelle matinée (9h05) : places libérées, convoi, gardiens et faune recréés, compteur de matinées", () => {
  const { Simulation, CASANEARSHORE, G4SVehicle } = env(2);
  const sim = new Simulation(CASANEARSHORE, 4, { present: 5 });
  assert.equal(sim.morning, 1);
  for (let i = 0; i < 2500; i++) sim.step();
  const avant = sim.stats();
  assert.ok(avant.carsParked + avant.carsMoving > 0);
  const gardiens = sim.guards.length;
  sim.reset(5);
  const apres = sim.stats();
  assert.equal(apres.morning, 2);
  assert.equal(sim.seed, 5);
  assert.equal(apres.time, "08:30:00");
  assert.equal(apres.surfaceFree, apres.surfaceAll);
  assert.equal(apres.garageFree, apres.garageAll);
  assert.equal(apres.carsMoving + apres.carsParked, 0);
  assert.equal(sim.crowd.employees.length, 5);
  assert.equal(sim.traffic.cars.length, 4, "seul le convoi roule à 8h30");
  assert.ok(sim.traffic.cars.every(c => c instanceof G4SVehicle));
  assert.equal(sim.guards.length, gardiens);
  assert.equal(apres.birdsGeneration, 1);
  assert.ok(sim.esplanade.obstacles.every(o => !o.seats || o.seats.every(p => p.occupant === null)), "bancs libérés");
});

test("accélération : seulement quand tout le monde est entré travailler (le convoi G4S ne compte pas)", () => {
  const { Simulation, CASANEARSHORE, SCHEDULE_CONFIG, stepsFor } = env(3);
  const calme = { ...SCHEDULE_CONFIG, cars: 0, late: [], lastTram: { h: 8, m: 0 } };
  const sim = new Simulation(CASANEARSHORE, 8, { schedule: calme, present: 3 });
  assert.equal(sim.schedule.filter(e => e.type === "tram").length, 0);
  // Avant 8h55, les flâneurs sont dehors : pas d'accélération.
  for (let i = 0; i < stepsFor(20 * 60); i++) sim.step();
  assert.equal(sim.isQuiet(), false);
  // Après 8h55, tant qu'un employé marche, pas d'accélération.
  while (!sim.crowd.workStarted) sim.step();
  assert.ok(sim.crowd.employees.length > 0);
  assert.equal(sim.isQuiet(), false);
  let n = 0;
  while (sim.crowd.employees.length > 0 && n < stepsFor(8 * 60)) {
    sim.step();
    n++;
  }
  assert.equal(sim.crowd.employees.length, 0, "tout le monde est entré");
  assert.ok(sim.transit.convoy.every(v => v.vel.mag() > 0 || v.state !== "gone"), "le convoi continue sa ronde");
  assert.equal(sim.isQuiet(), true);
  // Un retardataire de plus : l'accélération s'arrête.
  sim.crowd.spawnLate(sim.lateEntrance(), sim.crowd.randomBuilding());
  assert.equal(sim.isQuiet(), false);
});

test("faune dans la scène : pelouses dégagées dans le parc ; chats, papillon et pain y restent", () => {
  const e = env(4);
  const sim = new e.Simulation(e.CASANEARSHORE, 2026, { present: 0 });
  const f = sim.wildlife;
  const dansLeParc = p => sim.campus.insideSite({ x: p.x, y: p.y });
  assert.ok(dansLeParc(f.lawn.center) && dansLeParc(f.breadZone.center) && dansLeParc(f.nest));
  assert.ok(f.lawn.center.dist(f.breadZone.center) > f.lawn.radius + f.breadZone.radius, "deux pelouses distinctes");
  for (const b of sim.campus.buildings) assert.equal(b.contains(f.lawn.center) || b.contains(f.breadZone.center), false);
  let dehors = 0;
  for (let i = 0; i < e.stepsFor(5 * 60); i++) {
    f.step();
    for (const x of [...f.cats, f.butterfly, f.bread]) if (!dansLeParc(x.pos)) dehors++;
  }
  assert.equal(dehors, 0);
});
