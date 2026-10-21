// Kiosque à café de l'esplanade : entité immobile du monde (un Vehicle dont
// on n'appelle pas update()). Obstacle pour les piétons et destination de
// ceux qui vont chercher un café (point de comptoir).
class CoffeeKiosk extends Vehicle {
  constructor(x, y, options = {}) {
    super(x, y);
    this.maxSpeed = 0;
    this.maxForce = 0;
    this.r = options.r ?? mPx(2);
    this.angle = options.angle ?? 0;
    // Comptoir : devant le kiosque, côté ouverture.
    this.counter = createVector(Math.cos(this.angle), Math.sin(this.angle)).mult(this.r + mPx(1)).add(this.pos);
    this.name = options.name ?? "Kiosque";
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    noStroke();
    fill(0, 0, 0, 60);
    rect(-this.r + 0.5, -this.r + 0.6, this.r * 2, this.r * 2, 0.6);
    fill(111, 78, 55);
    rect(-this.r, -this.r, this.r * 2, this.r * 2, 0.6);
    // auvent rayé
    for (let i = 0; i < 4; i++) {
      fill(i % 2 ? 245 : color(176, 42, 48));
      rect(this.r - 1.2, -this.r + (i * this.r) / 2, 1.2, this.r / 2);
    }
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(this.r * 0.9);
    text("☕", -0.4, 0.2);
    pop();
  }
}
