// Banc de l'esplanade : obstacle immobile (Vehicle, update() jamais appelé).
class Bench extends Vehicle {
  constructor(x, y, angle = 0) {
    super(x, y);
    this.maxSpeed = 0;
    this.maxForce = 0;
    this.angle = angle;
    this.r = mPx(1);
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    noStroke();
    fill(0, 0, 0, 50);
    rect(-this.r + 0.3, -0.5, this.r * 2, 1.4, 0.3);
    fill(150, 105, 60);
    rect(-this.r, -0.7, this.r * 2, 1.4, 0.3);
    stroke(110, 75, 40);
    strokeWeight(0.15);
    for (const y of [-0.3, 0.1, 0.5]) line(-this.r + 0.2, y, this.r - 0.2, y);
    pop();
  }
}
