import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, reinitialiserAlea, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["boids.js", "obstacle.js", "pixelart.js", "perroquet.js", "chasseur.js"];

function chasseurA(Chasseur, x, y, vx = 1, vy = 0) {
  const c = new Chasseur(x, y);
  c.vel = new Vector(vx, vy);
  c.maxSpeed = 1.1;
  return c;
}

function proieA(x, y) {
  return { pos: new Vector(x, y), vel: new Vector(0, 0) };
}

test("Chasseur hérite de Boid avec les valeurs du requin d'origine", () => {
  const { Boid, Chasseur } = chargerExemple(FICHIERS);
  const c = new Chasseur(10, 10);
  assert.ok(c instanceof Boid);
  assert.equal(c.r, 40);
  assert.equal(c.maxForce, 0.5);
  assert.equal(c.poidsWander, 1);
  assert.equal(c.poidsSeek, 7);
  assert.equal(c.rayonDetection, 70);
  for (const m of ["wander", "seek", "getVehiculeLePlusProche", "edges", "applyForce"]) {
    assert.equal(Chasseur.prototype[m], Boid.prototype[m], m);
  }
});

test("sans proie détectée : seulement wander * poidsWander", () => {
  const { Chasseur, etat } = chargerExemple(FICHIERS);
  const c1 = chasseurA(Chasseur, 100, 100);
  const c2 = chasseurA(Chasseur, 100, 100);
  c1.poidsWander = c2.poidsWander = 2;

  reinitialiserAlea(etat, 3);
  const resultat = c1.chasser([proieA(500, 500)]);
  reinitialiserAlea(etat, 3);
  c2.applyForce(c2.wander().mult(2));

  assert.equal(resultat.proie, null);
  assert.equal(c1.enChasse, false);
  assert.ok(Math.abs(c1.acc.x - c2.acc.x) < 1e-12);
  assert.ok(Math.abs(c1.acc.y - c2.acc.y) < 1e-12);
  assert.ok(Math.abs(c1.acc.mag() - 2 * c1.maxForce) < 1e-9, "wander a la grandeur maxForce");
});

test("proie dans le rayon : wander * poidsWander + seek * poidsSeek vers la plus proche", () => {
  const { Chasseur, etat } = chargerExemple(FICHIERS);
  const c1 = chasseurA(Chasseur, 100, 100);
  const c2 = chasseurA(Chasseur, 100, 100);
  const proche = proieA(150, 100);
  const loin = proieA(160, 100);

  reinitialiserAlea(etat, 4);
  const resultat = c1.chasser([loin, proche]);
  reinitialiserAlea(etat, 4);
  c2.applyForce(c2.wander().mult(1));
  c2.applyForce(c2.seek(proche.pos).mult(7));

  assert.equal(resultat.proie, proche);
  assert.equal(c1.cible, proche);
  assert.ok(Math.abs(c1.acc.x - c2.acc.x) < 1e-12);
  assert.ok(Math.abs(c1.acc.y - c2.acc.y) < 1e-12);
  // La position de la proie n'est pas modifiée.
  assert.deepEqual([proche.pos.x, proche.pos.y], [150, 100]);
});

test("proie exactement au rayon de détection : pas de seek", () => {
  const { Chasseur } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100);
  const r = c.chasser([proieA(170, 100)]);
  assert.equal(r.proie, null);
  assert.equal(c.enChasse, false);
});

test("liste de proies vide : pas d'erreur, pas de cible", () => {
  const { Chasseur } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100);
  const r = c.chasser([]);
  assert.equal(r.proie, null);
  assert.ok(Number.isFinite(c.acc.x) && Number.isFinite(c.acc.y));
});

