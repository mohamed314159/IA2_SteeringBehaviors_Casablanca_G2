// Halos (rendu uniquement, aucun effet sur la simulation) : les couleurs
// claires de la carte (pavés, herbe au soleil) « avalent » les voitures
// blanches ou grises. Un liseré clair entouré d'une ombre floue sombre les
// détache sur tous les fonds ; un disque clair fait de même pour les petits
// agents (piétons, animaux) sur le fond noir du mode « véhicules seuls ».
// Les épaisseurs sont constantes à l'écran (divisées par le zoom).

// Halo d'un véhicule centré sur l'origine, regard vers +x. L, W : longueur et
// largeur (px du monde) ; zoom : échelle écran ; intensite : 0 (aucun) à 2.
function drawVehicleGlow(L, W, zoom, intensite = 1) {
  if (!(intensite > 0) || !(zoom > 0)) return;
  const ctx = drawingContext;
  const trait = 1 / zoom;
  push();
  noFill();
  rectMode(CENTER);
  // Liseré clair avec une ombre floue sombre (le flou est en pixels écran).
  ctx.shadowColor = `rgba(0, 0, 0, ${Math.min(0.9, 0.55 * intensite)})`;
  ctx.shadowBlur = 7 * intensite;
  stroke(255, 255, 255, Math.min(255, 210 * intensite));
  strokeWeight(2 * trait * Math.min(1.5, intensite));
  rect(0, 0, L + 3 * trait, W + 3 * trait, W * 0.35);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  // Contour sombre fin contre la carrosserie (lisible sur un fond clair).
  stroke(15, 20, 28, Math.min(255, 220 * intensite));
  strokeWeight(trait);
  rect(0, 0, L + 1.2 * trait, W + 1.2 * trait, W * 0.3);
  pop();
}

// Halo d'un petit agent de rayon r (px du monde), au moins 5 px à l'écran.
function drawAgentHalo(r, zoom, intensite = 1) {
  if (!(intensite > 0) || !(zoom > 0)) return;
  const rayon = Math.max(r * 1.8, 5 / zoom);
  push();
  fill(255, 255, 255, Math.min(255, 45 * intensite));
  stroke(255, 255, 255, Math.min(255, 170 * intensite));
  strokeWeight(1 / zoom);
  circle(0, 0, rayon * 2);
  pop();
}
