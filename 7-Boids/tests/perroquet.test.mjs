import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, reinitialiserAlea, Vector } from "./adaptateur-p5.mjs";

const FICHIERS = ["boids.js", "obstacle.js", "pixelart.js", "perroquet.js"];

function perroquetA(Perroquet, x, y, vx, vy) {
  const p = new Perroquet(x, y, Perroquet.VARIANTES[0]);
  p.vel = new Vector(vx, vy);
  return p;
}

test("Perroquet hérite de Boid sans changer la mécanique de nuée", () => {
  const { Boid, Perroquet } = chargerExemple(FICHIERS);
  const p = new Perroquet(100, 100);

  assert.ok(p instanceof Boid);
  // Les comportements de steering ne sont pas redéfinis.
  for (const methode of ["flock", "align", "cohesion", "separation", "boundaries", "avoid", "seek", "flee", "wander", "applyForce"]) {
    assert.equal(Perroquet.prototype[methode], Boid.prototype[methode], methode);
  }
  // Paramètres de la base conservés.
  assert.equal(p.maxForce, 0.2);
  assert.equal(p.alignWeight, 1.5);
  assert.equal(p.avoidWeight, 15);
  assert.equal(p.image, undefined);
});

test("la force de nuée d'un perroquet est identique à celle d'un Boid", () => {
  const { Boid, Perroquet, etat } = chargerExemple(FICHIERS);
  const obstacles = [{ pos: new Vector(700, 500), r: 30 }];
  const voisinsPerroquet = [perroquetA(Perroquet, 100, 100, 1, 0), perroquetA(Perroquet, 110, 105, 0, 1), perroquetA(Perroquet, 95, 112, -1, 0.5)];
  const voisinsBoid = voisinsPerroquet.map(v => { const b = new Boid(v.pos.x, v.pos.y); b.vel = v.vel.copy(); return b; });

  reinitialiserAlea(etat, 5);
  voisinsPerroquet[0].flock(voisinsPerroquet, obstacles);
  reinitialiserAlea(etat, 5);
  voisinsBoid[0].flock(voisinsBoid, obstacles);

  assert.ok(voisinsBoid[0].acc.mag() > 0);
  assert.ok(Math.abs(voisinsPerroquet[0].acc.x - voisinsBoid[0].acc.x) < 1e-12);
  assert.ok(Math.abs(voisinsPerroquet[0].acc.y - voisinsBoid[0].acc.y) < 1e-12);
});

test("fleeWithTargetRadius applique la même force que Boid, sans dessin hors debug", () => {
  const { Boid, Perroquet, etat } = chargerExemple(FICHIERS);
  const cible = { pos: new Vector(120, 100), r: 40 };
  const p = perroquetA(Perroquet, 100, 100, 1, 0);
  const b = new Boid(100, 100);
  b.vel = new Vector(1, 0);

  etat.dessins.length = 0;
  p.fleeWithTargetRadius(cible);
  assert.equal(etat.dessins.length, 0, "aucun cercle rouge hors debug");
  b.fleeWithTargetRadius(cible);

  assert.deepEqual([p.acc.x, p.acc.y], [b.acc.x, b.acc.y]);
  // Fuite : la force pointe à l'opposé de la cible (vers x négatif).
  assert.ok(p.acc.x < 0);
  // Cible inchangée.
  assert.deepEqual([cible.pos.x, cible.pos.y], [120, 100]);
});

test("fleeWithTargetRadius : pas de force hors zone, ni exactement sur le seuil r + 10", () => {
  const { Perroquet } = chargerExemple(FICHIERS);
  const cible = { pos: new Vector(150, 100), r: 40 };
  const surLeSeuil = perroquetA(Perroquet, 100, 100, 1, 0);
  surLeSeuil.fleeWithTargetRadius(cible);
  assert.equal(surLeSeuil.acc.mag(), 0);

  const loin = perroquetA(Perroquet, 0, 100, 1, 0);
  loin.fleeWithTargetRadius(cible);
  assert.equal(loin.acc.mag(), 0);
});

test("en mode debug, la zone de fuite est dessinée", () => {
  const { Boid, Perroquet, etat } = chargerExemple(FICHIERS);
  Boid.debug = true;
  const p = perroquetA(Perroquet, 100, 100, 1, 0);
  p.fleeWithTargetRadius({ pos: new Vector(110, 100), r: 30 });
  assert.ok(etat.dessins.some(([nom]) => nom === "circle"));
  Boid.debug = false;
});

test("update réutilise la locomotion de Boid et respecte maxSpeed", () => {
  const { Boid, Perroquet } = chargerExemple(FICHIERS);
  const p = perroquetA(Perroquet, 100, 100, 1, 0);
  const b = new Boid(100, 100);
  b.vel = new Vector(1, 0);
  p.maxSpeed = b.maxSpeed = 1.4;
  const force = new Vector(5, 5);
  p.applyForce(force.copy());
  b.applyForce(force.copy());

  p.update();
  b.update();

  assert.deepEqual([p.pos.x, p.pos.y], [b.pos.x, b.pos.y]);
  assert.deepEqual([p.vel.x, p.vel.y], [b.vel.x, b.vel.y]);
  assert.ok(p.vel.mag() <= 1.4 + 1e-12);
  assert.equal(p.acc.mag(), 0);
});

