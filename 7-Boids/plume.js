// Plume : particule décorative qui s'éparpille quand un perroquet meurt.
// Ce n'est pas un véhicule : pas de steering, seulement une petite
// physique de décor (gravité faible, frottement de l'air, balancement).

class Plume {
  static GRAVITE = 0.035;
  static FROTTEMENT = 0.965;
  // Nombre maximal de plumes en même temps dans la scène.
  static MAX_PLUMES = 400;

  constructor(x, y, couleur, alea = Math.random, echelle = 1) {
    this.pos = createVector(x, y);
    const angle = alea() * Math.PI * 2;
    const vitesse = 0.8 + alea() * 2.6;
    // Légère poussée vers le haut pour un effet "explosion de plumes".
    this.vel = createVector(Math.cos(angle) * vitesse, Math.sin(angle) * vitesse - 1.2);
    this.couleur = couleur;
    this.angle = alea() * Math.PI * 2;
    this.rotation = (alea() - 0.5) * 0.2;
    this.phase = alea() * Math.PI * 2;
    // Demi-longueur de la plume en px, proportionnelle à la taille du perroquet.
    this.taille = (4 + alea() * 4) * echelle;
    this.dureeVie = Math.floor(90 + alea() * 70);
    this.age = 0;
  }

  // Crée une gerbe de plumes aux couleurs du perroquet.
  // echelle : 1 pour un perroquet de 30 px, plus pour un plus gros.
  static eclater(x, y, couleurs, nombre = 14, alea = Math.random, echelle = 1) {
    const plumes = [];
    for (let i = 0; i < nombre; i++) {
      plumes.push(new Plume(x, y, couleurs[i % couleurs.length], alea, echelle));
    }
    return plumes;
  }

  update() {
    this.vel.mult(Plume.FROTTEMENT);
    this.vel.y += Plume.GRAVITE;
    this.pos.add(this.vel);
    // Balancement de feuille morte, plus visible quand la plume ralentit.
    this.pos.x += Math.sin(this.age * 0.12 + this.phase) * 0.35;
    this.angle += this.rotation;
    this.age++;
  }

  estMorte() {
    return this.age >= this.dureeVie;
  }

  opacite() {
    const restant = 1 - this.age / this.dureeVie;
    return 255 * Math.max(0, Math.min(1, restant * 2));
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    noStroke();
    const c = color(this.couleur);
    c.setAlpha(this.opacite());
    fill(c);
    // Plume en pixels : une tige claire et deux barbes.
    const t = this.taille;
    rect(-t, -t * 0.3, t * 2, t * 0.6);
    rect(-t * 0.5, -t * 0.6, t * 1.2, t * 0.3);
    fill(255, 255, 255, this.opacite() * 0.5);
    rect(-t, -t * 0.08, t * 2, t * 0.16);
    pop();
  }
}
