import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, Vector } from "./adaptateur-p5.mjs";

// Faux éléments DOM de p5 (createDiv, createSlider...) pour tester le panneau.
function creerFauxElement(genre, args, registre) {
  const ecouteurs = {};
  const element = {
    genre, args, contenu: args[0], valeurCourante: args[2], classes: new Set(), attributs: {},
    parentElement: null, gestionnaireInput: null, supprime: false,
    elt: {
      addEventListener(type, f) { (ecouteurs[type] ||= []).push(f); },
      removeEventListener(type, f) { ecouteurs[type] = (ecouteurs[type] || []).filter(g => g !== f); },
      declencher(type) { (ecouteurs[type] || []).forEach(f => f({ type })); },
      ecouteurs
    },
    id(v) { this.attributs.id = v; return this; },
    class(v) { this.classes = new Set([v]); return this; },
    addClass(v) { this.classes.add(v); return this; },
    removeClass(v) { this.classes.delete(v); return this; },
    attribute(n, v) { this.attributs[n] = v; return this; },
    parent(p) { this.parentElement = p; return this; },
    html(v) { this.contenu = v; return this; },
    value(v) { if (v !== undefined) { this.valeurCourante = v; return this; } return this.valeurCourante; },
    input(f) { this.gestionnaireInput = f; return this; },
    remove() { this.supprime = true; },
    style() { return this; }
  };
  registre.push(element);
  return element;
}

function chargerScene() {
  const elements = [];
  const canvas = { elt: { nom: "canvas" } };
  const sons = [];
  const graphique = () => ({ pixelDensity() {}, noStroke() {}, fill() {}, rect() {}, remove() {}, shader() {}, createShader: () => ({ setUniform() {} }), width: 200, height: 150 });
  const extras = {
    windowWidth: 800, windowHeight: 600, key: "", keyCode: 0,
    createCanvas: () => canvas, resizeCanvas() {}, noSmooth() {}, describe() {}, millis: () => 0,
    loadStrings: () => ["// source"], createGraphics: graphique,
    createButton: (...a) => creerFauxElement("button", a, elements),
    createDiv: (...a) => creerFauxElement("div", a, elements),
    createP: (...a) => creerFauxElement("p", a, elements),
    createSpan: (...a) => creerFauxElement("span", a, elements),
    createSlider: (...a) => creerFauxElement("slider", a, elements),
    createElement: (balise, contenu) => creerFauxElement(balise, [contenu], elements)
  };
  const fichiers = ["boids.js", "obstacle.js", "pixelart.js", "perroquet.js", "chasseur.js", "plume.js",
    "obstacleMinecraft.js", "decor.js", "soundbox.js", "reglages.js", "panneau.js", "sketch.js"];
  const scene = chargerExemple(fichiers, { extras });
  scene.executer("preload(); setup();");
  // SoundBox espionnée : on enregistre les sons demandés.
  const boite = scene.contexte.soundbox ?? scene.executer("soundbox");
  boite.jouer = nom => { sons.push(nom); return true; };
  boite.deverrouiller = () => true;
  return { ...scene, elements, canvas, sons };
}

function curseur(elements, cle) {
  return elements.find(e => e.genre === "slider" && e.attributs.id === `reglage-${cle}`);
}

function afficheur(elements, cle) {
  const c = curseur(elements, cle);
  return elements.find(e => e.genre === "span" && e.parentElement === c.parentElement);
}

test("setup crée les effectifs initiaux avec les réglages appliqués", () => {
  const { executer } = chargerScene();
  assert.equal(executer("flock.length"), 80);
  assert.equal(executer("chasseurs.length"), 1);
  assert.equal(executer("flock.every(p => p.maxSpeed === 1.4 && p.maxForce === 0.2)"), true);
  assert.equal(executer("flock.every(p => p.separationWeight === 3)"), true);
  assert.equal(executer("chasseurs[0].maxSpeed < flock[0].maxSpeed"), true, "chasseur plus lent");
  assert.equal(executer("flock.every(p => p.boundariesHeight === decor.yHorizon)"), true);
  assert.equal(executer("obstacles.length === 1 && obstacles[0].invisible"), true);
});

