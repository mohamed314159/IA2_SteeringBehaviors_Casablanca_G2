// Murs qu'un rayon de longueur `reach` partant de `pos` peut toucher (étape 26) :
// un mur dont le point le plus proche est plus loin ne change aucun résultat de
// castAll. Marge d'1 px contre les arrondis. Le tableau d'entrée n'est pas modifié.
function wallsWithinReach(walls, pos, reach) {
  const limitSq = (reach + 1) * (reach + 1);
  const result = [];
  for (const wall of walls) {
    const abx = wall.b.x - wall.a.x;
    const aby = wall.b.y - wall.a.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq === 0 ? 0 : ((pos.x - wall.a.x) * abx + (pos.y - wall.a.y) * aby) / lenSq;
    t = t < 0 ? 0 : t > 1 ? 1 : t;   // = Math.min(1, Math.max(0, t)), sans appel de fonction
    const dx = pos.x - (wall.a.x + abx * t);
    const dy = pos.y - (wall.a.y + aby * t);
    if (dx * dx + dy * dy <= limitSq) result.push(wall);
  }
  return result;
}

// Rayon capteur repris du dossier 9b : intersection demi-droite / segment.
// Les murs sont des objets { a: {x, y}, b: {x, y} }.
class Ray {
  constructor(angle = 0) {
    this.pos = { x: 0, y: 0 };
    this.dir = { x: Math.cos(angle), y: Math.sin(angle) };
    this.end = null; // point touché le plus proche (ou null)
  }

  setPos(x, y) {
    this.pos.x = x;
    this.pos.y = y;
  }

  setDir(angle) {
    this.dir.x = Math.cos(angle);
    this.dir.y = Math.sin(angle);
  }

  // Retourne le point d'intersection avec le mur, ou null.
  cast(wall) {
    const x1 = wall.a.x;
    const y1 = wall.a.y;
    const x2 = wall.b.x;
    const y2 = wall.b.y;
    const x3 = this.pos.x;
    const y3 = this.pos.y;
    const x4 = this.pos.x + this.dir.x;
    const y4 = this.pos.y + this.dir.y;

    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;
    if (t >= 0 && t <= 1 && u > 0) {
      return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }
    return null;
  }

  // Distance au mur le plus proche parmi `walls`, plafonnée à maxDist.
  castAll(walls, maxDist) {
    let record = maxDist;
    this.end = null;
    for (const wall of walls) {
      const pt = this.cast(wall);
      if (!pt) continue;
      const d = Math.hypot(pt.x - this.pos.x, pt.y - this.pos.y);
      if (d < record) {
        record = d;
        this.end = pt;
      }
    }
    return record;
  }
}
