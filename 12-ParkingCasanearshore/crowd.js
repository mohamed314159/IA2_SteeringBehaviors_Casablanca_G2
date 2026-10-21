// Foule des employés (règles de scène et sélection d'action collective) :
// apparitions (déjà sur place, sortie du tram, de la navette, d'une voiture),
// groupes de discussion, groupes de marche (boids ou formation derrière un
// guide), départ général à 8h55. Aucune formule de steering ici : chaque
// employé calcule ses forces dans Employee.chooseForces().

// Grille spatiale : retrouve les voisins sans parcourir toute la foule.
class SpatialGrid {
  constructor(cellSize) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  key(x, y) {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  rebuild(items) {
    this.cells.clear();
    for (const it of items) {
      const k = this.key(it.pos.x, it.pos.y);
      if (!this.cells.has(k)) this.cells.set(k, []);
      this.cells.get(k).push(it);
    }
  }

  query(pos, radius) {
    const resultat = [];
    const c = this.cellSize;
    const r2 = radius * radius;
    for (let gx = Math.floor((pos.x - radius) / c); gx <= Math.floor((pos.x + radius) / c); gx++) {
      for (let gy = Math.floor((pos.y - radius) / c); gy <= Math.floor((pos.y + radius) / c); gy++) {
        for (const it of this.cells.get(`${gx},${gy}`) ?? []) {
          const dx = it.pos.x - pos.x;
          const dy = it.pos.y - pos.y;
          if (dx * dx + dy * dy <= r2) resultat.push(it);
        }
      }
    }
    return resultat;
  }
}

// Groupe de marche : collègues d'un même bâtiment.
//  - mode "flock" : tous suivent le chemin avec alignement, cohésion, séparation ;
//  - mode "formation" : un guide suit le chemin, les autres le suivent en
//    formation sur deux colonnes.
class WalkingGroup {
  constructor(members, building, mode, path) {
    this.members = members;
    this.building = building;
    this.mode = mode;
    this.path = path;
    this.leader = mode === "formation" ? members[0] : null;
  }

  // Place de formation du i-ème suiveur (repère du guide : derrière, côté).
  static slot(i) {
    return { back: mPx(1.6) * (1 + Math.floor(i / 2)), side: (i % 2 ? 1 : -1) * mPx(0.75) };
  }
}

const CROWD_CONFIG = {
  chatGroupSize: [3, 5],
  chatRadiusM: 1.1,
  coffeeChance: 0.0015,     // par pas, pour un flâneur
  chatShare: 0.55,          // part des employés présents qui discutent
  minGroupSize: 2,
  formationShare: 0.5,      // part des groupes qui marchent en formation
  seekCoffeeShare: 0.08,    // passagers qui foncent au café avant de monter
  badgeShare: 0.15,         // voitures avec un collègue passager (scénario du badge)
  workDelaySeconds: 12      // à 8h55, départs étalés sur 12 s
};

class Crowd {
  constructor(campus, world, esplanades, obstacles, rng = Math.random, config = CROWD_CONFIG) {
    this.campus = campus;
    this.world = world;
    this.esplanades = esplanades;
    this.config = config;
    this.rng = rng;
    this.employees = [];
    this.groups = [];
    this.chats = [];
    this.grid = new SpatialGrid(mPx(8));
    // Obstacles des piétons : bâtiments, décor de l'esplanade, poteaux du garage.
    this.obstaclesSurface = [...campus.buildings, ...obstacles];
    this.obstaclesGarage = world.garage.pillars;
    this.cars = () => [];
    this.enteredCount = 0;
    this.enteredBy = {};
    this.workStarted = false;
  }

  randomLook() {
    return { outfit: randomPick(this.rng, OUTFITS), skin: randomPick(this.rng, SKIN_TONES), hair: randomPick(this.rng, HAIR_COLORS) };
  }

