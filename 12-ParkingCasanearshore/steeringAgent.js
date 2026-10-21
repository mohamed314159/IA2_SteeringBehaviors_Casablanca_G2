// SteeringAgent : sous-classe commune de toutes les entités mobiles de la
// simulation. Elle hérite de la base protégée (vehicle.js, copie de 1-Seek)
// et regroupe les comportements des autres dossiers du cours.
//
//   Comportement        Origine
//   seek, arrive        hérités de vehicle.js (1-Seek), via super
//   wander              hérité de vehicle.js (1-Seek), via super
//   flee                hérité ; fleeWithin d'après 2-PursueEvade
//   pursue              2-PursueEvade (prédiction), horizon borné T = D / vitesse (Reynolds)
//   evade               2-PursueEvade (predictThreatPosition) + rayon de détection
//                       distinct de la distance de sortie (consignes micbuffa)
//   follow(path)        5-2 / 5-3 (projection scalaire, segment le plus proche),
//                       limité aux segments devant le véhicule
//   avoid(obstacles)    6-ObstacleAvoidance / 7-Boids (ahead, ahead/2, position)
//                       étendu aux bâtiments polygonaux (closestPoint)
//   separate            6-ObstacleAvoidance / 5-3 (répulsion en 1/distance)
//   align, cohesion     7-Boids
//   followLeader        slides p. 50-51 et Reynolds : point derrière le leader,
//                       évasion devant lui, séparation
//
// Toutes ces méthodes RETOURNENT une force et ne dessinent rien : le rendu
// de debug lit les informations rangées dans this.debugInfo.
// Vehicle.debug reste à false : en mode debug, wander() et boundaries() de la
// base dessinent pendant le calcul, ce que l'on évite ici.
class SteeringAgent extends Vehicle {
  static debug = false;
  static nextId = 1;
  // Réglages par comportement (reglages.js) : { seek: { vitesse, taille }, ... }.
  // null : valeurs par défaut (facteurs 1), par exemple dans les tests.
  static settings = null;
  // Comportement principal → groupe de réglages.
  static GROUPS = { seek: "seek", neuro: "seek", pursue: "pursue", arrive: "arrive", wander: "wander", path: "path", boids: "boids", leader: "leader", file: "leader", evade: "evade" };

  // Lit un réglage, ou `defaut` s'il n'y a pas de réglages.
  static param(groupe, cle, defaut) {
    const s = SteeringAgent.settings;
    const v = s && s[groupe] ? s[groupe][cle] : undefined;
    return Number.isFinite(v) ? v : defaut;
  }

  constructor(x, y) {
    super(x, y);
    this.id = SteeringAgent.nextId++;
    // Nom du comportement actif (affiché en debug, choisit les réglages).
    this.behavior = "idle";
    // Direction mémorisée quand la vitesse devient nulle (leader arrêté, départ).
    this.heading = createVector(1, 0);
    // Vitesse (px/pas) au-dessous de laquelle la direction n'est plus mise à jour.
    this.headingSpeedThreshold = 0.02;

    // Arrive : la zone de freinage est celle de la base (rayonZoneDeFreinage).
    // Seuils d'arrêt : distance et vitesse résiduelle sous lesquelles on
    // considère l'entité arrivée.
    this.stopRadius = 2;
    this.stopSpeed = 0.05;

    // Pursue / evade : horizon de prédiction maximal, en images.
    this.predictionHorizon = 20;
    // Evade : déclenchement et sortie (sortie > détection : hystérésis).
    this.evadeDetectionRadius = 60;
    this.evadeExitRadius = 90;
    this.evadeState = { active: false, threat: null };

    // Suivi de chemin : anticipation (px), point visé plus loin sur le chemin,
    // nombre de segments examinés devant le segment courant.
    this.pathPredict = 25;
    this.pathTargetAhead = 25;
    this.pathWindow = 3;
    this.pathIndex = 0;

    // Évitement : longueur du vecteur ahead (en images de vitesse) et
    // demi-largeur de la zone balayée devant l'entité.
    this.aheadFrames = 30;
    this.avoidWidth = this.r;

    // Voisinage.
    this.separationRadius = this.r * 3;
    this.perceptionRadius = 50;

    // Suivi de leader : distance derrière le leader et rayon de la zone
    // interdite devant lui.
    this.leaderBehind = 30;
    this.leaderSightRadius = 25;

    this.lastForce = createVector(0, 0);
    this.debugInfo = {};
  }

