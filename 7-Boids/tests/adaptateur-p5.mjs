// Adaptateur p5 minimal pour exécuter les classes de l'exemple dans Node.
// Il ne prouve pas la compatibilité avec p5 réel : le rendu et l'audio sont
// validés séparément dans le navigateur.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const dossierExemple = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  setMag(n) { const m = this.mag(); return m === 0 ? this : this.mult(n / m); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}

// Générateur à graine fixe (mulberry32) pour des tests reproductibles.
export function creerAlea(graine = 1) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FONCTIONS_DESSIN = ["push", "pop", "translate", "scale", "rotate", "fill", "noFill", "stroke",
  "noStroke", "strokeWeight", "rect", "circle", "ellipse", "line", "arc", "text", "textSize",
  "textAlign", "image", "imageMode", "triangle", "point"];

export function chargerExemple(fichiers, { graine = 1, extras = {} } = {}) {
  const etat = { alea: creerAlea(graine), dessins: [], calques: [] };
  const random = (a, b) => {
    if (Array.isArray(a)) return a[Math.floor(etat.alea() * a.length)];
    if (a === undefined) return etat.alea();
    if (b === undefined) return etat.alea() * a;
    return a + etat.alea() * (b - a);
  };
  const contexte = {
    p5: { Vector: Object.assign(Vector, { random2D: () => { const t = etat.alea() * Math.PI * 2; return new Vector(Math.cos(t), Math.sin(t)); } }) },
    Math, Number, String, Array, Object, console, globalThis: undefined,
    width: 800, height: 600, mouseX: 0, mouseY: 0, frameCount: 1,
    PI: Math.PI, TWO_PI: Math.PI * 2, CENTER: "center", CORNER: "corner", WEBGL: "webgl", ESCAPE: 27,
    createVector: (x = 0, y = 0) => new Vector(x, y),
    random,
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    constrain: (v, a, b) => Math.min(b, Math.max(a, v)),
    cos: Math.cos, sin: Math.sin,
    color: (...args) => ({ args, setAlpha(a) { this.alpha = a; } }),
    lerpColor: (a, b, t) => ({ a, b, t }),
    // Faux calque : enregistre ce qu'on y dessine.
    createGraphics: (w, h) => {
      const g = { w, h, appels: [] };
      for (const nom of ["pixelDensity", "noStroke", "fill", "rect", "remove"]) g[nom] = (...a) => g.appels.push([nom, a]);
      etat.calques.push(g);
      return g;
    },
    ...extras
  };
  for (const nom of FONCTIONS_DESSIN) {
    if (contexte[nom] === undefined) contexte[nom] = (...args) => { etat.dessins.push([nom, args]); };
  }
  contexte.globalThis = contexte;
  vm.createContext(contexte);
  for (const fichier of fichiers) {
    const chemin = path.join(dossierExemple, fichier);
    vm.runInContext(fs.readFileSync(chemin, "utf8"), contexte, { filename: chemin });
  }
  // Les classes déclarées avec "class" ne sont pas des propriétés globales :
  // on les expose explicitement pour les tests.
  const exposer = vm.runInContext(`({
    Boid: typeof Boid !== 'undefined' ? Boid : undefined,
    Obstacle: typeof Obstacle !== 'undefined' ? Obstacle : undefined,
    Perroquet: typeof Perroquet !== 'undefined' ? Perroquet : undefined,
    Chasseur: typeof Chasseur !== 'undefined' ? Chasseur : undefined,
    Plume: typeof Plume !== 'undefined' ? Plume : undefined,
    ObstacleMinecraft: typeof ObstacleMinecraft !== 'undefined' ? ObstacleMinecraft : undefined,
    SoundBox: typeof SoundBox !== 'undefined' ? SoundBox : undefined,
    Decor: typeof Decor !== 'undefined' ? Decor : undefined
  })`, contexte);
  return { contexte, etat, ...exposer, executer: code => vm.runInContext(code, contexte) };
}

// Remet la graine pour rejouer la même suite de nombres aléatoires.
export function reinitialiserAlea(etat, graine) {
  etat.alea = creerAlea(graine);
}
