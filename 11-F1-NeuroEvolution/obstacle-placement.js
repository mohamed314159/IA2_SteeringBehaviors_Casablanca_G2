// Placement aléatoire d'obstacles (règle de scène, pas un comportement de
// steering) : chaque obstacle est tiré sur la piste, en un nombre d'essais
// borné, et n'est gardé que s'il respecte trois règles :
//  - rien dans la zone de départ (les voitures ne naissent pas sur un obstacle) ;
//  - un passage libre d'au moins PASSAGE_CAR_WIDTHS largeurs de voiture ;
//  - un écart minimal avec les autres obstacles et les autres portions du tracé.
const RANDOM_OBSTACLES_MAX = 30;            // obstacles demandés au maximum en une fois
const RANDOM_PLACEMENT_ATTEMPTS = 80;       // essais par obstacle, puis abandon
const START_CLEAR_AHEAD_CARS = 12;          // zone libre après la ligne de départ (longueurs de voiture)
const START_CLEAR_BEHIND_CARS = 3;          // et avant elle
const PASSAGE_CAR_WIDTHS = 3;               // passage libre minimal (≈ 6 m)
const OBSTACLE_GAP_CAR_WIDTHS = 3;          // écart minimal entre deux obstacles

// Demandes { model, count } → nombres entiers ≥ 0, total borné à RANDOM_OBSTACLES_MAX.
function normalizeRequests(requests) {
  let left = RANDOM_OBSTACLES_MAX;
  const result = [];
  for (const { model, count } of requests) {
    const wanted = Math.max(0, Math.floor(Number(count) || 0));
    const kept = Math.min(wanted, left);
    left -= kept;
    if (kept > 0) result.push({ model, count: kept });
  }
  return result;
}

// Écart latéral signé d'un point à la ligne médiane au point d'indice index
// (+ vers le bord droit, comme le décalage de départ des voitures).
function lateralOffsetAt(circuit, index, point) {
  const c = circuit.center[index];
  const t = circuit.tangents[index];
  return (point[0] - c.x) * -t.y + (point[1] - c.y) * t.x;
}

// Passage libre le plus large (px) laissé à côté de l'obstacle, à l'indice index.
function freePassage(circuit, index, obstacle) {
  const half = circuit.trackWidth / 2;
  const offsets = obstacle.points.map((p) => lateralOffsetAt(circuit, index, p));
  const leftGap = Math.min(...offsets) + half;
  const rightGap = half - Math.max(...offsets);
  return Math.max(0, leftGap, rightGap);
}

// Distance entre deux obstacles (0 s'ils se touchent ou se chevauchent).
function obstacleGap(a, b) {
  for (const wa of a.walls) {
    for (const wb of b.walls) if (segmentsIntersect(wa.a, wa.b, wb.a, wb.b)) return 0;
  }
  if (a.containsPoint(b.pos) || b.containsPoint(a.pos)) return 0;
  const fromA = Math.min(...a.points.map(([x, y]) => b.distanceTo({ x, y })));
  const fromB = Math.min(...b.points.map(([x, y]) => a.distanceTo({ x, y })));
  return Math.min(fromA, fromB);
}

// Distance (px) parcourue depuis la ligne de départ jusqu'à l'indice index.
function distanceFromStart(circuit, index) {
  const start = circuit.arc[circuit.startPose(0).index];
  return (((circuit.arc[index] - start) % circuit.totalLength) + circuit.totalLength) % circuit.totalLength;
}

// Rayon de l'obstacle autour de son centre (px).
function obstacleRadius(obstacle) {
  return Math.max(...obstacle.shape.map(([x, y]) => Math.hypot(x, y)));
}

// Raison du refus d'un obstacle tiré à l'indice index, sinon null.
function placementProblem(circuit, index, obstacle, others) {
  const radius = obstacleRadius(obstacle);
  const fromStart = distanceFromStart(circuit, index);
  if (fromStart - radius < START_CLEAR_AHEAD_CARS * circuit.carLength) return "zone de départ";
  if (circuit.totalLength - fromStart - radius < START_CLEAR_BEHIND_CARS * circuit.carLength) return "zone de départ";
  if (freePassage(circuit, index, obstacle) < PASSAGE_CAR_WIDTHS * circuit.carWidth) return "passage trop étroit";
  const gap = OBSTACLE_GAP_CAR_WIDTHS * circuit.carWidth;
  if (others.some((other) => obstacleGap(obstacle, other) < gap)) return "trop près d'un autre obstacle";
  // Un sommet ne doit pas déborder sur une autre portion du tracé (épingle, croisement proche).
  const neighbourhood = circuit.trackWidth * 2;
  for (const [x, y] of obstacle.points) {
    const p = circuit.project({ x, y });
    const along = Math.abs(wrapArcDelta(p.s - circuit.arc[index], circuit.totalLength));
    if (along > neighbourhood + radius && p.distance < circuit.trackWidth / 2 + gap) return "déborde sur une autre portion";
  }
  return null;
}

// Tire un obstacle du modèle sur la piste ; null après RANDOM_PLACEMENT_ATTEMPTS échecs.
function tryPlaceObstacle(circuit, model, others, rng, pixelsPerMeter) {
  const shape = obstacleShape(model, pixelsPerMeter);
  const n = circuit.center.length;
  const half = circuit.trackWidth / 2;
  for (let attempt = 0; attempt < RANDOM_PLACEMENT_ATTEMPTS; attempt++) {
    const index = Math.min(n - 1, Math.floor(rng() * n));
    const offset = randomBetween(rng, -half, half);
    const rotation = rng() * Math.PI * 2;
    const c = circuit.center[index];
    const t = circuit.tangents[index];
    const obstacle = new Obstacle(c.x - t.y * offset, c.y + t.x * offset, shape, rotation);
    if (placementProblem(circuit, index, obstacle, others) === null) return obstacle;
  }
  return null;
}

// Place au hasard les obstacles demandés ([{ model, count }]) en plus des
// obstacles existants (non modifiés). Les plus grands sont placés d'abord.
// Retourne { placed, requested, missing }.
function placeRandomObstacles(circuit, requests, existing, rng, pixelsPerMeter = circuit.pixelsPerMeter) {
  const queue = normalizeRequests(requests)
    .flatMap(({ model, count }) => Array.from({ length: count }, () => model))
    .sort((a, b) => b.sizeMeters - a.sizeMeters);
  const placed = [];
  for (const model of queue) {
    const obstacle = tryPlaceObstacle(circuit, model, [...existing, ...placed], rng, pixelsPerMeter);
    if (obstacle) placed.push(obstacle);
  }
  return { placed, requested: queue.length, missing: queue.length - placed.length };
}
