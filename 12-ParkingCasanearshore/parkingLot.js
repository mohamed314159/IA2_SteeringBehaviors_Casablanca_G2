// Parking : découpage d'un polygone (parking OSM ou plan du garage) en
// rangées de places de 2,5 × 5 m desservies par des allées de 6 m.
// Le parking lui-même n'est pas une entité : c'est le marquage au sol et le
// conteneur de ses places (ParkingSpot, des Vehicle immobiles).

const PARKING_LAYOUT = {
  spotWidthM: 2.5,
  spotLengthM: 5,
  aisleWidthM: 6,
  marginM: 0.5,
  minEdgeM: 25 // seuls les côtés d'au moins 25 m donnent une orientation de rangées
};

// Découpe le polygone : modules « rangée + allée + rangée » répétés, pour
// chaque orientation candidate (côtés les plus longs d'abord). Une place est
// gardée si ses 4 coins et son point d'allée sont dans le polygone et si elle
// ne chevauche aucune place déjà gardée.
// Retourne { spots: [{ center, angle, aislePoint, aisleKey }], aisles: [{ key, a, b }] }.
function layoutParkingSpots(points, pxParMetre, options = {}) {
  const o = { ...PARKING_LAYOUT, ...options };
  const W = o.spotWidthM * pxParMetre;
  const L = o.spotLengthM * pxParMetre;
  const A = o.aisleWidthM * pxParMetre;
  const marge = o.marginM * pxParMetre;
  const module = 2 * L + A;

  const orientations = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const longueur = p5.Vector.dist(a, b);
    if (longueur < o.minEdgeM * pxParMetre) continue;
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const doublon = orientations.some(x => {
      const d = Math.abs(((angle - x.angle) % Math.PI + Math.PI) % Math.PI);
      return d < 0.17 || Math.PI - d < 0.17;
    });
    if (!doublon) orientations.push({ angle, longueur });
  }
  orientations.sort((x, y) => y.longueur - x.longueur);
  if (o.maxOrientations) orientations.length = Math.min(orientations.length, o.maxOrientations);

  const spots = [];
  const aisles = [];
  // Surfaces déjà prises par les orientations précédentes (places et allées).
  const occupes = [];
  orientations.forEach(({ angle }, k) => {
    const rectangles = [];
    const rectAllee = (u, vAllee, demiLongueur) => {
      const c = rotatedVector(u, vAllee, angle);
      return { x: c.x, y: c.y, angle, demiLongueur, demiLargeur: A / 2 - 0.05 };
    };
    // Repère local : u le long du côté, v perpendiculaire.
    const local = points.map(p => rotatedVector(p.x, p.y, -angle));
    const us = local.map(p => p.x);
    const vs = local.map(p => p.y);
    const uMin = Math.min(...us) + marge;
    const uMax = Math.max(...us) - marge;
    const vMin = Math.min(...vs) + marge;
    const vMax = Math.max(...vs) - marge;
    const versMonde = (u, v) => rotatedVector(u, v, angle);
    const dedans = (u, v) => pointInPolygon(versMonde(u, v), points);

    for (let v0 = vMin, m = 0; v0 + L + A <= vMax + 1e-9; v0 += module, m++) {
      const vAllee = v0 + L + A / 2;
      const cle = `${k}-${m}`;
      const rangees = [
        { v: v0 + L / 2, cap: angle - Math.PI / 2 },
        { v: v0 + L + A + L / 2, cap: angle + Math.PI / 2 }
      ];
      let uPremier = Infinity;
      let uDernier = -Infinity;
      for (let u = uMin + W / 2; u + W / 2 <= uMax + 1e-9; u += W) {
        if (!dedans(u, vAllee)) continue;
        // Le morceau d'allée devant la place doit être libre.
        const morceau = rectAllee(u, vAllee, W / 2);
        if (occupes.some(r => rectanglesSeTouchent(r, morceau))) continue;
        for (const rangee of rangees) {
          if (rangee.v + L / 2 > vMax + 1e-9) continue;
          const coins = [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, L / 2], [-W / 2, L / 2]];
          if (!coins.every(([du, dv]) => dedans(u + du, rangee.v + dv))) continue;
          const centre = versMonde(u, rangee.v);
          const rect = { x: centre.x, y: centre.y, angle: rangee.cap, demiLongueur: L / 2 - 0.05, demiLargeur: W / 2 - 0.05 };
          if (occupes.some(r => rectanglesSeTouchent(r, rect))) continue;
          if (rectangles.some(r => rectanglesSeTouchent(r, rect))) continue;
          rectangles.push(rect);
          spots.push({ center: centre, angle: rangee.cap, aislePoint: versMonde(u, vAllee), aisleKey: cle });
          uPremier = Math.min(uPremier, u);
          uDernier = Math.max(uDernier, u);
        }
      }
      if (uPremier <= uDernier) {
        // Allée : de la première à la dernière place, prolongée d'une place
        // de chaque côté si elle reste dans le polygone et libre.
        const libre = u => dedans(u, vAllee) && !occupes.some(r => rectanglesSeTouchent(r, rectAllee(u, vAllee, W / 2)));
        const debut = libre(uPremier - W) ? uPremier - W : uPremier;
        const fin = libre(uDernier + W) ? uDernier + W : uDernier;
        aisles.push({ key: cle, a: versMonde(debut, vAllee), b: versMonde(fin, vAllee) });
        rectangles.push(rectAllee((debut + fin) / 2, vAllee, (fin - debut) / 2 + W / 2));
      }
    }
    occupes.push(...rectangles);
  });
  return { spots, aisles };
}

