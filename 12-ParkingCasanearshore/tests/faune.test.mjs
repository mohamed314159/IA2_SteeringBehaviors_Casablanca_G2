// Faune : réseau de neurones (8 neurones cachés), oiseaux neuro-évolutifs et
// pain, chats (pursue) et papillon (evade, wander).
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["vehicle.js", "random.js", "simUnits.js", "geometry.js", "path.js", "steeringAgent.js",
  "neuralNetwork.js", "bird.js", "bread.js", "cat.js", "butterfly.js", "wildlife.js"];
const NOMS = ["NeuralNetwork", "NN_HIDDEN", "Bird", "BIRD_CONFIG", "Bread", "Cat", "CAT_CONFIG", "Butterfly", "Wildlife",
  "WILDLIFE_CONFIG", "SteeringAgent", "createRng", "stepsFor", "mPx", "kmh"];

function env(graine = 1) {
  return chargerExemple(FICHIERS, { noms: NOMS, graine });
}

const poids = n => [...n.w1.flat(), ...n.b1, ...n.w2.flat(), ...n.b2];

test("réseau : 6 entrées, 8 neurones cachés, 2 sorties ; prédiction bornée et reproductible", () => {
  const { NeuralNetwork, NN_HIDDEN, createRng } = env();
  assert.equal(NN_HIDDEN, 8);
  const a = new NeuralNetwork(6, NN_HIDDEN, 2, createRng(3));
  const b = new NeuralNetwork(6, NN_HIDDEN, 2, createRng(3));
  assert.deepEqual([...a.tailles], [6, 8, 2]);
  assert.equal(a.weightCount(), 6 * 8 + 8 + 8 * 2 + 2);
  const x = [0.5, -0.2, 0.1, 0, 1, -1];
  const y = a.predict(x);
  assert.equal(y.length, 2);
  assert.ok(y.every(v => v > -1 && v < 1), "tanh : sorties dans ]-1, 1[");
  assert.deepEqual([...y], [...b.predict(x)], "même graine, même réseau");
  assert.throws(() => a.predict([1, 2, 3]), /6 entrées/);
});

test("réseau : la copie est indépendante ; mutate(taux) modifie la bonne proportion de poids", () => {
  const { NeuralNetwork, createRng } = env();
  const a = new NeuralNetwork(6, 8, 2, createRng(5));
  const c = a.copy();
  assert.deepEqual(poids(c), poids(a));
  c.w1[0][0] += 10;
  assert.notEqual(c.w1[0][0], a.w1[0][0], "copie profonde");
  const avant = poids(a);
  a.copy().mutate(0, 1, createRng(1));
  assert.deepEqual(poids(a), avant, "l'original n'est jamais modifié");
  const zero = a.copy().mutate(0, 1, createRng(1));
  assert.deepEqual(poids(zero), avant, "taux 0 : rien ne change");
  const tout = a.copy().mutate(1, 0.5, createRng(1));
  assert.ok(poids(tout).every((w, i) => w !== avant[i]), "taux 1 : tous les poids changent");
  const partiel = a.copy().mutate(0.15, 0.5, createRng(2));
  const changes = poids(partiel).filter((w, i) => w !== avant[i]).length;
  assert.ok(changes > 2 && changes < 25, `${changes} poids sur 74`);
});

test("oiseau : entrées normalisées (direction unitaire, distance bornée), sans modifier le pain", () => {
  const { Bird, Bread, SteeringAgent, mPx, createRng } = env();
  const o = new Bird(0, 0, null, createRng(1));
  assert.ok(o instanceof SteeringAgent);
  assert.equal(o.brain.tailles[1], 8);
  const pain = new Bread(mPx(30), mPx(40), { center: new Vector(0, 0), radius: 1000 });
  const avant = pain.pos.copy();
  const e = o.inputs(pain);
  assert.equal(e.length, 6);
  assert.ok(Math.abs(e[0] - 0.6) < 1e-9 && Math.abs(e[1] - 0.8) < 1e-9, "direction unitaire vers le pain");
  assert.ok(Math.abs(e[2] - 50 / o.config.sensorRangeM) < 1e-9, "distance / portée");
  pain.pos = new Vector(mPx(1000), 0);
  assert.equal(o.inputs(pain)[2], 1, "distance bornée à 1");
  pain.pos = o.pos.copy();
  assert.ok(o.inputs(pain).every(Number.isFinite), "pain confondu avec l'oiseau : pas de NaN");
  pain.pos = avant;
  assert.ok(pain.pos.equals(avant));
});

