// Véhicule de sécurité G4S (texte et couleurs, sans logo). Les G4S se
// déplacent en convoi de 4 : la tête fait la ronde du parc (path following
// sur une boucle de routes réelles, avec les règles de circulation de
// RoadVehicle), les trois autres suivent en colonne (suivi de leader sur la
// route : arrive sur leur place derrière le véhicule de devant, distance
// mesurée le long de la route ; évasion de la zone devant lui ; séparation).
// Sous-classe de RoadVehicle.
const G4S_CONFIG = {
  ...ROAD_CONFIG,
  insideSpeed: kmh(18),
  convoyGapM: 3.5,          // distance entre pare-chocs dans le convoi
  convoySlowRadius: mPx(14),
  catchUpFactor: 1.35       // un suiveur en retard rattrape à 1,35 × la vitesse du leader
};

class G4SVehicle extends RoadVehicle {
  constructor(x, y, options = {}) {
    super(x, y, { ...options, lengthM: 4.9, widthM: 2.0, config: { ...G4S_CONFIG, ...(options.config ?? {}) } });
    this.predecessor = options.predecessor ?? null; // véhicule de devant (null pour la tête)
    this.state = this.predecessor ? "convoy" : "patrol";
    this.number = options.number ?? 1;
    this.lightPhase = 0;
    this.leaderSightRadius = mPx(3);
    this.setBehavior(this.predecessor ? "leader" : "path");
  }

  static FOLLOW_STATES = ["patrol"];

  followStates() {
    return G4SVehicle.FOLLOW_STATES;
  }

  applySpeedLimit() {
    const base = this.config.insideSpeed * (this.predecessor ? this.config.catchUpFactor : 1);
    this.maxSpeed = this.speedFor(this.predecessor ? base : this.cornerSpeedLimit(base));
  }

  // Les suiveurs du convoi (suivi de leader, sur la route) :
  //  - ils restent sur la voie : ils visent le point de la route situé devant
  //    eux (path following), sans couper les virages ;
  //  - leur vitesse est celle d'un arrive sur leur place derrière le véhicule
  //    de devant (zone de freinage ≥ v² / maxForce) ;
  //  - ils évitent la zone devant le véhicule de devant (evade) ;
  //  - si une autre voiture ou un piéton se trouve entre eux et leur place,
  //    ils lui cèdent comme dans une file (A3 de RoadVehicle).
  chooseForces(ctx) {
    if (!this.predecessor) return super.chooseForces(ctx);
    const w = this.config.weights;
    // Zone de freinage calculée sur la vitesse actuelle (et non la vitesse
    // max de rattrapage) : R ≥ v² / maxForce suffit pour s'arrêter à sa place,
    // et le suiveur reste plus près de son leader.
    const v = this.vel.mag();
    const rayon = Math.max(this.config.convoySlowRadius, ((v * v) / this.maxForce) * 1.2);
    this.rayonZoneDeFreinage = rayon;
    const ecart = this.predecessor.length / 2 + this.length / 2 + mPx(this.config.convoyGapM);
    const f = this.followLeader(this.predecessor, [], { back: ecart, side: 0 });
    const contrainte = this.queueConstraint(ctx.cars.filter(c => c !== this.predecessor), null, ctx.pedestrians ?? []);
    // Distance jusqu'à sa place, mesurée le long de la route (dans un virage
    // serré, la ligne droite sous-estimerait l'écart).
    let leLong = this.path.distanceAlong(this.path.positionAlong(this.pathIndex, this.pos),
      this.path.positionAlong(this.predecessor.pathIndex, this.predecessor.pos));
    // Indice pas encore à jour (plus d'un demi-tour d'écart) : la ligne droite.
    const enLigneDroite = p5.Vector.dist(this.pos, this.predecessor.pos);
    if (leLong > this.path.length() / 2) leLong = enLigneDroite;
    // Mais jamais plus près que 1 m du véhicule de devant, même en ligne
    // droite (dans une épingle, les deux voies sont proches).
    const degagement = enLigneDroite - (this.predecessor.length / 2 + this.length / 2 + mPx(1));
    const versSaPlace = Math.min(leLong - ecart * SteeringAgent.param("leader", "distance", 1), degagement);
    const cede = contrainte !== null && contrainte.libre < versSaPlace;
    const nom = cede ? "file" : "leader";
    this.detectDeadlock(nom);
    this.setBehavior(nom);
    const separation = { name: "separate", force: this.separationForce(ctx.cars), weight: w.separate };
    if (cede) return [{ name: "file", force: this.queueForce(contrainte), weight: w.leader }, separation];
    this.follow(this.path);
    const cible = this.debugInfo.path.target;
    const vitesse = Math.min(this.maxSpeed, (this.maxSpeed * Math.max(0, versSaPlace)) / rayon);
    const desiree = p5.Vector.sub(cible, this.pos);
    const force = desiree.magSq() > 1e-9 ? desiree.setMag(vitesse).sub(this.vel).limit(this.maxForce) : this.brake();
    return [{ name: "evade", force: f.evade, weight: 1 }, separation, { name: "leader", force, weight: 1 }];
  }

  transitions() {
    this.lightPhase++;
  }

  show() {
    const L = this.length;
    const W = this.widthPx;
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.heading.heading());
    scale(this.sizeFactor());
    noStroke();
    fill(0, 0, 0, 70);
    rect(-L / 2 + 0.35, -W / 2 + 0.5, L, W, W * 0.25);
    fill(15);
    for (const x of [-L * 0.33, L * 0.2]) {
      rect(x, -W / 2 - 0.25, L * 0.14, 0.55, 0.2);
      rect(x, W / 2 - 0.3, L * 0.14, 0.55, 0.2);
    }
    fill(248);
    stroke(0, 0, 0, 150);
    strokeWeight(0.12);
    rect(-L / 2, -W / 2, L, W, W * 0.25);
    noStroke();
    // bandes rouges et toit
    fill(200, 16, 46);
    rect(-L / 2 + 0.3, -W / 2 + 0.25, L - 0.6, 0.35);
    rect(-L / 2 + 0.3, W / 2 - 0.6, L - 0.6, 0.35);
    fill(140, 180, 215);
    rect(L * 0.18, -W / 2 + 0.4, L * 0.1, W - 0.8, 0.3);
    fill(225);
    rect(-L * 0.3, -W / 2 + 0.45, L * 0.46, W - 0.9, 0.4);
    // rampe lumineuse (orange clignotant)
    const allume = Math.floor(this.lightPhase / 6) % 2 === 0;
    fill(allume ? color(255, 160, 0) : color(120, 80, 0));
    rect(-L * 0.05, -W / 2 + 0.5, 0.5, W - 1);
    fill(200, 16, 46);
    textAlign(CENTER, CENTER);
    textSize(1.3);
    textStyle(BOLD);
    text("G4S", -L * 0.2, 0.1);
    textStyle(NORMAL);
    fill(255, 248, 210);
    rect(L / 2 - 0.4, -W / 2 + 0.25, 0.4, 0.5);
    rect(L / 2 - 0.4, W / 2 - 0.75, 0.4, 0.5);
    fill(this.braking ? color(255, 40, 40) : color(110, 20, 20));
    rect(-L / 2, -W / 2 + 0.25, 0.4, 0.5);
    rect(-L / 2, W / 2 - 0.75, 0.4, 0.5);
    pop();
  }
}
