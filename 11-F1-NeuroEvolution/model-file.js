// Modèle de voiture en fichier JSON : cerveau, paramètres, numéro de
// génération, fiches par circuit (confiance, record, validation) et
// architecture. Exporté depuis le garage, rechargé plus tard (même sur un
// autre navigateur). Fonctions pures : testables sans navigateur.
const MODEL_FILE_FORMAT = "f1-neuroevolution-model";
const MODEL_FILE_VERSION = 1;

// Construit le contenu du fichier pour une lignée du garage, à la génération
// choisie (null : dernier champion).
function exportModelFile(garage, key, generation = null, now = Date.now()) {
  const snapshot = garage.snapshot(key, generation);
  if (!snapshot) throw new Error(`Aucun modèle « ${key} » génération ${generation ?? "dernière"} au garage`);
  const entry = garage.lineages[key];
  return {
    format: MODEL_FILE_FORMAT,
    version: MODEL_FILE_VERSION,
    exportedAt: now,
    brand: snapshot.spec.brand,
    model: snapshot.spec.model,
    generation: snapshot.generation,
    architecture: {
      layers: snapshot.brain.layers.slice(),
      hiddenActivation: snapshot.brain.hiddenActivation
    },
    rayLength: snapshot.rayLength ?? null,
    snapshot: JSON.parse(JSON.stringify(snapshot)),
    circuits: JSON.parse(JSON.stringify(entry.circuits ?? {})),
    trained: entry.trained ? { ...entry.trained } : null
  };
}

// Nom de fichier lisible : marque_modele_genN.json (caractères sûrs).
function modelFileName(data) {
  const safe = (text) => String(text).normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe(data.brand)}_${safe(data.model)}_gen${data.generation}.json`;
}

// Vérifie la forme d'un cerveau (tailles des couches cohérentes avec les poids).
function validateBrainData(brain) {
  if (!brain || !Array.isArray(brain.layers) || brain.layers.length < 2) return "couches absentes";
  if (!brain.layers.every((n) => Number.isInteger(n) && n >= 1)) return "tailles de couches invalides";
  if (!(brain.hiddenActivation in ACTIVATIONS)) return "activation inconnue";
  if (!Array.isArray(brain.weights) || brain.weights.length !== brain.layers.length - 1) return "poids absents";
  if (!Array.isArray(brain.biases) || brain.biases.length !== brain.layers.length - 1) return "biais absents";
  for (let l = 0; l < brain.weights.length; l++) {
    const rows = brain.weights[l];
    if (!Array.isArray(rows) || rows.length !== brain.layers[l + 1]) return `couche ${l + 1} : nombre de neurones incohérent`;
    for (const row of rows) {
      if (!Array.isArray(row) || row.length !== brain.layers[l] || !row.every(Number.isFinite)) {
        return `couche ${l + 1} : poids invalides`;
      }
    }
    const biases = brain.biases[l];
    if (!Array.isArray(biases) || biases.length !== brain.layers[l + 1] || !biases.every(Number.isFinite)) {
      return `couche ${l + 1} : biais invalides`;
    }
  }
  return null;
}

// Lit le texte d'un fichier et le vérifie. Lève une erreur explicite sinon.
function parseModelFile(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new Error("Fichier illisible : ce n'est pas du JSON");
  }
  if (!data || data.format !== MODEL_FILE_FORMAT) throw new Error("Ce fichier n'est pas un modèle de voiture F1 Neuroévolution");
  if (data.version !== MODEL_FILE_VERSION) throw new Error(`Version de fichier non prise en charge : ${data.version}`);
  if (!Number.isInteger(data.generation) || data.generation < 0) throw new Error("Numéro de génération invalide");
  findModel(data.brand, data.model); // lève « Modèle inconnu » si la marque ou le modèle n'existe pas
  const snapshot = data.snapshot;
  if (!snapshot || !snapshot.spec || snapshot.spec.brand !== data.brand || snapshot.spec.model !== data.model) {
    throw new Error("Fichier incohérent : marque ou modèle différents dans le contenu");
  }
  if (snapshot.generation !== data.generation) throw new Error("Fichier incohérent : numéro de génération différent dans le contenu");
  const brainError = validateBrainData(snapshot.brain);
  if (brainError) throw new Error(`Cerveau invalide : ${brainError}`);
  if (!Number.isFinite(snapshot.spec.maxSpeed) || !Number.isFinite(snapshot.spec.maxForce)) {
    throw new Error("Paramètres de la voiture invalides");
  }
  return data;
}

// Vrai si le cerveau du fichier a l'architecture courante (couches cachées et
// activation) : sinon il ne peut pas entrer au garage (voir architecture.js).
function modelMatchesArchitecture(data, config) {
  const hidden = data.snapshot.brain.layers.slice(1, -1);
  return data.snapshot.brain.hiddenActivation === config.hiddenActivation &&
    hidden.length === config.hiddenLayers.length &&
    hidden.every((n, i) => n === config.hiddenLayers[i]);
}

// Description de l'architecture d'un fichier, ex. "6 → 16 → 8 → 2 (relu)".
function describeModelArchitecture(data) {
  return `${data.snapshot.brain.layers.join(" → ")} (${data.snapshot.brain.hiddenActivation})`;
}
