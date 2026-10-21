// Orchestration de la simulation (règles de scène) : horloge, programme des
// événements, trafic, transports, foule, gardiens, faune. Un pas = un pas de
// chaque gestionnaire, dans un ordre documenté :
//   1. événements dus (apparitions, 8h55) ;
//   2. trafic (voitures de luxe et convoi G4S) ;
//   3. transports (trams) ;
//   4. foule (employés) ;
//   5. gardiens ;
//   6. faune (chats, papillons, oiseaux, pain) ;
//   7. l'horloge avance.
// Aucune formule de steering ici.
const GUARD_POSTS = [
  // Barrière OSM, nombre de gardiens.
  { osmId: 5688433271, count: 2 },   // porte nord principale
  { osmId: 1849822167, count: 1 },   // porte nord secondaire
  { osmId: 5673669986, count: 2 },   // porte sud
  { osmId: 12651651057, count: 1 }   // porte est (vers l'ESCAE et la N11)
];

class Simulation {
  constructor(data, seed = 2026, options = {}) {
    this.seed = seed;
    this.options = options;
    // Construction lourde, faite une seule fois.
    this.campus = createCampus(data);
    this.world = createParkingWorld(this.campus);
    this.esplanade = createEsplanades(this.campus, this.world, createRng(seed + 1));
    this.esplanades = this.esplanade.esplanades;
    this.decorObstacles = [...this.esplanade.obstacles];
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.rng = createRng(seed);
    this.morning = (this.morning ?? 0) + 1;
    for (const lot of this.world.allLots) for (const s of lot.spots) s.release();
    for (const b of this.esplanade.obstacles) if (b.seats) for (const s of b.seats) s.occupant = null;
    for (const g of Object.values(this.world.gates)) {
      g.queue = [];
      g.opening = 0;
      g.passedCount = 0;
    }
    this.clock = new SimClock();
    this.schedule = buildSchedule(this.rng, this.clock, this.options.schedule ?? SCHEDULE_CONFIG);
    this.traffic = new TrafficManager(this.campus, this.world, this.rng);
    this.transit = new TransitManager(this.campus, this.world, this.traffic, this.rng);
    this.crowd = new Crowd(this.campus, this.world, this.esplanades, this.decorObstacles, this.rng);
    // Liens entre gestionnaires (rappels de scène).
    this.crowd.cars = () => this.traffic.cars;
    this.traffic.pedestriansNear = (p, r) => this.crowd.near(p, r);
    this.traffic.onParked = car => {
      if (car instanceof LuxuryCar) this.crowd.spawnDriver(car);
    };
    this.transit.onTramDoorsOpen = tram => this.crowd.spawnPassengers(tram.doorPoints(), tram.platformSide, tram.passengers, "tram");
    this.transit.createConvoy();
    this.guards = this.createGuards();
    this.wildlife = this.createWildlife();
    this.crowd.spawnPresent(this.options.present ?? 60);
    this.carsSpawned = 0;
  }

  // Gardiens en blanc postés aux portes réelles, côté parc ; leur ronde
  // longe la clôture de part et d'autre de la barrière.
  createGuards() {
    const gardiens = [];
    const net = this.campus.network;
    for (const poste of GUARD_POSTS) {
      const n = net.nodes.get(poste.osmId);
      if (!n) continue;
      const porte = createVector(n.x, n.y);
      const voisin = n.edges.map(e => net.nodes.get(e.to)).find(m => this.campus.insideSite(m)) ?? net.nodes.get(n.edges[0].to);
      const dedans = createVector(voisin.x - n.x, voisin.y - n.y).normalize();
      const long = createVector(-dedans.y, dedans.x);
      for (let k = 0; k < poste.count; k++) {
        const cote = k === 0 ? 1 : -1;
        const p = long.copy().mult(mPx(6) * cote).add(dedans.copy().mult(mPx(4))).add(porte);
        const ronde = [long.copy().mult(mPx(20) * cote).add(p), long.copy().mult(mPx(35) * cote).add(dedans.copy().mult(mPx(6))).add(p)];
        gardiens.push(new SecurityGuard(p, ronde, this.rng));
      }
    }
    return gardiens;
  }

