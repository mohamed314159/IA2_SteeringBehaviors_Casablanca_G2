// Décor du circuit : « herbe » (texture façon Minecraft, grass.js) ou
// « léger » (fond uni). Le décor est dessiné une seule fois par circuit dans
// un p5.Graphics ; le mode léger allège donc surtout :
//  - la construction du circuit (pas des ~100 000 carrés d'herbe) ;
//  - chaque image : densité de pixels 1 (sur un écran haute résolution, le
//    canevas et le décor recopié ont moins de pixels à traiter).
const DECOR_STORAGE_KEY = "f1-neuroevolution-decor-v1";
const DECOR_GRASS = "grass";
const DECOR_LIGHT = "light";
const LIGHT_BACKGROUND = "#5f9136";   // vert uni, proche de la teinte moyenne de l'herbe

// ---------- Fonctions pures (testées) ----------

function normalizeDecor(value) {
  return value === DECOR_LIGHT ? DECOR_LIGHT : DECOR_GRASS;
}

function toggledDecor(decor) {
  return normalizeDecor(decor) === DECOR_LIGHT ? DECOR_GRASS : DECOR_LIGHT;
}

// Densité de pixels du canevas et du décor : 1 en mode léger, sinon celle de l'écran.
function decorPixelDensity(decor, displayDensityValue) {
  if (normalizeDecor(decor) === DECOR_LIGHT) return 1;
  return Number.isFinite(displayDensityValue) && displayDensityValue > 0 ? displayDensityValue : 1;
}

function decorButtonLabel(decor) {
  return normalizeDecor(decor) === DECOR_LIGHT ? "Décor : léger" : "Décor : herbe";
}

function loadDecor(storage) {
  if (!storage) return DECOR_GRASS;
  try {
    return normalizeDecor(storage.getItem(DECOR_STORAGE_KEY));
  } catch (error) {
    return DECOR_GRASS;
  }
}

function saveDecor(storage, decor) {
  if (!storage) return;
  try {
    storage.setItem(DECOR_STORAGE_KEY, normalizeDecor(decor));
  } catch (error) {
    // stockage bloqué : le choix reste valable pour cette page
  }
}

// Fond du décor dans un p5.Graphics : herbe texturée ou couleur unie.
function drawDecorBackground(g, decor, rng) {
  if (normalizeDecor(decor) === DECOR_LIGHT) g.background(LIGHT_BACKGROUND);
  else drawGrass(g, g.width, g.height, rng);
}
