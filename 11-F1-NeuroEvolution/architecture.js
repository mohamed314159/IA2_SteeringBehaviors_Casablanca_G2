// Architecture du réseau choisie dans l'interface (network.html).
// Elle remplace hiddenLayers / hiddenActivation de network-config.js et est
// mémorisée dans le navigateur. Changer d'architecture efface toutes les
// générations du garage : les cerveaux sauvegardés n'ont plus la bonne forme.
const ARCHITECTURE_STORAGE_KEY = "f1-neuroevolution-architecture-v1";
const MAX_HIDDEN_LAYERS = 6;

let architectureOverride = null;   // { hiddenLayers, hiddenActivation } ou null

// Configuration réellement utilisée par les nouvelles voitures.
function currentNetworkConfig() {
  return architectureOverride ? { ...NETWORK_CONFIG, ...architectureOverride } : NETWORK_CONFIG;
}

function architectureOf(config) {
  return { hiddenLayers: config.hiddenLayers.slice(), hiddenActivation: config.hiddenActivation };
}

function sameArchitecture(a, b) {
  return a.hiddenActivation === b.hiddenActivation &&
    a.hiddenLayers.length === b.hiddenLayers.length &&
    a.hiddenLayers.every((n, i) => n === b.hiddenLayers[i]);
}

// Vérifie une architecture (lève une erreur explicite) et en retourne une copie propre.
function validateArchitecture(architecture) {
  if (!architecture || !Array.isArray(architecture.hiddenLayers)) {
    throw new Error("Architecture invalide : hiddenLayers doit être une liste");
  }
  if (architecture.hiddenLayers.length > MAX_HIDDEN_LAYERS) {
    throw new Error(`Architecture invalide : ${MAX_HIDDEN_LAYERS} couches cachées au maximum`);
  }
  const clean = {
    hiddenLayers: architecture.hiddenLayers.map(Number),
    hiddenActivation: architecture.hiddenActivation
  };
  layerSizesFromConfig({ ...NETWORK_CONFIG, ...clean }); // mêmes règles que le fichier
  return clean;
}

// Lit l'architecture mémorisée ; absente ou illisible → null (network-config.js).
function loadArchitecture(storage) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ARCHITECTURE_STORAGE_KEY);
    return raw ? validateArchitecture(JSON.parse(raw)) : null;
  } catch (error) {
    return null;
  }
}

// Charge l'architecture mémorisée comme architecture courante.
function useStoredArchitecture(storage) {
  architectureOverride = loadArchitecture(storage);
  return currentNetworkConfig();
}

// Applique une nouvelle architecture. Si elle diffère de l'actuelle, elle est
// mémorisée et toutes les lignées du garage sont effacées.
// Retourne { changed, erased } (erased = nombre de lignées effacées).
function applyArchitecture(architecture, storage, garage) {
  const clean = validateArchitecture(architecture);
  if (sameArchitecture(clean, architectureOf(currentNetworkConfig()))) return { changed: false, erased: 0 };
  const erased = garage.keys().length;
  garage.clear();
  architectureOverride = sameArchitecture(clean, architectureOf(NETWORK_CONFIG)) ? null : clean;
  if (storage) {
    try {
      if (architectureOverride) storage.setItem(ARCHITECTURE_STORAGE_KEY, JSON.stringify(architectureOverride));
      else storage.removeItem(ARCHITECTURE_STORAGE_KEY);
    } catch (error) {
      // stockage bloqué : l'architecture reste valable pour cette page
    }
  }
  return { changed: true, erased };
}

// Revient à l'architecture du fichier network-config.js.
function resetArchitecture(storage, garage) {
  return applyArchitecture(architectureOf(NETWORK_CONFIG), storage, garage);
}
