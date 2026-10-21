// Écran d'accueil (interface, pas une entité) : description de la simulation,
// une vignette par comportement et le bouton « Commencer ».
// Les vignettes sont dessinées une seule fois dans setup(), sur le canvas
// principal, avec les fonctions de dessin des entités (drawEmployee,
// drawLuxuryCar, show() des chats, oiseaux, G4S…), puis recopiées dans de
// petits canvas de l'accueil. Ce sont des schémas : aucun steering n'y est calculé.

const VIGNETTE = { w: 240, h: 140 };

const COULEURS_SCHEMA = {
  vitesse: "#4fc3f7",
  desiree: "#66bb6a",
  steering: "#ff5252",
  prediction: "#ce93d8",
  freinage: "#29b6f6",
  chemin: "#ffee58",
  leader: "#ec407a",
  texte: "#ffffff"
};

const COMPORTEMENTS_ACCUEIL = [
  {
    titre: "1. Seek",
    texte: "Viser une cible à pleine vitesse : la vitesse désirée pointe vers la cible, et la force de steering vaut vitesse désirée − vitesse actuelle, bornée par maxForce.",
    ou: "les retardataires de 8h54 qui courent vers leur porte, les employés qui vont au stand de café.",
    image: "Un employé court vers la porte d'un bâtiment ; flèches de la vitesse actuelle, de la vitesse désirée et du steering.",
    dessin: vignetteSeek
  },
  {
    titre: "2. Pursue / Evade",
    texte: "Pursue vise la position future de la cible (sa vitesse × un horizon borné) ; evade fuit cette position future, avec un rayon de détection et une distance de sortie distincts.",
    ou: "les deux chats qui chassent le papillon sur la pelouse ; le papillon qui les esquive ; piétons et gardiens qui s'écartent des voitures.",
    image: "Un chat vise la position future d'un papillon, qui s'enfuit.",
    dessin: vignettePursue
  },
  {
    titre: "3. Arrive",
    texte: "Comme seek, mais la vitesse désirée diminue dans le rayon de freinage pour s'arrêter pile sur la cible, sans la dépasser.",
    ou: "voitures sur leur place et à la barrière, tram au quai, gardiens à leur poste, employés au banc, au café et à leur porte.",
    image: "Une voiture ralentit en entrant dans le rayon de freinage de sa place de parking.",
    dessin: vignetteArrive
  },
  {
    titre: "4. Wander",
    texte: "Errance : un point sur un cercle placé devant l'entité ; son angle varie un peu à chaque pas, ce qui donne une trajectoire douce et imprévisible.",
    ou: "les employés qui flânent avant 8h55, le papillon, le morceau de pain que les oiseaux poursuivent.",
    image: "Un employé et son cercle d'errance, avec le point visé sur le cercle.",
    dessin: vignetteWander
  },
  {
    titre: "5. Path following",
    texte: "Prédire sa position un peu plus loin, la projeter sur le chemin ; si elle sort du couloir, viser un point du chemin plus en avant.",
    ou: "voitures sur les vraies routes OpenStreetMap, tram sur ses rails, piétons sur les trottoirs, rondes des gardiens et du convoi G4S.",
    image: "Une voiture suit le tracé d'une route : position prédite, projection et point visé.",
    dessin: vignettePath
  },
  {
    titre: "6. Obstacle avoidance",
    texte: "Un vecteur « ahead » est projeté devant l'entité ; s'il touche un obstacle, une force latérale l'en écarte avant le contact.",
    ou: "piétons autour des bâtiments, des stands et des bancs ; voitures autour des poteaux des garages souterrains.",
    image: "Un employé détecte le coin d'un bâtiment avec son vecteur ahead et le contourne.",
    dessin: vignetteAvoid
  },
  {
    titre: "7. Boids",
    texte: "Trois forces avec les voisins perçus : séparation (ne pas se cogner), alignement (même direction), cohésion (rester ensemble).",
    ou: "les collègues qui descendent du tram et marchent ensemble vers leur bâtiment.",
    image: "Un groupe de collègues marche ensemble ; flèches de séparation, d'alignement et de cohésion.",
    dessin: vignetteBoids
  },
  {
    titre: "8. Leader following",
    texte: "Arriver sur une place derrière le leader, et s'écarter de la zone devant lui pour ne jamais lui barrer la route. Les suiveurs du convoi restent sur la route et règlent leur vitesse sur leur place.",
    ou: "le convoi G4S de quatre véhicules (un leader et trois suiveurs) ; les groupes de passagers en formation derrière un guide.",
    image: "Convoi de quatre véhicules G4S : le leader en tête, la zone interdite devant lui.",
    dessin: vignetteLeader
  },
  {
    titre: "Bonus : oiseaux neuro-évolutifs",
    texte: "Comme les missiles du dossier 10 : chaque oiseau a un réseau de neurones (6 entrées, 8 neurones cachés, 2 sorties) qui choisit sa vitesse désirée. Un oiseau qui s'arrête sans attraper le pain disparaît et revient au nid avec une copie mutée du meilleur cerveau.",
    ou: "au centre du parc, autour du morceau de pain (génération et captures dans ⚙).",
    image: "Des oiseaux foncent vers un morceau de pain ; schéma du réseau de neurones à 8 neurones cachés.",
    dessin: vignetteOiseaux
  }
];

