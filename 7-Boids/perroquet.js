// Perroquet façon Minecraft (vue de profil, en 2D).
// C'est un Boid : la nuée (flock = alignement + cohésion + séparation
// + confinement + évitement), la fuite et la locomotion sont celles de
// boids.js, sans modification. Cette sous-classe ajoute seulement :
// - un dessin en pixel art (show) ;
// - une animation purement visuelle (battement d'ailes, cri au clic) ;
// - un test de clic (contientPoint).

class Perroquet extends Boid {
  // Les cinq couleurs des perroquets de Minecraft :
  // B = corps, W = aile, T = bout des ailes et de la queue.
  static VARIANTES = [
    { nom: 'rouge', B: '#d7261b', W: '#2f5fd0', T: '#f3cf2a' },
    { nom: 'bleu', B: '#2a48d8', W: '#1b2c8f', T: '#f1c827' },
    { nom: 'vert', B: '#5fc21a', W: '#2c62d6', T: '#d7261b' },
    { nom: 'cyan', B: '#22bfd3', W: '#167f92', T: '#f1c827' },
    { nom: 'gris', B: '#b8b8b8', W: '#8a8a8a', T: '#ececec' }
  ];

  // Couleurs communes : Y = bec, K = bout du bec, e = blanc de l'œil,
  // E = pupille, S = ombre du corps, F = pattes.
  static COULEURS_COMMUNES = { Y: '#f2b42e', K: '#3a3a3a', e: '#ffffff', E: '#111111', F: '#6f6f6f' };

  // Corps de profil, tourné vers la droite (12 x 11 pixels).
  static CORPS = [
    '.......BB...',
    '......BBBB..',
    '......BeEBY.',
    '......BBBBYY',
    '.....BBBBBBK',
    '....BBBBBB..',
    '...BBBBBBBB.',
    '..BBBBBBBSS.',
    '.TBBBBBBSS..',
    'TTBS.F..F...',
    'T...........'
  ];

  // Variante du corps bec ouvert, utilisée pendant le cri.
  static CORPS_CRI = [
    '.......BB...',
    '......BBBB..',
    '......BeEBY.',
    '......BBBBYY',
    '.....BBBBB..',
    '....BBBBBBYK',
    '...BBBBBBBB.',
    '..BBBBBBBSS.',
    '.TBBBBBBSS..',
    'TTBS.F..F...',
    'T...........'
  ];

  // Trois positions d'aile superposées au corps : haute, milieu, basse.
  static AILES = [
    ['............', '............', '............',
      '....TT......', '....WWW.....', '....WWWW....', '.....WWW....'],
    ['............', '............', '............', '............',
      '............', '............', '....WWWW....', '...WWWWW....', '...TTWW.....'],
    ['............', '............', '............', '............',
      '............', '............', '............', '...WWWW.....',
      '...WWWWW....', '....TTTT....', '....TT......']
  ];

  static LARGEUR_MOTIF = 12;
  static HAUTEUR_MOTIF = 11;
  // Durée de l'animation de cri, en images.
  static DUREE_CRI = 16;

  // Caches partagés : palettes et sprites (voir spriteDe).
  static palettes = new Map();
  static sprites = new Map();

  constructor(x, y, variante) {
    // Pas d'image : le perroquet est dessiné en pixel art.
    super(x, y);
    this.variante = variante !== undefined ? variante : random(Perroquet.VARIANTES);
    // Chaque perroquet a sa propre taille autour de la taille réglée.
    this.facteurTaille = random(0.85, 1.15);
    // État d'animation (visuel uniquement).
    this.phaseAiles = random(0, 3);
    this.regardeADroite = this.vel.x >= 0;
    this.cri = 0;
  }

  // Même calcul que Boid.fleeWithTargetRadius (zone = target.r + 10,
  // force flee multipliée par 100). Seule différence : le cercle rouge
  // de la zone n'est dessiné qu'en mode debug, pour ne pas abîmer le décor.
  fleeWithTargetRadius(target) {
    const d = this.pos.dist(target.pos);
    const rayonZoneAFuir = target.r + 10;

    if (d < rayonZoneAFuir) {
      if (Boid.debug) {
        push();
        noFill();
        stroke('red');
        strokeWeight(2);
        circle(target.pos.x, target.pos.y, rayonZoneAFuir * 2);
        pop();
      }

      const fleeForce = this.flee(target.pos);
      fleeForce.mult(100);
      this.applyForce(fleeForce);
    }
  }

  // Locomotion héritée, puis animation visuelle.
  update() {
    super.update();
    this.animer();
  }

