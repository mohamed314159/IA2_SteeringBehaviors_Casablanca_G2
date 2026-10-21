// Base protégée : vehicle.js est la copie exacte de 1-Seek/vehicle.js du dépôt
// micbuffa (commit 62cca18). Ces tests vérifient qu'il n'a pas changé et
// documentent le contrat hérité utilisé par les sous-classes.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { chargerExemple, creerAlea, dossierExemple, Vector } from "./adaptateur-p5.mjs";

const EMPREINTE_VEHICLE = "2489335a34b6bd23b6dad1c039277a456387417e13f3d9526996683bf91ebf49";

test("vehicle.js est identique à la base 1-Seek de micbuffa", () => {
  const contenu = fs.readFileSync(path.join(dossierExemple, "vehicle.js"));
  const empreinte = crypto.createHash("sha256").update(contenu).digest("hex");
  assert.equal(empreinte, EMPREINTE_VEHICLE);
});

test("la base se charge et expose les comportements hérités", () => {
  const { Vehicle } = chargerExemple(["vehicle.js"], { noms: ["Vehicle"] });
  for (const methode of ["seek", "arrive", "wander", "boundaries", "flee", "applyForce", "update", "edges"]) {
    assert.equal(typeof Vehicle.prototype[methode], "function", methode);
  }
  const v = new Vehicle(10, 20);
  assert.equal(v.maxSpeed, 4);
  assert.equal(v.maxForce, 0.1);
  assert.equal(v.rayonZoneDeFreinage, 100);
});

test("arrive hérité : vitesse désirée proportionnelle dans la zone de freinage", () => {
  const { Vehicle } = chargerExemple(["vehicle.js"], { noms: ["Vehicle"] });
  const v = new Vehicle(0, 0);
  v.maxForce = 100; // pour lire directement la vitesse désirée (vel = 0)
  const loin = v.arrive(new Vector(500, 0));
  assert.equal(loin.x, 4);
  const moitie = v.arrive(new Vector(50, 0));
  assert.ok(Math.abs(moitie.x - 2) < 1e-9);
  const aDistanceArret = v.arrive(new Vector(30, 0), 30);
  assert.ok(Math.abs(aDistanceArret.x) < 1e-9);
});

test("update hérité : intègre une seule fois et borne la vitesse", () => {
  const { Vehicle } = chargerExemple(["vehicle.js"], { noms: ["Vehicle"] });
  const v = new Vehicle(0, 0);
  v.applyForce(new Vector(10, 0));
  v.update();
  assert.equal(v.vel.x, 4);
  assert.equal(v.pos.x, 4);
  assert.equal(v.acc.mag(), 0);
});

test("random.js : même graine, même suite", () => {
  const { createRng } = chargerExemple(["random.js"], { noms: ["createRng"] });
  const a = createRng(42);
  const b = createRng(42);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
  // même algorithme que l'adaptateur de test
  const c = creerAlea(42);
  assert.equal(createRng(42)(), c());
});
