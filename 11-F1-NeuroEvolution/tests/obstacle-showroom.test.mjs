import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

// ---------- Faux DOM minimal (pour la vitrine) : ne prouve pas le rendu réel ----------

function fakeElement(tag) {
  const listeners = {};
  const classes = new Set();
  const attributes = {};
  const el = {
    tagName: tag.toUpperCase(), children: [], textContent: "", hidden: false, disabled: false,
    value: "", open: false, width: 0, height: 0,
    get className() { return [...classes].join(" "); },
    set className(v) { classes.clear(); for (const c of String(v).split(/\s+/).filter(Boolean)) classes.add(c); },
    classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)) },
    setAttribute: (k, v) => { attributes[k] = String(v); },
    getAttribute: (k) => attributes[k] ?? null,
    append: (...items) => el.children.push(...items),
    appendChild: (item) => { el.children.push(item); return item; },
    replaceChildren: () => { el.children = []; },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    dispatch: (type) => { for (const fn of listeners[type] || []) fn({ type, target: el }); },
    click: () => el.dispatch("click"),
    showModal: () => { el.open = true; },
    close: () => { el.open = false; },
    getContext: () => new Proxy({ calls: [] }, { get: (t, k) => (k in t ? t[k] : (...args) => t.calls.push([k, ...args])), set: () => true })
  };
  return el;
}

// Tous les descendants d'un élément (parcours en profondeur).
function descendants(el) {
  return el.children.flatMap((child) => [child, ...descendants(child)]);
}

const ex = loadExample(undefined, { document: { createElement: fakeElement } });
const PPM = 44 / 14;
const plain = (value) => JSON.parse(JSON.stringify(value));
const circuit = (key, layout) => new ex.Circuit(layout, { key, pixelsPerMeter: PPM });
const monza = circuit("monza", ex.F1_CIRCUITS.monza);
const byId = (id) => ex.BUILT_IN_OBSTACLES.find((m) => m.id === id);

// ---------- Catalogue ----------

test("obstacles de série : déjà dessinés, formes valides, tailles réalistes, identifiants uniques", () => {
  assert.ok(ex.BUILT_IN_OBSTACLES.length >= 8);
  assert.equal(new Set(ex.BUILT_IN_OBSTACLES.map((m) => m.id)).size, ex.BUILT_IN_OBSTACLES.length);
  for (const model of ex.BUILT_IN_OBSTACLES) {
    assert.equal(model.builtIn, true);
    assert.equal(ex.validateShape(ex.obstacleShape(model, PPM)), null, model.name);
    assert.ok(model.sizeMeters >= ex.OBSTACLE_MIN_SIZE_M && model.sizeMeters <= ex.OBSTACLE_MAX_SIZE_M, model.name);
  }
});

test("obstacleShape : plus grande dimension = taille du modèle en mètres", () => {
  const shape = ex.obstacleShape(byId("barriere"), PPM); // 9 m
  const xs = shape.map((p) => p[0]);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 9 * PPM) < 1e-9);
});

test("noms des prototypes : proto_1, proto_2…, jamais réutilisés tant qu'un plus grand existe", () => {
  assert.equal(ex.nextProtoName([]), "proto_1");
  assert.equal(ex.nextProtoName([{ name: "proto_1" }, { name: "proto_2" }]), "proto_3");
  assert.equal(ex.nextProtoName([{ name: "proto_7" }]), "proto_8"); // proto_1 à 6 retirés
  assert.equal(ex.protoNumber("Pile de pneus"), 0);
  assert.equal(ex.protoNumber("proto_12"), 12);
});

