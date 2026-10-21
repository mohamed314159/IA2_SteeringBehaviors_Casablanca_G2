// Flocking
// Daniel Shiffman
// https://thecodingtrain.com/CodingChallenges/124-flocking-boids.html
// https://youtu.be/mhjuuHl6qHM
//
// Version "perroquets Minecraft" : la mécanique (flock, fuite, wander + seek
// du prédateur) est celle de l'exemple d'origine. Les boids sont des
// Perroquet, le requin est remplacé par un ou plusieurs Chasseur.

// Equivalent du tableau de véhicules dans les autres exemples
const flock = [];
let chasseurs = [];
let plumes = [];
let obstacleSouris;
let obstacles = [];

let reglages;
let panneau;
let soundbox;
let decor;
let sourcesCiel;
let elementCanvas;

function preload() {
  // Le seul shader de l'exemple : le ciel (voir shaders/ciel.frag).
  // On charge le texte des fichiers ; le shader est compilé par le décor
  // pour son propre calque WEBGL.
  sourcesCiel = {
    vert: loadStrings('shaders/ciel.vert'),
    frag: loadStrings('shaders/ciel.frag')
  };
}

function setup() {
  elementCanvas = createCanvas(windowWidth, windowHeight).elt;
  // Pas de lissage des images : le ciel calculé en basse résolution
  // reste pixelisé quand on l'agrandit.
  noSmooth();
  describe('Des perroquets Minecraft volent en nuée dans un ciel bleu au-dessus de l\'herbe. ' +
    'Un vieil homme aux cheveux blancs armé d\'une épée en diamant les poursuit lentement.');

  reglages = { ...REGLAGES_INITIAUX };
  soundbox = new SoundBox({ volume: reglages.volume });

  decor = new Decor({ vert: sourcesCiel.vert.join('\n'), frag: sourcesCiel.frag.join('\n') });
  decor.redimensionner(width, height);

  // Panneau de réglages (bouton ⚙ en haut à droite, touche P)
  panneau = creerPanneauReglages(reglages, DEFINITIONS_REGLAGES, appliquerReglage);

  // On crée les "boids". Un boid en anglais signifie "un oiseau" ou "un poisson"
  // Dans cet exemple c'est l'équivalent d'un véhicule dans les autres exemples
  ajusterEffectif(flock, reglages.nbPerroquets, () => creerPerroquet(random(width), random(decor.yHorizon)));

  // prédateurs
  ajusterEffectif(chasseurs, reglages.nbChasseurs, creerChasseur);

  // souris = obstacle (invisible, il repousse les perroquets comme avant)
  obstacleSouris = new ObstacleMinecraft(mouseX, mouseY, 30, true);
  obstacles.push(obstacleSouris);
}

function creerPerroquet(x, y) {
  const p = new Perroquet(x, y);
  appliquerAuPerroquet(p, reglages);
  // Les perroquets restent dans le ciel (comportement boundaries de Boid).
  p.boundariesWidth = width;
  p.boundariesHeight = decor.yHorizon;
  return p;
}

function creerChasseur() {
  const c = new Chasseur(random(width), random(decor.yHorizon));
  appliquerAuChasseur(c, reglages);
  return c;
}

// Appelée par le panneau pendant le glissement d'un curseur.
function appliquerReglage(cle, valeur) {
  if (cle === 'nbPerroquets') {
    ajusterEffectif(flock, valeur, () => creerPerroquet(random(width), random(decor.yHorizon)));
  } else if (cle === 'nbChasseurs') {
    ajusterEffectif(chasseurs, valeur, creerChasseur);
  } else if (cle === 'volume') {
    soundbox.setVolume(valeur);
  } else if (CLES_PERROQUET.includes(cle)) {
    flock.forEach(p => appliquerAuPerroquet(p, reglages));
  } else if (CLES_CHASSEUR.includes(cle)) {
    chasseurs.forEach(c => appliquerAuChasseur(c, reglages));
  }
}