  animer() {
    // Les ailes battent plus vite quand le perroquet va vite.
    const vitesseRelative = this.maxSpeed > 0 ? this.vel.mag() / this.maxSpeed : 0;
    this.phaseAiles += 0.18 + 0.22 * vitesseRelative;

    // Hystérésis : on ne se retourne que si le mouvement horizontal est net,
    // pour éviter un clignotement quand vel.x est proche de 0.
    const seuil = 0.15 * this.maxSpeed;
    if (this.vel.x > seuil) this.regardeADroite = true;
    else if (this.vel.x < -seuil) this.regardeADroite = false;

    if (this.cri > 0) this.cri--;
  }

  // Le clic est volontairement un peu plus large que le dessin.
  contientPoint(x, y) {
    return dist(x, y, this.pos.x, this.pos.y) < this.r * 0.6 + 4;
  }

  crier() {
    this.cri = Perroquet.DUREE_CRI;
  }

  couleursPlumes() {
    return [this.variante.B, this.variante.W, this.variante.T];
  }

  // Index de l'aile à dessiner : 0 haute, 1 milieu, 2 basse, 1 milieu...
  indexAile() {
    const cycle = [0, 1, 2, 1];
    const i = Math.floor(this.phaseAiles) % cycle.length;
    return cycle[(i + cycle.length) % cycle.length];
  }

  // Palette p5 d'une variante, créée une seule fois.
  static paletteDe(variante) {
    if (!Perroquet.palettes.has(variante.nom)) {
      const palette = {};
      const sources = { ...Perroquet.COULEURS_COMMUNES, B: variante.B, W: variante.W, T: variante.T };
      for (const code in sources) palette[code] = color(sources[code]);
      palette.S = lerpColor(color(variante.B), color(0), 0.25);
      Perroquet.palettes.set(variante.nom, palette);
    }
    return Perroquet.palettes.get(variante.nom);
  }

  // Sprite de 12 x 11 pixels (1 pixel de motif = 1 pixel d'image), dessiné
  // une seule fois par variante, position d'aile et état du bec, puis
  // agrandi sans lissage. C'est bien plus rapide que de redessiner chaque
  // pixel de chaque perroquet à chaque image.
  static spriteDe(variante, indexAile, becOuvert) {
    const cle = `${variante.nom}-${indexAile}-${becOuvert}`;
    if (!Perroquet.sprites.has(cle)) {
      const g = createGraphics(Perroquet.LARGEUR_MOTIF, Perroquet.HAUTEUR_MOTIF);
      g.pixelDensity(1);
      g.noStroke();
      const palette = Perroquet.paletteDe(variante);
      dessinerMotif(becOuvert ? Perroquet.CORPS_CRI : Perroquet.CORPS, palette, 0, 0, 1, g);
      dessinerMotif(Perroquet.AILES[indexAile], palette, 0, 0, 1, g);
      Perroquet.sprites.set(cle, g);
    }
    return Perroquet.sprites.get(cle);
  }

  show() {
    const largeur = this.r;
    const hauteur = this.r * Perroquet.HAUTEUR_MOTIF / Perroquet.LARGEUR_MOTIF;
    const sprite = Perroquet.spriteDe(this.variante, this.indexAile(), this.cri > 0);

    // Inclinaison selon la montée ou la descente, bornée pour rester lisible.
    const inclinaison = constrain(Math.atan2(this.vel.y, Math.abs(this.vel.x)), -0.5, 0.5);
    // Petit saut pendant le cri (visuel, la position réelle ne change pas).
    const progressionCri = this.cri / Perroquet.DUREE_CRI;
    const saut = this.cri > 0 ? -Math.sin(progressionCri * Math.PI) * this.r * 0.18 : 0;

    push();
    translate(this.pos.x, this.pos.y + saut);
    if (!this.regardeADroite) scale(-1, 1);
    rotate(inclinaison);
    imageMode(CORNER);
    image(sprite, -largeur / 2, -hauteur / 2, largeur, hauteur);
    pop();

    if (this.cri > 0) this.dessinerNote(progressionCri);
  }

  // Note de musique qui monte au-dessus de la tête pendant le cri,
  // comme les perroquets qui dansent près d'un jukebox dans Minecraft.
  dessinerNote(progression) {
    const montee = (1 - progression) * this.r * 0.8;
    push();
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(Math.max(12, this.r * 0.55));
    fill(255, 255, 255, 255 * progression);
    text('♪', this.pos.x + this.r * 0.25, this.pos.y - this.r * 0.7 - montee);
    pop();
  }
}
