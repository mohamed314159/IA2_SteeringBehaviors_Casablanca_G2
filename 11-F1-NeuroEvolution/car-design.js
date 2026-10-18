// Dessin d'une voiture de F1 vue de dessus, centrée sur l'origine, nez vers +x.
// Utilisé sur le circuit (petit, version simple) et dans la vitrine (grand,
// version détaillée). `g` est la cible de dessin : p5.instance pour le canvas
// principal, ou un p5.Graphics pour la vitrine.
//   spec    : { brand, model } (apparence lue dans brands.js, carAppearance),
//             ou directement { color, accent, livery, number }
//   L, W    : longueur et largeur de la voiture (px)
//   options : { dead, detailed }
// Étape 28 : silhouette de F1 (nez effilé, pontons), ombre portée, reflets,
// dérives d'aileron, casque coloré, pneus arrondis.
const LIVERIES = ["bande", "double-bande", "unie", "flèche", "damier"];

// Couleur de contour lisible sur la carrosserie : sombre sur une couleur claire,
// claire sur une couleur sombre (luminance relative, seuil 0,4). Retourne [r, g, b].
function hexToRgb(hex) {
  const value = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!value) return [128, 128, 128];
  const n = parseInt(value[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function outlineColor(hex) {
  return relativeLuminance(hex) > 0.4 ? [20, 20, 20] : [240, 240, 240];
}

// Couleur plus claire (amount > 0, vers le blanc) ou plus sombre (amount < 0,
// vers le noir) : [r, g, b] entiers. Utilisée pour les reflets et les ombres de la
// carrosserie (étape 28).
function shadeColor(hex, amount) {
  const target = amount >= 0 ? 255 : 0;
  const k = Math.min(1, Math.abs(amount));
  return hexToRgb(hex).map((c) => Math.round(c + (target - c) * k));
}

// Contour de la coque vue de dessus (étape 28), nez vers +x, symétrique :
// nez effilé, cockpit, pontons larges, puis la boîte de vitesses qui se resserre.
// Points [x, y] en px pour une voiture de longueur L et de largeur W.
function chassisOutline(L, W) {
  const half = [
    [0.5, 0.03], [0.42, 0.06], [0.24, 0.1], [0.14, 0.16], [0.1, 0.38], [0.02, 0.41],
    [-0.2, 0.36], [-0.3, 0.22], [-0.42, 0.15], [-0.45, 0.1]
  ];
  const top = half.map(([x, y]) => [x * L, -y * W]);
  const bottom = half.slice().reverse().map(([x, y]) => [x * L, y * W]);
  return [...top, ...bottom];
}

function drawPolygon(g, points, dx = 0, dy = 0) {
  g.beginShape();
  for (const [x, y] of points) g.vertex(x + dx, y + dy);
  g.endShape(g.CLOSE);
}

function drawCarDesign(g, spec, L, W, options = {}) {
  const { dead = false, detailed = false } = options;
  if (spec.brand && spec.model) spec = { ...spec, ...carAppearance(spec) };
  const alpha = dead ? 110 : 255;
  const body = g.color(spec.color);
  body.setAlpha(alpha);
  const accent = g.color(spec.accent);
  accent.setAlpha(alpha);
  const outline = chassisOutline(L, W);

  g.push();
  g.rectMode(g.CENTER);
  g.noStroke();

  // Ombre portée sous la voiture (pas pour une voiture éliminée, déjà transparente).
  if (!dead) {
    g.fill(0, 0, 0, 70);
    drawPolygon(g, outline, L * 0.03, W * 0.14);
    g.rect(L * 0.03, W * 0.14, L * 0.9, W * 1.1, W * 0.3);
  }

  // Pneus (larges à l'arrière) arrondis, bande de roulement plus claire.
  const tyres = [
    [L * 0.30, -W * 0.55, L * 0.16, W * 0.35],
    [L * 0.30, W * 0.55, L * 0.16, W * 0.35],
    [-L * 0.32, -W * 0.55, L * 0.18, W * 0.38],
    [-L * 0.32, W * 0.55, L * 0.18, W * 0.38]
  ];
  for (const [x, y, w, h] of tyres) {
    g.fill(dead ? 60 : 18);
    g.rect(x, y, w, h, h * 0.3);
    g.fill(dead ? 80 : 58);
    g.rect(x, y, w * 0.7, h * 0.18);
    if (detailed) {
      g.fill(90);
      g.rect(x, y, w * 0.45, h * 0.25);
    }
  }

  // Bras de suspension (fins) en version détaillée.
  if (detailed) {
    g.stroke(40);
    g.strokeWeight(Math.max(1, W * 0.04));
    for (const [x, y] of tyres) g.line(x, y * 0.35, x, y * 0.8);
    g.noStroke();
  }

  // Aileron avant (dérives couleur carrosserie), aileron arrière à deux plans.
  g.fill(accent);
  g.rect(L * 0.46, 0, L * 0.07, W * 1.12, W * 0.06);
  g.rect(-L * 0.47, 0, L * 0.08, W * 0.92, W * 0.06);
  g.fill(body);
  g.rect(L * 0.46, -W * 0.54, L * 0.09, W * 0.06);
  g.rect(L * 0.46, W * 0.54, L * 0.09, W * 0.06);
  g.fill(...shadeColor(spec.accent, -0.45), alpha);
  g.rect(-L * 0.445, 0, L * 0.025, W * 0.92);

  // Coque. Sur le circuit, contour contrasté (une voiture noire reste visible
  // sur l'asphalte), puis motif de la livrée.
  g.fill(body);
  if (!detailed) {
    g.stroke(...outlineColor(spec.color), alpha);
    g.strokeWeight(0.8);
  }
  drawPolygon(g, outline);
  g.noStroke();
  // Reflet du capot moteur et du nez (ligne claire au centre), flancs plus sombres.
  g.fill(...shadeColor(spec.color, -0.3), alpha);
  g.rect(-L * 0.08, -W * 0.3, L * 0.3, W * 0.08, W * 0.04);
  g.rect(-L * 0.08, W * 0.3, L * 0.3, W * 0.08, W * 0.04);
  g.fill(...shadeColor(spec.color, 0.45), alpha);
  g.rect(L * 0.02, 0, L * 0.7, W * 0.05);
  drawLivery(g, spec.livery, accent, L, W);
  // Entrées d'air des pontons.
  g.fill(25, alpha);
  g.rect(L * 0.08, -W * 0.3, L * 0.05, W * 0.12, 1);
  g.rect(L * 0.08, W * 0.3, L * 0.05, W * 0.12, 1);
  if (detailed) {
    // Rétroviseurs.
    g.fill(body);
    g.rect(L * 0.12, -W * 0.28, L * 0.03, W * 0.1);
    g.rect(L * 0.12, W * 0.28, L * 0.03, W * 0.1);
  }

  // Cockpit et casque (couleur d'accent), halo en version détaillée.
  g.fill(20, alpha);
  g.ellipse(-L * 0.02, 0, L * 0.14, W * 0.32);
  g.fill(accent);
  g.ellipse(-L * 0.03, 0, L * 0.06, W * 0.2);
  if (detailed) {
    g.fill(255, 255, 255, 120);
    g.ellipse(-L * 0.02, -W * 0.04, L * 0.025, W * 0.06);   // reflet sur la visière
    g.noFill();
    g.stroke(30);
    g.strokeWeight(Math.max(1, W * 0.05));
    g.arc(-L * 0.02, 0, L * 0.18, W * 0.36, -g.HALF_PI, g.HALF_PI); // halo
    g.noStroke();
    // Numéro sur le capot moteur (contour sombre : lisible sur toutes les couleurs).
    g.fill(255, alpha);
    g.stroke(0);
    g.strokeWeight(Math.max(1, W * 0.03));
    g.textAlign(g.CENTER, g.CENTER);
    g.textStyle(g.BOLD);
    g.textSize(W * 0.24);
    g.push();
    g.translate(-L * 0.2, 0);
    g.rotate(g.HALF_PI);
    g.text(String(spec.number ?? ""), 0, 0);
    g.pop();
    g.noStroke();
  }
  g.pop();
}

// Motif de la livrée, limité au nez (de 0,08 L à 0,42 L) pour ne pas
// recouvrir le numéro peint sur le capot moteur (version détaillée).
function drawLivery(g, livery, accent, L, W) {
  g.fill(accent);
  if (livery === "bande") {
    g.rect(L * 0.25, 0, L * 0.34, W * 0.1);
  } else if (livery === "double-bande") {
    g.rect(L * 0.25, -W * 0.1, L * 0.34, W * 0.06);
    g.rect(L * 0.25, W * 0.1, L * 0.34, W * 0.06);
  } else if (livery === "flèche") {
    g.triangle(L * 0.42, 0, L * 0.12, -W * 0.18, L * 0.12, W * 0.18);
  } else if (livery === "damier") {
    const size = W * 0.1;
    for (let i = 0; i < 6; i++) {
      for (let j = -1; j <= 0; j++) {
        if ((i + j) % 2 === 0) g.rect(L * 0.13 + i * size, (j + 0.5) * size, size, size);
      }
    }
  }
  // "unie" : pas de motif.
}