test("createProto : forme dessinée normalisée, taille bornée, forme invalide ou vitrine pleine refusées", () => {
  const drawn = [[20, 20], [220, 20], [220, 120], [20, 120]];
  const before = plain(drawn);
  const proto = ex.createProto([], drawn, 8);
  assert.equal(proto.name, "proto_1");
  assert.equal(proto.builtIn, false);
  assert.equal(proto.sizeMeters, 8);
  assert.deepEqual(plain(drawn), before, "la forme dessinée n'est pas modifiée");
  const xs = proto.points.map((p) => p[0]);
  assert.ok(Math.abs(Math.max(...xs) - Math.min(...xs) - 2) < 1e-9);
  assert.equal(ex.createProto([], drawn, 99).sizeMeters, ex.OBSTACLE_MAX_SIZE_M);
  assert.equal(ex.createProto([], drawn, "abc").sizeMeters, 6);
  assert.throws(() => ex.createProto([], [[0, 0], [10, 0]], 6), /au moins 3/);
  const full = Array.from({ length: ex.PROTO_MAX_COUNT }, (_, i) => ({ name: `proto_${i + 1}` }));
  assert.throws(() => ex.createProto(full, drawn, 6), /pleine/);
});

test("prototypes mémorisés et relus ; données invalides ignorées ; stockage bloqué sans erreur", () => {
  const storage = createMemoryStorage();
  const drawn = [[0, 0], [100, 0], [50, 80]];
  const p1 = ex.createProto([], drawn, 5);
  const p2 = ex.createProto([p1], drawn, 7);
  ex.saveProtos(storage, [p1, p2]);
  const loaded = ex.loadProtos(storage);
  assert.deepEqual(plain(loaded.map((p) => p.name)), ["proto_1", "proto_2"]);
  assert.deepEqual(plain(loaded[1].points), plain(p2.points));
  assert.equal(loaded[1].sizeMeters, 7);
  assert.deepEqual(plain(ex.obstacleCatalog(loaded).map((m) => m.name).slice(-2)), ["proto_1", "proto_2"]);
  assert.equal(ex.obstacleCatalog(loaded).length, ex.BUILT_IN_OBSTACLES.length + 2);

  const bad = createMemoryStorage({ [ex.OBSTACLE_PROTOS_STORAGE_KEY]: JSON.stringify([{ name: "proto_1", points: [[0, 0], [1, 0]] }, { name: "bidule", points: p1.points }, null]) });
  assert.deepEqual(plain(ex.loadProtos(bad)), []);
  assert.deepEqual(plain(ex.loadProtos(createMemoryStorage({ [ex.OBSTACLE_PROTOS_STORAGE_KEY]: "{cassé" }))), []);
  assert.deepEqual(plain(ex.loadProtos(null)), []);
  assert.equal(ex.isValidUnitShape(p1.points), true);
  assert.equal(ex.isValidUnitShape([[0, 0], [1, 0], [2, 0]]), false);
  assert.equal(ex.isValidUnitShape("x"), false);
  const blocked = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.doesNotThrow(() => ex.saveProtos(blocked, [p1]));
  assert.deepEqual(plain(ex.loadProtos(blocked)), []);
});

// ---------- Placement aléatoire ----------

function assertPlacementRules(track, obstacles, existing = []) {
  for (const [i, obstacle] of obstacles.entries()) {
    assert.ok(obstacle instanceof ex.Obstacle && obstacle instanceof ex.Vehicle);
    const index = track.project(obstacle.pos).index;
    const fromStart = ex.distanceFromStart(track, index);
    const radius = ex.obstacleRadius(obstacle);
    assert.ok(fromStart - radius >= ex.START_CLEAR_AHEAD_CARS * track.carLength - track.trackWidth, `obstacle ${i} trop près après le départ`);
    assert.ok(track.totalLength - fromStart - radius >= ex.START_CLEAR_BEHIND_CARS * track.carLength - track.trackWidth, `obstacle ${i} trop près avant le départ`);
    assert.ok(track.project(obstacle.pos).distance <= track.trackWidth / 2 + 1e-6, `obstacle ${i} : centre sur la piste`);
    for (const other of [...existing, ...obstacles.slice(0, i)]) {
      assert.ok(ex.obstacleGap(obstacle, other) >= ex.OBSTACLE_GAP_CAR_WIDTHS * track.carWidth - 1e-9, `obstacle ${i} trop près d'un autre`);
    }
  }
}

