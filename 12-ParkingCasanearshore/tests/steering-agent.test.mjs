// Tests de SteeringAgent : les vraies méthodes, sur l'adaptateur p5 minimal.
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, reinitialiserAlea, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["vehicle.js", "geometry.js", "path.js", "steeringAgent.js"];
const NOMS = ["Vehicle", "SteeringAgent", "Path"];

function charger(graine = 1) {
  return chargerExemple(FICHIERS, { graine, noms: NOMS });
}

function agent(SteeringAgent, x, y, vx = 0, vy = 0) {
  const a = new SteeringAgent(x, y);
  a.vel = new Vector(vx, vy);
  return a;
}

const proche = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test("SteeringAgent hérite de Vehicle et réutilise seek, arrive, wander, flee", () => {
  const { Vehicle, SteeringAgent } = charger();
  const a = new SteeringAgent(0, 0);
  assert.ok(a instanceof Vehicle);
  for (const m of ["seek", "arrive", "wander", "flee", "applyForce", "boundaries"]) {
    assert.equal(SteeringAgent.prototype[m], Vehicle.prototype[m], m);
  }
});

test("seekTo : direction vers la cible et force limitée à maxForce", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  const f = a.seekTo(new Vector(100, 0));
  assert.ok(f.x > 0 && proche(f.y, 0));
  assert.ok(f.mag() <= a.maxForce + 1e-12);
  // cible confondue avec l'entité : force nulle, pas de NaN
  const nulle = a.seekTo(new Vector(0, 0));
  assert.equal(nulle.mag(), 0);
  // entrée invalide
  assert.equal(a.seekTo(new Vector(NaN, 0)).mag(), 0);
});

test("arriveAt : freine dans la zone, freine franchement dans le seuil d'arrêt", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  a.maxForce = 100;
  a.rayonZoneDeFreinage = 80;
  // hors zone : vitesse désirée = maxSpeed
  assert.ok(proche(a.arriveAt(new Vector(300, 0)).x, a.maxSpeed));
  // au quart de la zone : un quart de maxSpeed
  assert.ok(proche(a.arriveAt(new Vector(20, 0)).x, a.maxSpeed / 4));
  // dans le seuil d'arrêt avec vitesse résiduelle : force opposée à la vitesse
  a.vel = new Vector(0.5, 0);
  const frein = a.arriveAt(new Vector(1, 0));
  assert.ok(frein.x < 0);
});

test("arriveAt + update : l'entité s'arrête sur la cible sans la dépasser", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  a.maxSpeed = 3;
  a.maxForce = 0.2;
  a.rayonZoneDeFreinage = 60;
  const cible = new Vector(200, 0);
  let xMax = 0;
  for (let i = 0; i < 600; i++) {
    a.steer([{ name: "arrive", force: a.arriveAt(cible) }]);
    a.update();
    xMax = Math.max(xMax, a.pos.x);
  }
  assert.ok(a.hasArrived(cible), `pos ${a.pos.x}, vitesse ${a.vel.mag()}`);
  assert.ok(xMax <= cible.x + a.stopRadius, `dépassement ${xMax}`);
  assert.ok(a.vel.mag() <= a.maxSpeed + 1e-9);
});

test("hasArrived : seuils exacts de distance et de vitesse", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  a.stopRadius = 2;
  a.stopSpeed = 0.05;
  assert.equal(a.hasArrived(new Vector(2, 0)), true);
  assert.equal(a.hasArrived(new Vector(2.001, 0)), false);
  a.vel = new Vector(0.05, 0);
  assert.equal(a.hasArrived(new Vector(1, 0)), true);
  a.vel = new Vector(0.051, 0);
  assert.equal(a.hasArrived(new Vector(1, 0)), false);
});

test("fleeWithin : rien hors du rayon, fuite à l'opposé dans le rayon", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  assert.equal(a.fleeWithin(new Vector(50, 0), 40).mag(), 0);
  const f = a.fleeWithin(new Vector(30, 0), 40);
  assert.ok(f.x < 0);
  assert.equal(a.fleeWithin(new Vector(0, 0), 40).mag(), 0);
});

test("pursue : vise la position future, horizon borné, cible immobile gérée", () => {
  const { SteeringAgent } = charger();
  const chasseur = agent(SteeringAgent, 0, 0);
  chasseur.maxSpeed = 2;
  const cible = agent(SteeringAgent, 100, 0, 0, 1);
  const futur = chasseur.predictPosition(cible, 20);
  // T = min(20, 100 / 2) = 20 → 20 images en avant
  assert.ok(proche(futur.x, 100) && proche(futur.y, 20));
  const proche10 = chasseur.predictPosition(agent(SteeringAgent, 10, 0, 0, 1), 20);
  assert.ok(proche(proche10.y, 5), "horizon réduit quand la cible est proche");
  // vitesse nulle de la cible : la prédiction est la position actuelle
  const immobile = agent(SteeringAgent, 50, 0);
  const p = chasseur.predictPosition(immobile);
  assert.ok(proche(p.x, 50) && proche(p.y, 0));
  // la cible n'est pas modifiée
  chasseur.pursue(cible);
  assert.equal(cible.vel.y, 1);
  assert.equal(cible.pos.x, 100);
});

