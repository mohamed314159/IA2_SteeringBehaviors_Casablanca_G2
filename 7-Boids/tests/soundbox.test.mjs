import assert from "node:assert/strict";
import test from "node:test";
import { chargerExemple, creerAlea } from "./adaptateur-p5.mjs";

// Faux AudioContext : enregistre les nœuds créés et vérifie, comme un vrai
// navigateur, qu'une rampe exponentielle ne vise jamais 0 ou un négatif.
class FauxParam {
  constructor(valeur = 0) { this.value = valeur; this.evenements = []; }
  verifier(v, t) {
    if (!Number.isFinite(v) || !Number.isFinite(t)) throw new RangeError("valeur non finie");
  }
  setValueAtTime(v, t) { this.verifier(v, t); this.evenements.push(["set", v, t]); this.value = v; }
  linearRampToValueAtTime(v, t) { this.verifier(v, t); this.evenements.push(["lin", v, t]); }
  exponentialRampToValueAtTime(v, t) {
    this.verifier(v, t);
    if (v <= 0) throw new RangeError("rampe exponentielle vers une valeur <= 0");
    this.evenements.push(["exp", v, t]);
  }
}

class FauxNoeud {
  constructor(ctx, type) {
    this.ctx = ctx; this.genre = type; this.type = type; this.connexions = []; this.deconnecte = false;
    this.demarre = null; this.arrete = null; this.arretForce = false;
    this.gain = new FauxParam(1); this.frequency = new FauxParam(440); this.Q = new FauxParam(1);
  }
  connect(cible) { this.connexions.push(cible); return cible; }
  disconnect() { this.deconnecte = true; this.connexions = []; }
  start(t = 0) { this.demarre = t; }
  stop(t) { if (t === undefined) this.arretForce = true; else this.arrete = t; }
}

class FauxContexte {
  static instances = [];
  constructor() {
    this.currentTime = 0; this.sampleRate = 8000; this.state = "running";
    this.destination = new FauxNoeud(this, "destination"); this.noeuds = []; this.ferme = false;
    FauxContexte.instances.push(this);
  }
  creer(type) { const n = new FauxNoeud(this, type); this.noeuds.push(n); return n; }
  createGain() { return this.creer("gain"); }
  createOscillator() { return this.creer("oscillator"); }
  createBiquadFilter() { return this.creer("filtre"); }
  createBufferSource() { return this.creer("buffer"); }
  createBuffer(canaux, longueur) { const d = new Float32Array(longueur); return { getChannelData: () => d, longueur }; }
  resume() { this.state = "running"; }
  close() { this.ferme = true; this.state = "closed"; }
}

function nouvelleBoite(options = {}) {
  const { SoundBox } = chargerExemple(["soundbox.js"]);
  return { SoundBox, boite: new SoundBox({ ContexteAudio: FauxContexte, alea: creerAlea(9), ...options }) };
}

test("aucun son n'est joué avant deverrouiller()", () => {
  const { boite } = nouvelleBoite();
  assert.equal(boite.jouer("cuiPerroquet"), false);
  assert.equal(boite.ctx, null);
});

test("sans Web Audio, la boîte reste silencieuse sans erreur", () => {
  const { SoundBox } = chargerExemple(["soundbox.js"]);
  const boite = new SoundBox({ ContexteAudio: null });
  assert.equal(boite.deverrouiller(), false);
  assert.equal(boite.jouer("cuiPerroquet"), false);
});

test("cuiPerroquet : 3 à 5 gazouillis rapides dans l'aigu", () => {
  const { boite } = nouvelleBoite();
  boite.deverrouiller();
  assert.equal(boite.jouer("cuiPerroquet"), true);
  const oscillateurs = boite.ctx.noeuds.filter(n => n.genre === "oscillator");
  assert.ok(oscillateurs.length >= 3 && oscillateurs.length <= 5);
  for (const osc of oscillateurs) {
    const f = osc.frequency.evenements[0][1];
    assert.ok(f >= 1700 && f <= 2900, `fréquence ${f}`);
    assert.ok(osc.arrete - osc.demarre <= 0.08, "gazouillis court");
  }
  // Tous les gazouillis tiennent en moins d'une demi-seconde.
  assert.ok(Math.max(...oscillateurs.map(o => o.arrete)) < 0.5);
});