test("placement aléatoire sur Monza : nombre demandé, hors zone de départ, sur la piste, espacés, passage libre", () => {
  const requests = [{ model: byId("pneus"), count: 4 }, { model: byId("barriere"), count: 2 }, { model: byId("etoile"), count: 3 }];
  const result = ex.placeRandomObstacles(monza, requests, [], ex.createRng(7), PPM);
  assert.equal(result.requested, 9);
  assert.equal(result.missing, 0);
  assert.equal(result.placed.length, 9);
  assertPlacementRules(monza, result.placed);
  for (const obstacle of result.placed) {
    const index = monza.project(obstacle.pos).index;
    assert.ok(ex.freePassage(monza, index, obstacle) >= ex.PASSAGE_CAR_WIDTHS * monza.carWidth);
  }
  // Tailles conservées : les barrières mesurent 9 m.
  const big = result.placed.filter((o) => Math.abs(ex.obstacleRadius(o) - 4.5 * PPM) < 0.6 * PPM);
  assert.ok(big.length >= 2);
});

test("placement aléatoire : même graine → mêmes obstacles ; obstacles existants respectés et non modifiés", () => {
  const requests = [{ model: byId("bloc"), count: 3 }];
  const a = ex.placeRandomObstacles(monza, requests, [], ex.createRng(3), PPM);
  const b = ex.placeRandomObstacles(monza, requests, [], ex.createRng(3), PPM);
  assert.deepEqual(plain(a.placed.map((o) => o.toJSON())), plain(b.placed.map((o) => o.toJSON())));

  const existing = a.placed;
  const snapshot = plain(existing.map((o) => o.toJSON()));
  const c = ex.placeRandomObstacles(monza, [{ model: byId("cone"), count: 5 }], existing, ex.createRng(11), PPM);
  assert.equal(c.placed.length, 5);
  assert.deepEqual(plain(existing.map((o) => o.toJSON())), snapshot);
  assertPlacementRules(monza, c.placed, existing);
});

test("placement aléatoire sur chaque niveau d'entraînement, piste étroite comprise", () => {
  for (const key of ex.trainingLevelKeys()) {
    const track = circuit(key, ex.TRAINING_CIRCUITS[key]);
    const result = ex.placeRandomObstacles(track, [{ model: byId("pneus"), count: 3 }], [], ex.createRng(5), PPM);
    assert.ok(result.placed.length >= 1, key);
    assert.equal(result.placed.length + result.missing, 3, key);
    assertPlacementRules(track, result.placed);
  }
});

test("une voiture au départ ne touche aucun obstacle placé au hasard", () => {
  const result = ex.placeRandomObstacles(monza, [{ model: byId("croix"), count: 10 }], [], ex.createRng(21), PPM);
  const spec = { brand: "Ferraaa", model: "F40o", maxSpeed: 4.5, maxForce: 0.22 };
  for (const offset of [-12, 0, 12]) {
    const car = new ex.Car(monza, spec, offset, null, 0, ex.createRng(1));
    car.crashIntoObstacles(result.placed);
    assert.equal(car.dead, false, `départ décalé de ${offset} px`);
  }
});

test("obstacle impossible à placer (plus large que la piste moins le passage) : compté comme manquant, boucle bornée", () => {
  const huge = { id: "mur", name: "Mur", sizeMeters: 20, points: [[-1, -1], [1, -1], [1, 1], [-1, 1]] };
  const result = ex.placeRandomObstacles(monza, [{ model: huge, count: 2 }, { model: byId("pneus"), count: 1 }], [], ex.createRng(2), PPM);
  assert.equal(result.requested, 3);
  assert.equal(result.missing, 2);
  assert.equal(result.placed.length, 1);
});