test("chaque curseur a un libellé associé et part de la valeur initiale", () => {
  const { elements, executer } = chargerScene();
  const definitions = executer("DEFINITIONS_REGLAGES");
  assert.equal(elements.filter(e => e.genre === "slider").length, definitions.length);
  for (const def of definitions) {
    const c = curseur(elements, def.cle);
    assert.ok(c, def.cle);
    assert.deepEqual(Array.from(c.args), [def.min, def.max, executer(`REGLAGES_INITIAUX.${def.cle}`), def.pas]);
    const label = elements.find(e => e.genre === "label" && e.attributs.for === c.attributs.id);
    assert.ok(label, `libellé de ${def.cle}`);
  }
});

test("glisser le curseur de vitesse met à jour l'affichage et tous les perroquets", () => {
  const { elements, executer } = chargerScene();
  const c = curseur(elements, "vitessePerroquets");
  c.valeurCourante = 3.2;
  c.gestionnaireInput();
  assert.equal(afficheur(elements, "vitessePerroquets").contenu, "3.2");
  assert.equal(executer("reglages.vitessePerroquets"), 3.2);
  assert.equal(executer("flock.every(p => p.maxSpeed === 3.2)"), true);
  assert.equal(executer("flock.every(p => p.maxForce === 0.2)"), true, "maxForce inchangée");
});

test("les poids de la nuée et des chasseurs sont appliqués", () => {
  const { elements, executer } = chargerScene();
  for (const [cle, valeur] of [["alignWeight", 0.4], ["cohesionWeight", 1.7], ["separationWeight", 9], ["perceptionRadius", 40], ["poidsWander", 2.5], ["poidsSeek", 11], ["rayonDetection", 150]]) {
    const c = curseur(elements, cle);
    c.valeurCourante = valeur;
    c.gestionnaireInput();
  }
  assert.equal(executer("flock.every(p => p.alignWeight === 0.4 && p.cohesionWeight === 1.7 && p.separationWeight === 9 && p.perceptionRadius === 40)"), true);
  assert.equal(executer("chasseurs.every(c => c.poidsWander === 2.5 && c.poidsSeek === 11 && c.rayonDetection === 150)"), true);
});

test("changer le nombre conserve l'identité des entités restantes", () => {
  const { elements, executer } = chargerScene();
  executer("globalThis.premier = flock[0]; globalThis.chasseur0 = chasseurs[0];");
  const nb = curseur(elements, "nbPerroquets");
  nb.valeurCourante = 10; nb.gestionnaireInput();
  assert.equal(executer("flock.length"), 10);
  assert.equal(executer("flock[0] === premier"), true);
  nb.valeurCourante = 25; nb.gestionnaireInput();
  assert.equal(executer("flock.length"), 25);
  nb.valeurCourante = 0; nb.gestionnaireInput();
  assert.equal(executer("flock.length"), 0);

  const nc = curseur(elements, "nbChasseurs");
  nc.valeurCourante = 4; nc.gestionnaireInput();
  assert.equal(executer("chasseurs.length === 4 && chasseurs[0] === chasseur0"), true);
  const taille = curseur(elements, "tailleChasseurs");
  taille.valeurCourante = 70; taille.gestionnaireInput();
  assert.equal(executer("chasseurs.every(c => c.r === 70)"), true);
});

test("ajusterEffectif gère les entrées invalides", () => {
  const { executer } = chargerScene();
  assert.equal(executer("ajusterEffectif([1, 2, 3], -4, () => 0).length"), 0);
  assert.equal(executer("ajusterEffectif([1], 'abc', () => 0).length"), 0);
  assert.equal(executer("ajusterEffectif([], 2.7, () => 9).join()"), "9,9");
});

