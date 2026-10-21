// Jardinière (bac à arbuste) de l'esplanade : obstacle circulaire immobile
// (Vehicle, update() jamais appelé), contourné par les piétons avec avoid().
class Planter extends Vehicle {
  constructor(x, y, r = mPx(1.2)) {
    super(x, y);
    this.maxSpeed = 0;
    this.maxForce = 0;
    this.r = r;
  }

  show() {
    push();
    noStroke();
    fill(0, 0, 0, 55);
    circle(this.pos.x + 0.4, this.pos.y + 0.5, this.r * 2);
    fill(160, 150, 135);
    circle(this.pos.x, this.pos.y, this.r * 2);
    fill(70, 130, 60);
    circle(this.pos.x, this.pos.y, this.r * 1.5);
    fill(95, 160, 80);
    circle(this.pos.x - this.r * 0.2, this.pos.y - this.r * 0.2, this.r * 0.8);
    pop();
  }
}
