// Porte d'entrée avec barrière levante (nord ou sud), placée sur la vraie
// barrière OpenStreetMap. Entité immobile du monde, donc un Vehicle : on
// n'appelle pas update(). La barrière est un état de scène : elle s'ouvre
// quand une voiture attend à la ligne d'arrêt, se referme quand plus aucune
// voiture n'est dessous. C'est ici que la place d'une voiture lui est attribuée.
class Gate extends Vehicle {
  constructor(key, label, x, y, approachDir, options = {}) {
    super(x, y);
    this.key = key;
    this.label = label;
    this.maxSpeed = 0;
    this.maxForce = 0;
    // Direction d'arrivée des voitures (vecteur unitaire).
    this.approach = approachDir.copy().normalize();
    this.pxPerMeter = options.pxPerMeter ?? 2;
    // Ligne d'arrêt 4 m avant la barrière, sur la voie de droite.
    const droite = createVector(-this.approach.y, this.approach.x);
    this.laneOffset = options.laneOffset ?? 3;
    this.stopLine = p5.Vector.sub(this.pos, this.approach.copy().mult(4 * this.pxPerMeter))
      .add(droite.copy().mult(this.laneOffset));
    // Ouverture de la barrière : 0 = fermée, 1 = levée. Vitesse par pas.
    this.opening = 0;
    this.openSpeed = options.openSpeed ?? 0.04;
    this.wantsOpen = false;
    this.clearRadius = 6 * this.pxPerMeter;
    this.passedCount = 0;
    // File d'attente devant la barrière, dans l'ordre d'arrivée (règle de
    // scène) : elle départage les voitures qui arrivent de branches différentes.
    this.queue = [];
  }

  joinQueue(car) {
    if (!this.queue.includes(car)) this.queue.push(car);
  }

  leaveQueue(car) {
    this.queue = this.queue.filter(c => c !== car);
  }

  predecessorOf(car) {
    const i = this.queue.indexOf(car);
    return i > 0 ? this.queue[i - 1] : null;
  }

  // Voitures qui ont priorité sur `car` : celles qui la précèdent dans la
  // file, et celles qui viennent de franchir la barrière (encore à moins de
  // `degagement` px). Elles peuvent venir d'une autre branche.
  prioritiesOver(car, cars, degagement) {
    const i = this.queue.indexOf(car);
    const devant = i > 0 ? this.queue.slice(0, i) : [];
    const sorties = cars.filter(c => c !== car && c.gateKey === this.key && c.state === "inside" &&
      p5.Vector.dist(c.pos, this.pos) < degagement);
    return [...devant, ...sorties];
  }

  isOpen() {
    return this.opening >= 1;
  }

  requestOpen() {
    this.wantsOpen = true;
  }

  // Règle de scène, un pas : la barrière monte si demandée, sinon redescend
  // quand aucune voiture n'est sous la barrière.
  tick(vehicles = []) {
    const dessous = vehicles.some(v => p5.Vector.dist(v.pos, this.pos) < this.clearRadius);
    if (this.wantsOpen || dessous) {
      this.opening = Math.min(1, this.opening + this.openSpeed);
    } else {
      this.opening = Math.max(0, this.opening - this.openSpeed);
    }
    this.wantsOpen = false;
  }

  show(zoom = 1) {
    push();
    translate(this.pos.x, this.pos.y);
    const cap = this.approach.heading();
    rotate(cap);
    // Poteau
    noStroke();
    fill(60);
    const largeur = 7 * this.pxPerMeter;
    rectMode(CENTER);
    rect(0, largeur / 2, 1.2 * this.pxPerMeter, 1.2 * this.pxPerMeter);
    // Bras rayé rouge et blanc : il pivote vers le haut (vue de dessus, il raccourcit).
    const longueur = largeur * (1 - 0.85 * this.opening);
    strokeCap(SQUARE);
    strokeWeight(0.5 * this.pxPerMeter);
    const segments = 6;
    for (let i = 0; i < segments; i++) {
      stroke(i % 2 ? 255 : color(220, 40, 40));
      const y0 = largeur / 2 - (i / segments) * longueur;
      const y1 = largeur / 2 - ((i + 1) / segments) * longueur;
      line(0, y0, 0, y1);
    }
    pop();
    // Étiquette à taille constante à l'écran.
    push();
    translate(this.pos.x, this.pos.y);
    scale(1 / zoom);
    stroke(255);
    strokeWeight(2);
    fill("#d84315");
    rectMode(CENTER);
    rect(0, -20, 18, 18, 3);
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(11);
    textStyle(BOLD);
    text(this.key === "nord" ? "N" : "S", 0, -19.5);
    textStyle(NORMAL);
    fill(30);
    stroke(255);
    strokeWeight(3);
    textAlign(LEFT, CENTER);
    text(this.label, 14, -20);
    pop();
  }
}
