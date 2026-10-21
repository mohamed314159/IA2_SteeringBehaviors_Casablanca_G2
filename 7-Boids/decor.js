// Décor : ciel (shader ciel.frag) et sol d'herbe façon Minecraft.
// Le décor n'est pas une entité de la simulation : il ne crée aucune force.
//
// - Le ciel est calculé par le shader dans un petit calque WEBGL
//   (1/ECHELLE_CIEL de la taille de l'écran), puis agrandi sans lissage :
//   c'est moins coûteux et donne un rendu pixelisé.
// - L'herbe est dessinée une seule fois dans un calque 2D (à la création et
//   au redimensionnement), puis recopiée à chaque image.

const ECHELLE_CIEL = 4;
// Taille d'un "pixel" de texture du sol, en pixels d'écran.
const PIXEL_SOL = 4;

// Hauteur de la bande d'herbe et de terre : 14 % de l'écran,
// arrondie à 8 px, entre 48 et 160 px.
function hauteurDuSol(hauteurEcran) {
  const brute = Math.round((hauteurEcran * 0.14) / 8) * 8;
  return Math.min(160, Math.max(48, brute));
}

// Générateur pseudo-aléatoire à graine (mulberry32) : le sol est identique
// à chaque lancement et ne consomme pas le random() de p5.
function creerAleatoire(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Description pure du sol (sans dessin) : pour chaque colonne de PIXEL_SOL px,
// l'épaisseur de l'herbe ; puis la position des touffes et des fleurs.
function genererSol(largeur, graine = 7) {
  const alea = creerAleatoire(graine);
  const nbColonnes = Math.ceil(largeur / PIXEL_SOL);
  const epaisseursHerbe = [];
  for (let i = 0; i < nbColonnes; i++) {
    epaisseursHerbe.push(3 + Math.floor(alea() * 3));
  }

  const touffes = [];
  const fleurs = [];
  for (let i = 0; i < nbColonnes; i++) {
    const tirage = alea();
    if (tirage < 0.05) {
      fleurs.push({ colonne: i, type: alea() < 0.5 ? 'coquelicot' : 'pissenlit' });
    } else if (tirage < 0.2) {
      touffes.push({ colonne: i, hauteur: 2 + Math.floor(alea() * 3) });
    }
  }
  return { nbColonnes, epaisseursHerbe, touffes, fleurs, alea };
}

class Decor {
  static COULEURS_TERRE = ['#866043', '#79553a', '#966c4a', '#6c4a31'];
  static COULEURS_HERBE = ['#5da130', '#6db43a', '#4f8f27', '#7cc142'];
  // Marge au-dessus du sol pour les touffes et les fleurs.
  static MARGE_HAUT = 6 * PIXEL_SOL;

  // sourcesCiel = { vert, frag } : textes des fichiers du shader.
  // Un shader p5 est lié au contexte WebGL qui l'a compilé : on le recompile
  // donc pour chaque nouveau calque (création et redimensionnement).
  constructor(sourcesCiel) {
    this.sourcesCiel = sourcesCiel;
    this.shaderCiel = null;
    this.calqueCiel = null;
    this.calqueSol = null;
    this.cielSecours = null;
  }

  redimensionner(largeur, hauteur) {
    // Au moins 1 px : une fenêtre masquée peut annoncer une taille nulle,
    // et un calque de taille nulle ne peut pas être dessiné.
    this.largeur = Math.max(1, Math.floor(largeur));
    this.hauteur = Math.max(1, Math.floor(hauteur));
    this.hauteurSol = hauteurDuSol(this.hauteur);
    this.yHorizon = Math.max(1, this.hauteur - this.hauteurSol);

    this.creerCalqueCiel();
    this.creerCalqueSol();
  }

  creerCalqueCiel() {
    if (this.calqueCiel) this.calqueCiel.remove();
    if (this.cielSecours) this.cielSecours.remove();
    this.calqueCiel = null;
    this.shaderCiel = null;
    this.cielSecours = null;

    const l = Math.ceil(this.largeur / ECHELLE_CIEL);
    const h = Math.ceil(this.hauteur / ECHELLE_CIEL);
    try {
      if (this.sourcesCiel) {
        const calque = createGraphics(l, h, WEBGL);
        calque.pixelDensity(1);
        calque.noStroke();
        this.shaderCiel = calque.createShader(this.sourcesCiel.vert, this.sourcesCiel.frag);
        this.calqueCiel = calque;
      }
    } catch (erreur) {
      console.warn('WEBGL indisponible : ciel sans shader.', erreur);
      this.calqueCiel = null;
      this.shaderCiel = null;
    }

    if (this.calqueCiel === null) this.creerCielSecours(l, h);
  }

  // Ciel de secours (dégradé fixe) si le WEBGL n'est pas disponible.
  creerCielSecours(l, h) {
    const g = createGraphics(l, h);
    g.pixelDensity(1);
    g.noStroke();
    const haut = color(102, 153, 255);
    const bas = color(194, 219, 255);
    const yHorizon = this.yHorizon / ECHELLE_CIEL;
    for (let y = 0; y < h; y += 2) {
      const t = Math.min(1, y / yHorizon);
      g.fill(lerpColor(haut, bas, t * t));
      g.rect(0, y, l, 2);
    }
    this.cielSecours = g;
  }

  creerCalqueSol() {
    if (this.calqueSol) this.calqueSol.remove();
    const marge = Decor.MARGE_HAUT;
    const g = createGraphics(this.largeur, this.hauteurSol + marge);
    g.pixelDensity(1);
    g.noStroke();

    const sol = genererSol(this.largeur);
    const p = PIXEL_SOL;
    const lignes = Math.ceil(this.hauteurSol / p);

    for (let col = 0; col < sol.nbColonnes; col++) {
      const herbe = sol.epaisseursHerbe[col];
      for (let ligne = 0; ligne < lignes; ligne++) {
        const palette = ligne < herbe ? Decor.COULEURS_HERBE : Decor.COULEURS_TERRE;
        // Surtout la teinte principale, avec quelques taches.
        const tirage = sol.alea();
        const indice = tirage < 0.55 ? 0 : 1 + Math.floor(sol.alea() * 3);
        g.fill(palette[indice]);
        g.rect(col * p, marge + ligne * p, p, p);
      }
    }

    // Petite ombre sous la couche d'herbe.
    g.fill(0, 0, 0, 35);
    for (let col = 0; col < sol.nbColonnes; col++) {
      g.rect(col * p, marge + sol.epaisseursHerbe[col] * p, p, p);
    }

    // Touffes d'herbe haute.
    for (const touffe of sol.touffes) {
      g.fill(Decor.COULEURS_HERBE[touffe.colonne % 2 === 0 ? 2 : 3]);
      g.rect(touffe.colonne * p, marge - touffe.hauteur * p, p, touffe.hauteur * p);
    }

    // Fleurs : tige verte et fleur de 2 x 2 pixels.
    for (const fleur of sol.fleurs) {
      const x = fleur.colonne * p;
      g.fill('#3f7d22');
      g.rect(x, marge - 3 * p, p, 3 * p);
      g.fill(fleur.type === 'coquelicot' ? '#d7261b' : '#f5d327');
      g.rect(x - p / 2, marge - 5 * p, 2 * p, 2 * p);
      g.fill(fleur.type === 'coquelicot' ? '#2a1a12' : '#f8a51c');
      g.rect(x, marge - 4.5 * p, p, p);
    }
    this.calqueSol = g;
  }

  dessinerCiel(tempsSecondes) {
    push();
    imageMode(CORNER);
    if (this.calqueCiel !== null) {
      this.shaderCiel.setUniform('u_resolution', [this.largeur, this.hauteur]);
      this.shaderCiel.setUniform('u_time', tempsSecondes);
      this.shaderCiel.setUniform('u_horizon', this.yHorizon);
      this.calqueCiel.shader(this.shaderCiel);
      this.calqueCiel.rect(0, 0, this.calqueCiel.width, this.calqueCiel.height);
      image(this.calqueCiel, 0, 0, this.largeur, this.hauteur);
    } else {
      image(this.cielSecours, 0, 0, this.largeur, this.hauteur);
    }
    pop();
  }

  dessinerSol() {
    push();
    imageMode(CORNER);
    image(this.calqueSol, 0, this.yHorizon - Decor.MARGE_HAUT);
    pop();
  }
}
