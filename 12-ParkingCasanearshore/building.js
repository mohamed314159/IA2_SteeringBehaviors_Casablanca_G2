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

  // Hauteur estimée (m) : sert à la longueur de l'ombre portée.
  heightM() {
    if (this.usage === "chantier") return 4;
    if (this.usage === "restaurant") return 5;
    if (this.name === "Ibis") return 30;
    return 18;
  }

  // Générateur déterministe propre au bâtiment (même décor à chaque chargement).
  rng() {
    let h = 2166136261;
    for (const c of String(this.id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    return createRng(h >>> 0);
  }

  // Ombre portée (soleil du matin à l'est-sud-est : ombre vers l'ouest-nord-ouest).
  drawShadow(g) {
    const longueur = mPx(this.heightM()) * 0.8;
    const d = createVector(-0.94, -0.34).mult(longueur);
    g.noStroke();
    g.fill(0, 0, 0, 55);
    for (let k = 1; k <= 4; k++) {
      g.beginShape();
      for (const p of this.points) g.vertex(p.x + (d.x * k) / 4, p.y + (d.y * k) / 4);
      g.endShape(CLOSE);
    }
  }

  // Toit vu de dessus, dessiné une fois dans le calque du décor.
  drawRoof(g) {
    const contour = (ctx, retrait = 0) => {
      ctx.beginShape();
      for (const p of this.points) ctx.vertex(lerp(p.x, this.center.x, retrait), lerp(p.y, this.center.y, retrait));
      ctx.endShape(CLOSE);
    };
    const r = this.rng();
    const couleurs = { chantier: [168, 140, 105], restaurant: [196, 120, 80] };
    const [cr, cg, cb] = couleurs[this.usage] ?? [204, 205, 200];
    g.stroke(110, 112, 110);
    g.strokeWeight(0.6);
    g.fill(cr, cg, cb);
    contour(g);
    if (this.usage === "chantier") return this.drawConstruction(g, r);
    // Acrotère : liseré clair à l'intérieur du contour.
    g.noFill();
    g.stroke(235, 236, 232);
    g.strokeWeight(1.2);
    contour(g, 0.04);
    // Remplissage du toit, découpé à l'intérieur du contour (clip).
    const c = g.drawingContext;
    c.save();
    c.beginPath();
    this.points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.clip();
    const xs = this.points.map(p => p.x);
    const ys = this.points.map(p => p.y);
    const x0 = Math.min(...xs);
    const y0 = Math.min(...ys);
    const x1 = Math.max(...xs);
    const y1 = Math.max(...ys);
    g.noStroke();
    if (this.roof === "solaire") {
      // Rangées de panneaux photovoltaïques (bleu nuit) avec allées techniques.
      for (let y = y0 + mPx(3); y < y1 - mPx(3); y += mPx(3.2)) {
        for (let x = x0 + mPx(3); x < x1 - mPx(3); x += mPx(2.1)) {
          if (!this.contains(createVector(x + mPx(1), y + mPx(0.9)))) continue;
          g.fill(32, 52, 92);
          g.rect(x, y, mPx(1.9), mPx(1.8));
          g.fill(70, 100, 150, 120);
          g.rect(x, y, mPx(1.9), mPx(0.4));
        }
      }
    } else if (this.roof === "patios") {
      // Patios plantés (Shore 12) répartis dans l'ovale.
      for (let y = y0 + mPx(12); y < y1 - mPx(8); y += mPx(16)) {
        for (let x = x0 + mPx(12); x < x1 - mPx(8); x += mPx(18)) {
          if (!this.contains(createVector(x, y))) continue;
          g.fill(70, 80, 72);
          g.rect(x - mPx(4), y - mPx(4), mPx(8), mPx(8));
          g.fill(86, 130, 70);
          g.circle(x, y, mPx(5));
        }
      }
    } else if (this.roof === "courbe") {
      // Lanterneaux le long du toit courbe (Shore 2).
      for (let k = 0; k < 9; k++) {
        const t = (k + 0.5) / 9;
        const i = Math.floor(t * (this.points.length / 2 - 1));
        const a = this.points[i];
        const b = this.points[this.points.length - 1 - i];
        const m = p5.Vector.lerp(a, b, 0.5);
        g.fill(150, 165, 175);
        g.ellipse(m.x, m.y, mPx(4), mPx(2.2));
      }
    }
    // Équipements techniques (climatisation, cage d'escalier) en position tirée.
    for (let k = 0; k < 3 + Math.floor(r() * 5); k++) {
      const x = x0 + (0.15 + 0.7 * r()) * (x1 - x0);
      const y = y0 + (0.15 + 0.7 * r()) * (y1 - y0);
      if (!this.contains(createVector(x, y))) continue;
      const lw = mPx(1.5 + r() * 3);
      const lh = mPx(1.5 + r() * 2.5);
      g.fill(0, 0, 0, 50);
      g.rect(x - mPx(0.8), y - mPx(0.3), lw, lh);
      g.fill(168, 170, 168);
      g.rect(x, y, lw, lh);
      g.fill(120, 122, 122);
      g.circle(x + lw / 2, y + lh / 2, Math.min(lw, lh) * 0.5);
    }
    if (this.name === "Ibis") {
      g.fill(196, 30, 58);
      g.rect(this.center.x - mPx(2.5), this.center.y - mPx(1), mPx(5), mPx(2), 2);
    }
    c.restore();
  }

  // Chantier : dalles de béton, ferraillage, grue.
  drawConstruction(g, r) {
    const c = g.drawingContext;
    c.save();
    c.beginPath();
    this.points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.clip();
    const xs = this.points.map(p => p.x);
    const ys = this.points.map(p => p.y);
    g.noStroke();
    for (let k = 0; k < 14; k++) {
      const x = Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs) - mPx(18));
      const y = Math.min(...ys) + r() * (Math.max(...ys) - Math.min(...ys) - mPx(12));
      g.fill(150 + r() * 30, 150 + r() * 25, 145 + r() * 20);
      g.rect(x, y, mPx(10 + r() * 14), mPx(8 + r() * 8));
      g.stroke(90, 70, 50, 120);
      g.strokeWeight(0.3);
      for (let k2 = 0; k2 < 6; k2++) g.line(x + k2 * mPx(2), y, x + k2 * mPx(2), y + mPx(8));
      g.noStroke();
    }
    c.restore();
    // Grue : mât et flèche.
    const pied = createVector(Math.min(...xs) + mPx(25), Math.min(...ys) + mPx(20));
    g.stroke(240, 190, 30);
    g.strokeWeight(mPx(0.9));
    g.line(pied.x, pied.y, pied.x + mPx(50), pied.y + mPx(14));
    g.line(pied.x, pied.y, pied.x - mPx(12), pied.y - mPx(3));
    g.noStroke();
    g.fill(240, 190, 30);
    g.rect(pied.x - mPx(1.5), pied.y - mPx(1.5), mPx(3), mPx(3));
    g.fill(80);
    g.rect(pied.x - mPx(14), pied.y - mPx(5), mPx(3), mPx(3));
  }

  // Porte vitrée sur la façade (1,6 m de large), face au point d'arrivée.
  drawDoor(g) {
    if (this.usage === "chantier") return;
    const facade = this.closestPoint(this.door);
    g.push();
    g.translate(facade.x, facade.y);
    g.rotate(this.doorNormal.heading());
    g.noStroke();
    g.rectMode(CENTER);
    g.fill("#ffcc80");
    g.rect(0, 0, 1.2, 3.4);
    g.fill(120, 170, 210);
    g.rect(0.25, 0, 0.6, 2.8);
    g.pop();
  }

  // Le toit est dans le calque du décor : à chaque image, seulement le
  // contour de mise en évidence s'il est demandé.
  show() {
    if (!this.highlight) return;
    push();
    noFill();
    stroke("#ffd54f");
    strokeWeight(3);
    beginShape();
    for (const p of this.points) vertex(p.x, p.y);
    endShape(CLOSE);
    pop();
  }

  showLabel(zoom) {
    if (!this.name || this.labelHidden) return;
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
