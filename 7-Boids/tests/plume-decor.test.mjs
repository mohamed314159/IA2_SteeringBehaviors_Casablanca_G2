import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, creerAlea } from "./adaptateur-p5.mjs";

test("eclater crée le nombre de plumes demandé, aux couleurs du perroquet", () => {
  const { Plume } = chargerExemple(["plume.js"]);
  const couleurs = ["#d7261b", "#2f5fd0", "#f3cf2a"];
  const plumes = Plume.eclater(50, 60, couleurs, 14, creerAlea(2));
  assert.equal(plumes.length, 14);
  for (const p of plumes) {
    assert.ok(couleurs.includes(p.couleur));
    assert.deepEqual([p.pos.x, p.pos.y], [50, 60]);
  }
  assert.ok(new Set(plumes.map(p => p.couleur)).size === 3);
});

test("la taille des plumes suit l'échelle du perroquet", () => {
  const { Plume } = chargerExemple(["plume.js"]);
  const petites = Plume.eclater(0, 0, ["#fff"], 10, creerAlea(4), 1);
  const grandes = Plume.eclater(0, 0, ["#fff"], 10, creerAlea(4), 2);
  petites.forEach((p, i) => {
    assert.ok(p.taille >= 4 && p.taille <= 8);
    assert.ok(Math.abs(grandes[i].taille - 2 * p.taille) < 1e-9);
  });
});

test("les plumes s'éparpillent, retombent puis disparaissent", () => {
  const { Plume } = chargerExemple(["plume.js"]);
  const plumes = Plume.eclater(0, 0, ["#fff"], 20, creerAlea(3));
  const vy = plumes.map(p => p.vel.y);
  for (const p of plumes) p.update();
  plumes.forEach((p, i) => assert.ok(p.vel.y > vy[i] * Plume.FROTTEMENT - 1e-9, "gravité vers le bas"));

  const ecarts = plumes.map(p => Math.hypot(p.pos.x, p.pos.y));
  assert.ok(Math.max(...ecarts) > 0.5, "les plumes s'éloignent du point d'impact");

  for (const p of plumes) {
    let n = 0;
    while (!p.estMorte() && n < 1000) { p.update(); n++; }
    assert.ok(p.estMorte(), "durée de vie bornée");
    assert.ok(n <= 160);
    assert.equal(p.opacite(), 0);
  }
});

test("hauteurDuSol est bornée et multiple de 8", () => {
  const { executer } = chargerExemple(["decor.js"]);
  assert.equal(executer("hauteurDuSol(100)"), 48);
  assert.equal(executer("hauteurDuSol(5000)"), 160);
  const h = executer("hauteurDuSol(900)");
  assert.equal(h % 8, 0);
  assert.ok(h >= 48 && h <= 160);
});

test("genererSol est déterministe et couvre toute la largeur", () => {
  const { executer } = chargerExemple(["decor.js"]);
  const a = executer("JSON.stringify((({ alea, ...s }) => s)(genererSol(803, 7)))");
  const b = executer("JSON.stringify((({ alea, ...s }) => s)(genererSol(803, 7)))");
  const c = executer("JSON.stringify((({ alea, ...s }) => s)(genererSol(803, 8)))");
  assert.equal(a, b);
  assert.notEqual(a, c);
  const sol = JSON.parse(a);
  assert.equal(sol.nbColonnes, Math.ceil(803 / 4));
  assert.equal(sol.epaisseursHerbe.length, sol.nbColonnes);
  assert.ok(sol.epaisseursHerbe.every(e => e >= 3 && e <= 5));
  assert.ok(sol.fleurs.every(f => f.colonne >= 0 && f.colonne < sol.nbColonnes));
});
