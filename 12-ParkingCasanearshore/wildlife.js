// Faune du parc (règles de scène) :
//  - deux chats chassent un papillon sur une pelouse ; quand l'un l'attrape,
//    un autre papillon apparaît ailleurs sur la pelouse ;
//  - des oiseaux apprennent par neuro-évolution à attraper un morceau de pain
//    qui se déplace au hasard. Un oiseau qui s'arrête sans l'avoir attrapé
//    disparaît puis réapparaît au nid avec un cerveau neuf : copie mutée du
//    meilleur (celui qui est allé le plus loin vers le pain, ou l'a attrapé le
//    plus vite). Quand le pain est attrapé, il réapparaît ailleurs dans sa
//    zone. Le score du meilleur vieillit un peu à chaque remplacement : un
//    record chanceux finit par céder la place à un cerveau plus régulier.
// Le nid est au bord de la zone du pain : un oiseau peut toujours l'atteindre
// avant d'épuiser son énergie.
// Aucune formule de steering ici : chats, papillons, oiseaux et pain
// calculent leurs forces eux-mêmes.
const WILDLIFE_CONFIG = {
  cats: 2,
  birds: 6,
  lawnRadiusM: 22,
  breadZoneRadiusM: 30,
  nestDistanceM: 45,       // nid à 45 m du centre de la zone du pain
  mutationRate: 0.15,
  mutationSd: 0.4,
  championDecay: 0.99      // vieillissement du score du meilleur à chaque remplacement
};

class Wildlife {
  constructor(lawn, breadZone, nest = null, rng = Math.random, config = WILDLIFE_CONFIG) {
    this.lawn = { center: lawn.copy(), radius: mPx(config.lawnRadiusM) };
    this.breadZone = { center: breadZone.copy(), radius: mPx(config.breadZoneRadiusM) };
    this.nest = nest ? nest.copy() : createVector(-mPx(config.nestDistanceM), 0).add(this.breadZone.center);
    this.rng = rng;
    this.config = config;
    this.cats = Array.from({ length: config.cats }, (_, i) => {
      const p = p5.Vector.fromAngle(i * Math.PI).mult(this.lawn.radius * 0.6).add(this.lawn.center);
      return new Cat(p.x, p.y, this.lawn, rng);
    });
    this.butterfly = this.spawnButterfly();
    this.butterfliesCaught = 0;
    this.bread = this.spawnBread();
    this.champion = null;          // meilleur cerveau
    this.championScore = -Infinity;
    this.generation = 1;
    this.breadCaught = 0;
    this.birds = Array.from({ length: config.birds }, () => this.spawnBird(null));
  }

  randomPointIn(zone) {
    const a = this.rng() * Math.PI * 2;
    const d = Math.sqrt(this.rng()) * zone.radius * 0.8;
    return p5.Vector.fromAngle(a).mult(d).add(zone.center);
  }

  spawnButterfly() {
    const p = this.randomPointIn(this.lawn);
    return new Butterfly(p.x, p.y, this.lawn, this.rng);
  }

  spawnBread() {
    const p = this.randomPointIn(this.breadZone);
    return new Bread(p.x, p.y, this.breadZone);
  }

  // Nouveau cerveau : copie mutée du champion, ou aléatoire au début.
  spawnBird(cerveau) {
    const p = p5.Vector.fromAngle(this.rng() * Math.PI * 2).mult(mPx(2)).add(this.nest);
    const brain = cerveau ? cerveau.copy().mutate(this.config.mutationRate, this.config.mutationSd, this.rng) : null;
    const oiseau = new Bird(p.x, p.y, brain ?? new NeuralNetwork(6, NN_HIDDEN, 2, this.rng), this.rng);
    oiseau.vel = p5.Vector.fromAngle(this.rng() * Math.PI * 2).mult(oiseau.maxSpeed * 0.5);
    return oiseau;
  }

  consider(oiseau) {
    const score = oiseau.fitness();
    if (score > this.championScore) {
      this.championScore = score;
      this.champion = oiseau.brain.copy();
    }
  }

  step() {
    // Chats et papillon
    for (const chat of this.cats) {
      if (chat.step(this.butterfly)) {
        this.butterfliesCaught++;
        this.butterfly = this.spawnButterfly();
      }
    }
    this.butterfly.step(this.cats);
    // Pain et oiseaux
    this.bread.step();
    for (let i = 0; i < this.birds.length; i++) {
      const oiseau = this.birds[i];
      if (oiseau.step(this.bread)) {
        // Capture : le gagnant devient la référence, le pain réapparaît.
        this.breadCaught++;
        this.consider(oiseau);
        this.bread = this.spawnBread();
        for (const o of this.birds) {
          o.startDist = null;
          o.minDist = Infinity;
        }
      } else if (oiseau.state === "stopped") {
        // Arrêté sans capture : il disparaît et réapparaît avec un cerveau neuf.
        this.consider(oiseau);
        this.championScore *= this.config.championDecay;
        this.birds[i] = this.spawnBird(this.champion);
        this.generation++;
      }
    }
  }

  stats() {
    return {
      generation: this.generation,
      breadCaught: this.breadCaught,
      championScore: Number.isFinite(this.championScore) ? this.championScore : 0,
      butterfliesCaught: this.butterfliesCaught
    };
  }

  entities() {
    return [...this.cats, this.butterfly, this.bread, ...this.birds];
  }
}