  // Faune : sur les deux pelouses les plus dégagées (points de rassemblement
  // les plus loin de la clôture, des bâtiments et des routes) : chats et
  // papillon sur la première, pain et oiseaux sur la seconde. Le rayon de
  // chaque zone reste dans la pelouse ; le nid est du côté de l'intérieur du parc.
  createWildlife() {
    const centre = polygonCentroid(this.campus.site);
    const routes = this.campus.data.roads.flatMap(r => r.points.slice(1).map((p, i) => [createVector(...r.points[i]), createVector(...p)]));
    const degagement = p => Math.min(
      p5.Vector.dist(p, closestPointOnPolygon(p, this.campus.site)),
      ...this.campus.buildings.map(b => p5.Vector.dist(p, b.closestPoint(p))),
      ...routes.map(([a, b]) => p5.Vector.dist(p, closestPointOnSegment(p, a, b)))
    );
    const pelouses = this.esplanade.assemblyPoints.map(a => ({ pos: a.pos.copy(), libre: degagement(a.pos) }))
      .sort((u, v) => v.libre - u.libre);
    const [chats, pain] = [pelouses[0] ?? { pos: centre, libre: mPx(20) }, pelouses[1] ?? pelouses[0] ?? { pos: centre, libre: mPx(20) }];
    const borne = (v, a, b) => Math.min(b, Math.max(a, v));
    const config = {
      ...WILDLIFE_CONFIG,
      lawnRadiusM: borne((chats.libre * 0.8) / PX_PER_METER, 8, WILDLIFE_CONFIG.lawnRadiusM),
      breadZoneRadiusM: borne((pain.libre * 0.8) / PX_PER_METER, 10, WILDLIFE_CONFIG.breadZoneRadiusM)
    };
    const versLeCentre = p5.Vector.sub(centre, pain.pos);
    if (versLeCentre.magSq() < 1e-9) versLeCentre.set(1, 0);
    const nid = versLeCentre.setMag(mPx(config.breadZoneRadiusM + 10)).add(pain.pos);
    return new Wildlife(chats.pos, pain.pos, nid, this.rng, config);
  }

  // Porte d'entrée piétonne nord (à côté de la barrière) pour les retardataires.
  lateEntrance() {
    const g = this.world.gates.nord;
    return createVector(-g.approach.y, g.approach.x).mult(mPx(5)).add(g.pos);
  }

  handle(ev) {
    switch (ev.type) {
      case "car": {
        const entree = randomPick(this.rng, this.campus.entries);
        if (!this.traffic.entryIsClear(entree)) {
          // Entrée encombrée : la voiture arrive 2 s plus tard.
          this.insert({ ...ev, time: ev.time + 2 });
          return;
        }
        this.traffic.spawnCar({ entry: entree });
        this.carsSpawned++;
        break;
      }
      case "tram":
        this.transit.spawnTram(ev.direction, ev.passengers);
        break;
      case "late": {
        const p = this.lateEntrance();
        this.crowd.spawnLate(p, this.crowd.randomBuilding());
        break;
      }
      case "work":
        this.crowd.goToWork();
        break;
    }
  }

  insert(ev) {
    const i = this.schedule.findIndex(e => e.time > ev.time);
    if (i === -1) this.schedule.push(ev);
    else this.schedule.splice(i, 0, ev);
  }

  step() {
    const t = this.clock.elapsed();
    while (this.schedule.length && this.schedule[0].time <= t) this.handle(this.schedule.shift());
    this.traffic.step();
    this.transit.step();
    this.crowd.step();
    const roulantes = this.traffic.cars.filter(c => c.state !== "parked");
    for (const g of this.guards) g.step(roulantes.filter(c => p5.Vector.dist(c.pos, g.pos) < mPx(15)));
    this.wildlife.step();
    this.clock.tick();
    return !this.isFinished();
  }

  secondsToNextEvent() {
    return this.schedule.length ? this.schedule[0].time - this.clock.elapsed() : Infinity;
  }

  // Accélération autorisée seulement quand tout le monde est entré au
  // travail : 8h55 passé, plus aucun employé dehors, plus aucune voiture
  // d'employé en mouvement, plus de tram à la station. (Le convoi G4S, les
  // gardiens et la faune continuent leur vie pendant l'accélération.)
  isQuiet() {
    if (!this.crowd.workStarted || this.crowd.employees.length > 0) return false;
    if (this.schedule.some(e => e.type === "car" || e.type === "tram" || e.type === "late")) return false;
    if (this.traffic.cars.some(c => c instanceof LuxuryCar && c.state !== "parked")) return false;
    return this.transit.trams.length === 0;
  }

  isFinished() {
    return this.clock.isOver();
  }

  stats() {
    const surface = countSpots(this.world.lots);
    const garage = countSpots(this.world.garages.map(g => g.lot));
    const faune = this.wildlife.stats();
    return {
      time: this.clock.label(),
      morning: this.morning,
      surfaceFree: surface.free,
      surfaceAll: surface.all,
      garageFree: garage.free,
      garageAll: garage.all,
      carsMoving: this.traffic.cars.filter(c => c instanceof LuxuryCar && c.state !== "parked").length,
      carsParked: this.traffic.parkedCount,
      collisions: this.traffic.collisions.total,
      employeesOutside: this.crowd.employees.length,
      entered: this.crowd.enteredCount,
      trams: this.transit.trams.length,
      birdsGeneration: faune.generation,
      breadCaught: faune.breadCaught,
      butterfliesCaught: faune.butterfliesCaught
    };
  }
}