  randomBuilding() {
    const total = this.campus.buildings.reduce((s, b) => s + b.area, 0);
    let t = this.rng() * total;
    for (const b of this.campus.buildings) {
      t -= b.area;
      if (t <= 0) return b;
    }
    return this.campus.buildings.at(-1);
  }

  add(options) {
    const e = new Employee(options.x, options.y, {
      look: this.randomLook(),
      building: options.building ?? this.randomBuilding(),
      phase: this.rng() * 6,
      onEnter: emp => {
        this.enteredCount++;
        this.enteredBy[emp.origin] = (this.enteredBy[emp.origin] ?? 0) + 1;
      },
      ...options
    });
    if (!e.target) e.target = e.building.door.copy();
    e.origin = options.origin ?? "site";
    this.employees.push(e);
    return e;
  }

  // ---------- Avant 8h55 : flâneurs, discussions, café ----------

  spawnPresent(n) {
    for (let i = 0; i < n; i++) {
      // Chacun flâne sur l'esplanade la plus proche de son bâtiment.
      const building = this.randomBuilding();
      const zone = this.nearestEsplanade(building.door);
      const a = this.rng() * Math.PI * 2;
      const d = Math.sqrt(this.rng()) * zone.radius * 0.8;
      const p = createVector(Math.cos(a), Math.sin(a)).mult(d).add(zone.center);
      this.add({ x: p.x, y: p.y, building, state: "wander", zone, origin: "site", heading: p5.Vector.fromAngle(this.rng() * Math.PI * 2) });
    }
    this.formChats();
  }

  // Regroupe une partie des flâneurs de chaque esplanade en cercles de discussion.
  formChats() {
    for (const zone of this.esplanades) {
      const libres = this.employees.filter(e => e.zone === zone && e.state === "wander");
      let reste = Math.round(libres.length * this.config.chatShare);
      let i = 0;
      while (reste >= this.config.chatGroupSize[0]) {
        const [mn, mx] = this.config.chatGroupSize;
        const taille = Math.min(reste, mn + Math.floor(this.rng() * (mx - mn + 1)));
        const membres = libres.slice(i, i + taille);
        i += taille;
        reste -= taille;
        const centre = this.chatCenter(zone);
        if (!centre) break;
        const discussion = { center: centre, members: membres };
        membres.forEach((m, k) => {
          const angle = (k / membres.length) * Math.PI * 2;
          m.slot = createVector(Math.cos(angle), Math.sin(angle)).mult(mPx(this.config.chatRadiusM)).add(centre);
          // À 8h30, les discussions sont déjà engagées : chacun est à sa place.
          m.pos = m.slot.copy().add(p5.Vector.fromAngle(this.rng() * Math.PI * 2).mult(mPx(0.3)));
          m.vel.set(0, 0);
          m.chatCenter = centre.copy();
          m.chat = discussion;
          m.state = "chat";
        });
        this.chats.push(discussion);
      }
    }
  }

  // Centre d'un cercle de discussion : sur l'esplanade, à au moins 3 m du
  // décor et des autres cercles. Nombre d'essais borné ; null si aucun.
  chatCenter(zone) {
    const obstacles = [zone.kiosk, ...zone.benches, ...zone.planters];
    for (let essai = 0; essai < 30; essai++) {
      const a = this.rng() * Math.PI * 2;
      const d = zone.radius * (0.35 + 0.35 * this.rng());
      const c = createVector(Math.cos(a), Math.sin(a)).mult(d).add(zone.center);
      const libre = obstacles.every(o => p5.Vector.dist(c, o.pos) > o.r + mPx(3)) &&
        this.chats.every(ch => p5.Vector.dist(c, ch.center) > mPx(5)) &&
        this.campus.buildings.every(b => !b.contains(c) && p5.Vector.dist(c, b.closestPoint(c)) > mPx(5));
      if (libre) return c;
    }
    return null;
  }

  // ---------- 8h55 : tout le monde va travailler ----------

