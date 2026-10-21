// Poteau du garage souterrain : obstacle circulaire immobile (un Vehicle,
// update() jamais appelé). Les voitures et les piétons l'évitent avec avoid().
class Pillar extends Vehicle {
  constructor(x, y, r) {
    super(x, y);
    this.r = r;
    this.maxSpeed = 0;
    this.maxForce = 0;
  }

  show() {
    push();
    noStroke();
    fill(0, 0, 0, 60);
    rectMode(CENTER);
    rect(this.pos.x + 0.6, this.pos.y + 0.6, this.r * 2, this.r * 2);
    fill(150, 150, 145);
    stroke(90);
    strokeWeight(0.4);
    rect(this.pos.x, this.pos.y, this.r * 2, this.r * 2);
    pop();
  }
}