class ParkingLot {
  constructor(id, points, options = {}) {
    this.id = id;
    this.name = options.name ?? `Parking ${id}`;
    this.points = points.map(p => (p.copy ? p.copy() : createVector(p[0], p[1])));
    this.level = options.level ?? 0;
    this.pxPerMeter = options.pxPerMeter ?? 2;
    const plan = layoutParkingSpots(this.points, this.pxPerMeter, options.layout);
    this.aisles = new Map();
    for (const a of plan.aisles) {
      this.aisles.set(a.key, { key: a.key, a: a.a, b: a.b, path: new Path([a.a, a.b], (PARKING_LAYOUT.aisleWidthM / 4) * this.pxPerMeter) });
    }
    this.spots = plan.spots.map((s, i) => new ParkingSpot(s.center.x, s.center.y, s.angle, {
      width: PARKING_LAYOUT.spotWidthM * this.pxPerMeter,
      length: PARKING_LAYOUT.spotLengthM * this.pxPerMeter,
      aislePoint: s.aislePoint,
      aisle: this.aisles.get(s.aisleKey),
      level: this.level,
      lot: this,
      number: i + 1
    }));
    // Sommet routier d'accès de chaque allée (renseigné par la scène).
    this.access = new Map();
  }

  freeSpots(kind = null) {
    return this.spots.filter(s => s.isFree() && (kind === null || s.kind === kind));
  }

  capacity() {
    return this.spots.length;
  }

  // Attribue un type (⚡, ♿) aux `n` places les plus proches d'un point.
  assignKind(kind, n, pres) {
    const libres = this.spots.filter(s => s.kind === "standard")
      .sort((a, b) => p5.Vector.dist(a.pos, pres) - p5.Vector.dist(b.pos, pres));
    for (const s of libres.slice(0, n)) s.kind = kind;
  }

  showGround() {
    push();
    noStroke();
    // Allées en asphalte plus foncé.
    stroke(150, 156, 166);
    strokeCap(SQUARE);
    strokeWeight(PARKING_LAYOUT.aisleWidthM * this.pxPerMeter);
    for (const a of this.aisles.values()) line(a.a.x, a.a.y, a.b.x, a.b.y);
    pop();
  }
}
