// Réseau routier construit à partir des routes OpenStreetMap : graphe dont
// les sommets sont les nœuds OSM et les arcs les tronçons des routes
// (sens unique respecté). Il sert à la sélection d'action (quel chemin
// prendre) ; le déplacement reste fait par follow(path) dans les véhicules.
// Ce n'est pas une entité : aucun dessin, aucun steering.
class RoadNetwork {
  constructor(roads) {
    this.nodes = new Map();
    for (const road of roads) {
      for (let i = 0; i < road.nodes.length; i++) {
        const id = road.nodes[i];
        if (!this.nodes.has(id)) {
          const [x, y] = road.points[i];
          this.nodes.set(id, { id, x, y, edges: [], types: new Set(), services: new Set() });
        }
        this.nodes.get(id).types.add(road.type);
        if (road.service) this.nodes.get(id).services.add(road.service);
      }
      for (let i = 0; i + 1 < road.nodes.length; i++) {
        this.addEdge(road.nodes[i], road.nodes[i + 1], road);
        if (!road.oneway) this.addEdge(road.nodes[i + 1], road.nodes[i], road);
      }
    }
  }

  addEdge(a, b, road) {
    const na = this.nodes.get(a);
    const nb = this.nodes.get(b);
    if (!na || !nb || a === b) return;
    const longueur = Math.hypot(nb.x - na.x, nb.y - na.y);
    na.edges.push({ to: b, length: longueur, type: road.type, service: road.service });
  }

  // Sommet le plus proche d'un point, éventuellement filtré.
  nearestNode(point, filtre = () => true) {
    let meilleur = null;
    let record = Infinity;
    for (const n of this.nodes.values()) {
      if (!filtre(n)) continue;
      const d = Math.hypot(n.x - point.x, n.y - point.y);
      if (d < record) {
        record = d;
        meilleur = n;
      }
    }
    return meilleur;
  }

  // Plus court chemin (Dijkstra avec tas binaire). Retourne la liste des ids
  // de sommets, ou null si la destination est inaccessible.
  // `autorise(sommet)` limite les sommets traversés (par exemple : rester
  // dans le parc après la porte) ; départ et arrivée sont toujours autorisés.
  shortestPath(depart, arrivee, autorise = () => true) {
    if (!this.nodes.has(depart) || !this.nodes.has(arrivee)) return null;
    const distances = new Map([[depart, 0]]);
    const precedent = new Map();
    const tas = new MinHeap();
    tas.push(0, depart);
    while (tas.size() > 0) {
      const { priority: d, value: id } = tas.pop();
      if (id === arrivee) break;
      if (d > (distances.get(id) ?? Infinity)) continue;
      for (const e of this.nodes.get(id).edges) {
        if (e.to !== arrivee && !autorise(this.nodes.get(e.to))) continue;
        const nd = d + e.length;
        if (nd < (distances.get(e.to) ?? Infinity)) {
          distances.set(e.to, nd);
          precedent.set(e.to, id);
          tas.push(nd, e.to);
        }
      }
    }
    if (!distances.has(arrivee)) return null;
    const chemin = [arrivee];
    while (chemin[0] !== depart) chemin.unshift(precedent.get(chemin[0]));
    return chemin;
  }

  routeLength(ids) {
    let total = 0;
    for (let i = 0; i + 1 < ids.length; i++) {
      const a = this.nodes.get(ids[i]);
      const b = this.nodes.get(ids[i + 1]);
      total += Math.hypot(b.x - a.x, b.y - a.y);
    }
    return total;
  }

  points(ids) {
    return ids.map(id => {
      const n = this.nodes.get(id);
      return { x: n.x, y: n.y };
    });
  }

  // Entrées de la carte : extrémités de routes principales situées à moins de
  // `marge` px d'un bord du monde, d'où l'on peut atteindre `destination`.
  borderEntries(largeur, hauteur, marge, types, destination) {
    const entrees = [];
    for (const n of this.nodes.values()) {
      const auBord = n.x < marge || n.y < marge || n.x > largeur - marge || n.y > hauteur - marge;
      if (!auBord || ![...n.types].some(t => types.includes(t))) continue;
      if (destination !== undefined && this.shortestPath(n.id, destination) === null) continue;
      entrees.push(n);
    }
    return entrees;
  }
}

// Décale une polyligne de `d` px vers la droite du sens de marche
// (circulation à droite, comme 6-ObstacleAvoidance/route.js).
function offsetPolylineRight(points, d) {
  if (points.length < 2 || d === 0) return points.map(p => ({ x: p.x, y: p.y }));
  const normale = (a, b) => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    // droite du sens de marche dans un repère y vers le bas : (-dy, dx)
    return { x: -(b.y - a.y) / l, y: (b.x - a.x) / l };
  };
  const resultat = [];
  for (let i = 0; i < points.length; i++) {
    const avant = i > 0 ? normale(points[i - 1], points[i]) : null;
    const apres = i < points.length - 1 ? normale(points[i], points[i + 1]) : null;
    let nx = (avant ? avant.x : 0) + (apres ? apres.x : 0);
    let ny = (avant ? avant.y : 0) + (apres ? apres.y : 0);
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    resultat.push({ x: points[i].x + nx * d, y: points[i].y + ny * d });
  }
  return resultat;
}

// Supprime les points trop rapprochés (moins de `min` px).
function simplifyPolyline(points, min) {
  const resultat = [];
  for (const p of points) {
    const dernier = resultat[resultat.length - 1];
    if (!dernier || Math.hypot(p.x - dernier.x, p.y - dernier.y) >= min) resultat.push(p);
  }
  const fin = points[points.length - 1];
  const dernier = resultat[resultat.length - 1];
  if (fin && dernier !== fin && (dernier.x !== fin.x || dernier.y !== fin.y)) resultat.push(fin);
  return resultat;
}

// File de priorité minimale (tas binaire).
class MinHeap {
  constructor() {
    this.items = [];
  }

  size() {
    return this.items.length;
  }

  push(priority, value) {
    const items = this.items;
    items.push({ priority, value });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].priority <= items[i].priority) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop() {
    const items = this.items;
    const sommet = items[0];
    const dernier = items.pop();
    if (items.length > 0) {
      items[0] = dernier;
      let i = 0;
      for (;;) {
        const g = 2 * i + 1;
        const d = g + 1;
        let min = i;
        if (g < items.length && items[g].priority < items[min].priority) min = g;
        if (d < items.length && items[d].priority < items[min].priority) min = d;
        if (min === i) break;
        [items[min], items[i]] = [items[i], items[min]];
        i = min;
      }
    }
    return sommet;
  }
}