test("le cri d'alerte n'est signalé qu'au début de la chasse, puis après le délai", () => {
  const { Chasseur } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100);
  c.delaiEntreCris = 5;
  const proie = proieA(120, 100);
  const loin = proieA(900, 900);

  assert.equal(c.chasser([proie]).debutDeChasse, true);
  assert.equal(c.chasser([proie]).debutDeChasse, false);
  // Perd puis retrouve la proie trop vite : pas de nouveau cri.
  c.chasser([loin]);
  assert.equal(c.chasser([proie]).debutDeChasse, false);
  for (let i = 0; i < 6; i++) c.chasser([loin]);
  assert.equal(c.chasser([proie]).debutDeChasse, true);
});

test("frappe : portée, impact unique à mi-animation, fin après dureeFrappe", () => {
  const { Chasseur } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100);
  const portee = c.porteeEpee();
  assert.equal(portee, 32);

  assert.equal(c.peutFrapper(proieA(100 + portee, 100)), false, "seuil exclu");
  const proie = proieA(100 + portee - 1, 100);
  assert.equal(c.peutFrapper(proie), true);
  assert.equal(c.peutFrapper(null), false);

  assert.equal(c.commencerFrappe(proie), true);
  assert.equal(c.commencerFrappe(proie), false, "pas de seconde frappe en cours");
  assert.equal(c.peutFrapper(proie), false);

  const touchees = [];
  for (let i = 1; i <= c.dureeFrappe; i++) {
    const t = c.avancerFrappe();
    if (t !== null) touchees.push(i);
  }
  assert.deepEqual(touchees, [Math.round(c.dureeFrappe * 0.5)]);
  assert.equal(c.estEnTrainDeFrapper(), false);
  assert.equal(c.avancerFrappe(), null);
});

test("frappe ratée si la proie s'est trop éloignée au moment de l'impact", () => {
  const { Chasseur } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100);
  const proie = proieA(120, 100);
  c.commencerFrappe(proie);
  proie.pos.x = 100 + c.porteeEpee() * c.toleranceImpact + 1;
  let touchee = null;
  for (let i = 0; i < c.dureeFrappe; i++) touchee = c.avancerFrappe() || touchee;
  assert.equal(touchee, null);
});

test("angle du bras : fini à chaque image et revient au repos", () => {
  const { Chasseur } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100);
  c.pas = 0;
  assert.equal(c.angleBrasEpee(), Chasseur.ANGLE_REPOS);
  c.commencerFrappe(proieA(110, 100));
  let minimum = Infinity;
  let maximum = -Infinity;
  for (let i = 0; i < c.dureeFrappe; i++) {
    const a = c.angleBrasEpee();
    assert.ok(Number.isFinite(a));
    minimum = Math.min(minimum, a);
    maximum = Math.max(maximum, a);
    c.avancerFrappe();
  }
  assert.ok(minimum < -2, "le bras s'arme au-dessus de la tête");
  assert.ok(maximum > 0, "le bras frappe vers le bas");
});

test("update utilise la locomotion héritée et respecte maxSpeed", () => {
  const { Chasseur } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100, 1, 0);
  c.applyForce(new Vector(10, 0));
  c.update();
  assert.ok(c.vel.mag() <= c.maxSpeed + 1e-12);
  assert.deepEqual([c.pos.x, c.pos.y], [101, 100], "pos += ancienne vitesse (ordre de Boid.update)");
  assert.equal(c.acc.mag(), 0);
});

test("le chasseur regarde sa cible pendant la chasse", () => {
  const { Chasseur } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100, 1, 0);
  c.chasser([proieA(60, 100)]);
  c.animer();
  assert.equal(c.regardeADroite, false);
});

test("show équilibre push/pop et dessine l'épée", () => {
  const { Chasseur, etat } = chargerExemple(FICHIERS);
  const c = chasseurA(Chasseur, 100, 100);
  c.commencerFrappe(proieA(110, 100));
  for (let i = 0; i < 10; i++) c.avancerFrappe();
  etat.dessins.length = 0;
  c.show();
  const push = etat.dessins.filter(([n]) => n === "push").length;
  const pop = etat.dessins.filter(([n]) => n === "pop").length;
  assert.equal(push, pop);
  assert.ok(etat.dessins.some(([n]) => n === "arc"), "trace de balayage pendant le coup");
});
