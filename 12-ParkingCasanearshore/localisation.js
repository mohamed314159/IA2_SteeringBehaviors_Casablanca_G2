// Retrouver un comportement sur la carte (interface) : entités mobiles,
// comptage par comportement, entité suivante à montrer, garage où elle se
// trouve. Lecture seule, comme le debug : on lit le comportement rangé par
// chaque entité pendant son pas, on ne recalcule aucun steering.
const COMPORTEMENTS_A_LOCALISER = {
  seek: { nom: "Seek", test: e => e.behavior === "seek" || e.behavior === "neuro" },
  pursue: { nom: "Pursue", test: e => e.behavior === "pursue" },
  evade: { nom: "Evade", test: e => e.behavior === "evade" || Boolean(e.evadeState && e.evadeState.active) },
  arrive: { nom: "Arrive", test: e => e.behavior === "arrive" },
  wander: { nom: "Wander", test: e => e.behavior === "wander" },
  path: { nom: "Path following", test: e => e.behavior === "path" },
  avoid: { nom: "Obstacle avoidance", test: e => Boolean(e.debugInfo && e.debugInfo.avoid && e.debugInfo.avoid.active) },
  boids: { nom: "Boids", test: e => e.behavior === "boids" },
  leader: { nom: "Leader following", test: e => e.behavior === "leader" }
};

const NOMS_ENTITES = {
  LuxuryCar: "voiture", G4SVehicle: "véhicule G4S", Tram: "tram", Employee: "employé",
  SecurityGuard: "gardien", Cat: "chat", Butterfly: "papillon", Bird: "oiseau", Bread: "morceau de pain"
};

function nomEntite(e) {
  return NOMS_ENTITES[e.constructor.name] ?? "entité";
}

// Entités qui bougent en ce moment (les voitures garées sont exclues).
function entitesMobiles(sim) {
  return [
    ...sim.traffic.cars.filter(c => c.state !== "parked" && c.state !== "gone"),
    ...sim.transit.trams.filter(t => t.state !== "gone"),
    ...sim.crowd.employees.filter(e => e.state !== "gone"),
    ...sim.guards,
    ...sim.wildlife.entities()
  ];
}

// Nombre d'entités qui exécutent chaque comportement.
function comptesParComportement(entites) {
  const comptes = {};
  for (const [cle, c] of Object.entries(COMPORTEMENTS_A_LOCALISER)) comptes[cle] = entites.filter(c.test).length;
  return comptes;
}

// Entité à montrer : la suivante après `precedente` parmi celles qui
// exécutent le comportement (on fait le tour) ; null s'il n'y en a aucune.
function prochaineEntite(entites, cle, precedente = null) {
  const c = COMPORTEMENTS_A_LOCALISER[cle];
  if (!c) return null;
  const candidates = entites.filter(c.test);
  if (candidates.length === 0) return null;
  const rang = (candidates.indexOf(precedente) + 1) % candidates.length;
  return { entite: candidates[rang], rang: rang + 1, total: candidates.length };
}

// Indice du garage dont le plan contient la position, ou -1 (surface).
function garageDe(world, pos) {
  return world.garages.findIndex(g => pos.x >= g.bounds.x && pos.x <= g.bounds.x + g.bounds.w &&
    pos.y >= g.bounds.y && pos.y <= g.bounds.y + g.bounds.h);
}
