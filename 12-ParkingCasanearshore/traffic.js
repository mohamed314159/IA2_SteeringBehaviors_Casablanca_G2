// Gestion du trafic (règles de scène) : apparition des voitures au bord de
// la carte, ordre de mise à jour, barrières, passage surface → garage,
// compteur de collisions. Aucune formule de steering ici : chaque voiture
// calcule ses forces dans LuxuryCar.step().
class TrafficManager {
  constructor(campus, world, rng = Math.random) {
    this.campus = campus;
    this.world = world;
    this.rng = rng;
    this.cars = [];
    this.collisions = new CompteurCollisions();
    this.onParked = null; // rappel de la scène : le conducteur descend
    this.parkedCount = 0;
    // Piétons proches d'un véhicule (fourni par la foule) : les véhicules leur cèdent le passage.
    this.pedestriansNear = () => [];
  }

  // Bâtiment de travail tiré au sort, pondéré par la surface.
  randomBuilding() {
    const lieux = this.campus.workplaces;
    const total = lieux.reduce((s, b) => s + b.area, 0);
    let t = this.rng() * total;
    for (const b of lieux) {
      t -= b.area;
      if (t <= 0) return b;
    }
    return lieux[lieux.length - 1];
  }

  randomSpec(kind) {
    const base = kind === "ev" ? LUXURY_ELECTRIC : randomPick(this.rng, LUXURY_MODELS);
    return { ...base, color: randomPick(this.rng, LUXURY_COLORS) };
  }

  randomKind() {
    const t = this.rng();
    if (t < 0.04) return "pmr";
    if (t < 0.14) return "ev";
    return "standard";
  }

  // Règle de scène : une voiture apparaît sur une entrée de la carte et suit
  // la route publique jusqu'à la porte la plus proche par la route.
  spawnCar(options = {}) {
    const entree = options.entry ?? randomPick(this.rng, this.campus.entries);
    const gateKey = options.gateKey ?? entree.gate;
    // Route publique uniquement : on n'entre dans le parc que par la porte.
    const ids = this.campus.network.shortestPath(entree.nodeId, this.campus.gates[gateKey].osmId, n => !this.campus.insideSite(n));
    if (!ids) return null;
    const decalage = metres(this.campus.config.laneOffsetM, this.campus.proj);
    const points = simplifyPolyline(offsetPolylineRight(this.campus.network.points(ids), decalage), mPx(1));
    // On s'arrête sur la ligne d'arrêt de la porte.
    points.push(this.world.gates[gateKey].stopLine.copy());
    const kind = options.kind ?? this.randomKind();
    const building = options.building ?? this.randomBuilding();
    const voiture = new LuxuryCar(points[0].x, points[0].y, {
      spec: options.spec ?? this.randomSpec(kind),
      kind,
      gateKey,
      building,
      path: new Path(points, mPx(ROAD_CONFIG.laneToleranceM)),
      config: options.config
    });
    this.cars.push(voiture);
    return voiture;
  }

  rampIsClear(car) {
    const haut = car.spot.lot.garage.rampTop;
    return !this.cars.some(c => c !== car && c.level === -1 && c.state !== "parked" &&
      p5.Vector.dist(c.pos, haut) < c.length + car.length / 2 + mPx(2));
  }

  // Les voitures qui roulent bloquent l'apparition si l'entrée est encombrée.
  entryIsClear(entree) {
    return !this.cars.some(c => c.level === 0 && p5.Vector.dist(c.pos, entree.pos) < mPx(12));
  }

  context(car) {
    return {
      cars: this.cars,
      pedestrians: car.state === "parked" ? [] : this.pedestriansNear(car.pos, car.brakingZone() + car.length * 2),
      gate: this.world.gates[car.gateKey],
      insideSite: p => pointInPolygon(p, this.campus.site),
      garage: car.spot && car.spot.lot.garage ? car.spot.lot.garage : null,
      pillars: car.spot && car.spot.lot.garage ? car.spot.lot.garage.pillars : [],
      assign: c => assignSpot(this.world.allLots, c),
      plan: (c, spot) => planSpotRoute(this.campus, this.world, c.gateKey, spot),
      // Règle de scène : passage au garage seulement si le haut de la rampe
      // est dégagé ; sinon la voiture attend à la bouche du garage.
      onEnterGarage: c => {
        if (this.rampIsClear(c)) c.moveToGarage(c.spot.lot.garage);
      },
      onParked: c => {
        this.parkedCount++;
        if (this.onParked) this.onParked(c);
      }
    };
  }

  // Un pas : barrières, puis une mise à jour par voiture (ordre de création),
  // puis comptage des collisions entre voitures en mouvement d'un même niveau.
  step() {
    for (const g of Object.values(this.world.gates)) g.tick(this.cars.filter(c => c.level === 0 && c.state !== "parked"));
    for (const c of this.cars) c.step(this.context(c));
    const roulantes = this.cars.filter(c => c.state !== "parked");
    for (const niveau of [0, -1]) {
      this.collisions.mettreAJour(roulantes.filter(c => c.level === niveau));
    }
  }

  movingCount() {
    return this.cars.filter(c => c.state !== "parked").length;
  }

  reset() {
    for (const lot of this.world.allLots) for (const s of lot.spots) s.release();
    this.cars = [];
    this.parkedCount = 0;
    this.collisions.reinitialiser();
  }
}
