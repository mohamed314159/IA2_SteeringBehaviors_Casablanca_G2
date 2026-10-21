// Obstacle dessiné comme un amas de feuilles de chêne façon Minecraft.
// Seul le rendu change : la position et le rayon r restent ceux de la
// classe Obstacle, donc l'évitement des boids est inchangé.
// L'obstacle invisible sert pour la souris : il agit sur les perroquets
// mais ne se dessine qu'en mode debug.

class ObstacleMinecraft extends Obstacle {
  static COULEURS_FEUILLES = ['#3f7d22', '#4f9a2b', '#356b1c', '#5aa834'];

  constructor(x, y, r, invisible = false) {
    super(x, y, r, '#4f9a2b');
    this.invisible = invisible;
    // Motif de feuilles tiré une fois pour toutes (pas de hasard dans draw).
    this.motif = [];
    const cases = 6;
    for (let i = 0; i < cases * cases; i++) this.motif.push(Math.floor(random(0, 4)));
  }

  show() {
    if (this.invisible) {
      if (Boid.debug) super.show();
      return;
    }

    const cases = 6;
    const cote = (this.r * 2) / cases;
    const x0 = this.pos.x - this.r;
    const y0 = this.pos.y - this.r;

    push();
    noStroke();
    for (let ligne = 0; ligne < cases; ligne++) {
      for (let col = 0; col < cases; col++) {
        // On arrondit le carré pour que la silhouette suive le cercle de collision.
        const cx = x0 + (col + 0.5) * cote;
        const cy = y0 + (ligne + 0.5) * cote;
        if (dist(cx, cy, this.pos.x, this.pos.y) > this.r) continue;
        const teinte = this.motif[ligne * cases + col];
        fill(ObstacleMinecraft.COULEURS_FEUILLES[teinte]);
        rect(x0 + col * cote, y0 + ligne * cote, cote + 0.4, cote + 0.4);
      }
    }
    pop();
  }
}
