// Programme de la matinée (règle de scène, fonction pure) : liste des
// événements datés, tirés avec un générateur à graine (reproductible).
//   car      une voiture apparaît au bord de la carte
//   tram     un tram arrive (direction, nombre de passagers)
//   shuttle  la navette G4S arrive (nombre de passagers)
//   late     un employé en retard arrive en courant
//   work     8h55 : tout le monde va travailler
// Les heures sont en secondes depuis le début de la simulation (8h30).
const SCHEDULE_CONFIG = {
  cars: 110,
  rushCenter: { h: 8, m: 49 },  // pic d'arrivée des voitures
  rushSpreadMin: 4,              // écart type du pic (minutes)
  earlyShare: 0.2,               // part des voitures arrivant tôt (répartie uniformément)
  firstCar: { h: 8, m: 31 },
  lastCar: { h: 9, m: 0 },
  tramEveryMin: 4,
  firstTram: { h: 8, m: 32 },
  lastTram: { h: 8, m: 57 },
  tramPassengers: [12, 22],
  shuttles: [{ h: 8, m: 37 }, { h: 8, m: 46 }, { h: 8, m: 52 }],
  shuttlePassengers: [10, 16],
  late: [{ h: 8, m: 54, s: 0 }, { h: 8, m: 54, s: 30 }]
};

// Tirage gaussien (Box-Muller) avec le générateur fourni.
function gaussian(rng) {
  const u = Math.max(1e-9, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function buildSchedule(rng, clock, config = SCHEDULE_CONFIG) {
  const t = hm => clock.at(hm.h, hm.m, hm.s ?? 0);
  const evenements = [];
  const debut = t(config.firstCar);
  const fin = t(config.lastCar);
  for (let i = 0; i < config.cars; i++) {
    let instant;
    if (rng() < config.earlyShare) {
      instant = debut + rng() * (fin - debut);
    } else {
      instant = t(config.rushCenter) + gaussian(rng) * config.rushSpreadMin * 60;
    }
    instant = Math.min(fin, Math.max(debut, instant));
    evenements.push({ time: instant, type: "car" });
  }
  let sens = 0;
  for (let instant = t(config.firstTram); instant <= t(config.lastTram); instant += config.tramEveryMin * 60) {
    const [a, b] = config.tramPassengers;
    evenements.push({ time: instant, type: "tram", direction: sens++ % 2 ? "est" : "ouest", passengers: a + Math.floor(rng() * (b - a + 1)) });
  }
  for (const hm of config.shuttles) {
    const [a, b] = config.shuttlePassengers;
    evenements.push({ time: t(hm), type: "shuttle", passengers: a + Math.floor(rng() * (b - a + 1)) });
  }
  for (const hm of config.late) evenements.push({ time: t(hm), type: "late" });
  evenements.push({ time: t(clock.config.work), type: "work" });
  evenements.sort((a, b) => a.time - b.time);
  return evenements;
}
