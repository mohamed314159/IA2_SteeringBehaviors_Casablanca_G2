// Voiture de F1 autonome : sous-classe de Vehicle.
// Perception : rayons capteurs (comme dans 9b). Steering : réseau de neurones
// (topologie : network-config.js, ou l'architecture choisie dans network.html,
// voir architecture.js ; ex. 6 → 20 → 2). Locomotion : Vehicle.update().
// Le nombre de rayons suit le cerveau (entrées - 1) : un modèle sauvegardé garde
// ses capteurs même si network-config.js change.
const START_SPEED_RATIO = 0.25;    // vitesse initiale = 25 % de maxSpeed
const STALL_FRAMES = 180;          // ~3 s sans progresser d'une longueur → éliminée
const TURN_MAX = 0.3;              // rotation max du cap désiré par image (rad)
const LAUNCH_FRAMES = 30;          // aide au démarrage (images)
const MAX_LAPS = 1;                // entraînement : jamais plus d'un tour (circuit terminé)

class Car extends Vehicle {
  // circuit : Circuit ; spec : résultat de createRandomCarSpec() ;
  // lateralOffset : décalage latéral au départ (px, + vers la droite) ;
  // brain : NeuralNetwork hérité (sinon cerveau aléatoire tiré avec rng) ;
  // generation : numéro de génération de la lignée.
  constructor(circuit, spec, lateralOffset = 0, brain = null, generation = 0, rng = Math.random) {
    const start = circuit.startPose(0);
    const nx = -Math.sin(start.heading);
    const ny = Math.cos(start.heading);
    super(start.x + nx * lateralOffset, start.y + ny * lateralOffset);
    this.circuit = circuit;
    this.spec = spec;
    this.startOffset = lateralOffset;
    // Confiance de la lignée (confidence.js) : vitesse max effective réduite.
    this.confidence = spec.confidence ?? 1;
    this.maxSpeed = spec.maxSpeed * this.confidence;
    this.maxForce = spec.maxForce;
    this.raceLaps = circuit.raceLaps ?? MAX_LAPS;
    this.length = circuit.carLength;
    this.width = circuit.carWidth;

    this.heading = start.heading;
    this.vel = p5.Vector.fromAngle(start.heading).mult(this.maxSpeed * START_SPEED_RATIO);

    this.brain = brain || NeuralNetwork.fromConfig(currentNetworkConfig(), rng);
    this.generation = generation;
    this.rayCount = this.brain.inputNodes - 1;
    this.rayFov = ((spec.rayFovDegrees ?? currentNetworkConfig().rayFovDegrees) * Math.PI) / 180;
    this.rays = [];
    for (let i = 0; i < this.rayCount; i++) this.rays.push(new Ray(start.heading));
    this.rayDistances = new Array(this.rayCount).fill(this.sightDistance);

    this.lap = new LapTracker(circuit, this.pos);
    this.dead = false;
    this.finished = false;
    this.framesAlive = 0;
    this.bestProgress = 0;
    this.framesSinceProgress = 0;
  }

  // Longueur des rayons : réglage commun du menu (sensor-settings.js), lu à
  // chaque image pour qu'un changement agisse immédiatement.
  get sightDistance() {
    return currentRayLength();
  }

  // Angle absolu du rayon i, réparti symétriquement autour du cap
  // (un rayon unique regarde droit devant).
  rayAngle(i) {
    if (this.rayCount === 1) return this.heading;
    return this.heading - this.rayFov / 2 + (i * this.rayFov) / (this.rayCount - 1);
  }

  // Lance les rayons contre les murs proches. Retourne les entrées du
  // réseau (proximité 1 = mur collé, 0 = rien en vue, puis vitesse normalisée).
  sense(extraWalls = []) {
    const walls = this.circuit.wallsNear(this.pos, this.sightDistance).concat(extraWalls);
    const inputs = [];
    for (let i = 0; i < this.rayCount; i++) {
      const ray = this.rays[i];
      ray.setPos(this.pos.x, this.pos.y);
      ray.setDir(this.rayAngle(i));
      this.rayDistances[i] = ray.castAll(walls, this.sightDistance);
      inputs.push(1 - this.rayDistances[i] / this.sightDistance);
    }
    inputs.push(this.vel.mag() / this.maxSpeed);
    return inputs;
  }

