// Étapes 11-12 : réglages par comportement et rendu de debug.
import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["vehicle.js", "random.js", "simUnits.js", "geometry.js", "path.js", "steeringAgent.js", "reglages.js", "debug.js"];
const NOMS = ["SteeringAgent", "REGLAGES_INITIAUX", "DEFINITIONS_REGLAGES", "creerReglages", "lireReglage", "ecrireReglage",
  "formaterValeur", "drawDebugOverlay", "drawHighlight", "COMPORTEMENTS_TOUCHES"];

function env() {
  return chargerExemple(FICHIERS, { noms: NOMS });
}

test("réglages : un groupe par comportement, chacun avec vitesse et taille", () => {
  const { DEFINITIONS_REGLAGES, REGLAGES_INITIAUX } = env();
  for (const groupe of ["seek", "pursue", "evade", "arrive", "wander", "path", "avoid", "boids", "leader"]) {
    assert.ok(DEFINITIONS_REGLAGES.some(d => d.cle === `${groupe}.vitesse`), `${groupe}.vitesse`);
    assert.ok(DEFINITIONS_REGLAGES.some(d => d.cle === `${groupe}.taille`), `${groupe}.taille`);
  }
  for (const d of DEFINITIONS_REGLAGES) {
    const [g, n] = d.cle.split(".");
    const v = REGLAGES_INITIAUX[g][n];
    assert.ok(v >= d.min && v <= d.max, `${d.cle} : valeur initiale dans la plage`);
  }
});

test("réglages : copie indépendante, écriture bornée, valeur invalide → défaut", () => {
  const { creerReglages, ecrireReglage, lireReglage, REGLAGES_INITIAUX, formaterValeur } = env();
  const r = creerReglages();
  r.seek.vitesse = 2;
  assert.equal(REGLAGES_INITIAUX.seek.vitesse, 1);
  assert.equal(ecrireReglage(r, "seek.vitesse", 99), 3);
  assert.equal(ecrireReglage(r, "seek.vitesse", "abc"), 1);
  assert.equal(lireReglage(r, "boids.alignement"), 1);
  assert.equal(formaterValeur(1.234, 0.05), "1.23");
});

test("vitesse et taille : le facteur du comportement actif s'applique (et celui de l'évasion)", () => {
  const { SteeringAgent, creerReglages } = env();
  const r = creerReglages();
  const a = new SteeringAgent(0, 0);
  SteeringAgent.settings = null;
  a.setBehavior("arrive");
  assert.equal(a.speedFor(2), 2, "sans réglages : facteur 1");
  SteeringAgent.settings = r;
  r.arrive.vitesse = 1.5;
  r.arrive.taille = 2;
  assert.equal(a.speedFor(2), 3);
  assert.equal(a.sizeFactor(), 2);
  r.evade.vitesse = 2;
  a.evadeState.active = true;
  assert.equal(a.speedFor(2), 6);
  a.setBehavior("wander");
  a.evadeState.active = false;
  assert.equal(a.speedFor(2), 2);
  SteeringAgent.settings = null;
});

test("arrive : le rayon de freinage (×) change la vitesse désirée, sans modifier l'entité", () => {
  const { SteeringAgent, creerReglages } = env();
  const r = creerReglages();
  const a = new SteeringAgent(0, 0);
  a.maxForce = 100;
  a.rayonZoneDeFreinage = 40;
  SteeringAgent.settings = r;
  const normale = a.arriveAt(new Vector(20, 0)).x;
  r.arrive.rayon = 2;
  const elargie = a.arriveAt(new Vector(20, 0)).x;
  assert.ok(Math.abs(normale - a.maxSpeed / 2) < 1e-9);
  assert.ok(Math.abs(elargie - a.maxSpeed / 4) < 1e-9);
  assert.equal(a.rayonZoneDeFreinage, 40, "rayon de l'entité inchangé");
  assert.equal(a.maxForce, 100, "maxForce jamais modifié");
  SteeringAgent.settings = null;
});

test("wander : les réglages s'appliquent le temps de l'appel puis l'entité retrouve ses valeurs", () => {
  const { SteeringAgent, creerReglages } = env();
  const r = creerReglages();
  const a = new SteeringAgent(0, 0);
  a.vel = new Vector(1, 0);
  const avant = [a.wanderRadius, a.distanceCercle, a.displaceRange];
  SteeringAgent.settings = r;
  r.wander.rayon = 2;
  r.wander.variation = 0;
  const theta = a.wanderTheta;
  a.wanderAround();
  assert.equal(a.wanderTheta, theta, "variation nulle : direction inchangée");
  assert.deepEqual([a.wanderRadius, a.distanceCercle, a.displaceRange], avant);
  SteeringAgent.settings = null;
});

test("debug : le rendu ne modifie ni les entités ni leurs informations de steering", () => {
  const { SteeringAgent, drawDebugOverlay, drawHighlight, etat } = env();
  const a = new SteeringAgent(10, 10);
  a.vel = new Vector(1, 0);
  a.setBehavior("arrive");
  a.rayonZoneDeFreinage = 30;
  a.arriveAt(new Vector(50, 10));
  a.setBehavior("path");
  a.debugInfo.path = { predictPos: new Vector(15, 10), normal: new Vector(15, 12), target: new Vector(20, 12), onPath: true };
  const avant = JSON.stringify({ pos: a.pos, vel: a.vel, acc: a.acc, info: a.debugInfo });
  drawDebugOverlay([a], 2);
  drawHighlight([a], 5, 2);
  assert.equal(JSON.stringify({ pos: a.pos, vel: a.vel, acc: a.acc, info: a.debugInfo }), avant);
  assert.ok(etat.dessins.length > 0, "quelque chose est dessiné");
});

test("surbrillance : les touches 1 à 8 couvrent les 8 comportements", () => {
  const { COMPORTEMENTS_TOUCHES, SteeringAgent } = env();
  assert.deepEqual(Object.keys(COMPORTEMENTS_TOUCHES).map(Number), [1, 2, 3, 4, 5, 6, 7, 8]);
  const a = new SteeringAgent(0, 0);
  a.setBehavior("boids");
  assert.equal(COMPORTEMENTS_TOUCHES[7].test(a), true);
  assert.equal(COMPORTEMENTS_TOUCHES[3].test(a), false);
});