test("demandes : nombres invalides ignorés, total borné à RANDOM_OBSTACLES_MAX", () => {
  const m = byId("pneus");
  assert.deepEqual(plain(ex.normalizeRequests([{ model: m, count: -2 }, { model: m, count: "abc" }, { model: m, count: 2.9 }]))
    .map((r) => r.count), [2]);
  const capped = ex.normalizeRequests([{ model: m, count: 25 }, { model: byId("bloc"), count: 25 }]);
  assert.deepEqual(plain(capped.map((r) => r.count)), [25, ex.RANDOM_OBSTACLES_MAX - 25]);
  assert.deepEqual(plain(ex.placeRandomObstacles(monza, [], [], ex.createRng(1), PPM).placed), []);
});

test("freePassage et obstacleGap : cas exacts", () => {
  const index = 100;
  const c = monza.center[index];
  const t = monza.tangents[index];
  const half = monza.trackWidth / 2;
  // Carré de 10 px centré sur la ligne médiane : passage de half - 5 de chaque côté.
  const square = [[-5, -5], [5, -5], [5, 5], [-5, 5]];
  const centered = new ex.Obstacle(c.x, c.y, square, Math.atan2(t.y, t.x));
  assert.ok(Math.abs(ex.freePassage(monza, index, centered) - (half - 5)) < 1e-6);
  // Décalé vers la droite de half : passage à gauche = 2 × half - 5.
  const right = new ex.Obstacle(c.x - t.y * half, c.y + t.x * half, square, Math.atan2(t.y, t.x));
  assert.ok(Math.abs(ex.freePassage(monza, index, right) - (2 * half - 5)) < 1e-6);
  assert.ok(ex.lateralOffsetAt(monza, index, [right.pos.x, right.pos.y]) > 0, "+ = vers le bord droit");

  const a = new ex.Obstacle(0, 0, square);
  assert.ok(Math.abs(ex.obstacleGap(a, new ex.Obstacle(30, 0, square)) - 20) < 1e-9);
  assert.equal(ex.obstacleGap(a, new ex.Obstacle(8, 0, square)), 0);
  assert.equal(ex.obstacleGap(a, new ex.Obstacle(0, 0, [[-1, -1], [1, -1], [1, 1], [-1, 1]])), 0); // contenu dans a
});

// ---------- Vitrine (interface, faux DOM) ----------

test("aides de la vitrine : miniature centrée, nombre borné, libellés", () => {
  const points = ex.thumbnailPoints(byId("equerre"), 150, 0.15);
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  assert.ok(Math.abs(Math.min(...xs) + Math.max(...xs) - 150) < 1e-9 && Math.abs(Math.min(...ys) + Math.max(...ys) - 150) < 1e-9);
  assert.ok(Math.abs(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) - 105) < 1e-9);
  assert.equal(ex.clampCount("3"), 3);
  assert.equal(ex.clampCount("-1"), 0);
  assert.equal(ex.clampCount(""), 0);
  assert.equal(ex.clampCount("2.7"), 2);
  assert.equal(ex.clampCount(99), ex.RANDOM_COUNT_MAX);
  assert.equal(ex.randomButtonLabel(0), "Choisissez au moins un obstacle");
  assert.equal(ex.randomButtonLabel(1), "Placer 1 obstacle au hasard");
  assert.equal(ex.randomButtonLabel(5), "Placer 5 obstacles au hasard");
  assert.match(ex.randomButtonLabel(40), /Placer 30 obstacles au hasard \(30 au maximum\)/);
  assert.match(ex.obstacleCardFacts(byId("pneus")), /série · 3 m · 10 sommets/);
});

