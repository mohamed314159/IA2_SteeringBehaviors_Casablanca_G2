// Catalogue de la vitrine des obstacles : obstacles « de série » déjà dessinés
// et prototypes dessinés dans l'éditeur (proto_1, proto_2…). Un modèle
// d'obstacle est une forme normalisée (plus grande dimension = 2, centrée)
// et une taille en mètres ; il devient un Obstacle (px) avec obstacleShape().
const OBSTACLE_PROTOS_STORAGE_KEY = "f1-neuroevolution-obstacle-protos-v1";
const PROTO_PREFIX = "proto_";
const PROTO_MAX_COUNT = 40;               // prototypes gardés dans la vitrine
const OBSTACLE_MIN_SIZE_M = 2;
const OBSTACLE_MAX_SIZE_M = 20;

// Pile de pneus : cercle à n sommets ; étoile : rayons alternés.
function regularShape(n, radius = 1, phase = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return [radius * Math.cos(a), radius * Math.sin(a)];
  });
}

function starShape(branches, inner) {
  return Array.from({ length: branches * 2 }, (_, i) => {
    const r = i % 2 === 0 ? 1 : inner;
    const a = -Math.PI / 2 + (i / (branches * 2)) * Math.PI * 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  });
}

// Obstacles de série (dessinés pour l'exemple), tailles réalistes en mètres.
const BUILT_IN_OBSTACLES = [
  { id: "pneus", name: "Pile de pneus", sizeMeters: 3, points: regularShape(10) },
  { id: "bloc", name: "Bloc béton", sizeMeters: 4, points: [[-1, -1], [1, -1], [1, 1], [-1, 1]] },
  { id: "barriere", name: "Barrière", sizeMeters: 9, points: [[-1, -0.2], [1, -0.2], [1, 0.2], [-1, 0.2]] },
  { id: "cone", name: "Cône géant", sizeMeters: 3, points: [[0, -1], [0.85, 0.75], [-0.85, 0.75]] },
  { id: "chevron", name: "Chevron", sizeMeters: 7, points: [[-1, -0.6], [0, 0.2], [1, -0.6], [1, 0], [0, 0.8], [-1, 0]] },
  { id: "equerre", name: "Muret en L", sizeMeters: 7, points: [[-1, -1], [-0.5, -1], [-0.5, 0.5], [1, 0.5], [1, 1], [-1, 1]] },
  { id: "croix", name: "Croix", sizeMeters: 5, points: [[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]] },
  { id: "etoile", name: "Étoile", sizeMeters: 5, points: starShape(5, 0.45) },
  { id: "losange", name: "Losange", sizeMeters: 5, points: [[0, -1], [0.6, 0], [0, 1], [-0.6, 0]] }
].map((model) => ({ ...model, builtIn: true }));

// ---------- Fonctions pures (testées) ----------

// Forme dessinée → forme normalisée : centrée, plus grande dimension = 2.
function toUnitShape(points) {
  return normalizeShape(points, 2, 1);
}

// Forme normalisée relue (stockage) : mêmes règles que le dessin. On la
// valide agrandie, sinon le seuil d'aire en px² rejetterait toute forme de taille 2.
function isValidUnitShape(points) {
  if (!Array.isArray(points) || !points.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite))) return false;
  return validateShape(points.map(([x, y]) => [x * 100, y * 100])) === null;
}

// Forme d'un modèle en pixels, prête pour new Obstacle(x, y, shape, rotation).
function obstacleShape(model, pixelsPerMeter) {
  return normalizeShape(model.points, model.sizeMeters, pixelsPerMeter);
}

function clampSize(sizeMeters) {
  const size = Number(sizeMeters);
  if (!Number.isFinite(size)) return 6;
  return Math.min(OBSTACLE_MAX_SIZE_M, Math.max(OBSTACLE_MIN_SIZE_M, size));
}

// Numéro d'un nom « proto_N » (sinon 0).
function protoNumber(name) {
  const match = new RegExp(`^${PROTO_PREFIX}(\\d+)$`).exec(name);
  return match ? Number(match[1]) : 0;
}

// Nom du prochain prototype : jamais réutilisé tant que les précédents existent.
function nextProtoName(protos) {
  const highest = protos.reduce((max, p) => Math.max(max, protoNumber(p.name)), 0);
  return `${PROTO_PREFIX}${highest + 1}`;
}

// Nouveau prototype à partir d'une forme dessinée (coordonnées de l'éditeur).
function createProto(protos, drawnPoints, sizeMeters) {
  if (protos.length >= PROTO_MAX_COUNT) throw new Error(`Vitrine pleine (${PROTO_MAX_COUNT} prototypes) : retirez-en un.`);
  const problem = validateShape(drawnPoints);
  if (problem) throw new Error(`Forme : ${problem}.`);
  const name = nextProtoName(protos);
  return { id: name, name, sizeMeters: clampSize(sizeMeters), points: toUnitShape(drawnPoints), builtIn: false };
}

function loadProtos(storage) {
  if (!storage) return [];
  try {
    const list = JSON.parse(storage.getItem(OBSTACLE_PROTOS_STORAGE_KEY) || "[]");
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => p && typeof p.name === "string" && protoNumber(p.name) > 0 && isValidUnitShape(p.points))
      .map((p) => ({ id: p.name, name: p.name, sizeMeters: clampSize(p.sizeMeters), points: p.points.map((q) => [q[0], q[1]]), builtIn: false }));
  } catch (error) {
    return [];
  }
}

function saveProtos(storage, protos) {
  if (!storage) return;
  try {
    const data = protos.map((p) => ({ name: p.name, sizeMeters: p.sizeMeters, points: p.points }));
    storage.setItem(OBSTACLE_PROTOS_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    // stockage bloqué : les prototypes restent pour cette page
  }
}

// Vitrine complète : obstacles de série puis prototypes (plus récents en dernier).
function obstacleCatalog(protos) {
  return [...BUILT_IN_OBSTACLES, ...protos];
}