test("evadeThreats : détection, poursuite de la fuite jusqu'à la distance de sortie", () => {
  const { SteeringAgent } = charger();
  const pieton = agent(SteeringAgent, 0, 0);
  pieton.evadeDetectionRadius = 60;
  pieton.evadeExitRadius = 90;
  const voiture = agent(SteeringAgent, 61, 0, -1, 0);
  assert.equal(pieton.evadeThreats([voiture]).mag(), 0, "hors détection");
  voiture.pos = new Vector(60, 0);
  assert.ok(pieton.evadeThreats([voiture]).mag() > 0, "seuil exact de détection");
  // la menace sort de la détection mais reste sous la sortie : on fuit encore
  voiture.pos = new Vector(80, 0);
  assert.ok(pieton.evadeThreats([voiture]).mag() > 0);
  assert.equal(pieton.evadeState.active, true);
  voiture.pos = new Vector(90.5, 0);
  assert.equal(pieton.evadeThreats([voiture]).mag(), 0, "au-delà de la sortie");
  assert.equal(pieton.evadeState.active, false);
});

test("evadeThreats : choisit la menace la plus proche", () => {
  const { SteeringAgent } = charger();
  const pieton = agent(SteeringAgent, 0, 0);
  const loin = agent(SteeringAgent, 50, 0);
  const pres = agent(SteeringAgent, 0, 20);
  pieton.evadeThreats([loin, pres]);
  assert.equal(pieton.evadeState.threat, pres);
});

test("wanderAround : reproductible avec la même graine, direction progressive", () => {
  const essai = graine => {
    const { SteeringAgent, etat } = charger(graine);
    reinitialiserAlea(etat, graine);
    const a = agent(SteeringAgent, 0, 0, 1, 0);
    const thetas = [];
    for (let i = 0; i < 10; i++) {
      a.wanderAround();
      thetas.push(a.wanderTheta);
    }
    return thetas;
  };
  const a = essai(7);
  assert.deepEqual(a, essai(7));
  for (let i = 1; i < a.length; i++) assert.ok(Math.abs(a[i] - a[i - 1]) <= 0.3 + 1e-12);
});

test("follow : revient sur la voie et avance vers la fin du chemin", () => {
  const { SteeringAgent, Path } = charger();
  const chemin = new Path([new Vector(0, 0), new Vector(200, 0), new Vector(200, 200)], 5);
  const a = agent(SteeringAgent, 0, 30, 1, 0);
  a.maxSpeed = 2;
  a.maxForce = 0.2;
  for (let i = 0; i < 400; i++) {
    a.steer([{ name: "follow", force: a.follow(chemin) }]);
    a.update();
  }
  assert.ok(a.pathIndex === 1, "a atteint le second segment");
  assert.ok(a.pos.y > 30 && Math.abs(a.pos.x - 200) < 20, `pos ${a.pos.x}, ${a.pos.y}`);
});

test("follow : démarre à vitesse nulle (vise la cible sur le chemin)", () => {
  const { SteeringAgent, Path } = charger();
  const chemin = new Path([new Vector(0, 0), new Vector(100, 0)], 5);
  const a = agent(SteeringAgent, 0, 0);
  const f = a.follow(chemin);
  assert.ok(f.x > 0);
});

test("avoid : force latérale devant un obstacle, nulle sinon", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0, 2, 0);
  a.aheadFrames = 30;
  a.avoidWidth = 10;
  // obstacle juste au-dessus de la trajectoire, devant
  const f = a.avoid([{ pos: new Vector(40, -12), r: 8 }]);
  assert.ok(f.mag() > 0 && f.y > 0, "repoussé vers le bas");
  assert.ok(f.mag() <= a.maxForce + 1e-12);
  assert.equal(a.avoid([{ pos: new Vector(40, 200), r: 8 }]).mag(), 0);
  assert.equal(a.avoid([]).mag(), 0);
});

test("avoid : obstacle polygonal (bâtiment) via closestPoint", () => {
  const { SteeringAgent, executer } = charger();
  const carre = executer(`({
    pts: [createVector(50, 5), createVector(80, 5), createVector(80, 40), createVector(50, 40)],
    closestPoint(p) { return closestPointOnPolygon(p, this.pts); },
    contains(p) { return pointInPolygon(p, this.pts); },
    center: createVector(65, 22)
  })`);
  const a = agent(SteeringAgent, 0, 0, 2, 0);
  a.avoidWidth = 10;
  const f = a.avoid([carre]);
  assert.ok(f.y < 0, "écarté vers le haut, loin du bâtiment");
});

