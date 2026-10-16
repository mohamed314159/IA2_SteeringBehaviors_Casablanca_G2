// Adaptateur p5 minimal pour Node : charge les scripts de l'exemple dans un
// contexte vm. Il ne prouve pas la compatibilité avec p5 réel (voir README).
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const exampleDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  dot(v) { return this.x * v.x + this.y * v.y; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  setMag(n) { const m = this.mag(); return m === 0 ? this : this.mult(n / m); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static fromAngle(a) { return new Vector(Math.cos(a), Math.sin(a)); }
}

export const SCRIPTS = [
  "random.js", "vehicle.js", "ray.js", "sensor-settings.js", "sim-speed.js", "circuits-data.js", "training-circuits-data.js", "circuit.js",
  "track-renderer.js", "finish-flames.js", "circuit-showroom.js", "brands.js", "network-config.js", "neural-network.js", "architecture.js", "grass.js", "decor.js", "confidence.js", "car-design.js", "obstacle.js",
  "obstacle-catalog.js", "obstacle-placement.js", "obstacle-showroom.js", "car.js",
  "evolution.js", "garage.js", "curriculum.js", "showroom.js", "model-file.js", "ray-editor.js", "network-viewer.js"
];

// Stockage factice de type localStorage.
export function createMemoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; }
  };
}

// globals : objets ajoutés au contexte (ex. un faux `document` pour une interface).
export function loadExample(files = SCRIPTS, globals = {}) {
  const context = vm.createContext({
    p5: { Vector },
    Math, Map, Set, Array, Object, Number, JSON, String, RegExp, Error,
    createVector: (x = 0, y = 0) => new Vector(x, y),
    ...globals
  });
  for (const file of files) {
    const filename = path.join(exampleDir, file);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  }
  // Les déclarations class/const ne deviennent pas des propriétés du contexte :
  // on les expose explicitement.
  return vm.runInContext(`({
    Vector: p5.Vector, createVector, createRng, randomBetween, randomPick,
    Vehicle, Ray, F1_CIRCUITS, Circuit, LapTracker, catmullRomClosed, resampleClosed,
    projectOnSegment, segmentsIntersect, segmentIntersection, removeEdgeLoops, wrapArcDelta,
    F1_CAR_LENGTH_M, F1_CAR_WIDTH_M, F1_TRACK_WIDTH_M,
    CAR_BRANDS, createRandomCarSpec, GRASS_PALETTE, generateGrassTexels, drawGrass,
    FLAME_EMIT_FRAMES, FLAME_PER_FRAME, FLAME_MAX_PARTICLES, FLAME_LIFE_MIN, FLAME_LIFE_MAX,
    FLAME_RISE_MIN, FLAME_RISE_MAX, finishLine, flameColor, FinishFlames,
    DECOR_STORAGE_KEY, DECOR_GRASS, DECOR_LIGHT, LIGHT_BACKGROUND, normalizeDecor, toggledDecor,
    decorPixelDensity, decorButtonLabel, loadDecor, saveDecor, drawDecorBackground, drawTrackLayer,
    Car, STALL_FRAMES, TURN_MAX, LAUNCH_FRAMES, MAX_LAPS,
    findModel, createRandomSpecForModel, mutateSpec,
    NeuralNetwork, sigmoid, gaussian, NETWORK_CONFIG, layerSizesFromConfig, NETWORK_OUTPUTS,
    MAX_RAYS, evenRayAngles, rayAnglesFromConfig, validateRayAngles,
    addRayAngle, setRayAngle, removeRayAngle, inputLayerDescription,
    lineageKey, carFitness, compareCars, runIsBetter, bestCar, populationPerModel,
    createInitialPopulation, createTrainingPopulation, spawnFromParent, groupByLineage,
    nextGeneration, TARGET_POPULATION, MIN_PER_MODEL,
    initialConfidenceState, advanceConfidence, confidenceFromProgress, toConfidenceState, runFinished,
    CONFIDENCE_EARLY, CONFIDENCE_EARLY_GENERATIONS, CONFIDENCE_STEPS,
    nextLineageGeneration, advanceStoppedLineages, LIVERIES, drawCarDesign,
    carsButtonLabel, allModelEntries, circuitConfidenceRows,
    SPEED_FACTORS, SIM_FRAME_BUDGET_MS, SIM_MAX_STEPS, SIM_SPEED_STORAGE_KEY,
    normalizeSpeedFactor, runSimulationSteps, SpeedMeter, loadSpeedFactor, saveSpeedFactor,
    MODEL_FILE_FORMAT, MODEL_FILE_VERSION, exportModelFile, modelFileName, validateBrainData,
    parseModelFile, modelMatchesArchitecture, describeModelArchitecture,
    Obstacle, OBSTACLE_PRESETS, OBSTACLES_STORAGE_KEY, OBSTACLE_MIN_POINTS, OBSTACLE_MAX_POINTS,
    polygonArea, polygonCentroid, validateShape, normalizeShape, pointInPolygon,
    loadObstacles, saveObstacles, obstacleWalls, obstacleIndexAt,
    BUILT_IN_OBSTACLES, OBSTACLE_PROTOS_STORAGE_KEY, PROTO_MAX_COUNT, OBSTACLE_MIN_SIZE_M, OBSTACLE_MAX_SIZE_M,
    toUnitShape, isValidUnitShape, obstacleShape, clampSize, protoNumber, nextProtoName, createProto, loadProtos, saveProtos, obstacleCatalog,
    RANDOM_OBSTACLES_MAX, RANDOM_PLACEMENT_ATTEMPTS, START_CLEAR_AHEAD_CARS, START_CLEAR_BEHIND_CARS,
    PASSAGE_CAR_WIDTHS, OBSTACLE_GAP_CAR_WIDTHS, normalizeRequests, lateralOffsetAt, freePassage, obstacleGap,
    distanceFromStart, obstacleRadius, placementProblem, tryPlaceObstacle, placeRandomObstacles,
    OBSTACLE_THUMB_SIZE, RANDOM_COUNT_MAX, thumbnailPoints, clampCount, randomButtonLabel, obstacleCardFacts,
    ObstacleShowroom, drawObstacleThumbnail,
    allCircuitEntries, circuitLayout, thumbnailScale, circuitCardInfo, drawTrackThumbnail,
    CIRCUIT_THUMB_WIDTH, CIRCUIT_THUMB_HEIGHT, CONFIDENCE_START, CONFIDENCE_MIN, CONFIDENCE_MAX,

    TRAINING_CIRCUITS, TRAINING_AREA_RATIO, trainingLevelKeys, Curriculum, arcPoints, spiralPoints, mirrorX,
    DEFAULT_RAY_LENGTH, MIN_RAY_LENGTH, MAX_RAY_LENGTH, RAY_LENGTH_STORAGE_KEY,
    currentRayLength, setRayLength, loadRayLength, saveRayLength,
    ARCHITECTURE_STORAGE_KEY, MAX_HIDDEN_LAYERS, currentNetworkConfig, architectureOf,
    sameArchitecture, validateArchitecture, loadArchitecture, useStoredArchitecture,
    applyArchitecture, resetArchitecture,
    Garage, GARAGE_STORAGE_KEY, GARAGE_HISTORY_LIMIT, networkLayout, networkLabels
  })`, context);
}