  setBehavior(name) {
    this.behavior = name;
  }

  // Facteur des réglages pour le comportement en cours : celui du comportement
  // principal, multiplié par ceux de l'évasion et de l'évitement s'ils sont actifs.
  behaviorFactor(cle) {
    let f = SteeringAgent.param(SteeringAgent.GROUPS[this.behavior], cle, 1);
    if (this.evadeState.active) f *= SteeringAgent.param("evade", cle, 1);
    if (this.debugInfo.avoid && this.debugInfo.avoid.active) f *= SteeringAgent.param("avoid", cle, 1);
    return f;
  }

  // Vitesse max réglée : vitesse de base × facteur « vitesse » du comportement.
  speedFor(base) {
    return base * this.behaviorFactor("vitesse");
  }

  // Facteur de taille du dessin (réglage « taille » du comportement).
  sizeFactor() {
    return this.behaviorFactor("taille");
  }

  // ---------- Arrive ----------

  // Arrive hérité de la base avec la zone de freinage de l'entité.
  // Dans le seuil d'arrêt, la force freine (opposée à la vitesse résiduelle).
  arriveAt(target, distanceArret = 0) {
    if (!isFiniteVector(target)) return createVector(0, 0);
    this.debugInfo.arriveTarget = target.copy();
    if (p5.Vector.dist(this.pos, target) <= distanceArret + this.stopRadius) return this.brake();
    // Réglage « rayon de freinage (×) » appliqué le temps de l'appel.
    const rayon = this.rayonZoneDeFreinage;
    this.rayonZoneDeFreinage = rayon * SteeringAgent.param("arrive", "rayon", 1);
    this.debugInfo.slowRadius = this.rayonZoneDeFreinage;
    const force = super.arrive(target, distanceArret);
    this.rayonZoneDeFreinage = rayon;
    return force;
  }

  // Vrai quand l'entité est dans le seuil d'arrêt et quasiment immobile.
  hasArrived(target, distanceArret = 0) {
    return p5.Vector.dist(this.pos, target) <= distanceArret + this.stopRadius &&
      this.vel.mag() <= this.stopSpeed;
  }

  // Force qui annule la vitesse courante, bornée par maxForce.
  brake() {
    return this.vel.copy().mult(-1).limit(this.maxForce);
  }

  // ---------- Seek / flee ----------

  seekTo(target) {
    if (!isFiniteVector(target) || p5.Vector.dist(this.pos, target) === 0) return createVector(0, 0);
    return super.seek(target);
  }

  // Fuite seulement si la menace est dans le rayon de détection (2-PursueEvade).
  fleeWithin(target, distanceDeDetection = Infinity) {
    const position = target.pos || target;
    if (!isFiniteVector(position)) return createVector(0, 0);
    if (p5.Vector.dist(this.pos, position) > distanceDeDetection) return createVector(0, 0);
    return super.flee(position);
  }

  // ---------- Pursue / evade ----------

  // Position future de la cible, horizon T = distance / vitesse, borné.
  predictPosition(target, maxHorizon = this.predictionHorizon) {
    const distance = p5.Vector.dist(this.pos, target.pos);
    const vitesse = Math.max(this.maxSpeed, 0.0001);
    const horizon = Math.min(Math.max(0, maxHorizon), distance / vitesse);
    return target.vel.copy().mult(horizon).add(target.pos);
  }

  pursue(target, maxHorizon = SteeringAgent.param("pursue", "horizon", this.predictionHorizon)) {
    const futur = this.predictPosition(target, maxHorizon);
    this.debugInfo.pursuePoint = futur.copy();
    return this.seekTo(futur);
  }

  // Point de rapprochement le plus probable d'une menace (2-PursueEvade).
  predictThreatPosition(threat, maxPrediction = this.predictionHorizon) {
    const relativePosition = p5.Vector.sub(threat.pos, this.pos);
    const relativeVelocity = p5.Vector.sub(threat.vel, this.vel);
    const relativeSpeedSquared = relativeVelocity.magSq();
    let prediction = 0;
    if (relativeSpeedSquared > 0.0001) {
      prediction = -p5.Vector.dot(relativePosition, relativeVelocity) / relativeSpeedSquared;
      prediction = Math.min(Math.max(prediction, 0), Math.max(0, maxPrediction));
    }
    const predicted = threat.vel.copy().mult(prediction).add(threat.pos);
    if (p5.Vector.dist(this.pos, predicted) < 0.0001) return threat.pos.copy();
    return predicted;
  }

