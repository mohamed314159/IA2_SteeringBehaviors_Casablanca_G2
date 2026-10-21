// Chemin = suite de points + rayon (demi-largeur de la voie), comme
// 5-3-PathFollowingComplex/path.js. Ce n'est pas une entité : c'est le tracé
// au sol que suivent les véhicules (routes, rails, chemin de la navette).
class Path {
  constructor(points = [], radius = 10, closed = false) {
    this.points = points.map(p => createVector(p.x, p.y));
    this.radius = radius;
    this.closed = closed;
  }

  addPoint(x, y) {
    this.points.push(createVector(x, y));
  }

  segmentCount() {
    if (this.points.length < 2) return 0;
    return this.closed ? this.points.length : this.points.length - 1;
  }

  segment(i) {
    const n = this.points.length;
    return [this.points[i % n], this.points[(i + 1) % n]];
  }

  start() {
    return this.points[0];
  }

  end() {
    return this.points[this.points.length - 1];
  }

  length() {
    let total = 0;
    for (let i = 0; i < this.segmentCount(); i++) {
      const [a, b] = this.segment(i);
      total += p5.Vector.dist(a, b);
    }
    return total;
  }

  // Point situé à `distance` le long du chemin à partir du point `depuis`
  // posé sur le segment `index`. S'arrête au dernier point d'un chemin ouvert.
  pointAhead(index, depuis, distance) {
    let restant = distance;
    let courant = depuis.copy();
    let i = index;
    for (let tours = 0; tours <= this.segmentCount(); tours++) {
      const [, b] = this.segment(i);
      const d = p5.Vector.dist(courant, b);
      if (d >= restant) {
        return p5.Vector.sub(b, courant).setMag(restant).add(courant);
      }
      restant -= d;
      courant = b.copy();
      i++;
      if (i >= this.segmentCount()) {
        if (!this.closed) return this.end().copy();
        i = 0;
      }
    }
    return courant;
  }

  // Longueurs cumulées depuis le début (calculées une fois : les points d'un
  // chemin ne changent pas après sa création).
  cumulative() {
    if (!this._cumul || this._cumul.length !== this.points.length) {
      this._cumul = [0];
      for (let i = 1; i < this.points.length; i++) {
        this._cumul.push(this._cumul[i - 1] + p5.Vector.dist(this.points[i - 1], this.points[i]));
      }
    }
    return this._cumul;
  }

  // Abscisse curviligne (distance depuis le premier point, le long du chemin)
  // d'un point `p` projeté sur le segment `index`.
  positionAlong(index, p) {
    const i = index % this.segmentCount();
    const [a, b] = this.segment(i);
    return this.cumulative()[i] + p5.Vector.dist(a, closestPointOnSegment(p, a, b));
  }

  // Distance le long du chemin pour aller de l'abscisse `de` à l'abscisse `a`
  // (en faisant le tour pour un chemin fermé ; 0 si `a` est derrière sur un chemin ouvert).
  distanceAlong(de, a) {
    if (!this.closed) return Math.max(0, a - de);
    const total = this.length();
    return (((a - de) % total) + total) % total;
  }

  // Distance restante jusqu'au dernier point depuis un point du segment index.
  remainingLength(index, depuis) {
    if (this.closed) return Infinity;
    const cumul = this.cumulative();
    const total = cumul[cumul.length - 1];
    return total - cumul[index + 1] + p5.Vector.dist(depuis, this.segment(index)[1]);
  }
}
