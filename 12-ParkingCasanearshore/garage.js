// Garage souterrain (niveau -1) sous un bâtiment du parc.
// OpenStreetMap ne décrit pas les sous-sols : le plan est construit avec les
// dimensions usuelles (places 2,5 × 5 m, allées de 6 m, rampe de 3 m à 15 %).
// Le plan est placé dans une zone à part du monde (à droite de la carte) : la
// vue « Voir le garage » y déplace la caméra. Les entités du garage utilisent
// exactement les mêmes comportements que celles de la surface.
//
//   rampe (descente) ─┐
//                     ▼ borne badge
//   ┌─ allée de liaison ─┬──────── places ────────┐
//   │                    ├──────── allée ─────────┤
//   │                    ├──────── places ────────┤  ■ poteaux
//   │   ...              │                        │
//   └── ascenseur 🛗 ────┴────────────────────────┘
const GARAGE_PLAN = {
  widthM: 72,
  heightM: 54,
  spineWidthM: 7,   // allée de liaison le long du mur gauche
  rampLengthM: 30,
  rampWidthM: 3,
  rampSlope: 0.15,  // 15 % : vitesse réduite sur la rampe
  pillarSizeM: 0.5,  // poteau de 50 cm, entre deux voitures au fond des places
  pillarEverySpots: 3
};

class Garage {
  constructor(building, surfaceEntrance, origin, pxPerMeter, plan = GARAGE_PLAN) {
    this.building = building;
    this.plan = plan;
    this.px = m => m * pxPerMeter;
    this.pxPerMeter = pxPerMeter;
    this.level = -1;
    this.origin = origin.copy();
    const W = this.px(plan.widthM);
    const H = this.px(plan.heightM);
    const spine = this.px(plan.spineWidthM);
    const o = this.origin;
    this.bounds = { x: o.x, y: o.y - this.px(plan.rampLengthM), w: W, h: H + this.px(plan.rampLengthM) + this.px(10) };
    this.rect = { x: o.x, y: o.y, w: W, h: H };

    // Places : tout le plan sauf l'allée de liaison.
    const zone = [createVector(o.x + spine, o.y), createVector(o.x + W, o.y), createVector(o.x + W, o.y + H), createVector(o.x + spine, o.y + H)];
    // Une seule orientation : rangées parallèles au grand côté, comme un vrai sous-sol.
    this.lot = new ParkingLot("garage", zone, { level: -1, name: `Garage -1 (${building.name})`, pxPerMeter, layout: { maxOrientations: 1 } });

    // Entrée en surface : bouche de la rampe et zone plate de 5 m avant elle.
    this.surfaceEntrance = surfaceEntrance.copy();
    // Rampe : de l'extérieur du plan jusqu'au début de l'allée de liaison.
    const xSpine = o.x + spine / 2;
    this.rampTop = createVector(xSpine, o.y - this.px(plan.rampLengthM));
    this.rampBottom = createVector(xSpine, o.y + this.px(2));
    this.rampPath = new Path([this.rampTop, this.rampBottom], this.px(plan.rampWidthM) / 2);
    // Borne badge en bas de la rampe.
    this.badgeLine = createVector(xSpine, o.y + this.px(1));
    this.spineX = xSpine;
    // Ascenseur en bas de l'allée de liaison ; il remonte dans le bâtiment.
    this.elevatorDoor = createVector(xSpine, o.y + H - this.px(2));
    this.elevatorBox = { x: o.x, y: o.y + H, w: spine, h: this.px(8) };

    this.pillars = this.createPillars();
    // Places ♿ et ⚡ près de l'ascenseur.
    this.lot.assignKind("pmr", 4, this.elevatorDoor);
    this.lot.assignKind("ev", 6, this.elevatorDoor.copy().add(this.px(15), 0));
  }

