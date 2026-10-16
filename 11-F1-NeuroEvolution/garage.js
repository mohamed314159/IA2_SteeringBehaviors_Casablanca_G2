// Garage : conserve, pour chaque lignée (marque + modèle), le champion de chaque
// génération terminée qui a battu le record (plus loin, ou arrivée plus rapide :
// runIsBetter), plus le dernier champion.
// Stockage injectable (localStorage dans le navigateur, objet factice en test) :
// rien n'est réinitialisé quand on relance un entraînement.
const GARAGE_STORAGE_KEY = "f1-neuroevolution-garage-v1";
const GARAGE_HISTORY_LIMIT = 40;   // générations conservées par lignée (les plus anciennes partent)

class Garage {
  constructor(storage = null) {
    this.storage = storage;
    this.lastError = null;
    this.lineages = {};
    this.load();
  }

  load() {
    this.lineages = {};
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(GARAGE_STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (data && typeof data.lineages === "object" && data.lineages !== null) this.lineages = data.lineages;
    } catch (error) {
      this.lastError = error; // données illisibles : garage vide, sans planter la page
    }
  }

  persist() {
    if (!this.storage) return;
    try {
      this.storage.setItem(GARAGE_STORAGE_KEY, JSON.stringify({ lineages: this.lineages }));
      this.lastError = null;
    } catch (error) {
      this.lastError = error; // quota dépassé ou stockage bloqué
    }
  }

  static snapshotOf(car, circuitName, now) {
    return {
      generation: car.generation,
      progress: car.progress,
      framesAlive: car.framesAlive,
      startOffset: car.startOffset,
      raceLaps: car.raceLaps,
      rayLength: car.sightDistance,
      circuit: circuitName,
      circuitKey: car.circuit.key,
      savedAt: now,
      spec: { ...car.spec },
      brain: car.brain.toJSON()
    };
  }

  // Enregistre le champion d'une génération terminée. Retourne true si record.
  // Met aussi à jour la fiche du circuit (record, confiance, validation).
  recordChampion(car, circuitName = car.circuit.name, now = Date.now()) {
    const key = lineageKey(car.spec);
    const entry = this.lineages[key] || (this.lineages[key] = {
      brand: car.spec.brand, model: car.spec.model, history: []
    });
    const snapshot = Garage.snapshotOf(car, circuitName, now);
    entry.latest = snapshot;
    this.updateCircuitRecord(entry, car, circuitName, now);
    const record = this.best(key);
    const isRecord = record === null || runIsBetter(snapshot, record);
    if (isRecord) {
      entry.history.push(snapshot);
      if (entry.history.length > GARAGE_HISTORY_LIMIT) entry.history.shift();
    }
    this.persist();
    return isRecord;
  }

  // Fiche par circuit : meilleur pourcentage (et temps), confiance pour la
  // prochaine génération sur ce circuit, validation quand le tour est bouclé.
  updateCircuitRecord(entry, car, circuitName, now) {
    const circuits = entry.circuits || (entry.circuits = {});
    const circuitKey = car.circuit.key;
    const record = circuits[circuitKey] || (circuits[circuitKey] = {
      name: circuitName, bestProgress: 0, bestFrames: null, bestGeneration: null,
      confidence: CONFIDENCE_START, trained: null
    });
    const run = { progress: Math.min(car.progress, car.raceLaps), framesAlive: car.framesAlive, raceLaps: car.raceLaps };
    const previous = { progress: record.bestProgress, framesAlive: record.bestFrames ?? Infinity, raceLaps: car.raceLaps };
    if (record.bestGeneration === null || runIsBetter(run, previous)) {
      record.bestProgress = Math.max(0, run.progress);
      record.bestFrames = car.framesAlive;
      record.bestGeneration = car.generation;
    }
    record.confidence = confidenceAfterRun(car.confidence, car.progress, car.framesAlive, car.raceLaps);
    if (car.progress >= car.raceLaps && !record.trained) {
      record.trained = { generation: car.generation, savedAt: now };
    }
  }

