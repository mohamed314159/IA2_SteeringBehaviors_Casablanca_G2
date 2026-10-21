// Employé (piéton) : sous-classe de SteeringAgent.
//
// Sélection d'action (états) et comportements utilisés :
//   wander      avant 8h55, flâne près d'un stand de café (wander + confinement : seek
//               vers le centre de la zone s'il s'en éloigne)
//   chat        discute en groupe : arrive sur sa place autour du groupe
//   coffee      va chercher un café : arrive au comptoir du kiosque, attend
//   seekCoffee  sorti du tram, fonce vers le kiosque (seek, sans freiner)
//   alight      descend du tram : arrive à quelques mètres
//               de la porte (comme 5-3/passenger.js)
//   walk        marche seul vers son bâtiment (path following)
//   flock       marche en groupe de collègues (path following + boids :
//               alignement, cohésion, séparation)
//   lead        guide d'un groupe en formation (path following, plus lent)
//   follow      suit le guide en formation (suivi de leader : place derrière
//               lui, évasion de la zone devant lui, séparation)
//   run         en retard : court vers sa porte (seek, sans freiner) en visant
//               un à un les points de son itinéraire piéton (trottoirs)
//   sit         s'assoit sur un banc (arrive sur la place), puis repart flâner
//   arrive      arrive à la porte du bâtiment (A9) ou à l'ascenseur (A18)
//   gone        est entré : la scène le retire
// Dans tous les états mobiles : évitement des bâtiments, kiosques, bancs,
// jardinières et poteaux (avoid), évasion des voitures qui roulent (evade),
// séparation avec les piétons voisins.
const EMPLOYEE_CONFIG = {
  walkSpeed: kmh(5),
  wanderSpeed: kmh(2.2),
  runSpeed: kmh(12),
  runForce: 0.15,            // en courant, on tourne plus vite qu'en marchant
  waypointRadiusM: 4,        // point de passage atteint à 4 m : on vise le suivant
  leadSpeedFactor: 0.85,     // le guide ralentit pour que le groupe suive
  hurryFactor: 1.35,         // après 8h55, ceux qui marchent encore pressent le pas
  maxForce: 0.05,
  bodyRadiusM: 0.3,
  sizeFactor: 2.2,           // dessin et rayon agrandis pour rester visibles
  doorSlowRadius: mPx(4),    // A9 : porte du bâtiment
  elevatorSlowRadius: mPx(3),// A18 : porte de l'ascenseur
  slotSlowRadius: mPx(2),    // places de discussion et de formation
  counterSlowRadius: mPx(3), // comptoir du café
  alightSlowRadius: mPx(2),
  enterDistance: mPx(1),     // disparaît à 1 m de la porte
  coffeeWaitSteps: stepsFor(6),
  sitSeconds: [20, 70],      // durée assise sur un banc
  evadeDetectionM: 6,
  evadeExitM: 9,
  weights: { avoid: 3, evade: 2.5, separate: 1.2, follow: 1, arrive: 1, seek: 1, wander: 0.8, containment: 1.5, align: 0.6, cohesion: 0.5, leader: 1 }
};

class Employee extends SteeringAgent {
  constructor(x, y, options = {}) {
    super(x, y);
    this.config = { ...EMPLOYEE_CONFIG, ...(options.config ?? {}) };
    this.look = options.look ?? { outfit: OUTFITS[0], skin: SKIN_TONES[0], hair: HAIR_COLORS[0] };
    this.building = options.building ?? null;
    this.level = options.level ?? 0;
    this.r = mPx(this.config.bodyRadiusM) * this.config.sizeFactor;
    this.length = this.r * 2;
    this.isPedestrian = true;
    this.maxSpeed = this.config.walkSpeed;
    this.maxForce = this.config.maxForce;
    this.stopRadius = mPx(0.4);
    this.stopSpeed = 0.03;
    this.separationRadius = this.r * 3;
    this.perceptionRadius = mPx(6);
    this.aheadFrames = 20;
    this.avoidWidth = this.r * 1.2;
    this.pathPredict = mPx(1.5);
    this.pathTargetAhead = mPx(2.5);
    this.pathWindow = 3;
    this.evadeDetectionRadius = mPx(this.config.evadeDetectionM);
    this.evadeExitRadius = mPx(this.config.evadeExitM);
    this.leaderBehind = mPx(1.6);
    this.leaderSightRadius = mPx(1.5);
    // Wander : petit cercle devant le piéton.
    this.distanceCercle = mPx(4);
    this.wanderRadius = mPx(2);
    this.displaceRange = 0.25;

    this.state = options.state ?? "walk";
    this.target = options.target ? options.target.copy() : null; // porte ou ascenseur
    this.path = options.path ?? null;
    this.zone = options.zone ?? null;         // esplanade (centre, rayon, kiosque)
    this.slot = null;                         // place de discussion
    this.group = null;                        // groupe de marche
    this.formationSlot = null;
    this.holdsCoffee = false;
    this.waitSteps = 0;
    this.walkPhase = options.phase ?? 0;
    this.heading = options.heading ? options.heading.copy() : createVector(1, 0);
    this.onEnter = options.onEnter ?? null;
    this.setBehavior("idle");
  }

