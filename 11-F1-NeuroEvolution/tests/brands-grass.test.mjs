import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();

test("marques parodiques demandées présentes", () => {
  const names = ex.CAR_BRANDS.map((b) => b.name);
  for (const name of ["Tiyoti", "Ferraaa", "Limbargana"]) assert.ok(names.includes(name), name);
  for (const brand of ex.CAR_BRANDS) assert.ok(brand.models.length > 0, brand.name);
});

test("createRandomCarSpec : paramètres tirés dans les plages du modèle", () => {
  const rng = ex.createRng(7);
  for (let i = 0; i < 300; i++) {
    const spec = ex.createRandomCarSpec(rng);
    const brand = ex.CAR_BRANDS.find((b) => b.name === spec.brand);
    const model = brand.models.find((m) => m.name === spec.model);
    assert.ok(spec.maxSpeed >= model.speed[0] && spec.maxSpeed <= model.speed[1]);
    assert.ok(spec.maxForce >= model.grip[0] && spec.maxForce <= model.grip[1]);
    assert.equal(spec.color, ex.modelAppearance(brand, brand.models.find((m) => m.name === spec.model)).color);
  }
});

test("même graine → mêmes voitures ; le hasard couvre plusieurs marques", () => {
  const a = ex.createRng(123);
  const b = ex.createRng(123);
  const brands = new Set();
  for (let i = 0; i < 50; i++) {
    const sa = ex.createRandomCarSpec(a);
    assert.deepEqual({ ...sa }, { ...ex.createRandomCarSpec(b) });
    brands.add(sa.brand);
  }
  assert.ok(brands.size >= 5);
});

test("createRng reste dans [0, 1)", () => {
  const rng = ex.createRng(0);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
  }
});

test("herbe Minecraft : 16 x 16 texels, indices de palette valides, déterministe", () => {
  const t1 = ex.generateGrassTexels(ex.createRng(42));
  const t2 = ex.generateGrassTexels(ex.createRng(42));
  assert.equal(t1.length, 256);
  assert.deepEqual([...t1], [...t2]);
  for (const i of t1) assert.ok(Number.isInteger(i) && i >= 0 && i < ex.GRASS_PALETTE.length);
  assert.ok(new Set(t1).size >= 4, "texture trop uniforme");
});

test("drawGrass couvre toute la surface avec des texels de la palette", () => {
  const rects = [];
  const fills = [];
  const g = {
    push() {}, pop() {}, noStroke() {},
    fill(c) { fills.push(c); },
    rect(x, y, w, h) { rects.push({ x, y, w, h }); }
  };
  drawGrass_(g);
  function drawGrass_(graphics) { ex.drawGrass(graphics, 96, 48, ex.createRng(1), 3); }
  assert.equal(rects.length, 2 * 256); // 2 blocs de 48 px
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  assert.equal(maxX, 96);
  assert.equal(maxY, 48);
  for (const c of fills) assert.ok(ex.GRASS_PALETTE.includes(c));
});