  // Chacun termine sa phrase ou son café dans les secondes qui suivent
  // (départ étalé sur workDelaySeconds), puis marche vers son bâtiment.
  goToWork() {
    if (this.workStarted) return;
    this.workStarted = true;
    for (const e of this.employees) {
      if (["wander", "chat", "coffee"].includes(e.state)) {
        e.workDelay = Math.floor(this.rng() * stepsFor(this.config.workDelaySeconds));
      }
    }
  }

  // Départs au travail dus à ce pas.
  startDueWorkers() {
    if (!this.workStarted) return;
    for (const e of this.employees) {
      if (e.workDelay === undefined || !["wander", "chat", "coffee"].includes(e.state)) continue;
      if (e.workDelay-- > 0) continue;
      e.workDelay = undefined;
      e.state = "walk";
      e.planWalkTo(this.context());
    }
  }

  // ---------- Passagers du tram et de la navette ----------

  // Les passagers sortent par les portes et s'arrêtent à `distanceM` m.
  spawnPassengers(portes, cote, n, origine) {
    const sortis = [];
    for (let i = 0; i < n; i++) {
      const porte = portes[i % portes.length];
      const dehors = cote.copy().setMag(mPx(3) + (Math.floor(i / portes.length) % 3) * mPx(1.2))
        .add(porte).add(p5.Vector.fromAngle(this.rng() * Math.PI * 2).mult(mPx(0.6)));
      const e = this.add({ x: porte.x, y: porte.y, state: "alight", origin: origine, heading: cote.copy() });
      e.alightTarget = dehors;
      e.target = dehors;
      e.alighting = true;
      sortis.push(e);
    }
    this.pendingAlight = (this.pendingAlight ?? []).concat([{ members: sortis, origine }]);
    return sortis;
  }

  // Quand tous les passagers d'une descente sont sur le quai, on forme les
  // groupes par bâtiment (boids ou formation) ; les isolés marchent seuls.
  onAlighted(e) {
    e.alighted = true;
    e.vel.set(0, 0);
    e.state = "waitGroup";
    for (const lot of this.pendingAlight ?? []) {
      if (!lot.members.every(m => m.alighted)) continue;
      this.pendingAlight = this.pendingAlight.filter(x => x !== lot);
      this.formWalkingGroups(lot.members);
    }
  }

  formWalkingGroups(membres) {
    const ctx = this.context();
    const parBatiment = new Map();
    for (const m of membres) {
      m.target = m.building.door.copy();
      if (!parBatiment.has(m.building)) parBatiment.set(m.building, []);
      parBatiment.get(m.building).push(m);
    }
    for (const [batiment, gens] of parBatiment) {
      // Quelques-uns foncent d'abord au café le plus proche (seek).
      const cafe = gens.length > 1 && this.rng() < this.config.seekCoffeeShare * gens.length ? gens.pop() : null;
      if (cafe) {
        cafe.zone = this.nearestEsplanade(cafe.pos);
        cafe.state = "seekCoffee";
        cafe.nextStateAfterCoffee = "walk";
      }
      if (gens.length >= this.config.minGroupSize) {
        const mode = this.rng() < this.config.formationShare && gens.length >= 3 ? "formation" : "flock";
        const depart = gens.reduce((s, g) => s.add(g.pos), createVector(0, 0)).div(gens.length);
        const chemin = new Path([depart, ...ctx.planWalk(depart, batiment.door)], mPx(2));
        const groupe = new WalkingGroup(gens, batiment, mode, chemin);
        this.groups.push(groupe);
        gens.forEach((g, i) => {
          g.group = groupe;
          g.pathIndex = 0;
          if (mode === "flock") {
            g.state = "flock";
          } else if (i === 0) {
            g.state = "lead";
            g.path = chemin;
          } else {
            g.state = "follow";
            g.formationSlot = WalkingGroup.slot(i - 1);
          }
        });
      } else {
        for (const g of gens) {
          g.state = "walk";
          g.planWalkTo(ctx);
        }
      }
    }
  }

