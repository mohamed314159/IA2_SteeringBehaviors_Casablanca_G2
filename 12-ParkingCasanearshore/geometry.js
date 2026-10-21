// Aides géométriques pures (aucun état, aucun dessin).
// findProjection reprend la projection scalaire de 5-1-ScalarProjection et
// 5-2-PathFollowing ; les autres fonctions servent au suivi de chemin, à
// l'évitement des bâtiments (polygones) et aux parkings.

// Projection orthogonale du point a sur la droite (pos, b).
function findProjection(pos, a, b) {
  const v1 = p5.Vector.sub(a, pos);
  const v2 = p5.Vector.sub(b, pos);
  v2.normalize();
  const sp = v1.dot(v2);
  v2.mult(sp);
  v2.add(pos);
  return v2;
}

// Point du segment [a, b] le plus proche de p (projection bornée aux extrémités).
function closestPointOnSegment(p, a, b) {
  const ab = p5.Vector.sub(b, a);
  const longueur2 = ab.magSq();
  if (longueur2 === 0) return a.copy();
  const t = Math.min(1, Math.max(0, p5.Vector.sub(p, a).dot(ab) / longueur2));
  return ab.mult(t).add(a);
}

// Vrai si p est à l'intérieur du polygone (lancer de rayon horizontal).
function pointInPolygon(p, points) {
  let dedans = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      dedans = !dedans;
    }
  }
  return dedans;
}

// Point du contour d'un polygone fermé le plus proche de p.
function closestPointOnPolygon(p, points) {
  let meilleur = null;
  let record = Infinity;
  for (let i = 0; i < points.length; i++) {
    const candidat = closestPointOnSegment(p, points[i], points[(i + 1) % points.length]);
    const d = p5.Vector.dist(p, candidat);
    if (d < record) {
      record = d;
      meilleur = candidat;
    }
  }
  return meilleur;
}

// Centre de gravité (moyenne des sommets) d'un polygone.
function polygonCentroid(points) {
  const c = createVector(0, 0);
  for (const p of points) c.add(p);
  return c.div(Math.max(1, points.length));
}

// Aire (valeur absolue) d'un polygone, formule du lacet.
function polygonArea(points) {
  let somme = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    somme += a.x * b.y - b.x * a.y;
  }
  return Math.abs(somme) / 2;
}

function isFiniteVector(v) {
  return v !== undefined && v !== null && Number.isFinite(v.x) && Number.isFinite(v.y);
}

// Tourne (x, y) d'un angle donné et renvoie un nouveau vecteur.
function rotatedVector(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return createVector(x * c - y * s, x * s + y * c);
}