  evade(threat, maxPrediction = this.predictionHorizon) {
    const point = this.predictThreatPosition(threat, maxPrediction);
    this.debugInfo.evadePoint = point.copy();
    return super.flee(point);
  }

  // Évasion de la menace la plus proche. Elle démarre quand une menace entre
  // dans evadeDetectionRadius et continue, en mesurant la distance réelle,
  // jusqu'à ce que cette menace dépasse evadeExitRadius.
  evadeThreats(threats) {
    const etat = this.evadeState;
    // Réglages : rayons de détection et de sortie (facteurs).
    const detection = this.evadeDetectionRadius * SteeringAgent.param("evade", "detection", 1);
    const sortie = Math.max(detection, this.evadeExitRadius * SteeringAgent.param("evade", "sortie", 1));
    if (etat.active) {
      const encorePresente = threats.includes(etat.threat);
      if (!encorePresente || p5.Vector.dist(this.pos, etat.threat.pos) > sortie) {
        etat.active = false;
        etat.threat = null;
      }
    }
    if (!etat.active) {
      let plusProche = null;
      let record = Infinity;
      for (const t of threats) {
        if (t === this) continue;
        const d = p5.Vector.dist(this.pos, t.pos);
        if (d < record) {
          record = d;
          plusProche = t;
        }
      }
      if (plusProche && record <= detection) {
        etat.active = true;
        etat.threat = plusProche;
      }
    }
    if (!etat.active) return createVector(0, 0);
    return this.evade(etat.threat);
  }

  // ---------- Wander ----------

  // Wander hérité : le point de pilotage évolue progressivement (wanderTheta).
  // Le cercle est placé devant l'entité, à distanceCercle, de rayon wanderRadius.
  wanderAround() {
    // Réglages : rayon et distance du cercle (facteurs), variation (radians).
    const rayon = this.wanderRadius;
    const distance = this.distanceCercle;
    const variation = this.displaceRange;
    this.wanderRadius = rayon * SteeringAgent.param("wander", "rayon", 1);
    this.distanceCercle = distance * SteeringAgent.param("wander", "distance", 1);
    this.displaceRange = SteeringAgent.param("wander", "variation", variation);
    const force = super.wander();
    this.wanderRadius = rayon;
    this.distanceCercle = distance;
    this.displaceRange = variation;
    this.debugInfo.wander = { theta: this.wanderTheta };
    return force;
  }

  // ---------- Suivi de chemin ----------

  // Algorithme de 5-3 : position prédite, projection sur le segment le plus
  // proche, cible un peu plus loin sur le chemin, seek si on sort de la voie.
  // On n'examine que les segments à partir du segment courant (pathIndex) :
  // le véhicule ne revient pas en arrière aux croisements.
  // Une entité trop lente vise aussi la cible, pour démarrer.
  follow(path) {
    const n = path.segmentCount();
    if (n === 0) return createVector(0, 0);
    const direction = this.vel.magSq() > 1e-9 ? this.vel.copy() : this.heading.copy();
    const anticipation = SteeringAgent.param("path", "anticipation", 1);
    const predictPos = direction.setMag(this.pathPredict * anticipation).add(this.pos);

    let record = Infinity;
    let normal = null;
    let meilleurIndex = this.pathIndex;
    const fin = path.closed ? this.pathIndex + this.pathWindow : Math.min(n - 1, this.pathIndex + this.pathWindow);
    for (let k = this.pathIndex; k <= fin; k++) {
      const i = path.closed ? k % n : k;
      const [a, b] = path.segment(i);
      const candidat = closestPointOnSegment(predictPos, a, b);
      const d = p5.Vector.dist(predictPos, candidat);
      if (d < record) {
        record = d;
        normal = candidat;
        meilleurIndex = i;
      }
    }
    this.pathIndex = meilleurIndex;
    const target = path.pointAhead(meilleurIndex, normal, this.pathTargetAhead * anticipation);
    this.debugInfo.path = { predictPos, normal, target, onPath: record <= path.radius };

    if (record > path.radius || this.vel.mag() < this.maxSpeed * 0.5) return this.seekTo(target);
    return createVector(0, 0);
  }

