// Tenues professionnelles des employés et dessin vu de dessus (épaules,
// bras, tête). Fonctions de rendu pures, sans steering.
const OUTFITS = [
  { key: "costume", label: "Costume-cravate", jacket: "#1e2838", shirt: "#f7f7f5", tie: "#8b1e2d" },
  { key: "costume-gris", label: "Costume gris et cravate", jacket: "#4a4f57", shirt: "#e9eef5", tie: "#1f3f73" },
  { key: "chemise-bleue", label: "Chemise bleue", jacket: null, shirt: "#7fa7d6", tie: null },
  { key: "chemise-blanche", label: "Chemise blanche et cravate", jacket: null, shirt: "#f4f4f2", tie: "#22324f" },
  { key: "tailleur", label: "Tailleur", jacket: "#2b2b33", shirt: "#f1e9e1", tie: null, longHair: true },
  { key: "tailleur-beige", label: "Tailleur beige", jacket: "#b9a283", shirt: "#ffffff", tie: null, longHair: true },
  { key: "veste", label: "Veste sans cravate", jacket: "#5a4a3a", shirt: "#dfe6ee", tie: null },
  { key: "chemise-rayee", label: "Chemise rayée", jacket: null, shirt: "#c9d8ea", tie: null, stripes: true }
];

const SKIN_TONES = ["#f1c9a5", "#e0ac83", "#c68b59", "#a8714a", "#8d5524"];
const HAIR_COLORS = ["#1b1b1b", "#3b2a1e", "#5a3d2b", "#8a6a4a", "#c9c9c9"];

// Employé centré sur l'origine, regard vers +x. r : demi-largeur des épaules (px).
// pose : { phase (marche), moving, coffee, highlight }
function drawEmployee(look, r, pose = {}) {
  const tenue = look.outfit;
  const balancement = pose.moving ? Math.sin(pose.phase) * r * 0.45 : 0;
  noStroke();
  // ombre
  fill(0, 0, 0, 55);
  ellipse(r * 0.15, r * 0.2, r * 1.5, r * 2.2);
  // bras (balancement opposé)
  fill(tenue.jacket ?? tenue.shirt);
  ellipse(balancement, -r * 0.95, r * 0.75, r * 0.42);
  ellipse(-balancement, r * 0.95, r * 0.75, r * 0.42);
  fill(look.skin);
  circle(balancement + r * 0.38, -r * 0.98, r * 0.32);
  circle(-balancement + r * 0.38, r * 0.98, r * 0.32);
  // épaules et torse
  fill(tenue.jacket ?? tenue.shirt);
  stroke(0, 0, 0, 90);
  strokeWeight(r * 0.06);
  ellipse(0, 0, r * 1.15, r * 2);
  noStroke();
  if (tenue.jacket) {
    // revers de la veste : chemise visible devant
    fill(tenue.shirt);
    triangle(r * 0.58, 0, r * 0.05, -r * 0.32, r * 0.05, r * 0.32);
  }
  if (tenue.stripes) {
    stroke(90, 120, 160, 160);
    strokeWeight(r * 0.07);
    for (const y of [-0.6, -0.2, 0.2, 0.6]) line(-r * 0.4, y * r, r * 0.4, y * r);
    noStroke();
  }
  if (tenue.tie) {
    stroke(tenue.tie);
    strokeWeight(r * 0.16);
    line(r * 0.12, 0, r * 0.55, 0);
    noStroke();
  }
  // tête et cheveux
  fill(look.skin);
  circle(r * 0.05, 0, r * 0.95);
  fill(look.hair);
  if (tenue.longHair) {
    ellipse(-r * 0.12, 0, r * 0.9, r * 1.05);
    circle(-r * 0.5, 0, r * 0.45); // chignon
  } else {
    arc(r * 0.05, 0, r * 0.95, r * 0.95, Math.PI * 0.55, Math.PI * 1.45);
  }
  // café à la main
  if (pose.coffee) {
    fill(255);
    stroke(120, 80, 40);
    strokeWeight(r * 0.06);
    circle(balancement + r * 0.6, -r * 1.05, r * 0.38);
    noStroke();
  }
  if (pose.highlight) {
    noFill();
    stroke(255, 213, 79);
    strokeWeight(r * 0.15);
    circle(0, 0, r * 3);
    noStroke();
  }
}