test("le bouton ⚙ et la touche P ouvrent/ferment le panneau ; Échap le ferme", () => {
  const { elements, executer, contexte } = chargerScene();
  const bouton = elements.find(e => e.genre === "button" && e.classes.has("bouton-reglages"));
  const panneauDiv = elements.find(e => e.attributs.id === "panneau-reglages");
  assert.equal(panneauDiv.classes.has("ouvert"), false, "fermé au départ");
  assert.equal(bouton.attributs["aria-expanded"], "false");

  bouton.elt.declencher("click");
  assert.equal(panneauDiv.classes.has("ouvert"), true);
  assert.equal(bouton.attributs["aria-expanded"], "true");

  contexte.key = "Escape"; contexte.keyCode = 27;
  executer("keyPressed()");
  assert.equal(panneauDiv.classes.has("ouvert"), false);

  contexte.key = "p"; contexte.keyCode = 80;
  executer("keyPressed()");
  assert.equal(panneauDiv.classes.has("ouvert"), true);
  const fermer = elements.find(e => e.genre === "button" && e.classes.has("fermer"));
  fermer.elt.declencher("click");
  assert.equal(panneauDiv.classes.has("ouvert"), false);
});

test("retirer() nettoie les écouteurs et les éléments du panneau", () => {
  const { elements, executer } = chargerScene();
  const bouton = elements.find(e => e.genre === "button" && e.classes.has("bouton-reglages"));
  executer("panneau.retirer()");
  assert.equal(bouton.elt.ecouteurs.click.length, 0);
  assert.equal(bouton.supprime, true);
});

test("le compteur n'écrit dans le DOM que si le nombre change", () => {
  const { elements, executer } = chargerScene();
  const compteur = elements.find(e => e.genre === "p" && e.classes.has("compteur"));
  executer("panneau.majCompteur(12)");
  assert.equal(compteur.contenu, "Perroquets en vie : 12");
  compteur.contenu = "témoin";
  executer("panneau.majCompteur(12)");
  assert.equal(compteur.contenu, "témoin");
});

test("clic sur un perroquet : il crie et le cui-cui est joué, sans changer sa vitesse", () => {
  const { executer, contexte, canvas, sons } = chargerScene();
  executer("flock.splice(1); flock[0].pos.x = 300; flock[0].pos.y = 200;");
  const vitesse = executer("[flock[0].vel.x, flock[0].vel.y]");
  contexte.mouseX = 302; contexte.mouseY = 201;
  contexte.mousePressed({ target: canvas.elt });
  assert.deepEqual(sons, ["cuiPerroquet"]);
  assert.equal(executer("flock[0].cri > 0"), true);
  assert.deepEqual(executer("[flock[0].vel.x, flock[0].vel.y]"), vitesse);
});

test("clic dans le vide ou dans le panneau : aucun son, aucun obstacle ajouté", () => {
  const { executer, contexte, canvas, sons } = chargerScene();
  executer("flock.splice(1); flock[0].pos.x = 300; flock[0].pos.y = 200;");
  contexte.mouseX = 600; contexte.mouseY = 100;
  contexte.mousePressed({ target: canvas.elt });
  contexte.mouseX = 300; contexte.mouseY = 200;
  contexte.mousePressed({ target: { nom: "curseur du panneau" } });
  assert.deepEqual(sons, []);
  assert.equal(executer("obstacles.length"), 1);
});

test("glisser sur le canvas ajoute un perroquet, pas depuis le panneau", () => {
  const { executer, contexte, canvas } = chargerScene();
  const avant = executer("flock.length");
  contexte.mouseDragged({ target: { nom: "curseur" } });
  assert.equal(executer("flock.length"), avant);
  contexte.mouseDragged({ target: canvas.elt });
  assert.equal(executer("flock.length"), avant + 1);
  assert.equal(executer("flock[flock.length - 1].maxSpeed"), 1.4);
});