  // Recale pathIndex sur le segment le plus proche de la position actuelle
  // (parmi les segments devant), quand on avance sans appeler follow().
  syncPathIndex(path) {
    const n = path.segmentCount();
    if (n === 0) return this.pathIndex;
    let record = Infinity;
    let meilleur = this.pathIndex;
    const fin = Math.min(n - 1, this.pathIndex + this.pathWindow);
    for (let i = this.pathIndex; i <= fin; i++) {
      const [a, b] = path.segment(i);
      const d = p5.Vector.dist(this.pos, closestPointOnSegment(this.pos, a, b));
      if (d < record) {
        record = d;
        meilleur = i;
      }
    }
    this.pathIndex = meilleur;
    return meilleur;
  }

  // Distance restante jusqu'au bout d'un chemin ouvert.
  remainingOnPath(path) {
    this.syncPathIndex(path);
    const [a, b] = path.segment(this.pathIndex);
    return path.remainingLength(this.pathIndex, closestPointOnSegment(this.pos, a, b));
  }

  // ---------- Évitement d'obstacles ----------

  // Points testés : bout de ahead, bout de ahead/2 et position (6 et 7-Boids).
  // Un obstacle fournit closestPoint(p) (bâtiment polygonal) ou { pos, r }.
  avoid(obstacles) {
    if (obstacles.length === 0) return createVector(0, 0);
    const vitesse = this.vel.magSq() > 1e-9 ? this.vel : this.heading;
    const ahead = vitesse.copy().mult(this.aheadFrames * SteeringAgent.param("avoid", "portee", 1));
    if (this.vel.magSq() <= 1e-9) ahead.setMag(this.r);
    const points = [p5.Vector.add(this.pos, ahead), p5.Vector.add(this.pos, ahead.copy().mult(0.5)), this.pos.copy()];

    let record = Infinity;
    let pointTeste = null;
    let surface = null;
    let obstacleProche = null;
    for (const o of obstacles) {
      if (o === this) continue;
      for (const p of points) {
        const s = obstacleSurfacePoint(o, p);
        const d = obstacleInside(o, p) ? -p5.Vector.dist(p, s) : p5.Vector.dist(p, s);
        if (d < record) {
          record = d;
          pointTeste = p;
          surface = s;
          obstacleProche = o;
        }
      }
    }
    this.debugInfo.avoid = { ahead: points[0], surface, active: false };
    if (!obstacleProche || record >= this.avoidWidth * SteeringAgent.param("avoid", "largeur", 1)) return createVector(0, 0);

    // Direction : du point de la surface vers le point testé (vers l'extérieur).
    let force = p5.Vector.sub(pointTeste, surface);
    if (record < 0) force.mult(-1);
    if (force.magSq() < 1e-12) force = p5.Vector.sub(pointTeste, obstacleCenter(obstacleProche));
    if (force.magSq() < 1e-12) force = rotatedVector(vitesse.x, vitesse.y, Math.PI / 2);
    this.debugInfo.avoid.active = true;
    return force.setMag(this.maxForce);
  }

  // ---------- Voisinage ----------