test("oiseau : force = vitesse désirée du réseau − vitesse courante, bornée par maxForce", () => {
  const { Bird, Bread, createRng } = env();
  const o = new Bird(0, 0, { predict: () => [1, 0] }, createRng(1));
  const pain = new Bread(100, 0, { center: new Vector(0, 0), radius: 1000 });
  o.vel = new Vector(0, 0);
  const f = o.brainForce(pain);
  assert.ok(Math.abs(f.mag() - o.maxForce) < 1e-9 && f.x > 0, "limitée à maxForce");
  o.vel = new Vector(o.maxSpeed - 0.01, 0);
  const g = o.brainForce(pain);
  assert.ok(Math.abs(g.x - 0.01) < 1e-9 && Math.abs(g.y) < 1e-9, "désirée − courante");
});

test("oiseau : capture à catchM ; arrêt s'il reste immobile 2 s ou quand son énergie est épuisée", () => {
  const { Bird, Bread, mPx, stepsFor, createRng } = env();
  const zone = { center: new Vector(0, 0), radius: 1000 };
  const chasseur = new Bird(0, 0, { predict: () => [1, 0] }, createRng(1));
  const pain = new Bread(mPx(20), 0, zone);
  pain.maxSpeed = 0;
  let pasCapture = -1;
  for (let i = 0; i < 200 && pasCapture < 0; i++) if (chasseur.step(pain)) pasCapture = i;
  assert.ok(pasCapture > 0, "le pain est attrapé");
  assert.ok(chasseur.pos.dist(pain.pos) <= mPx(chasseur.config.catchM));
  assert.equal(chasseur.captures, 1);
  assert.ok(chasseur.fitness() > 1 && chasseur.fitness() <= 2, "capture : score entre 1 et 2");
  // Réseau qui « veut » rester sur place : arrêt après stillSeconds.
  const immobile = new Bird(0, 0, { predict: () => [0, 0] }, createRng(1));
  let n = 0;
  while (immobile.state === "flying" && n < 1000) {
    immobile.step(new Bread(500, 500, zone));
    n++;
  }
  assert.equal(immobile.state, "stopped");
  assert.ok(n <= stepsFor(immobile.config.stillSeconds) + 2);
  // Énergie : un oiseau qui tourne en rond s'arrête à lifeSeconds.
  const rond = new Bird(0, 0, { predict: () => [0, 1] }, createRng(1));
  rond.vel = new Vector(rond.maxSpeed, 0);
  n = 0;
  while (rond.state === "flying" && n < 10000) {
    rond.step(new Bread(5000, 5000, zone));
    n++;
  }
  assert.equal(n, stepsFor(rond.config.lifeSeconds));
});

test("oiseau : score de progression entre 0 et 1, comparable d'un départ à l'autre", () => {
  const { Bird, createRng } = env();
  const o = new Bird(0, 0, null, createRng(1));
  assert.equal(o.fitness(), 0, "pas encore parti");
  o.startDist = 200;
  o.minDist = 50;
  assert.equal(o.fitness(), 0.75);
  o.minDist = 300;
  assert.equal(o.fitness(), 0, "jamais négatif");
});

test("évolution : l'oiseau arrêté réapparaît au nid avec une copie mutée du meilleur ; capture → nouveau pain", () => {
  const { Wildlife, mPx, createRng } = env();
  const f = new Wildlife(new Vector(200, 200), new Vector(800, 800), null, createRng(4));
  assert.ok(f.nest.dist(new Vector(800 - mPx(45), 800)) < 1e-9, "nid au bord de la zone du pain");
  assert.equal(f.birds.length, 6);
  // Un oiseau arrêté : il est remplacé, le meilleur est mémorisé, la génération avance.
  const vieux = f.birds[2];
  vieux.startDist = 100;
  vieux.minDist = 20;
  vieux.state = "stopped";
  vieux.step = () => false;
  f.step();
  const neuf = f.birds[2];
  assert.notEqual(neuf, vieux);
  assert.ok(neuf.pos.dist(f.nest) <= mPx(2) + neuf.maxSpeed + 1e-9, "réapparaît au nid");
  assert.equal(f.generation, 2);
  assert.ok(f.champion && f.championScore > 0.79);
  assert.notEqual(neuf.brain, f.champion, "un nouveau cerveau, pas le même objet");
  const diff = poids(neuf.brain).filter((w, i) => w !== poids(f.champion)[i]).length;
  assert.ok(diff > 0 && diff < 30, "copie mutée (une partie des poids seulement)");
  // Capture : compteur, nouveau pain, nouvelles références de distance pour tous.
  const painAvant = f.bread;
  const gagnant = f.birds[0];
  gagnant.pos = f.bread.pos.copy();
  f.step();
  assert.equal(f.breadCaught, 1);
  assert.notEqual(f.bread, painAvant);
  assert.ok(f.birds.every(o => o.startDist === null || o.minDist !== Infinity));
});

