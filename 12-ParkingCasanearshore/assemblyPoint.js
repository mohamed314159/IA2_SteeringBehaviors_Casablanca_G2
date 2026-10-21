// Point de rassemblement (sécurité incendie) : panneau vert sur une pelouse.
// Entité immobile du monde, donc un Vehicle dont on n'appelle pas update().
class AssemblyPoint extends Vehicle {
  constructor(x, y, numero = 1) {
    super(x, y);
    this.maxSpeed = 0;
    this.maxForce = 0;
    this.r = mPx(1.2);
    this.numero = numero;
  }

  show(zoom = 1) {
    push();
    translate(this.pos.x, this.pos.y);
    noStroke();
    // Zone de regroupement marquée au sol
    fill(46, 160, 67, 40);
    circle(0, 0, mPx(10));
    // Panneau vu du dessus : carré vert avec quatre personnes stylisées
    fill(0, 0, 0, 70);
    rect(-this.r + 0.3, -this.r + 0.4, this.r * 2, this.r * 2, 0.3);
    fill(46, 160, 67);
    rect(-this.r, -this.r, this.r * 2, this.r * 2, 0.3);
    fill(255);
    for (const [dx, dy] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) circle(dx, dy, 0.6);
    circle(0, 0, 0.7);
    pop();
  }
}
