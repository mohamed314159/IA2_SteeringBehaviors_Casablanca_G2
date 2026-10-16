import assert from "node:assert/strict";
import test from "node:test";
import { loadExample } from "./p5-adapter.mjs";

const ex = loadExample();
const plain = (value) => JSON.parse(JSON.stringify(value));

test("removeEdgeLoops : une boucle repliée est coupée au point de croisement, même nombre de points", () => {
  // Bord qui se replie : le segment 1→2 croise le segment 3→4 au point (5, 0).
  const edge = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 2 }, { x: 8, y: -2 }, { x: 4, y: 2 }, { x: 0, y: 8 }, { x: -4, y: 4 }];
  const before = plain(edge);
  const out = ex.removeEdgeLoops(edge, 4);
  assert.equal(out.length, edge.length);
  assert.deepEqual(plain(edge), before, "le bord d'origine n'est pas modifié");
  const cut = ex.segmentIntersection(edge[1], edge[2], edge[3], edge[4]);
  assert.deepEqual(plain([out[2], out[3]]), plain([cut, cut]));
  assert.deepEqual(plain([out[0], out[1], out[4], out[5]]), plain([edge[0], edge[1], edge[4], edge[5]]));
});

test("removeEdgeLoops : bord sans boucle inchangé ; recherche limitée à maxSpan segments", () => {
  for (const key of Object.keys(ex.F1_CIRCUITS)) {
    const circuit = new ex.Circuit(ex.F1_CIRCUITS[key]);
    assert.deepEqual(plain(ex.removeEdgeLoops(circuit.leftEdge, 40)), plain(circuit.leftEdge), key);
  }
  const edge = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 2 }, { x: 8, y: -2 }, { x: 4, y: 2 }, { x: 0, y: 8 }, { x: -4, y: 4 }];
  assert.deepEqual(plain(ex.removeEdgeLoops(edge, 1)), plain(edge), "boucle hors de portée : non coupée");
  assert.equal(ex.segmentIntersection({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }), null);
});

test("virage plus serré que la demi-largeur : bords sans croisement après la coupe", () => {
  // Épingle très serrée (rayon ≈ 4 unités du repère, bien sous la demi-largeur de piste).
  const layout = { name: "épingle", points: [[10, 20], [80, 20], [86, 24], [80, 28], [10, 28], [4, 24]] };
  const circuit = new ex.Circuit(layout);
  assert.equal(circuit.hasSelfIntersection(), false);
  assert.ok(circuit.walls.every((w) => Number.isFinite(w.a.x) && Number.isFinite(w.b.y)));
});
