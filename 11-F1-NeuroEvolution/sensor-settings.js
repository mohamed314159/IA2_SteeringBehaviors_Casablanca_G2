// Longueur des rayons détecteurs de murs : réglage commun à toutes les voitures,
// modifiable depuis le menu (curseur et boutons) et mémorisé dans le navigateur.
// Elle est lue à chaque image : un changement agit tout de suite, même pendant
// un entraînement. Les entrées du réseau restent dans [0, 1] (distance / longueur),
// mais un cerveau entraîné avec une autre longueur « voit » les murs à une
// autre échelle : il peut devoir se réadapter.
const DEFAULT_RAY_LENGTH = 160;   // px ≈ 51 m à l'échelle F1 (3,14 px/m)
const MIN_RAY_LENGTH = 40;        // ≈ 13 m
const MAX_RAY_LENGTH = 1200;      // maximum sans écran connu : largeur du canvas (≈ 382 m)
const RAY_LENGTH_STEP = 10;       // pas des boutons − / +
const RAY_LENGTH_STORAGE_KEY = "f1-neuroevolution-ray-length-v1";

let rayLength = DEFAULT_RAY_LENGTH;
let maxRayLength = MAX_RAY_LENGTH;   // étape 23 : largeur de l'écran (setMaxRayLength)

function currentRayLength() {
  return rayLength;
}

function currentMaxRayLength() {
  return maxRayLength;
}

// Maximum = largeur de l'écran en px CSS (le canvas est affiché à l'échelle 1,
// 1 px CSS = 1 px du jeu). Valeur absente ou invalide → MAX_RAY_LENGTH ;
// jamais sous la longueur par défaut. La longueur actuelle est ramenée dans la plage.
function setMaxRayLength(screenWidth) {
  const value = Number(screenWidth);
  maxRayLength = Number.isFinite(value) && value > 0
    ? Math.max(DEFAULT_RAY_LENGTH, Math.round(value))
    : MAX_RAY_LENGTH;
  setRayLength(rayLength);
  return maxRayLength;
}

// Fixe la longueur (arrondie au pixel, bornée). Une valeur non numérique est
// ignorée. Retourne la longueur effective.
function setRayLength(px) {
  const value = Number(px);
  if (!Number.isFinite(value)) return rayLength;
  rayLength = Math.min(maxRayLength, Math.max(MIN_RAY_LENGTH, Math.round(value)));
  return rayLength;
}

function loadRayLength(storage) {
  rayLength = DEFAULT_RAY_LENGTH;
  if (!storage) return rayLength;
  try {
    const raw = storage.getItem(RAY_LENGTH_STORAGE_KEY);
    if (raw !== null) setRayLength(raw);
  } catch (error) {
    // stockage bloqué : valeur par défaut
  }
  return rayLength;
}

function saveRayLength(storage) {
  if (!storage) return;
  try {
    storage.setItem(RAY_LENGTH_STORAGE_KEY, String(rayLength));
  } catch (error) {
    // stockage bloqué : le réglage vaut pour cette page seulement
  }
}