  // ---------- Forces communes ----------

  // Obstacles proches (les bâtiments sont filtrés par leur rayon englobant).
  // Son propre bâtiment est ignoré près de la porte, pour pouvoir l'atteindre.
  // La liste est recalculée tous les 10 pas (un piéton avance d'à peine
  // 3 m pendant ce temps) avec une portée élargie d'autant.
  nearbyObstacles(obstacles) {
    this.obstacleCacheAge = (this.obstacleCacheAge ?? 10) + 1;
    if (this.obstacleCacheAge < 10 && this.obstacleCache && this.obstacleSource === obstacles) return this.obstacleCache;
    const proches = [];
    const portee = this.aheadFrames * this.maxSpeed + this.r * 4 + mPx(4);
    const presDeLaPorte = this.target && p5.Vector.dist(this.pos, this.target) < mPx(12);
    for (const o of obstacles) {
      if (o === this.building && presDeLaPorte) continue;
      if (o === this.bench) continue;
      const rayon = o.r ?? 0;
      if (p5.Vector.dist(this.pos, o.pos) - rayon < portee) proches.push(o);
    }
    this.obstacleCache = proches;
    this.obstacleSource = obstacles;
    this.obstacleCacheAge = 0;
    return proches;
  }

  commonForces(ctx) {
    const w = this.config.weights;
    const entrees = [];
    entrees.push({ name: "avoid", force: this.avoid(this.nearbyObstacles(ctx.obstacles)), weight: w.avoid * SteeringAgent.param("avoid", "poids", 1) });
    const menaces = ctx.threats(this);
    entrees.push({ name: "evade", force: this.evadeThreats(menaces), weight: w.evade * SteeringAgent.param("evade", "poids", 1) });
    return entrees;
  }

  arriveWith(target, slowRadius, distanceArret = 0) {
    this.rayonZoneDeFreinage = slowRadius;
    return this.arriveAt(target, distanceArret);
  }

  // Allure de marche : on presse le pas après 8h55 (règle de scène lue dans le contexte).
  pace(ctx) {
    return ctx.hurry ? this.config.hurryFactor : 1;
  }

  // ---------- Sélection d'action : forces de l'état ----------

