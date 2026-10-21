// Repris de 6-ObstacleAvoidance/collisions.js (même algorithme).
// Sert à deux règles de scène : placer des places de parking sans chevauchement
// et compter les collisions entre véhicules. Ce n'est pas un comportement de steering.

// Vrai si deux rectangles orientés se chevauchent (ou se touchent).
// Rectangle : { x, y, angle, demiLongueur, demiLargeur } (centre, cap en radians, demi-dimensions).
// Théorème des axes séparateurs : deux rectangles sont disjoints si et seulement si, sur l'un
// des 4 axes (les 2 axes de chaque rectangle), leurs projections ne se recouvrent pas.
function rectanglesSeTouchent(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  // test rapide : centres plus éloignés que la somme des demi-diagonales
  const diagonaleA = Math.hypot(a.demiLongueur, a.demiLargeur);
  const diagonaleB = Math.hypot(b.demiLongueur, b.demiLargeur);
  if (dx * dx + dy * dy > (diagonaleA + diagonaleB) ** 2) return false;

  for (const angle of [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2]) {
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    // demi-étendue d'un rectangle projeté sur l'axe (ax, ay)
    const etendue = r => r.demiLongueur * Math.abs(Math.cos(r.angle) * ax + Math.sin(r.angle) * ay)
      + r.demiLargeur * Math.abs(-Math.sin(r.angle) * ax + Math.cos(r.angle) * ay);
    if (Math.abs(dx * ax + dy * ay) > etendue(a) + etendue(b)) return false;
  }
  return true;
}

// Compte les collisions entre voitures : +1 quand deux voitures ENTRENT en contact.
// Tant qu'elles restent en contact, on ne recompte pas ; si elles se séparent puis se
// touchent de nouveau, c'est une nouvelle collision.
// Les voitures doivent fournir carrosserie() (rectangle orienté, voir rectanglesSeTouchent).
class CompteurCollisions {
  constructor() {
    this.total = 0;
    // paires actuellement en contact : chaque voiture -> ensemble des voitures touchées
    this.contacts = new Map();
  }

  enContact(a, b) {
    return this.contacts.get(a)?.has(b) ?? false;
  }

  // Examine toutes les paires ; renvoie le nombre de nouvelles collisions de cette image.
  mettreAJour(vehicules) {
    const carrosseries = vehicules.map(v => v.carrosserie());
    const nouveauxContacts = new Map();
    let nouvelles = 0;
    for (let i = 0; i < vehicules.length; i++) {
      for (let j = i + 1; j < vehicules.length; j++) {
        if (!rectanglesSeTouchent(carrosseries[i], carrosseries[j])) continue;
        const a = vehicules[i];
        const b = vehicules[j];
        if (!this.enContact(a, b)) nouvelles++;
        if (!nouveauxContacts.has(a)) nouveauxContacts.set(a, new Set());
        nouveauxContacts.get(a).add(b);
        if (!nouveauxContacts.has(b)) nouveauxContacts.set(b, new Set());
        nouveauxContacts.get(b).add(a);
      }
    }
    this.contacts = nouveauxContacts;
    this.total += nouvelles;
    return nouvelles;
  }

  reinitialiser() {
    this.total = 0;
    this.contacts = new Map();
  }
}