test("chaque son du catalogue se joue avec des paramètres valides", () => {
  const { SoundBox, boite } = nouvelleBoite();
  boite.deverrouiller();
  const noms = Object.keys(SoundBox.CATALOGUE);
  assert.deepEqual(noms.sort(), ["alerteChasseur", "coupEpee", "cuiPerroquet", "impactEpee", "mortPerroquet"]);
  for (const nom of noms) {
    assert.equal(boite.jouer(nom), true, nom);
    const son = SoundBox.CATALOGUE[nom];
    assert.ok(son.titre && son.quand && son.description, `description de ${nom}`);
  }
  // Toutes les sources démarrent et s'arrêtent d'elles-mêmes.
  for (const n of boite.ctx.noeuds.filter(n => n.genre === "oscillator" || n.genre === "buffer")) {
    assert.ok(n.demarre !== null && n.arrete > n.demarre);
  }
});

test("un nom inconnu ne joue rien et ne lève pas d'erreur", () => {
  const { boite } = nouvelleBoite();
  boite.deverrouiller();
  assert.equal(boite.jouer("meuh"), false);
});

test("le volume est borné entre 0 et 1 et appliqué à la sortie", () => {
  const { boite } = nouvelleBoite({ volume: 3 });
  assert.equal(boite.volume, 1);
  boite.deverrouiller();
  assert.equal(boite.sortie.gain.value, 1);
  boite.setVolume(-2);
  assert.equal(boite.sortie.gain.value, 0);
  boite.setVolume("abc");
  assert.equal(boite.volume, 0);
  boite.setVolume(0.25);
  assert.equal(boite.sortie.gain.value, 0.25);
});

test("le nombre de sons simultanés est limité, puis libéré avec le temps", () => {
  const { boite } = nouvelleBoite({ maxVoix: 2 });
  boite.deverrouiller();
  assert.equal(boite.jouer("impactEpee"), true);
  assert.equal(boite.jouer("impactEpee"), true);
  assert.equal(boite.jouer("impactEpee"), false);
  boite.ctx.currentTime = 1;
  assert.equal(boite.nombreDeVoix(), 0);
  assert.equal(boite.jouer("impactEpee"), true);
});

test("arreterTout coupe toutes les sources et déconnecte les nœuds", () => {
  const { boite } = nouvelleBoite();
  boite.deverrouiller();
  boite.jouer("mortPerroquet");
  boite.jouer("cuiPerroquet");
  // La sortie principale reste branchée pour les sons suivants.
  const crees = boite.ctx.noeuds.filter(n => n !== boite.sortie);
  boite.arreterTout();
  assert.equal(boite.nombreDeVoix(), 0);
  assert.equal(boite.sortie.deconnecte, false);
  for (const n of crees) {
    assert.equal(n.deconnecte, true, n.genre);
    if (n.genre === "oscillator" || n.genre === "buffer") assert.equal(n.arretForce, true);
  }
});

test("fermer libère le contexte", () => {
  const { boite } = nouvelleBoite();
  boite.deverrouiller();
  const ctx = boite.ctx;
  boite.jouer("coupEpee");
  boite.fermer();
  assert.equal(ctx.ferme, true);
  assert.equal(boite.ctx, null);
  assert.equal(boite.jouer("coupEpee"), false);
});

test("le bruit blanc est créé une seule fois", () => {
  const { boite } = nouvelleBoite();
  boite.deverrouiller();
  boite.jouer("coupEpee");
  const tampon = boite.tamponBruit;
  boite.jouer("coupEpee");
  assert.equal(boite.tamponBruit, tampon);
});
