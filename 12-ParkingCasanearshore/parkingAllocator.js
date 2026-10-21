// Attribution des places (règle de scène, sélection d'action) : quand une
// voiture franchit la porte, on lui réserve la place libre compatible la plus
// proche du bâtiment où travaille le conducteur. Aucune voiture ne cherche
// sa place en tournant (pas de wander).
//
// Compatibilité : une voiture électrique préfère une place ⚡, une voiture
// PMR une place ♿ ; à défaut elles prennent une place standard. Une voiture
// standard ne prend jamais une place ♿ ni ⚡.
const SPOT_BONUS_PX = 40; // avantage donné à une place réservée au bon type

function spotCompatible(spot, carKind) {
  if (spot.kind === "standard") return true;
  return spot.kind === carKind;
}

// Point d'où le conducteur part à pied depuis cette place : la place elle-même
// en surface, la sortie de l'ascenseur (porte du bâtiment) pour le garage.
function walkStart(spot) {
  if (spot.level === -1 && spot.lot.garage) return spot.lot.garage.building.door;
  return spot.pos;
}

function chooseSpot(lots, carKind, door) {
  let meilleure = null;
  let record = Infinity;
  for (const lot of lots) {
    for (const s of lot.spots) {
      if (!s.isFree() || !spotCompatible(s, carKind)) continue;
      let cout = p5.Vector.dist(walkStart(s), door);
      // Au garage, on marche aussi de la place jusqu'à l'ascenseur.
      if (s.level === -1 && s.lot.garage) cout += p5.Vector.dist(s.pos, s.lot.garage.elevatorDoor);
      if (s.kind !== "standard") cout -= SPOT_BONUS_PX;
      if (cout < record) {
        record = cout;
        meilleure = s;
      }
    }
  }
  return meilleure;
}

// Réserve une place pour la voiture ; null si tout est complet.
function assignSpot(lots, car) {
  const place = chooseSpot(lots, car.kind, car.destinationDoor);
  if (!place) return null;
  place.reserve(car);
  return place;
}

function countSpots(lots) {
  const total = { free: 0, reserved: 0, occupied: 0, all: 0 };
  for (const lot of lots) {
    for (const s of lot.spots) {
      total[s.state]++;
      total.all++;
    }
  }
  return total;
}