  // Séparation : répulsion en 1/distance des voisins à moins de separationRadius.
  // L'entité est exclue ; deux entités superposées s'écartent selon leur id.
  separate(neighbors, radius = this.separationRadius) {
    const somme = createVector(0, 0);
    let count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      const d = p5.Vector.dist(this.pos, other.pos);
      if (d >= radius) continue;
      let diff;
      if (d < 1e-6) {
        diff = createVector(this.id < other.id ? -1 : 1, 0);
      } else {
        diff = p5.Vector.sub(this.pos, other.pos).div(d * d);
      }
      somme.add(diff);
      count++;
    }
    if (count === 0 || somme.magSq() === 0) return createVector(0, 0);
    somme.div(count).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
    return somme;
  }

  // Alignement (7-Boids) : vitesse moyenne des voisins = vitesse désirée.
  align(neighbors, radius = this.perceptionRadius * SteeringAgent.param("boids", "perception", 1)) {
    const moyenne = createVector(0, 0);
    let count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      if (p5.Vector.dist(this.pos, other.pos) < radius) {
        moyenne.add(other.vel);
        count++;
      }
    }
    if (count === 0 || moyenne.magSq() === 0) return createVector(0, 0);
    moyenne.div(count).setMag(this.maxSpeed).sub(this.vel).limit(this.maxForce);
    return moyenne;
  }

  // Cohésion (7-Boids) : seek vers la position moyenne des voisins.
  cohesion(neighbors, radius = this.perceptionRadius * SteeringAgent.param("boids", "perception", 1)) {
    const centre = createVector(0, 0);
    let count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      if (p5.Vector.dist(this.pos, other.pos) < radius) {
        centre.add(other.pos);
        count++;
      }
    }
    if (count === 0) return createVector(0, 0);
    centre.div(count);
    this.debugInfo.cohesionCenter = centre.copy();
    return this.seekTo(centre);
  }

  // ---------- Suivi de leader ----------

  // Slides p. 50-51 : arrive sur une place derrière le leader (slot dans le
  // repère du leader : x vers l'arrière, y sur le côté), évasion si on est
  // dans la zone devant lui, séparation avec les autres suiveurs.
  // Retourne { arrive, evade, separate } : la composition se fait dans la
  // sous-classe (combineForces).
  followLeader(leader, followers = [], slot = { back: this.leaderBehind, side: 0 }) {
    const cap = leader.vel.magSq() > 1e-9 ? leader.vel.copy().normalize() : leader.heading.copy().normalize();
    const angle = cap.heading();
    const ecart = SteeringAgent.param("leader", "distance", 1);
    const decalage = rotatedVector(-slot.back * ecart, slot.side * ecart, angle);
    const place = p5.Vector.add(leader.pos, decalage);
    const devant = cap.copy().mult(this.leaderBehind).add(leader.pos);
    const zone = this.leaderSightRadius * SteeringAgent.param("leader", "zone", 1);
    const dansLaZone = p5.Vector.dist(this.pos, devant) <= zone || p5.Vector.dist(this.pos, leader.pos) <= zone;
    this.debugInfo.leader = { place: place.copy(), devant: devant.copy(), dansLaZone };
    return {
      arrive: this.arriveAt(place),
      evade: dansLaZone ? this.evade(leader) : createVector(0, 0),
      separate: this.separate(followers.filter(f => f !== leader))
    };
  }

  // ---------- Composition ----------

  // Composition par priorités (allocation prioritaire de Reynolds) : les
  // forces sont pondérées puis ajoutées dans l'ordre de la liste tant que le
  // budget maxForce n'est pas épuisé. La force finale ne dépasse jamais
  // maxForce, et une force prioritaire (évitement) n'est pas annulée par une
  // force opposée moins prioritaire.
  combineForces(entries) {
    const total = createVector(0, 0);
    let budget = this.maxForce;
    this.debugInfo.forces = {};
    for (const { name, force, weight = 1 } of entries) {
      if (!isFiniteVector(force) || !Number.isFinite(weight)) continue;
      const f = force.copy().mult(weight);
      this.debugInfo.forces[name] = f.copy();
      const m = f.mag();
      if (m === 0 || budget <= 0) continue;
      if (m <= budget) {
        total.add(f);
        budget -= m;
      } else {
        total.add(f.setMag(budget));
        budget = 0;
      }
    }
    return total;
  }

  // Applique la force composée (une seule fois par pas).
  steer(entries) {
    const force = this.combineForces(entries);
    this.lastForce = force.copy();
    this.applyForce(force);
    return force;
  }

  // Intégration héritée, une seule fois ; on mémorise la direction quand
  // l'entité avance vraiment (à vitesse quasi nulle, elle oscillerait).
  update() {
    super.update();
    if (this.vel.mag() > this.headingSpeedThreshold) this.heading = this.vel.copy().normalize();
  }
}

// Point de la surface d'un obstacle le plus proche de p.
function obstacleSurfacePoint(o, p) {
  if (typeof o.closestPoint === "function") return o.closestPoint(p);
  const dir = p5.Vector.sub(p, o.pos);
  if (dir.magSq() === 0) dir.set(1, 0);
  return dir.setMag(o.r).add(o.pos);
}

function obstacleInside(o, p) {
  if (typeof o.contains === "function") return o.contains(p);
  return p5.Vector.dist(p, o.pos) < o.r;
}

function obstacleCenter(o) {
  return o.center ? o.center : o.pos;
}