  chooseForces(ctx) {
    const w = this.config.weights;
    // Membre d'une discussion arrivé à sa place : il reste là (freinage) ;
    // il ne s'écarte que si une voiture approche.
    if (this.state === "chat" && this.hasArrived(this.slot)) {
      const menaces = ctx.threats(this);
      this.setBehavior("arrive");
      return menaces.length ? [{ name: "evade", force: this.evadeThreats(menaces), weight: w.evade }, { name: "brake", force: this.brake() }] : [{ name: "brake", force: this.brake() }];
    }
    const entrees = this.commonForces(ctx);
    const voisins = ctx.neighbors(this, this.separationRadius);
    let nom = this.state;
    switch (this.state) {
      case "wander": {
        this.maxSpeed = this.speedFor(this.config.wanderSpeed);
        entrees.push({ name: "separate", force: this.separate(voisins), weight: w.separate });
        if (this.zone && p5.Vector.dist(this.pos, this.zone.center) > this.zone.radius) {
          entrees.push({ name: "containment", force: this.seekTo(this.zone.center), weight: w.containment });
        }
        entrees.push({ name: "wander", force: this.wanderAround(), weight: w.wander });
        nom = "wander";
        break;
      }
      case "chat":
        this.maxSpeed = this.speedFor(this.config.wanderSpeed);
        // Pas de séparation avec les membres de sa propre discussion (cercle serré).
        entrees.push({ name: "separate", force: this.separate(voisins.filter(v => !this.chat || v.chat !== this.chat)), weight: w.separate * 0.5 });
        entrees.push({ name: "arrive", force: this.arriveWith(this.slot, this.config.slotSlowRadius), weight: w.arrive });
        nom = "arrive";
        break;
      case "coffee":
        this.maxSpeed = this.speedFor(this.config.walkSpeed);
        entrees.push({ name: "arrive", force: this.arriveWith(this.zone.kiosk.counter, this.config.counterSlowRadius), weight: w.arrive });
        nom = "arrive";
        break;
      case "seekCoffee":
        this.maxSpeed = this.speedFor(this.config.walkSpeed * 1.4);
        entrees.push({ name: "seek", force: this.seekTo(this.zone.kiosk.counter), weight: w.seek });
        nom = "seek";
        break;
      case "alight":
        entrees.push({ name: "arrive", force: this.arriveWith(this.target, this.config.alightSlowRadius), weight: w.arrive });
        nom = "arrive";
        break;
      case "walk":
      case "lead":
        this.maxSpeed = this.speedFor(this.config.walkSpeed * this.pace(ctx) * (this.state === "lead" ? this.config.leadSpeedFactor : 1));
        entrees.push({ name: "separate", force: this.separate(voisins), weight: w.separate });
        entrees.push({ name: "path", force: this.follow(this.path), weight: w.follow });
        nom = "path";
        break;
      case "flock": {
        this.maxSpeed = this.speedFor(this.config.walkSpeed * this.pace(ctx));
        // Priorités (Reynolds) : séparation, puis le but (le chemin), puis
        // alignement et cohésion avec ce qui reste du budget de force.
        const groupe = this.group.members.filter(m => m !== this && m.state === "flock");
        entrees.push({ name: "separate", force: this.separate(groupe.concat(voisins)), weight: w.separate * SteeringAgent.param("boids", "separation", 1) });
        entrees.push({ name: "path", force: this.follow(this.group.path), weight: w.follow });
        entrees.push({ name: "align", force: this.align(groupe), weight: w.align * SteeringAgent.param("boids", "alignement", 1) });
        entrees.push({ name: "cohesion", force: this.cohesion(groupe), weight: w.cohesion * SteeringAgent.param("boids", "cohesion", 1) });
        nom = "boids";
        break;
      }
      case "follow": {
        this.maxSpeed = this.speedFor(this.config.walkSpeed * 1.1 * this.pace(ctx));
        const chef = this.group.leader;
        const suiveurs = this.group.members.filter(m => m.state === "follow");
        this.rayonZoneDeFreinage = this.config.slotSlowRadius;
        const f = this.followLeader(chef, suiveurs, this.formationSlot);
        entrees.push({ name: "leaderEvade", force: f.evade, weight: w.evade });
        entrees.push({ name: "separate", force: f.separate, weight: w.separate });
        entrees.push({ name: "leader", force: f.arrive, weight: w.leader });
        nom = "leader";
        break;
      }
      case "run":
        this.maxSpeed = this.speedFor(this.config.runSpeed);
        this.maxForce = this.config.runForce;
        entrees.push({ name: "seek", force: this.seekTo(this.runWaypoint()), weight: w.seek });
        nom = "seek";
        break;
      case "sit":
        // Assis : on reste sur le banc ; sinon on y va (arrive sur la place).
        if (this.seated) {
          entrees.push({ name: "brake", force: this.brake(), weight: 1 });
          nom = "idle";
        } else {
          this.maxSpeed = this.speedFor(this.config.wanderSpeed * 1.3);
          entrees.push({ name: "arrive", force: this.arriveWith(this.seat.pos, this.config.slotSlowRadius), weight: w.arrive });
          nom = "arrive";
        }
        break;
      case "arrive": {
        this.maxSpeed = this.speedFor(this.config.walkSpeed);
        const rayon = this.level === -1 ? this.config.elevatorSlowRadius : this.config.doorSlowRadius;
        entrees.push({ name: "separate", force: this.separate(voisins), weight: w.separate * 0.5 });
        entrees.push({ name: "arrive", force: this.arriveWith(this.target, rayon), weight: w.arrive });
        nom = "arrive";
        break;
      }
      default:
        entrees.push({ name: "brake", force: this.brake(), weight: 1 });
        nom = "idle";
    }
    this.setBehavior(nom);
    return entrees;
  }

  // Un pas : sélection d'action → forces → intégration héritée (une fois).
  step(ctx) {
    if (this.state === "gone") return;
    this.steer(this.chooseForces(ctx));
    this.update();
    this.walkPhase += this.vel.mag() * 0.9;
    this.transitions(ctx);
  }

