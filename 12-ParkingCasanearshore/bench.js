// Banc à deux places : obstacle immobile (Vehicle, update() jamais appelé),
// et destination des employés qui s'y assoient avant 8h55.
class Bench extends Vehicle {
  constructor(x, y, angle = 0) {
    super(x, y);
    this.maxSpeed = 0;
    this.maxForce = 0;
    this.angle = angle;
    this.r = mPx(1);
    // On s'assoit face à l'avant du banc.
    this.facing = createVector(Math.cos(angle + Math.PI / 2), Math.sin(angle + Math.PI / 2));
    const le_long = createVector(Math.cos(angle), Math.sin(angle));
    this.seats = [-1, 1].map(s => ({
      pos: le_long.copy().mult(mPx(0.5) * s).add(this.facing.copy().mult(mPx(0.15))).add(this.pos),
      occupant: null
    }));
  }

  freeSeat() {
    return this.seats.find(s => s.occupant === null) ?? null;
  }

  release(employe) {
    for (const s of this.seats) if (s.occupant === employe) s.occupant = null;
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