test("separate : exclut l'entité, gère l'absence de voisins et la superposition", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  assert.equal(a.separate([a]).mag(), 0);
  assert.equal(a.separate([]).mag(), 0);
  const b = agent(SteeringAgent, 10, 0);
  assert.ok(a.separate([a, b], 30).x < 0);
  const c = agent(SteeringAgent, 0, 0);
  const fa = a.separate([a, c], 30);
  const fc = c.separate([a, c], 30);
  assert.ok(Number.isFinite(fa.x) && fa.mag() > 0);
  assert.ok(fa.x * fc.x < 0, "les deux entités superposées partent en sens opposés");
});

test("align et cohesion : moyenne des voisins dans le rayon, entité exclue", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  const v1 = agent(SteeringAgent, 10, 0, 0, 2);
  const v2 = agent(SteeringAgent, -10, 0, 0, 2);
  const loin = agent(SteeringAgent, 500, 0, 0, -2);
  const al = a.align([a, v1, v2, loin], 50);
  assert.ok(al.y > 0 && proche(al.x, 0));
  const co = a.cohesion([a, agent(SteeringAgent, 30, 0), loin], 50);
  assert.ok(co.x > 0);
  assert.equal(a.cohesion([a], 50).mag(), 0);
  // les voisins ne sont pas modifiés
  assert.equal(v1.vel.y, 2);
});

test("followLeader : vise la place derrière le leader, évite la zone devant", () => {
  const { SteeringAgent } = charger();
  const leader = agent(SteeringAgent, 100, 0, 1, 0);
  const suiveur = agent(SteeringAgent, 0, 0);
  suiveur.leaderBehind = 30;
  suiveur.leaderSightRadius = 20;
  const forces = suiveur.followLeader(leader, [leader, suiveur]);
  assert.ok(forces.arrive.x > 0);
  assert.equal(forces.evade.mag(), 0);
  procheX(suiveur.debugInfo.leader.place.x, 70);
  // devant le leader : évasion active
  const devant = agent(SteeringAgent, 130, 5);
  devant.leaderSightRadius = 20;
  devant.leaderBehind = 30;
  assert.ok(devant.followLeader(leader, []).evade.mag() > 0);
  // leader immobile : on garde sa dernière direction
  leader.vel = new Vector(0, 0);
  leader.heading = new Vector(0, 1);
  suiveur.followLeader(leader, []);
  assert.ok(proche(suiveur.debugInfo.leader.place.y, -30));
});

function procheX(valeur, attendu) {
  assert.ok(Math.abs(valeur - attendu) < 1e-9, `${valeur} ≠ ${attendu}`);
}

test("followLeader : place latérale de formation", () => {
  const { SteeringAgent } = charger();
  const leader = agent(SteeringAgent, 0, 0, 1, 0);
  const s = agent(SteeringAgent, -50, 0);
  s.followLeader(leader, [], { back: 20, side: 10 });
  procheX(s.debugInfo.leader.place.x, -20);
  procheX(s.debugInfo.leader.place.y, 10);
});

test("combineForces : pondération, budget maxForce, priorité préservée", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  a.maxForce = 1;
  const total = a.combineForces([
    { name: "avoid", force: new Vector(0, 1), weight: 0.8 },
    { name: "seek", force: new Vector(0, -1), weight: 1 }
  ]);
  // l'évitement prioritaire n'est pas annulé par la force opposée
  assert.ok(total.y > 0.5, `y = ${total.y}`);
  assert.ok(total.mag() <= a.maxForce + 1e-12);
  // les forces d'entrée ne sont pas modifiées
  const f = new Vector(3, 0);
  a.combineForces([{ name: "x", force: f, weight: 2 }]);
  assert.equal(f.x, 3);
  // une force non finie est ignorée
  const sur = a.combineForces([{ name: "nan", force: new Vector(NaN, 0) }, { name: "ok", force: new Vector(0.5, 0) }]);
  assert.ok(proche(sur.x, 0.5));
});

test("steer + update : une seule intégration, vitesse bornée, direction mémorisée", () => {
  const { SteeringAgent } = charger();
  const a = agent(SteeringAgent, 0, 0);
  a.maxSpeed = 2;
  a.maxForce = 10;
  a.steer([{ name: "seek", force: new Vector(0, 5) }]);
  a.update();
  assert.equal(a.pos.y, 2);
  assert.equal(a.acc.mag(), 0);
  assert.ok(proche(a.heading.y, 1));
});