test("tuerPerroquet : le perroquet disparaît, plumes et sons, le chasseur grossit", () => {
  const { executer, sons } = chargerScene();
  executer("globalThis.victime = flock[5]; globalThis.autre = flock[6];");
  const avant = executer("flock.length");
  const rAvant = executer("chasseurs[0].r");
  assert.equal(executer("tuerPerroquet(victime, chasseurs[0])"), true);
  assert.equal(executer("flock.length"), avant - 1);
  assert.equal(executer("flock.includes(victime)"), false);
  assert.equal(executer("flock.includes(autre)"), true);
  assert.equal(executer("chasseurs[0].r"), rAvant + 1);
  assert.equal(executer("plumes.length"), 14);
  assert.deepEqual(sons, ["impactEpee", "mortPerroquet"]);
  // Un second coup sur le même perroquet ne fait rien.
  assert.equal(executer("tuerPerroquet(victime, chasseurs[0])"), false);
  assert.equal(executer("plumes.length"), 14);
});

test("le nombre de plumes est borné", () => {
  const { executer } = chargerScene();
  executer("for (let i = 0; i < 40; i++) tuerPerroquet(flock[0], chasseurs[0]);");
  assert.ok(executer("plumes.length") <= executer("Plume.MAX_PLUMES"));
});

test("scène complète : le chasseur frappe une proie à portée et la tue à l'impact", () => {
  const { executer, sons } = chargerScene();
  executer(`
    flock.splice(1);
    flock[0].pos.x = 400; flock[0].pos.y = 300;
    flock[0].vel.x = 0; flock[0].vel.y = 0;
    flock[0].maxSpeed = 0;              // proie immobile pour le test
    chasseurs[0].pos.x = 390; chasseurs[0].pos.y = 300;
    chasseurs[0].vel.x = 0; chasseurs[0].vel.y = 0;
    chasseurs[0].maxSpeed = 0;
  `);
  let images = 0;
  while (executer("flock.length") === 1 && images < 60) {
    executer("draw()");
    images++;
  }
  assert.equal(executer("flock.length"), 0);
  assert.equal(images, Math.round(executer("chasseurs[0].dureeFrappe") * 0.5));
  assert.ok(sons.includes("alerteChasseur"));
  assert.ok(sons.includes("coupEpee"));
  assert.ok(sons.includes("mortPerroquet"));
  assert.ok(executer("plumes.length") > 0);
});

test("draw : positions finies et vitesses bornées sur plusieurs images", () => {
  const { executer } = chargerScene();
  for (let i = 0; i < 30; i++) executer("draw()");
  assert.equal(executer("flock.every(p => Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y) && p.vel.mag() <= p.maxSpeed + 1e-9)"), true);
  assert.equal(executer("chasseurs.every(c => Number.isFinite(c.pos.x) && c.vel.mag() <= c.maxSpeed + 1e-9)"), true);
});

test("la touche O ajoute un feuillage, R change les tailles, D le debug", () => {
  const { executer, contexte } = chargerScene();
  contexte.key = "o"; executer("keyPressed()");
  assert.equal(executer("obstacles.length"), 2);
  assert.equal(executer("obstacles[1] instanceof ObstacleMinecraft && !obstacles[1].invisible"), true);
  contexte.key = "r"; executer("keyPressed()");
  assert.equal(executer("flock.every(p => Math.abs(p.r - reglages.taillePerroquets * p.facteurTaille) < 1e-9)"), true);
  contexte.key = "d"; executer("keyPressed()");
  assert.equal(executer("Boid.debug"), true);
  executer("keyPressed()");
  assert.equal(executer("Boid.debug"), false);
});

test("windowResized garde les perroquets dans le ciel", () => {
  const { executer, contexte } = chargerScene();
  contexte.width = contexte.windowWidth = 1000; contexte.height = contexte.windowHeight = 900;
  executer("windowResized()");
  assert.equal(executer("flock.every(p => p.boundariesWidth === 1000 && p.boundariesHeight === decor.yHorizon)"), true);
  assert.equal(executer("decor.yHorizon"), 900 - executer("hauteurDuSol(900)"));
});

test("aucune entité n'utilise la même référence de vecteur qu'une autre", () => {
  const { executer } = chargerScene();
  executer("draw()");
  assert.equal(executer("new Set(flock.map(p => p.pos)).size === flock.length"), true);
  assert.ok(Vector);
});
