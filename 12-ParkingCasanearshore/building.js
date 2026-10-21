// Bâtiment du parc Casanearshore (contour réel OpenStreetMap).
// C'est une entité du monde, donc un Vehicle (consigne micbuffa), mais
// immobile : on n'appelle jamais update(). Il sert d'obstacle polygonal
// (closestPoint / contains, utilisés par SteeringAgent.avoid) et de
// destination (sa porte) pour les employés.
class Building extends Vehicle {
  constructor(id, points, name = "") {
    const contour = points.map(([x, y]) => createVector(x, y));
    const centre = polygonCentroid(contour);
    super(centre.x, centre.y);
    this.id = id;
    this.name = name;
    this.points = contour;
    this.center = centre.copy();
    this.maxSpeed = 0;
    this.maxForce = 0;
    // Rayon englobant : distance du centre au sommet le plus éloigné.
    this.r = Math.max(...contour.map(p => p5.Vector.dist(p, centre)));
    this.area = polygonArea(contour);
    // Porte : point devant la façade, où les employés arrivent.
    this.door = centre.copy();
    this.doorNormal = createVector(0, 1);
    this.highlight = false;
  }

  closestPoint(p) {
    return closestPointOnPolygon(p, this.points);
  }

  contains(p) {
    return pointInPolygon(p, this.points);
  }

  // Place la porte sur la façade la plus proche de `versPoint`, décalée de
  // `recul` px vers l'extérieur.
  placeDoor(versPoint, recul) {
    const facade = this.closestPoint(versPoint);
    let normale = p5.Vector.sub(versPoint, facade);
    if (normale.magSq() < 1e-9) normale = p5.Vector.sub(facade, this.center);
    normale.normalize();
    this.doorNormal = normale.copy();
    this.door = normale.mult(recul).add(facade);
  }

  show() {
    push();
    stroke(this.highlight ? "#ffd54f" : "#1b3358");
    strokeWeight(this.highlight ? 3 : 1.2);
    fill("#4f7fc4");
    beginShape();
    for (const p of this.points) vertex(p.x, p.y);
    endShape(CLOSE);
    // Toit : contour intérieur plus clair (effet de volume vu de dessus).
    noFill();
    stroke(255, 255, 255, 70);
    strokeWeight(2);
    beginShape();
    for (const p of this.points) vertex(lerp(p.x, this.center.x, 0.12), lerp(p.y, this.center.y, 0.12));
    endShape(CLOSE);
    // Porte vitrée sur la façade (1,6 m de large), face au point d'arrivée.
    const facade = this.closestPoint(this.door);
    translate(facade.x, facade.y);
    rotate(this.doorNormal.heading());
    noStroke();
    fill("#ffcc80");
    rectMode(CENTER);
    rect(0, 0, 1.2, 3.2);
    fill(120, 170, 210);
    rect(0.2, 0, 0.5, 2.6);
    pop();
  }

  showLabel(zoom) {
    if (!this.name) return;
    push();
    translate(this.center.x, this.center.y);
    scale(1 / zoom);
    textAlign(CENTER, CENTER);
    textSize(12);
    stroke(20, 35, 60);
    strokeWeight(3);
    fill(255);
    text(this.name, 0, 0);
    pop();
  }
}