  // Poteaux tous les 3 places sur les lignes de fond (entre deux rangées dos à dos).
  createPillars() {
    const poteaux = [];
    const taille = this.px(this.plan.pillarSizeM);
    const fonds = new Map();
    for (const s of this.lot.spots) {
      // Fond de la place : centre + demi-longueur dans le sens du cap.
      const fond = s.facing.copy().mult(s.length / 2).add(s.pos);
      const cle = Math.round(fond.y / 2);
      if (!fonds.has(cle)) fonds.set(cle, []);
      fonds.get(cle).push(fond);
    }
    for (const points of fonds.values()) {
      points.sort((a, b) => a.x - b.x);
      const vus = [];
      for (let i = 0; i < points.length; i += this.plan.pillarEverySpots) {
        const p = points[i].copy().add(-this.px(1.25), 0);
        if (vus.some(q => p5.Vector.dist(p, q) < taille * 2)) continue;
        vus.push(p);
        poteaux.push(new Pillar(p.x, p.y, taille / 2));
      }
    }
    return poteaux;
  }

  // Itinéraire d'une voiture dans le garage jusqu'au point d'allée de sa place.
  routeToSpot(spot) {
    const allee = spot.aisle;
    const yAllee = allee.a.y;
    const debut = Math.abs(allee.a.x - this.spineX) < Math.abs(allee.b.x - this.spineX) ? allee.a : allee.b;
    return [this.rampTop.copy(), this.rampBottom.copy(), createVector(this.spineX, yAllee), debut.copy(), spot.aislePoint.copy()];
  }

  // Facteur de vitesse sur la rampe (pente de 15 %).
  rampSpeedFactor() {
    return 1 - this.plan.rampSlope * 3;
  }

  isOnRamp(p) {
    return p.y < this.origin.y && Math.abs(p.x - this.spineX) <= this.px(this.plan.rampWidthM);
  }

  showPlan() {
    const o = this.origin;
    const r = this.rect;
    push();
    // Dalle de béton
    noStroke();
    fill(92, 96, 102);
    rect(r.x, r.y, r.w, r.h);
    // Rampe
    fill(110, 114, 120);
    const largeurRampe = this.px(this.plan.rampWidthM);
    rect(this.spineX - largeurRampe / 2 - this.px(0.5), this.rampTop.y, largeurRampe + this.px(1), o.y - this.rampTop.y);
    stroke(240, 200, 60);
    strokeWeight(0.6);
    for (let y = this.rampTop.y + this.px(2); y < o.y; y += this.px(3)) {
      line(this.spineX - largeurRampe / 2, y, this.spineX + largeurRampe / 2, y + this.px(1));
    }
    // Allées
    this.lot.showGround();
    // Allée de liaison
    noStroke();
    fill(120, 125, 132);
    rect(o.x, o.y, this.px(this.plan.spineWidthM), r.h);
    // Murs
    noFill();
    stroke(40);
    strokeWeight(this.px(0.6));
    rect(r.x, r.y, r.w, r.h);
    // Ascenseur
    const e = this.elevatorBox;
    fill(70, 90, 120);
    stroke(30);
    strokeWeight(0.6);
    rect(e.x, e.y, e.w, e.h);
    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(this.px(3));
    text("🛗", e.x + e.w / 2, e.y + e.h / 2);
    // Borne badge
    fill(255, 200, 0);
    circle(this.badgeLine.x + this.px(2.2), this.badgeLine.y, this.px(1.2));
    // Titre
    fill(255);
    textSize(this.px(3));
    textAlign(LEFT, BOTTOM);
    text(this.lot.name, r.x + this.px(9), r.y - this.px(1));
    pop();
  }
}

// Ouverture de rampe en surface (bouche du garage), dessinée sur la carte.
function drawGarageEntrance(garage, zoom) {
  const p = garage.surfaceEntrance;
  push();
  translate(p.x, p.y);
  noStroke();
  fill(50, 50, 55);
  circle(0, 0, garage.px(5));
  scale(1 / zoom);
  fill(255);
  textAlign(CENTER, CENTER);
  textSize(10);
  text("P-1", 0, 0);
  pop();
}