test("évolution : avec la sélection, les oiseaux attrapent bien plus souvent le pain qu'au hasard", () => {
  const { Wildlife, stepsFor, createRng } = env(7);
  const captures = mode => {
    const f = new Wildlife(new Vector(200, 200), new Vector(800, 800), null, createRng(7));
    // Témoin : chaque oiseau renaît avec un cerveau neuf au hasard (aucune hérédité).
    if (mode === "hasard") f.spawnBird = () => Wildlife.prototype.spawnBird.call(f, null);
    const debut = { n: 0 };
    for (let i = 0; i < stepsFor(15 * 60); i++) {
      f.step();
      if (i === stepsFor(5 * 60)) debut.n = f.breadCaught;
    }
    return { total: f.breadCaught, debut: debut.n, score: f.championScore };
  };
  const appris = captures("sélection");
  const hasard = captures("hasard");
  assert.ok(appris.total >= 30, `${appris.total} captures en 15 min`);
  assert.ok(appris.total >= 3 * hasard.total, `sélection ${appris.total} contre hasard ${hasard.total}`);
  assert.ok(appris.total - appris.debut > appris.debut, "on attrape davantage après les 5 premières minutes");
  assert.ok(appris.score > 1, "le meilleur cerveau attrape le pain");
});

test("chat : pursue vise la position future du papillon ; capture → repos → reprise", () => {
  const { Cat, Butterfly, SteeringAgent, mPx, stepsFor, createRng } = env();
  const zone = { center: new Vector(0, 0), radius: mPx(20) };
  const chat = new Cat(0, 0, zone, createRng(1));
  assert.ok(chat instanceof SteeringAgent);
  const papillon = new Butterfly(mPx(6), 0, zone, createRng(2));
  papillon.vel = new Vector(0, 1);
  chat.step(papillon);
  assert.equal(chat.behavior, "pursue");
  const vise = chat.debugInfo.pursuePoint;
  assert.ok(vise && vise.y > papillon.pos.y - 1e-9, "vise devant le papillon (sa vitesse)");
  // Papillon à portée : capture puis repos.
  papillon.pos = chat.pos.copy().add(mPx(0.2), 0);
  papillon.vel = new Vector(0, 0);
  assert.equal(chat.step(papillon), true);
  assert.equal(chat.state, "rest");
  // Comme dans la scène : le papillon suivant apparaît ailleurs sur la pelouse.
  papillon.pos = new Vector(mPx(15), mPx(15));
  let n = 0;
  while (chat.state === "rest" && n < 1000) {
    chat.step(papillon);
    n++;
  }
  assert.equal(n, stepsFor(chat.config.restSeconds));
  assert.equal(chat.catches, 1);
});

test("papillon : evade quand un chat approche (détection < sortie), wander sinon, reste sur sa pelouse", () => {
  const { Butterfly, Cat, mPx, createRng } = env();
  const zone = { center: new Vector(0, 0), radius: mPx(20) };
  const p = new Butterfly(0, 0, zone, createRng(3));
  assert.ok(p.evadeExitRadius > p.evadeDetectionRadius);
  p.step([]);
  assert.equal(p.behavior, "wander");
  const chat = new Cat(mPx(2), 0, zone, createRng(1));
  chat.vel = new Vector(-1, 0);
  p.vel = new Vector(0, 0);
  p.step([chat]);
  assert.equal(p.behavior, "evade");
  assert.ok(p.vel.x < 0, "il s'éloigne du chat");
  let loin = 0;
  for (let i = 0; i < 3000; i++) {
    p.step([]);
    loin = Math.max(loin, p.pos.dist(zone.center));
  }
  assert.ok(loin < zone.radius * 1.6, `distance maximale ${loin}`);
});

test("faune : un papillon attrapé est remplacé par un autre sur la pelouse ; le pain reste dans sa zone", () => {
  const { Wildlife, mPx, createRng } = env();
  const f = new Wildlife(new Vector(300, 300), new Vector(900, 900), null, createRng(6));
  const premier = f.butterfly;
  premier.pos = f.cats[0].pos.copy();
  premier.vel = new Vector(0, 0);
  f.step();
  assert.equal(f.butterfliesCaught, 1);
  assert.notEqual(f.butterfly, premier);
  assert.ok(f.butterfly.pos.dist(f.lawn.center) <= f.lawn.radius);
  let loin = 0;
  for (let i = 0; i < 3000; i++) {
    f.step();
    loin = Math.max(loin, f.bread.pos.dist(f.breadZone.center));
  }
  assert.ok(loin < f.breadZone.radius + mPx(10), `pain à ${loin / 2} m du centre`);
  assert.equal(f.entities().length, 2 + 1 + 1 + 6);
});