    // Steering décidé par le réseau (comme 9b) : sortie 0 → rotation du cap
  // désiré dans [-TURN_MAX, +TURN_MAX] rad, sortie 1 → vitesse désirée dans
  // [0, maxSpeed]. steering = vitesse désirée - vitesse, borné par maxForce.
  think(inputs) {
    const [turnOut, thrustOut] = this.brain.predict(inputs);
    const turn = (turnOut * 2 - 1) * TURN_MAX;
    let thrust = thrustOut * this.maxSpeed;
    // Aide au démarrage (9b) : la première demi-seconde, on pousse au moins à moitié.
    if (this.framesAlive < LAUNCH_FRAMES) thrust = Math.max(thrust, this.maxSpeed * 0.5);
    const desired = p5.Vector.fromAngle(this.heading + turn).mult(thrust);
    const steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  // Un pas complet : perception, steering, locomotion, règles de course.
  // extraWalls : murs supplémentaires vus par les rayons (côtés des obstacles) ;
  // obstacles : entités Obstacle qui éliminent la voiture au contact.
  drive(extraWalls = [], obstacles = []) {
    if (!this.racing) return;
    this.applyForce(this.think(this.sense(extraWalls)));
    this.update();
    this.crashIntoObstacles(obstacles);
  }

  // Règle de scène : contact avec un obstacle (centre à moins d'une demi-largeur
  // du polygone, ou à l'intérieur) → voiture éliminée.
  crashIntoObstacles(obstacles) {
    if (!this.racing) return;
    if (obstacles.some((obstacle) => obstacle.collides(this.pos, this.width / 2))) this.dead = true;
  }

  // En course = ni éliminée ni arrivée.
  get racing() {
    return !this.dead && !this.finished;
  }

  update() {
    if (!this.racing) return;
    super.update();
    if (this.vel.magSq() > 1e-6) this.heading = this.vel.heading();
    this.framesAlive++;
    this.lap.update(this.pos);
    this.applyRaceRules();
  }

  // Règles de scène : sortie de piste, absence de progression.
  applyRaceRules() {
    if (this.lap.offset > this.circuit.trackWidth / 2 - this.width / 2) {
      this.dead = true;
      return;
    }
    if (this.lap.progress >= this.raceLaps) {
      this.finished = true;
      return;
    }
    const progressPx = this.lap.distance;
    if (progressPx > this.bestProgress + this.length) {
      this.bestProgress = progressPx;
      this.framesSinceProgress = 0;
    } else if (++this.framesSinceProgress > STALL_FRAMES) {
      this.dead = true;
    }
  }

  get progress() {
    return this.lap.progress;
  }

  get secondsAlive() {
    return this.framesAlive / 60;
  }

  // Vitesse réelle équivalente (km/h) selon l'échelle F1 du circuit, à 60 images/s.
  get speedKmh() {
    return (this.vel.mag() / this.circuit.pixelsPerMeter) * 60 * 3.6;
  }

  show(showRays = false) {
    if (showRays && this.racing) this.showRays();
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading);
    drawCarDesign(p5.instance, this.spec, this.length, this.width, { dead: this.dead });
    pop();
  }

  // Légende affichée sous la voiture (ex. statut d'entraînement).
  showCaption(caption) {
    push();
    textAlign(CENTER, TOP);
    textSize(11);
    stroke(0);
    strokeWeight(3);
    fill(255, 230, 0);
    text(caption, this.pos.x, this.pos.y + this.length * 0.7 + 4);
    pop();
  }

  showRays() {
    push();
    stroke(255, 230, 0, 110);
    strokeWeight(0.8);
    for (let i = 0; i < this.rayCount; i++) {
      const angle = this.rayAngle(i);
      const d = this.rayDistances[i];
      line(this.pos.x, this.pos.y, this.pos.x + Math.cos(angle) * d, this.pos.y + Math.sin(angle) * d);
    }
    pop();
  }
}