test("l'animation avance et l'orientation a une hystérésis", () => {
  const { Perroquet } = chargerExemple(FICHIERS);
  const p = perroquetA(Perroquet, 100, 100, 1, 0);
  p.maxSpeed = 2;
  p.regardeADroite = true;
  const phase = p.phaseAiles;

  p.vel = new Vector(-0.1, 1); // horizontal trop faible : pas de retournement
  p.animer();
  assert.equal(p.regardeADroite, true);
  assert.ok(p.phaseAiles > phase);

  p.vel = new Vector(-1, 0);
  p.animer();
  assert.equal(p.regardeADroite, false);
  assert.ok([0, 1, 2].includes(p.indexAile()));
});

test("vitesse nulle et maxSpeed nulle ne produisent pas de NaN dans l'animation", () => {
  const { Perroquet } = chargerExemple(FICHIERS);
  const p = perroquetA(Perroquet, 100, 100, 0, 0);
  p.maxSpeed = 0;
  p.animer();
  assert.ok(Number.isFinite(p.phaseAiles));
});

test("contientPoint détecte un clic sur le perroquet et pas à côté", () => {
  const { Perroquet } = chargerExemple(FICHIERS);
  const p = perroquetA(Perroquet, 200, 200, 1, 0);
  p.r = 30;
  assert.equal(p.contientPoint(200, 200), true);
  assert.equal(p.contientPoint(215, 205), true);
  assert.equal(p.contientPoint(200 + 30 * 0.6 + 4, 200), false);
  assert.equal(p.contientPoint(300, 300), false);
});

test("crier lance une animation qui se termine et ne modifie pas la vitesse", () => {
  const { Perroquet } = chargerExemple(FICHIERS);
  const p = perroquetA(Perroquet, 200, 200, 1, 0.5);
  p.crier();
  assert.equal(p.cri, Perroquet.DUREE_CRI);
  assert.deepEqual([p.vel.x, p.vel.y], [1, 0.5]);
  for (let i = 0; i < Perroquet.DUREE_CRI + 3; i++) p.animer();
  assert.equal(p.cri, 0);
});

test("show dessine un sprite mis en cache, à la taille r, dans un push/pop équilibré", () => {
  const { Perroquet, etat } = chargerExemple(FICHIERS);
  const p = perroquetA(Perroquet, 200, 200, -1, 0.3);
  p.r = 30;
  etat.dessins.length = 0;
  p.show();
  const push = etat.dessins.filter(([n]) => n === "push").length;
  const pop = etat.dessins.filter(([n]) => n === "pop").length;
  assert.equal(push, pop);
  assert.ok(etat.dessins.some(([n, a]) => n === "scale" && a[0] === -1), "retourné vers la gauche");
  const images = etat.dessins.filter(([n]) => n === "image");
  assert.equal(images.length, 1);
  const [sprite, x, y, l, h] = images[0][1];
  assert.equal(l, 30);
  assert.ok(Math.abs(h - 30 * 11 / 12) < 1e-9);
  assert.deepEqual([x, y], [-l / 2, -h / 2], "centré sur la position");
  // Sprite de 12 x 11 pixels, dessiné pixel par pixel sans recouvrement.
  assert.deepEqual([sprite.w, sprite.h], [12, 11]);
  assert.ok(sprite.appels.filter(([n]) => n === "rect").every(([, a]) => Number.isInteger(a[2]) && a[3] === 1));

  // Même état : même sprite, aucun nouveau calque.
  const nbCalques = etat.calques.length;
  const autre = perroquetA(Perroquet, 50, 50, -1, 0);
  autre.phaseAiles = p.phaseAiles;
  autre.show();
  assert.equal(etat.calques.length, nbCalques);
});

test("au plus 5 variantes x 3 ailes x 2 becs sprites sont créés", () => {
  const { Perroquet, etat } = chargerExemple(FICHIERS);
  for (const variante of Perroquet.VARIANTES) {
    const p = new Perroquet(0, 0, variante);
    for (let phase = 0; phase < 8; phase++) {
      for (const cri of [0, 5]) {
        p.phaseAiles = phase;
        p.cri = cri;
        p.show();
      }
    }
  }
  assert.equal(etat.calques.length, 30);
  assert.equal(Perroquet.sprites.size, 30);
});

test("pendant le cri, le sprite bec ouvert et une note sont dessinés", () => {
  const { Perroquet, etat } = chargerExemple(FICHIERS);
  const p = perroquetA(Perroquet, 200, 200, 1, 0);
  p.crier();
  etat.dessins.length = 0;
  p.show();
  assert.ok(Perroquet.sprites.has(`${p.variante.nom}-${p.indexAile()}-true`));
  assert.ok(etat.dessins.some(([n, a]) => n === "text" && a[0] === "♪"));
});

test("les motifs ont tous la taille déclarée", () => {
  const { Perroquet } = chargerExemple(FICHIERS);
  for (const motif of [Perroquet.CORPS, Perroquet.CORPS_CRI, ...Perroquet.AILES]) {
    assert.ok(motif.length <= Perroquet.HAUTEUR_MOTIF);
    for (const ligne of motif) assert.equal(ligne.length, Perroquet.LARGEUR_MOTIF);
  }
  assert.equal(Perroquet.VARIANTES.length, 5);
});