// ---------- Ouverture et fermeture ----------

function creerAccueil(section, surFermer) {
  const bouton = section.querySelector("#bouton-commencer");
  let ouvert = !section.hidden;
  const fermer = () => {
    if (!ouvert) return;
    ouvert = false;
    section.hidden = true;
    bouton.textContent = "Reprendre";
    surFermer();
  };
  bouton.addEventListener("click", fermer);
  section.tabIndex = -1;
  return {
    estOuvert: () => ouvert,
    ouvrir() {
      ouvert = true;
      section.hidden = false;
      section.scrollTop = 0;
      section.focus();
    },
    fermer
  };
}

// Dessine chaque vignette sur le canvas principal puis la recopie dans la grille.
function remplirGrilleComportements(grille) {
  // Fenêtre plus petite qu'une vignette (onglet caché au chargement) : on
  // agrandit le canvas le temps du dessin, puis on rend sa taille.
  const taille = { w: width, h: height };
  const agrandir = width < VIGNETTE.w || height < VIGNETTE.h;
  if (agrandir) resizeCanvas(Math.max(width, VIGNETTE.w), Math.max(height, VIGNETTE.h));
  for (const c of COMPORTEMENTS_ACCUEIL) {
    clear();
    push();
    c.dessin(VIGNETTE.w, VIGNETTE.h);
    pop();
    const carte = document.createElement("article");
    carte.className = "comportement";
    const image = copierVignette();
    image.setAttribute("role", "img");
    image.setAttribute("aria-label", c.image);
    const titre = document.createElement("h3");
    titre.textContent = c.titre;
    const texte = document.createElement("p");
    texte.textContent = c.texte;
    const ou = document.createElement("p");
    ou.className = "ou";
    ou.innerHTML = "<strong>Où le voir :</strong> ";
    ou.append(c.ou);
    carte.append(image, titre, texte, ou);
    grille.append(carte);
  }
  clear();
  if (agrandir) resizeCanvas(taille.w, taille.h);
}

