// Seconde caisse du tram : même mécanisme que les anneaux du serpent de
// 1-Seek (snakeRing.js) et 5-3 (snakeSegment.js) : elle fait un arrive sur la
// caisse précédente avec une distance d'arrêt égale à l'espacement voulu.
// Dans les courbes, elle suit donc la tête en « serpent ».
class TramCar extends SteeringAgent {
  constructor(x, y, predecessor, options = {}) {
    super(x, y);
    this.predecessor = predecessor;
    this.length = options.length ?? mPx(16);
    this.widthPx = options.width ?? mPx(2.65);
    this.r = this.length / 2;
    this.gap = options.gap ?? mPx(0.8);
    this.maxSpeed = options.maxSpeed ?? kmh(60);
    this.maxForce = options.maxForce ?? 0.6;
    this.rayonZoneDeFreinage = options.braking ?? mPx(20);
    this.heading = predecessor.heading.copy();
    this.resting = false;
    this.doorOpening = 0;
  }

  // Espacement entre les centres des deux caisses.
  spacing() {
    return this.predecessor.length / 2 + this.length / 2 + this.gap;
  }

  // Comme SnakeRing.follow / arrive : au repos quand l'écart est atteint
  // (seuil avec hystérésis), sinon arrive sur la caisse précédente.
  followPredecessor() {
    const ecart = Math.abs(p5.Vector.dist(this.pos, this.predecessor.pos) - this.spacing());
    this.resting = ecart <= (this.resting ? 1.2 : 0.6) && this.predecessor.vel.mag() < 0.01;
    if (this.resting) return this.brake();
    return super.arrive(this.predecessor.pos, this.spacing());
  }

  // Un pas : force de suivi puis intégration héritée (une fois).
  stepFollow() {
    this.setBehavior("leader");
    this.steer([{ name: "leader", force: this.followPredecessor() }]);
    this.update();
    // La caisse regarde toujours vers la caisse précédente (attelage).
    const versAvant = p5.Vector.sub(this.predecessor.pos, this.pos);
    if (versAvant.magSq() > 1e-6) this.heading = versAvant.normalize();
  }

  show() {
    drawTramBody(this, false);
  }
}

// Dessin d'une caisse de tram vue de dessus (blanc, bande orange, portes).
function drawTramBody(caisse, estTete) {
  const L = caisse.length;
  const W = caisse.widthPx;
  push();
  translate(caisse.pos.x, caisse.pos.y);
  rotate(caisse.heading.heading());
  scale(caisse.sizeScale ?? (caisse.sizeFactor ? caisse.sizeFactor() : 1));
  noStroke();
  fill(0, 0, 0, 70);
  rect(-L / 2 + 0.5, -W / 2 + 0.7, L, W, 1.5);
  fill(246, 248, 250);
  stroke(0, 0, 0, 150);
  strokeWeight(0.15);
  // Avant arrondi pour la tête (rayons : haut-gauche, haut-droit, bas-droit, bas-gauche).
  if (estTete) rect(-L / 2, -W / 2, L, W, 0.6, 2.4, 2.4, 0.6);
  else rect(-L / 2, -W / 2, L, W, 1);
  noStroke();
  // Toit : équipements et bande orange
  fill(227, 93, 28);
  rect(-L / 2 + 1, -0.35, L - 2.5, 0.7);
  fill(90, 105, 120);
  rect(-L * 0.2, -W / 2 + 0.6, L * 0.25, W - 1.2, 0.3);
  if (estTete) {
    fill(140, 180, 215);
    rect(L / 2 - 1.5, -W / 2 + 0.4, 1.1, W - 0.8, 0.6);
    fill(255, 248, 210);
    rect(L / 2 - 0.4, -W / 2 + 0.3, 0.4, 0.6);
    rect(L / 2 - 0.4, W / 2 - 0.9, 0.4, 0.6);
    fill(50);
    textAlign(CENTER, CENTER);
    textSize(2.2);
    textStyle(BOLD);
    text("TRAM", -L * 0.38, 0.2);
    textStyle(NORMAL);
  }
  // Portes des deux côtés (elles s'écartent quand elles s'ouvrent)
  fill(70);
  const ouverture = caisse.doorOpening * 1.2;
  for (const x of [-L * 0.3, L * 0.15]) {
    rect(x - ouverture, -W / 2 - 0.05, 1.4, 0.3);
    rect(x + 1.4 + ouverture, -W / 2 - 0.05, 1.4, 0.3);
    rect(x - ouverture, W / 2 - 0.25, 1.4, 0.3);
    rect(x + 1.4 + ouverture, W / 2 - 0.25, 1.4, 0.3);
  }
  pop();
}
