// Orchestration de la simulation (règles de scène) : horloge, programme des
// événements, trafic, transports, foule. Un pas = un pas de chaque
// gestionnaire, dans un ordre documenté :
//   1. événements dus (apparitions, 8h55) ;
//   2. trafic (voitures et navette) ;
//   3. transports (trams) ;
//   4. foule (employés) ;
//   5. l'horloge avance.
// Aucune formule de steering ici.
class Simulation {
  constructor(data, seed = 2026, options = {}) {
    this.seed = seed;
    this.options = options;
    // Construction lourde, faite une seule fois.
    this.campus = createCampus(data);
    this.world = createParkingWorld(this.campus);
    const decor = createEsplanades(this.campus, this.world, createRng(seed + 1));
    this.esplanades = decor.esplanades;
    this.decorObstacles = decor.obstacles;
    this.reset(seed);
  }

  reset(seed = this.seed) {
    this.seed = seed;
    this.rng = createRng(seed);
    for (const lot of this.world.allLots) for (const s of lot.spots) s.release();
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
    this.traffic.onParked = car => this.crowd.spawnDriver(car);
    this.transit.onTramDoorsOpen = tram => this.crowd.spawnPassengers(tram.doorPoints(), tram.platformSide, tram.passengers, "tram");
    this.transit.onShuttleDoorsOpen = s => {
      const cote = createVector(-s.heading.y, s.heading.x);
      this.crowd.spawnPassengers([s.doorPoint()], cote, s.passengers, "navette");
    };
    this.crowd.spawnPresent(this.options.present ?? 60);
    this.carsSpawned = 0;
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
      case "shuttle":
        if (!this.traffic.entryIsClear(this.transit.shuttleEntry)) {
          // Entrée encombrée : la navette arrive 2 s plus tard.
          this.insert({ ...ev, time: ev.time + 2 });
          return;
        }
        this.transit.spawnShuttle(ev.passengers);
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
    this.clock.tick();
    return !this.isFinished();
  }

  secondsToNextEvent() {
    return this.schedule.length ? this.schedule[0].time - this.clock.elapsed() : Infinity;
  }

  // « Rien ne se passe » : aucun véhicule dans le parc ou à moins de 150 m
  // d'une porte, aucun tram à moins de 300 m de la station, aucun piéton en
  // marche (les flâneurs et les discussions ne comptent pas).
  isQuiet() {
    const portes = Object.values(this.world.gates);
    const vehiculeActif = this.traffic.cars.some(c => c.state !== "parked" &&
      (c.state !== "approach" || portes.some(g => p5.Vector.dist(c.pos, g.pos) < mPx(150))));
    if (vehiculeActif) return false;
    const tramActif = this.transit.trams.some(t => t.state !== "approach" || p5.Vector.dist(t.pos, t.station) < mPx(300));
    if (tramActif) return false;
    return this.crowd.walkingCount() === 0;
  }

  isFinished() {
    return this.clock.isOver();
  }

  stats() {
    const surface = countSpots(this.world.lots);
    const garage = countSpots([this.world.garage.lot]);
    return {
      time: this.clock.label(),
      surfaceFree: surface.free,
      surfaceAll: surface.all,
      garageFree: garage.free,
      garageAll: garage.all,
      carsMoving: this.traffic.movingCount(),
      carsParked: this.traffic.parkedCount,
      collisions: this.traffic.collisions.total,
      employeesOutside: this.crowd.employees.length,
      entered: this.crowd.enteredCount,
      trams: this.transit.trams.length
    };
  }
}
