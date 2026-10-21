// Voitures de luxe : marques et modèles parodiques (noms volontairement
// déformés, comme 11-F1-NeuroEvolution/brands.js) et dessin vue de dessus.
// Dimensions réelles en mètres, converties en px par la voiture.
const LUXURY_MODELS = [
  { brand: "Mercedas", model: "Classe Z", body: "berline", lengthM: 5.2, widthM: 1.95 },
  { brand: "Bémvé", model: "Série 8", body: "berline", lengthM: 5.1, widthM: 1.9 },
  { brand: "Audii", model: "A9", body: "berline", lengthM: 5.2, widthM: 1.95 },
  { brand: "Range Rouvre", model: "Vogue", body: "suv", lengthM: 5.0, widthM: 2.05 },
  { brand: "Porsha", model: "Kayenne", body: "suv", lengthM: 4.9, widthM: 2.0 },
  { brand: "Bentlé", model: "Continentale", body: "coupe", lengthM: 4.85, widthM: 1.95 },
  { brand: "Mazeratti", model: "Gran Turismo", body: "coupe", lengthM: 4.95, widthM: 1.95 }
];
const LUXURY_ELECTRIC = { brand: "Teslo", model: "Modèle Z", body: "ev", lengthM: 5.0, widthM: 1.95 };

// Teintes sobres de voitures de prestige.
const LUXURY_COLORS = ["#111318", "#3a3f45", "#eef0f2", "#1c2a4a", "#a7adb4", "#4a1520", "#2e3b2f", "#5b5f66"];

// Dessin d'une voiture centrée sur l'origine, nez vers +x, longueur L, largeur W (px).
// lights : { brake, blink, reverse } — états visibles du comportement actif.
function drawLuxuryCar(spec, L, W, lights = {}) {
  const x = -L / 2;
  const y = -W / 2;
  const corps = spec.color;
  const sombre = shadeHex(corps, -28);
  const clair = shadeHex(corps, 22);
  noStroke();
  // ombre portée
  fill(0, 0, 0, 70);
  rect(x + 0.35, y + 0.5, L, W, W * 0.32);
  // roues (dépassent légèrement)
  fill(15);
  for (const wx of [x + L * 0.17, x + L * 0.7]) {
    rect(wx, y - 0.25, L * 0.13, 0.55, 0.2);
    rect(wx, y + W - 0.3, L * 0.13, 0.55, 0.2);
  }
  // carrosserie
  fill(corps);
  stroke(0, 0, 0, 150);
  strokeWeight(0.12);
  rect(x, y, L, W, W * 0.32);
  noStroke();
  // capot (reflet), pare-brise, lunette, toit selon la silhouette
  const forme = {
    berline: { pb: 0.6, toit: [0.27, 0.33], lunette: 0.17 },
    suv: { pb: 0.66, toit: [0.2, 0.46], lunette: 0.1 },
    coupe: { pb: 0.56, toit: [0.3, 0.26], lunette: 0.2 },
    ev: { pb: 0.62, toit: [0.22, 0.4], lunette: 0.13 }
  }[spec.body] || { pb: 0.6, toit: [0.27, 0.33], lunette: 0.17 };
  fill(clair);
  rect(x + L * (forme.pb + 0.1), y + W * 0.18, L * 0.24, W * 0.64, 0.4);
  fill(140, 180, 215);
  rect(x + L * forme.pb, y + W * 0.13, L * 0.1, W * 0.74, 0.35);
  fill(105, 140, 175);
  rect(x + L * forme.lunette, y + W * 0.16, L * 0.08, W * 0.68, 0.35);
  fill(spec.body === "ev" ? "#1b2530" : sombre);
  rect(x + L * forme.toit[0], y + W * 0.12, L * forme.toit[1], W * 0.76, 0.5);
  if (spec.body === "suv") {
    // barres de toit
    stroke(200);
    strokeWeight(0.15);
    line(x + L * 0.22, y + W * 0.2, x + L * 0.62, y + W * 0.2);
    line(x + L * 0.22, y + W * 0.8, x + L * 0.62, y + W * 0.8);
    noStroke();
  }
  if (spec.body === "ev") {
    // liseré vert
    fill(31, 191, 106);
    rect(x + L * 0.05, y + W - 0.45, L * 0.9, 0.22);
  }
  // rétroviseurs
  fill(sombre);
  rect(x + L * 0.58, y - 0.35, 0.45, 0.4);
  rect(x + L * 0.58, y + W - 0.05, 0.45, 0.4);
  // phares avant
  fill(255, 248, 210);
  rect(x + L - 0.45, y + 0.25, 0.45, W * 0.22);
  rect(x + L - 0.45, y + W - 0.25 - W * 0.22, 0.45, W * 0.22);
  // feux arrière : rouge vif au freinage (arrive), sombres sinon
  fill(lights.brake ? color(255, 40, 40) : color(110, 20, 20));
  rect(x, y + 0.25, 0.45, W * 0.22);
  rect(x, y + W - 0.25 - W * 0.22, 0.45, W * 0.22);
  if (lights.brake) {
    fill(255, 40, 40, 70);
    circle(x - 0.4, y + 0.6, 1.6);
    circle(x - 0.4, y + W - 0.6, 1.6);
  }
  if (lights.blink) {
    fill(255, 170, 0);
    rect(x + L - 0.7, y + W - 0.35, 0.7, 0.35);
    rect(x, y + W - 0.35, 0.7, 0.35);
  }
  if (lights.reverse) {
    fill(255);
    rect(x, y + W / 2 - 0.3, 0.45, 0.6);
  }
}

function shadeHex(hex, delta) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, v + delta));
  return color(c(n >> 16), c((n >> 8) & 255), c(n & 255));
}