  nearestEsplanade(p) {
    return this.esplanades.reduce((m, z) => (p5.Vector.dist(z.center, p) < p5.Vector.dist(m.center, p) ? z : m));
  }

  // ---------- Conducteurs ----------

  // La voiture est garée : le conducteur descend (côté gauche) et va à son
  // bâtiment (surface) ou à l'ascenseur (garage). Parfois un collègue passager
  // descend aussi et part devant ; le conducteur, qui a son badge, le rattrape.
  spawnDriver(car) {
    const gauche = createVector(car.heading.y, -car.heading.x);
    const p = gauche.copy().mult(car.widthPx / 2 + mPx(0.6)).add(car.pos);
    const auGarage = car.level === -1;
    const cible = auGarage ? this.world.garage.elevatorDoor.copy() : car.building.door.copy();
    const conducteur = this.add({ x: p.x, y: p.y, building: car.building, level: car.level, state: "walk", target: cible, origin: auGarage ? "garage" : "voiture", heading: gauche });
    const ctx = this.context();
    if (auGarage) {
      conducteur.state = "arrive";
    } else {
      conducteur.planWalkTo(ctx);
    }
    if (this.rng() < this.config.badgeShare) {
      const q = gauche.copy().mult(-(car.widthPx / 2 + mPx(0.6))).add(car.pos);
      const passager = this.add({ x: q.x, y: q.y, building: car.building, level: car.level, state: "walk", target: cible.copy(), origin: conducteur.origin, heading: gauche.copy().mult(-1) });
      if (auGarage) passager.state = "arrive";
      else passager.planWalkTo(ctx);
      passager.waitingForBadge = true;
      conducteur.state = "pursue";
      conducteur.badgeFor = passager;
      conducteur.waitSteps = 0;
    }
    return conducteur;
  }

  // ---------- Retardataire ----------

  spawnLate(pos, building) {
    return this.add({ x: pos.x, y: pos.y, building, state: "run", origin: "retard" });
  }

  // ---------- Un pas ----------

  context() {
    return {
      obstacles: this.obstaclesSurface,
      threats: e => (this.movingCars ?? []).filter(c => c.level === e.level &&
        Math.abs(c.pos.x - e.pos.x) < e.evadeExitRadius + c.length && Math.abs(c.pos.y - e.pos.y) < e.evadeExitRadius + c.length),
      neighbors: (e, r) => this.grid.query(e.pos, r).filter(o => o !== e && o.level === e.level),
      planWalk: (de, a) => planWalk(this.campus, de, a, false),
      onAlighted: e => this.onAlighted(e)
    };
  }

  step() {
    // Voitures en mouvement, calculées une fois par pas (menaces des piétons).
    this.movingCars = this.cars().filter(c => c.state !== "parked");
    this.startDueWorkers();
    this.grid.rebuild(this.employees);
    const ctx = this.context();
    const ctxGarage = { ...ctx, obstacles: this.obstaclesGarage };
    for (const e of this.employees) {
      // Règle de scène : un flâneur va parfois chercher un café.
      if (e.state === "wander" && !e.holdsCoffee && this.rng() < this.config.coffeeChance) {
        e.state = "coffee";
        e.nextStateAfterCoffee = "wander";
      }
      e.step(e.level === -1 ? ctxGarage : ctx);
    }
    this.employees = this.employees.filter(e => e.state !== "gone");
    this.groups = this.groups.filter(g => g.members.some(m => m.state !== "gone"));
  }

  walkingCount() {
    return this.employees.filter(e => !["wander", "chat", "coffee", "gone"].includes(e.state)).length;
  }

  // Piétons proches d'un point (pour que les voitures leur cèdent le passage).
  near(pos, radius) {
    return this.grid.query(pos, radius);
  }
}