function copierVignette() {
  const d = pixelDensity();
  const c = document.createElement("canvas");
  c.width = Math.round(VIGNETTE.w * d);
  c.height = Math.round(VIGNETTE.h * d);
  c.getContext("2d").drawImage(drawingContext.canvas, 0, 0, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

// ---------- Petites aides de dessin (schémas) ----------

function fondPelouse(w, h) {
  noStroke();
  fill(104, 146, 70);
  rect(0, 0, w, h);
  const r = createRng(7);
  for (let k = 0; k < 40; k++) {
    fill(126, 168, 86, 90);
    ellipse(r() * w, r() * h, 10 + r() * 30, 6 + r() * 16);
  }
}

function fondAsphalte(w, h) {
  noStroke();
  fill(104, 146, 70);
  rect(0, 0, w, h);
  fill(82, 84, 88);
  rect(0, 22, w, h - 44);
  stroke(238, 236, 229);
  strokeWeight(1.5);
  line(0, 22, w, 22);
  line(0, h - 22, w, h - 22);
}

function fleche(x1, y1, x2, y2, couleur, epaisseur = 2) {
  push();
  stroke(couleur);
  strokeWeight(epaisseur);
  line(x1, y1, x2, y2);
  noStroke();
  fill(couleur);
  translate(x2, y2);
  rotate(Math.atan2(y2 - y1, x2 - x1));
  triangle(0, 0, -7, -3.5, -7, 3.5);
  pop();
}

function cercleTirete(x, y, d, couleur, epaisseur = 1.2) {
  push();
  noFill();
  stroke(couleur);
  strokeWeight(epaisseur);
  drawingContext.setLineDash([4, 3]);
  circle(x, y, d);
  drawingContext.setLineDash([]);
  pop();
}

function ligneTiretee(points, couleur, epaisseur = 1.2) {
  push();
  noFill();
  stroke(couleur);
  strokeWeight(epaisseur);
  drawingContext.setLineDash([4, 3]);
  beginShape();
  for (const [x, y] of points) vertex(x, y);
  endShape();
  drawingContext.setLineDash([]);
  pop();
}

function legende(x, y, texte, couleur = COULEURS_SCHEMA.texte, alignement = LEFT) {
  push();
  textSize(10);
  textAlign(alignement, CENTER);
  stroke(0, 0, 0, 160);
  strokeWeight(2.5);
  fill(couleur);
  text(texte, x, y);
  pop();
}

function regardAccueil(i) {
  return { outfit: OUTFITS[i % OUTFITS.length], skin: SKIN_TONES[(i * 2) % SKIN_TONES.length], hair: HAIR_COLORS[i % HAIR_COLORS.length] };
}

// Un employé dessiné par drawEmployee (outfits.js), agrandi pour la vignette.
function personne(x, y, angle, look, echelle = 5.5, pose = { moving: true, phase: 1.2 }) {
  push();
  translate(x, y);
  rotate(angle);
  scale(echelle);
  drawEmployee(look, mPx(EMPLOYEE_CONFIG.bodyRadiusM) * EMPLOYEE_CONFIG.sizeFactor, pose);
  pop();
}

// Une entité dessinée par son propre show(), placée et agrandie.
function entiteVignette(e, x, y, angle, echelle) {
  e.pos.set(0, 0);
  e.heading = p5.Vector.fromAngle(angle);
  push();
  translate(x, y);
  scale(echelle);
  e.show();
  pop();
}

function batimentVignette(x, y, w, h, nom) {
  push();
  noStroke();
  fill(0, 0, 0, 60);
  rect(x - 8, y - 4, w, h);
  fill(204, 205, 200);
  stroke(110, 112, 110);
  strokeWeight(1);
  rect(x, y, w, h);
  noFill();
  stroke(235, 236, 232);
  rect(x + 3, y + 3, w - 6, h - 6);
  if (nom) legende(x + w / 2, y + 14, nom, "#ffffff", CENTER);
  pop();
}

// ---------- Les vignettes ----------

function vignetteSeek(w, h) {
  fondPelouse(w, h);
  batimentVignette(w - 66, 14, 58, h - 28, "Shore 7");
  const porte = createVector(w - 70, h / 2 + 8);
  push();
  noStroke();
  fill("#ffcc80");
  rect(porte.x - 1, porte.y - 9, 4, 18);
  pop();
  const p = createVector(48, h - 32);
  const vitesse = p5.Vector.fromAngle(-1.25).mult(46);
  const desiree = p5.Vector.sub(porte, p).setMag(64);
  const v = p5.Vector.add(p, vitesse);
  const d = p5.Vector.add(p, desiree);
  personne(p.x, p.y, vitesse.heading(), regardAccueil(0));
  fleche(p.x, p.y, v.x, v.y, COULEURS_SCHEMA.vitesse);
  fleche(p.x, p.y, d.x, d.y, COULEURS_SCHEMA.desiree);
  fleche(v.x, v.y, d.x, d.y, COULEURS_SCHEMA.steering);
  legende(v.x - 4, v.y - 8, "vitesse", COULEURS_SCHEMA.vitesse, CENTER);
  legende(d.x - 6, d.y + 12, "désirée", COULEURS_SCHEMA.desiree, CENTER);
  legende((v.x + d.x) / 2 + 6, (v.y + d.y) / 2 - 8, "steering", COULEURS_SCHEMA.steering);
}

function vignettePursue(w, h) {
  fondPelouse(w, h);
  const papillon = createVector(130, 58);
  const future = createVector(196, 84);
  const chat = createVector(44, 108);
  ligneTiretee([[papillon.x, papillon.y], [future.x, future.y]], COULEURS_SCHEMA.prediction);
  cercleTirete(future.x, future.y, 10, COULEURS_SCHEMA.prediction);
  legende(future.x, future.y + 15, "position future", COULEURS_SCHEMA.prediction, CENTER);
  const vise = p5.Vector.sub(future, chat).setMag(70).add(chat);
  fleche(chat.x, chat.y, vise.x, vise.y, COULEURS_SCHEMA.prediction);
  // Le papillon fuit la position future du chat.
  const fuite = p5.Vector.sub(papillon, chat).setMag(34).add(papillon);
  fleche(papillon.x, papillon.y, fuite.x, fuite.y, "#ff7043");
  legende(fuite.x - 2, fuite.y - 10, "evade", "#ff7043", CENTER);
  legende(chat.x + 6, chat.y + 20, "pursue", COULEURS_SCHEMA.prediction, CENTER);
  const zone = { center: createVector(0, 0), radius: 100 };
  entiteVignette(new Cat(0, 0, zone, () => 0.05), chat.x, chat.y, p5.Vector.sub(future, chat).heading(), 12);
  entiteVignette(new Butterfly(0, 0, zone, () => 0.05), papillon.x, papillon.y, 0.4, 16);
}

function vignetteArrive(w, h) {
  noStroke();
  fill(82, 84, 88);
  rect(0, 0, w, h);
  // Places de parking (marquage blanc) en haut à droite.
  stroke(240);
  strokeWeight(1.5);
  for (let x = 120; x <= 232; x += 28) line(x, 6, x, 58);
  line(120, 58, 232, 58);
  const place = createVector(162, 32);
  cercleTirete(place.x, place.y, 110, COULEURS_SCHEMA.freinage, 1.4);
  legende(place.x - 64, 70, "rayon de freinage", COULEURS_SCHEMA.freinage, CENTER);
  push();
  noStroke();
  fill(COULEURS_SCHEMA.freinage);
  circle(place.x, place.y, 6);
  pop();
  // Positions successives à intervalles égaux : l'écart diminue, la voiture ralentit.
  const spec = { ...LUXURY_MODELS[0], color: "#1c2a4a" };
  const etapes = [[22, 118, 0], [80, 114, -0.15], [124, 100, -0.6], [146, 84, -1.1], [157, 70, -1.38]];
  for (const [x, y, a] of etapes.slice(0, -1)) {
    push();
    translate(x, y);
    rotate(a);
    noFill();
    stroke(255, 255, 255, 110);
    strokeWeight(1);
    rectMode(CENTER);
    rect(0, 0, mPx(spec.lengthM) * 4.2, mPx(spec.widthM) * 4.2, 4);
    pop();
  }
  for (let i = 0; i + 1 < etapes.length; i++) {
    const [x, y, a] = etapes[i];
    const l = 26 - i * 6;
    fleche(x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, COULEURS_SCHEMA.vitesse, 1.6);
  }
  const [x, y, a] = etapes.at(-1);
  push();
  translate(x, y);
  rotate(a);
  scale(4.2);
  drawLuxuryCar(spec, mPx(spec.lengthM), mPx(spec.widthM));
  pop();
}

function vignetteWander(w, h) {
  fondPelouse(w, h);
  push();
  noStroke();
  fill(214, 206, 188);
  rect(0, h - 34, w, 22);
  pop();
  const p = createVector(96, 86);
  const cap = -0.35;
  ligneTiretee([[8, 128], [28, 104], [50, 118], [72, 96], [p.x, p.y]], "rgba(255,255,255,0.7)");
  const centre = p5.Vector.fromAngle(cap).mult(58).add(p);
  cercleTirete(centre.x, centre.y, 52, COULEURS_SCHEMA.desiree, 1.4);
  const theta = cap - 1.0;
  const cible = p5.Vector.fromAngle(theta).mult(26).add(centre);
  push();
  stroke(255, 255, 255, 120);
  strokeWeight(1);
  line(p.x, p.y, centre.x, centre.y);
  line(centre.x, centre.y, cible.x, cible.y);
  noStroke();
  fill(COULEURS_SCHEMA.desiree);
  circle(cible.x, cible.y, 7);
  pop();
  fleche(p.x, p.y, cible.x, cible.y, COULEURS_SCHEMA.steering, 1.8);
  // L'angle θ varie un peu à chaque pas.
  push();
  noFill();
  stroke(255);
  strokeWeight(1);
  arc(centre.x, centre.y, 30, 30, theta - 0.5, theta + 0.5);
  pop();
  legende(cible.x + 8, cible.y - 4, "θ ± un peu", "#ffffff");
  legende(centre.x + 6, centre.y + 34, "cercle d'errance", COULEURS_SCHEMA.desiree, CENTER);
  personne(p.x, p.y, cap, regardAccueil(3), 5.5, { moving: true, phase: 2.4 });
}

function vignettePath(w, h) {
  fondPelouse(w, h);
  const y = x => h / 2 + 18 * Math.sin(x / 42);
  const points = [];
  for (let x = -10; x <= w + 10; x += 8) points.push([x, y(x)]);
  push();
  noFill();
  stroke(82, 84, 88);
  strokeWeight(44);
  beginShape();
  for (const [x, yy] of points) vertex(x, yy);
  endShape();
  pop();
  // Couloir du chemin (rayon) et ligne médiane.
  ligneTiretee(points.map(([x, yy]) => [x, yy - 12]), "rgba(255,238,88,0.45)", 1);
  ligneTiretee(points.map(([x, yy]) => [x, yy + 12]), "rgba(255,238,88,0.45)", 1);
  ligneTiretee(points, COULEURS_SCHEMA.chemin, 1.6);
  const voiture = createVector(70, y(70) + 17);
  const cap = 0.42;
  const predite = p5.Vector.fromAngle(cap).mult(46).add(voiture);
  const projection = createVector(predite.x, y(predite.x));
  const cible = createVector(predite.x + 22, y(predite.x + 22));
  push();
  stroke(255, 255, 255, 160);
  strokeWeight(1);
  line(voiture.x, voiture.y, predite.x, predite.y);
  line(predite.x, predite.y, projection.x, projection.y);
  noStroke();
  fill(255);
  circle(predite.x, predite.y, 6);
  fill(COULEURS_SCHEMA.chemin);
  circle(projection.x, projection.y, 5);
  circle(cible.x, cible.y, 8);
  pop();
  fleche(voiture.x, voiture.y, cible.x, cible.y, COULEURS_SCHEMA.steering, 1.8);
  legende(predite.x, predite.y + 13, "prédite", "#ffffff", CENTER);
  legende(cible.x + 8, cible.y - 10, "cible", COULEURS_SCHEMA.chemin);
  const spec = { ...LUXURY_MODELS[1], color: "#eef0f2" };
  push();
  translate(voiture.x, voiture.y);
  rotate(cap);
  scale(3.6);
  drawLuxuryCar(spec, mPx(spec.lengthM), mPx(spec.widthM));
  pop();
}

function vignetteAvoid(w, h) {
  fondPelouse(w, h);
  push();
  noStroke();
  fill(214, 206, 188);
  rect(0, 70, w, 30);
  pop();
  batimentVignette(128, 8, 104, 70, "Shore 3");
  const p = createVector(40, 82);
  const cap = -0.12;
  const ahead = p5.Vector.fromAngle(cap).mult(100).add(p);
  const coin = createVector(128, 72);
  push();
  stroke(COULEURS_SCHEMA.steering);
  strokeWeight(1.5);
  drawingContext.setLineDash([4, 3]);
  line(p.x, p.y, ahead.x, ahead.y);
  drawingContext.setLineDash([]);
  noFill();
  circle(coin.x, coin.y, 10);
  pop();
  legende(ahead.x - 22, ahead.y - 10, "ahead", COULEURS_SCHEMA.steering, CENTER);
  fleche(coin.x, coin.y, coin.x, coin.y + 28, "#ffa726", 2);
  legende(coin.x + 6, coin.y + 34, "force d'évitement", "#ffa726");
  ligneTiretee([[p.x, p.y], [80, 84], [112, 94], [150, 100], [200, 96], [236, 90]], "rgba(255,255,255,0.75)");
  personne(p.x, p.y, cap, regardAccueil(4));
}

function vignetteBoids(w, h) {
  fondPelouse(w, h);
  push();
  noStroke();
  fill(214, 206, 188);
  rect(0, 30, w, 80);
  pop();
  const cap = -0.08;
  const membres = [[70, 54], [96, 74], [72, 92], [122, 52], [126, 92], [150, 72]];
  const centre = membres.reduce((a, [x, y]) => a.add(x / membres.length, y / membres.length), createVector(0, 0));
  cercleTirete(96, 74, 104, "rgba(255,255,255,0.6)");
  legende(96, 16, "perception", "#ffffff", CENTER);
  membres.forEach(([x, y], i) => personne(x, y, cap + (i % 3 - 1) * 0.12, regardAccueil(i + 1), 4.8, { moving: true, phase: i }));
  // Pour le membre central : séparation (rouge), alignement (bleu), cohésion (vert).
  fleche(96, 74, 104, 64, COULEURS_SCHEMA.steering, 1.8);
  fleche(96, 74, 126, 72, COULEURS_SCHEMA.vitesse, 1.8);
  fleche(96, 74, centre.x, centre.y + 1, COULEURS_SCHEMA.desiree, 1.8);
  legende(8, 126, "séparation", COULEURS_SCHEMA.steering);
  legende(84, 126, "alignement", COULEURS_SCHEMA.vitesse);
  legende(160, 126, "cohésion", COULEURS_SCHEMA.desiree);
}

function vignetteLeader(w, h) {
  fondAsphalte(w, h);
  const y = h / 2;
  const echelle = 4;
  const espace = 46;
  const tete = 160;
  // Zone interdite devant le leader.
  cercleTirete(tete + 40, y, 34, COULEURS_SCHEMA.leader, 1.4);
  for (let i = 3; i >= 0; i--) {
    const v = new G4SVehicle(0, 0, { number: i + 1 });
    entiteVignette(v, tete - i * espace, y, 0, echelle);
    if (i > 0) {
      // Place visée par le suiveur, derrière le véhicule de devant.
      push();
      noStroke();
      fill(COULEURS_SCHEMA.leader);
      circle(tete - i * espace + 3, y, 5);
      pop();
    }
  }
  legende(tete, y - 26, "leader", COULEURS_SCHEMA.leader, CENTER);
  legende(w - 4, y + 28, "zone interdite", COULEURS_SCHEMA.leader, RIGHT);
  legende(tete - 2 * espace, y + 28, "suiveurs", "#ffffff", CENTER);
}

function vignetteOiseaux(w, h) {
  fondPelouse(w, h);
  const pain = createVector(80, 70);
  const zone = { center: pain.copy(), radius: 100 };
  const oiseaux = [[22, 30, 0.6], [30, 112, -0.7], [128, 24, 2.3], [140, 112, -2.4]];
  for (const [x, y] of oiseaux) ligneTiretee([[x, y], [pain.x, pain.y]], "rgba(255,255,255,0.5)", 1);
  entiteVignette(new Bread(0, 0, zone), pain.x, pain.y, 0.3, 5);
  const rng = createRng(3);
  for (const [x, y, a] of oiseaux) entiteVignette(new Bird(0, 0, new NeuralNetwork(6, NN_HIDDEN, 2, rng), rng), x, y, a, 9);
  // Réseau : 6 entrées, 8 neurones cachés, 2 sorties.
  push();
  noStroke();
  fill(20, 30, 40, 170);
  rect(160, 8, 74, 124, 6);
  const couches = [6, NN_HIDDEN, 2].map((n, c) => Array.from({ length: n }, (_, i) => createVector(172 + c * 25, 22 + ((i + 0.5) * 100) / n)));
  stroke(255, 255, 255, 50);
  strokeWeight(0.6);
  for (let c = 0; c + 1 < couches.length; c++) {
    for (const a of couches[c]) for (const b of couches[c + 1]) line(a.x, a.y, b.x, b.y);
  }
  noStroke();
  couches.forEach((couche, c) => {
    fill(["#4fc3f7", "#ffa726", "#66bb6a"][c]);
    for (const n of couche) circle(n.x, n.y, 6);
  });
  pop();
  legende(197, 128, "8 cachés", "#ffa726", CENTER);
}