  circuitRecord(key, circuitKey) {
    return this.lineages[key]?.circuits?.[circuitKey] ?? null;
  }

  // Confiance mémorisée d'une lignée sur un circuit (null : jamais roulé dessus).
  circuitConfidence(key, circuitKey) {
    return this.circuitRecord(key, circuitKey)?.confidence ?? null;
  }

  // Vrai si la lignée a déjà bouclé ce circuit : on ne peut plus l'y entraîner.
  isTrainedOn(key, circuitKey) {
    return Boolean(this.circuitRecord(key, circuitKey)?.trained);
  }

  // Circuits validés par une lignée : [{ circuitKey, name, generation }].
  trainedCircuits(key) {
    const circuits = this.lineages[key]?.circuits ?? {};
    return Object.entries(circuits)
      .filter(([, record]) => record.trained)
      .map(([circuitKey, record]) => ({ circuitKey, name: record.name, generation: record.trained.generation }));
  }

  keys() {
    return Object.keys(this.lineages);
  }

  has(key) {
    return key in this.lineages;
  }

  // Générations disponibles pour une lignée (dernier champion inclus), sans doublon.
  generations(key) {
    const entry = this.lineages[key];
    if (!entry) return [];
    const list = entry.history.map((s) => s.generation);
    if (entry.latest && !list.includes(entry.latest.generation)) list.push(entry.latest.generation);
    return list.sort((a, b) => a - b);
  }

  // Snapshot d'une génération donnée, ou le dernier champion si generation est null.
  snapshot(key, generation = null) {
    const entry = this.lineages[key];
    if (!entry) return null;
    if (generation === null || (entry.latest && entry.latest.generation === generation)) return entry.latest || null;
    return entry.history.find((s) => s.generation === generation) || null;
  }

  best(key) {
    const entry = this.lineages[key];
    if (!entry || entry.history.length === 0) return null;
    return entry.history.reduce((a, b) => (runIsBetter(b, a) ? b : a));
  }

  // Marque une lignée comme entraînée sur tous les circuits d'entraînement.
  markTrained(key, generation, now = Date.now()) {
    const entry = this.lineages[key];
    if (!entry) return;
    entry.trained = { generation, savedAt: now };
    this.persist();
  }

  trainedInfo(key) {
    return this.lineages[key]?.trained ?? null;
  }

  remove(key) {
    delete this.lineages[key];
    this.persist();
  }

  // Supprime les lignées dont le cerveau n'a pas l'architecture donnée
  // (couches cachées + activation). Retourne le nombre de lignées supprimées.
  removeIncompatible(hiddenLayers, hiddenActivation) {
    let removed = 0;
    for (const key of this.keys()) {
      const brain = this.lineages[key].latest?.brain;
      const hidden = brain ? brain.layers.slice(1, -1) : null;
      const same = brain && brain.hiddenActivation === hiddenActivation &&
        hidden.length === hiddenLayers.length && hidden.every((n, i) => n === hiddenLayers[i]);
      if (!same) {
        delete this.lineages[key];
        removed++;
      }
    }
    if (removed > 0) this.persist();
    return removed;
  }

  // Range au garage un modèle chargé depuis un fichier (model-file.js) : il
  // devient le dernier champion de sa lignée, avec ses fiches par circuit.
  // Une lignée du même modèle déjà présente est remplacée. Retourne { key, replaced }.
  importLineage(data, now = Date.now()) {
    const key = lineageKey({ brand: data.brand, model: data.model });
    const replaced = this.has(key);
    const snapshot = { ...JSON.parse(JSON.stringify(data.snapshot)), importedAt: now };
    this.lineages[key] = {
      brand: data.brand,
      model: data.model,
      history: [snapshot],
      latest: snapshot,
      circuits: JSON.parse(JSON.stringify(data.circuits ?? {})),
      ...(data.trained ? { trained: { ...data.trained } } : {})
    };
    this.persist();
    return { key, replaced };
  }

  // Efface toutes les lignées (changement d'architecture du réseau).
  clear() {
    this.lineages = {};
    this.persist();
  }
}