  // ---------- Transitions (règles explicites) ----------

  transitions(ctx) {
    switch (this.state) {
      case "coffee":
        if (p5.Vector.dist(this.pos, this.zone.kiosk.counter) < mPx(0.8) && this.vel.mag() < 0.05) {
          this.waitSteps++;
          if (this.waitSteps >= this.config.coffeeWaitSteps) {
            this.holdsCoffee = true;
            this.waitSteps = 0;
            this.state = this.nextStateAfterCoffee ?? "wander";
            if (this.state === "walk") this.planWalkTo(ctx);
          }
        }
        break;
      case "seekCoffee":
        // Le seek ne freine pas : à 2 m du comptoir, on termine en arrive.
        if (p5.Vector.dist(this.pos, this.zone.kiosk.counter) < mPx(2)) this.state = "coffee";
        break;
      case "alight":
        if (p5.Vector.dist(this.pos, this.target) < mPx(0.6) && this.vel.mag() < 0.05) ctx.onAlighted(this);
        break;
      case "walk":
      case "lead":
      case "flock": {
        const chemin = this.state === "flock" ? this.group.path : this.path;
        if (p5.Vector.dist(this.pos, this.target) <= this.config.doorSlowRadius || this.remainingOnPath(chemin) <= this.config.doorSlowRadius) {
          this.state = "arrive";
        }
        break;
      }
      case "follow":
        if (this.group.leader.state === "arrive" || this.group.leader.state === "gone") this.state = "arrive";
        break;
      case "run":
        if (p5.Vector.dist(this.pos, this.target) <= mPx(2)) {
          this.state = "arrive";
          this.maxForce = this.config.maxForce;
        }
        break;
      case "sit":
        if (!this.seated && p5.Vector.dist(this.pos, this.seat.pos) < mPx(0.4) && this.vel.mag() < 0.05) {
          this.seated = true;
          this.vel.set(0, 0);
          this.heading = this.bench.facing.copy();
        } else if (this.seated && --this.sitSteps <= 0) {
          this.standUp();
          this.state = "wander";
        }
        break;
      case "arrive":
        if (p5.Vector.dist(this.pos, this.target) <= this.config.enterDistance) {
          this.state = "gone";
          this.vel.set(0, 0);
          if (this.onEnter) this.onEnter(this);
        }
        break;
    }
  }

  // S'assoit sur une place libre du banc (règle de scène : la place est réservée).
  sitOn(banc, seat, duree) {
    this.bench = banc;
    this.seat = seat;
    seat.occupant = this;
    this.seated = false;
    this.obstacleCacheAge = 10; // recalcule les obstacles (sans son banc)
    this.sitSteps = duree;
    this.state = "sit";
  }

  standUp() {
    if (this.bench) this.bench.release(this);
    this.bench = null;
    this.seat = null;
    this.seated = false;
  }

  // Calcule le chemin à pied jusqu'à la cible (réseau piéton).
  planWalkTo(ctx) {
    this.path = new Path([this.pos.copy(), ...ctx.planWalk(this.pos, this.target)], mPx(1.5));
    this.pathIndex = 0;
    this.waypoint = 1;
  }

  // Point visé par le seek du retardataire : le prochain point de son
  // itinéraire ; on passe au suivant à waypointRadiusM. Sans itinéraire : la cible.
  runWaypoint() {
    const points = this.path ? this.path.points : [this.target];
    let i = Math.min(this.waypoint ?? 0, points.length - 1);
    while (i < points.length - 1 && p5.Vector.dist(this.pos, points[i]) < mPx(this.config.waypointRadiusM)) i++;
    this.waypoint = i;
    return points[i];
  }

  show(zoom = 1) {
    push();
    translate(this.pos.x, this.pos.y);
    // À l'arrêt dans une discussion, on regarde le centre du groupe.
    let cap = this.heading.heading();
    if (this.state === "chat" && this.chatCenter && this.vel.mag() < 0.05) cap = Math.atan2(this.chatCenter.y - this.pos.y, this.chatCenter.x - this.pos.x);
    rotate(cap);
    scale(this.sizeFactor());
    drawEmployee(this.look, this.r, { phase: this.walkPhase, moving: this.vel.mag() > 0.05 && !this.seated, coffee: this.holdsCoffee, highlight: this.highlight, seated: this.seated });
    pop();
  }
}