function buildShowroom(protos) {
  const els = Object.fromEntries(["dialog", "grid", "hint", "status", "placeModeButton", "randomModeButton", "randomBar", "randomButton", "drawButton"]
    .map((name) => [name, fakeElement(name === "dialog" ? "dialog" : "div")]));
  const events = { placed: [], random: [], draw: 0, removed: [] };
  const showroom = new ex.ObstacleShowroom({
    ...els,
    catalog: () => ex.obstacleCatalog(protos.list),
    onPlace: (model) => events.placed.push(model.name),
    onRandom: (requests) => events.random.push(requests.map((r) => [r.model.name, r.count])),
    onDraw: () => { events.draw++; },
    onRemove: (model) => { protos.list = protos.list.filter((p) => p.id !== model.id); events.removed.push(model.name); }
  });
  return { showroom, els, events };
}

test("vitrine, mode « placer » : une carte par obstacle, le prototype dessiné mis en avant, Placer ferme la vitrine", () => {
  const protos = { list: [ex.createProto([], [[0, 0], [100, 0], [50, 80]], 5)] };
  const { showroom, els, events } = buildShowroom(protos);
  showroom.open("place", "proto_1");
  assert.equal(els.dialog.open, true);
  assert.equal(els.randomBar.hidden, true);
  assert.equal(els.grid.children.length, ex.BUILT_IN_OBSTACLES.length + 1);
  const card = els.grid.children.at(-1);
  assert.ok(card.classList.contains("selected"));
  assert.ok(descendants(card).some((el) => el.textContent === "proto_1"));
  assert.ok(descendants(card).some((el) => /prototype dessiné/.test(el.textContent)));
  descendants(card).find((el) => el.textContent === "Placer sur le circuit").click();
  assert.deepEqual(events.placed, ["proto_1"]);
  assert.equal(els.dialog.open, false);
  // Les obstacles de série n'ont pas de bouton « Retirer de la vitrine ».
  assert.equal(descendants(els.grid.children[0]).some((el) => el.textContent === "Retirer de la vitrine"), false);
  els.drawButton.click();
  assert.equal(events.draw, 1);
});

test("vitrine, retirer un prototype : il disparaît de la vitrine", () => {
  const protos = { list: [ex.createProto([], [[0, 0], [100, 0], [50, 80]], 5)] };
  const { showroom, els, events } = buildShowroom(protos);
  showroom.open("place");
  descendants(els.grid.children.at(-1)).find((el) => el.textContent === "Retirer de la vitrine").click();
  assert.deepEqual(events.removed, ["proto_1"]);
  assert.equal(els.grid.children.length, ex.BUILT_IN_OBSTACLES.length);
  assert.match(els.status.textContent, /proto_1 retiré/);
});

test("vitrine, mode « hasard » : nombres saisis (événement input), bouton mis à jour, demandes transmises", () => {
  const { showroom, els, events } = buildShowroom({ list: [] });
  showroom.open("random");
  assert.equal(els.randomBar.hidden, false);
  assert.equal(els.randomModeButton.getAttribute("aria-pressed"), "true");
  assert.equal(els.randomButton.disabled, true);
  const inputs = descendants(els.grid).filter((el) => el.type === "number");
  assert.equal(inputs.length, ex.BUILT_IN_OBSTACLES.length);
  inputs[0].value = "3";
  inputs[0].dispatch("input");
  assert.equal(els.randomButton.textContent, "Placer 3 obstacles au hasard");
  assert.equal(els.randomButton.disabled, false);
  inputs[2].value = "50";            // borné à RANDOM_COUNT_MAX
  inputs[2].dispatch("input");
  inputs[2].dispatch("change");
  assert.equal(inputs[2].value, String(ex.RANDOM_COUNT_MAX));
  assert.equal(showroom.total(), 3 + ex.RANDOM_COUNT_MAX);
  // Changer de mode garde les nombres choisis.
  els.placeModeButton.click();
  els.randomModeButton.click();
  assert.equal(descendants(els.grid).filter((el) => el.type === "number")[0].value, "3");
  els.randomButton.click();
  assert.deepEqual(plain(events.random), [[[ex.BUILT_IN_OBSTACLES[0].name, 3], [ex.BUILT_IN_OBSTACLES[2].name, ex.RANDOM_COUNT_MAX]]]);
  assert.equal(els.dialog.open, false);
});