function draw() {
  // Fond : ciel (shader) puis herbe
  decor.dessinerCiel(millis() / 1000);
  decor.dessinerSol();

  // mettre à jour le nombre de boids
  panneau.majCompteur(flock.length);

  for (let boid of flock) {
    // équivalent de applyBehaviors, cohesion + separation + alignenement + confinement
    boid.flock(flock, obstacles);

    // chaque perroquet fuit chaque chasseur (comme il fuyait le requin)
    for (const chasseur of chasseurs) {
      boid.fleeWithTargetRadius(chasseur);
    }

    // on teste le comportement fleeWithTargetRadius sur l'obstacle souris
    boid.fleeWithTargetRadius(obstacles[0]);

    boid.update();
    boid.show();
  }

  // CHASSEURS (anciennement le requin)
  for (const chasseur of chasseurs) {
    mettreAJourChasseur(chasseur);
  }

  // plumes des perroquets touchés
  for (const plume of plumes) {
    plume.update();
    plume.show();
  }
  plumes = plumes.filter(plume => !plume.estMorte());

  // souris = obstacle
  obstacleSouris.pos.x = mouseX;
  obstacleSouris.pos.y = mouseY;

  // On dessine tous les obstacles
  obstacles.forEach(obstacle => {
    obstacle.show();
  });
}

function mettreAJourChasseur(chasseur) {
  // wander * poidsWander + seek * poidsSeek vers le perroquet le plus proche
  // s'il est dans le rayon de détection (même logique que le requin)
  const { proie, debutDeChasse } = chasseur.chasser(flock);
  if (debutDeChasse) soundbox.jouer('alerteChasseur');

  // Proie à portée d'épée : animation de frappe
  if (chasseur.peutFrapper(proie)) {
    chasseur.commencerFrappe(proie);
    soundbox.jouer('coupEpee');
  }

  // À mi-animation, l'épée touche
  const touchee = chasseur.avancerFrappe();
  if (touchee !== null) tuerPerroquet(touchee, chasseur);

  chasseur.edges();
  chasseur.update();
  chasseur.show();
}

// Règle de scène : le perroquet touché disparaît et ses plumes s'éparpillent.
function tuerPerroquet(perroquet, chasseur) {
  // on retire le perroquet du tableau flock
  const index = flock.indexOf(perroquet);
  if (index === -1) return false;
  flock.splice(index, 1);

  // Le chasseur grossit en augmentant sa taille (comme le requin)
  chasseur.r += 1;

  const echelle = perroquet.r / 30;
  const nouvelles = Plume.eclater(perroquet.pos.x, perroquet.pos.y, perroquet.couleursPlumes(), 14, random, echelle);
  plumes.push(...nouvelles);
  if (plumes.length > Plume.MAX_PLUMES) plumes.splice(0, plumes.length - Plume.MAX_PLUMES);

  soundbox.jouer('impactEpee');
  soundbox.jouer('mortPerroquet');
  return true;
}

// Perroquet le plus haut à l'écran (dessiné en dernier) sous le pointeur.
function perroquetSousLaSouris(x, y) {
  for (let i = flock.length - 1; i >= 0; i--) {
    if (flock[i].contientPoint(x, y)) return flock[i];
  }
  return null;
}

// Les événements souris de p5 arrivent aussi quand on clique dans le panneau :
// on ne réagit qu'aux événements dont la cible est le canvas.
function estSurLeCanvas(event) {
  return !event || event.target === elementCanvas;
}

function mousePressed(event) {
  // Le premier clic autorise le navigateur à jouer du son.
  soundbox.deverrouiller();
  if (!estSurLeCanvas(event)) return;

  const perroquet = perroquetSousLaSouris(mouseX, mouseY);
  if (perroquet !== null) {
    perroquet.crier();
    soundbox.jouer('cuiPerroquet');
  }
}

function mouseDragged(event) {
  if (!estSurLeCanvas(event)) return;
  flock.push(creerPerroquet(mouseX, mouseY));
}

function keyPressed() {
  soundbox.deverrouiller();
  if (key === 'd') {
    Boid.debug = !Boid.debug;
  } else if (key === 'r') {
    // On donne une taille différente à chaque perroquet
    flock.forEach(b => {
      b.facteurTaille = random(0.5, 1.5);
      appliquerAuPerroquet(b, reglages);
    });
  } else if (key === 'o') {
    // ajouter un obstacle (feuillage) à la position de la souris
    let o = new ObstacleMinecraft(mouseX, mouseY, random(20, 60));
    obstacles.push(o);
  } else if (key === 'p' || key === 'P') {
    panneau.basculer();
  } else if (keyCode === ESCAPE && panneau.estOuvert()) {
    panneau.fermer();
  }
}

function windowResized() {
  // Le décor d'abord : resizeCanvas() redessine immédiatement.
  decor.redimensionner(windowWidth, windowHeight);
  resizeCanvas(windowWidth, windowHeight);
  flock.forEach(p => {
    p.boundariesWidth = width;
    p.boundariesHeight = decor.yHorizon;
  });
}
