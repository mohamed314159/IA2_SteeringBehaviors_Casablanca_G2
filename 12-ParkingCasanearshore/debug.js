// Rendu de debug (touche D) : ne fait que LIRE les informations rangées par
// les comportements dans entite.debugInfo pendant le pas de simulation. Aucun
// comportement n'est recalculé ici (consigne : le debug ne relance pas le steering).

// Comportements mis en surbrillance avec les touches 1 à 8.
const COMPORTEMENTS_TOUCHES = {
  1: { nom: "Seek", test: e => e.behavior === "seek" || e.behavior === "neuro" },
  2: { nom: "Pursue / Evade", test: e => e.behavior === "pursue" || e.behavior === "evade" || Boolean(e.evadeState && e.evadeState.active) },
  3: { nom: "Arrive", test: e => e.behavior === "arrive" },
  4: { nom: "Wander", test: e => e.behavior === "wander" },
  5: { nom: "Path following", test: e => e.behavior === "path" },
  6: { nom: "Obstacle avoidance", test: e => Boolean(e.debugInfo && e.debugInfo.avoid && e.debugInfo.avoid.active) },
  7: { nom: "Boids", test: e => e.behavior === "boids" },
  8: { nom: "Leader following", test: e => e.behavior === "leader" }
};

const COULEURS_DEBUG = {
  seek: "#ff7043", pursue: "#ab47bc", arrive: "#29b6f6", wander: "#66bb6a",
  path: "#ffee58", boids: "#26a69a", leader: "#ec407a", idle: "#9e9e9e",
  file: "#f48fb1", evade: "#ff7043", neuro: "#ffa726"
};

function drawDebugOverlay(entites, zoom) {
  push();
  const trait = 1 / zoom;
  for (const e of entites) {
    const info = e.debugInfo || {};
    const couleur = COULEURS_DEBUG[e.behavior] ?? "#ffffff";
    noFill();
    strokeWeight(trait * 1.2);
    // Arrive : cible et rayon de freinage (pointillés).
    if (e.behavior === "arrive" && info.arriveTarget) {
      stroke(41, 182, 246, 200);
      drawingContext.setLineDash([4 * trait, 3 * trait]);
      circle(info.arriveTarget.x, info.arriveTarget.y, (info.slowRadius ?? e.rayonZoneDeFreinage) * 2);
      drawingContext.setLineDash([]);
      line(e.pos.x, e.pos.y, info.arriveTarget.x, info.arriveTarget.y);
    }
    // Suivi de chemin : position prédite, projection, cible sur le chemin.
    if (e.behavior === "path" && info.path) {
      stroke(255, 238, 88, 200);
      line(e.pos.x, e.pos.y, info.path.predictPos.x, info.path.predictPos.y);
      fill(info.path.onPath ? "#ffee58" : "#ff5252");
      noStroke();
      circle(info.path.target.x, info.path.target.y, 4 * trait);
      noFill();
    }
    // Évitement : vecteur ahead et point de surface le plus proche.
    if (info.avoid && info.avoid.ahead) {
      stroke(info.avoid.active ? color(255, 82, 82) : color(255, 255, 255, 60));
      line(e.pos.x, e.pos.y, info.avoid.ahead.x, info.avoid.ahead.y);
      if (info.avoid.active && info.avoid.surface) circle(info.avoid.surface.x, info.avoid.surface.y, 5 * trait);
    }
    // Évasion / poursuite : point prédit.
    if (e.evadeState && e.evadeState.active && info.evadePoint) {
      stroke(255, 112, 67);
      line(e.pos.x, e.pos.y, info.evadePoint.x, info.evadePoint.y);
      circle(info.evadePoint.x, info.evadePoint.y, 4 * trait);
    }
    if (e.behavior === "pursue" && info.pursuePoint) {
      stroke(171, 71, 188);
      line(e.pos.x, e.pos.y, info.pursuePoint.x, info.pursuePoint.y);
      circle(info.pursuePoint.x, info.pursuePoint.y, 5 * trait);
    }
    // Suivi de leader : place visée et zone interdite devant le guide.
    if (e.behavior === "leader" && info.leader) {
      stroke(236, 64, 122);
      circle(info.leader.place.x, info.leader.place.y, 3 * trait);
      stroke(236, 64, 122, 90);
      circle(info.leader.devant.x, info.leader.devant.y, e.leaderSightRadius * 2);
    }
    // File d'attente des voitures (A3) : point visé derrière le véhicule prioritaire.
    if (e.behavior === "file" && info.queueTarget) {
      stroke(236, 64, 122);
      line(e.pos.x, e.pos.y, info.queueTarget.x, info.queueTarget.y);
    }
    // Wander : cercle devant l'entité (lu depuis l'état, sans tirage aléatoire).
    if (e.behavior === "wander") {
      const centre = e.heading.copy().setMag(e.distanceCercle).add(e.pos);
      stroke(102, 187, 106, 160);
      circle(centre.x, centre.y, e.wanderRadius * 2);
      const a = e.wanderTheta + e.heading.heading();
      const cible = createVector(Math.cos(a), Math.sin(a)).mult(e.wanderRadius).add(centre);
      line(e.pos.x, e.pos.y, cible.x, cible.y);
    }
    // Nom du comportement actif, à taille constante à l'écran.
    push();
    translate(e.pos.x, e.pos.y);
    scale(trait);
    noStroke();
    fill(couleur);
    textSize(10);
    textAlign(CENTER, BOTTOM);
    text(e.behavior, 0, -8);
    pop();
  }
  pop();
}

// Surbrillance (touches 1 à 8) : un anneau autour des entités concernées.
function drawHighlight(entites, numero, zoom) {
  const choix = COMPORTEMENTS_TOUCHES[numero];
  if (!choix) return;
  push();
  noFill();
  stroke(255, 213, 79);
  strokeWeight(2.5 / zoom);
  for (const e of entites) {
    if (!choix.test(e)) continue;
    circle(e.pos.x, e.pos.y, Math.max(e.r * 3, 14 / zoom));
  }
  pop();
}
