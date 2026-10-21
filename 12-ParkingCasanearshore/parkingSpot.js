// Place de parking : entité immobile du monde, donc un Vehicle (consigne
// micbuffa), cible de l'arrive final des voitures. update() n'est jamais
// appelé. Les dimensions réelles (2,5 × 5 m) sont converties en pixels.
class ParkingSpot extends Vehicle {
  static KINDS = ["standard", "ev", "pmr"];

  constructor(x, y, angle, options = {}) {
    super(x, y);
    this.maxSpeed = 0;
    this.maxForce = 0;
    // Cap de la voiture garée (nez vers le fond de la place).
    this.angle = angle;
    this.facing = createVector(Math.cos(angle), Math.sin(angle));
    this.width = options.width ?? 5;     // px (2,5 m)
    this.length = options.length ?? 10;  // px (5 m)
    this.r = Math.hypot(this.width, this.length) / 2;
    this.kind = options.kind ?? "standard";
    this.level = options.level ?? 0;
    this.lot = options.lot ?? null;
    // Point de l'allée devant la place : la voiture y arrive avant d'entrer.
    this.aislePoint = options.aislePoint ? options.aislePoint.copy() : this.pos.copy();
    this.aisle = options.aisle ?? null;
    this.state = "free"; // free | reserved | occupied
    this.car = null;
    this.number = options.number ?? 0;
  }

  isFree() {
    return this.state === "free";
  }

  reserve(car) {
    if (this.state !== "free") return false;
    this.state = "reserved";
    this.car = car;
    return true;
  }

  occupy(car) {
    if (this.car !== car) return false;
    this.state = "occupied";
    return true;
  }

  release() {
    this.state = "free";
    this.car = null;
  }

  // Rectangle orienté au format de collisions.js.
  rectangle() {
    return { x: this.pos.x, y: this.pos.y, angle: this.angle, demiLongueur: this.length / 2, demiLargeur: this.width / 2 };
  }

  // Marquage au sol (statique) : dessiné une fois dans un calque `g`
  // (p5.Graphics), ou sur le canvas quand g vaut la fonction globale.
  drawMarking(g) {
    g.push();
    g.translate(this.pos.x, this.pos.y);
    g.rotate(this.angle);
    g.rectMode(CENTER);
    g.noFill();
    g.stroke(255, 255, 255, 220);
    g.strokeWeight(0.5);
    // Deux lignes latérales et le fond de la place.
    const l = this.length / 2;
    const w = this.width / 2;
    g.line(-l, -w, l, -w);
    g.line(-l, w, l, w);
    g.line(l, -w, l, w);
    g.noStroke();
    if (this.kind === "pmr" || this.kind === "ev") {
      g.fill(this.kind === "pmr" ? g.color(30, 110, 210, 200) : g.color(30, 170, 95, 200));
      g.rect(1, 0, this.length * 0.55, this.width * 0.8, 0.6);
      g.fill(255);
      g.textAlign(CENTER, CENTER);
      g.textSize(3.2);
      g.text(this.kind === "pmr" ? "♿" : "⚡", 1, 0.3);
    }
    g.pop();
  }

  // État variable (dessiné à chaque image) : pastille orange tant que la
  // place est réservée par une voiture en route.
  showState() {
    if (this.state !== "reserved") return;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    noStroke();
    fill(255, 152, 0);
    circle(this.length / 2 - 1.6, 0, 2.2);
    pop();
  }

  show() {
    this.drawMarking(globalThis);
    this.showState();
  }
}
