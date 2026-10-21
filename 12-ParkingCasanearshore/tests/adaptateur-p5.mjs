// Adaptateur p5 minimal pour exécuter les classes de l'exemple dans Node
// (inspiré de 7-Boids/tests/adaptateur-p5.mjs).
// Il ne prouve pas la compatibilité avec p5 réel : le rendu et les interactions
// sont validés séparément dans le navigateur.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

export const dossierExemple = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// Sous-ensemble de p5.Vector utilisé par l'exemple, mêmes conventions de mutation :
// les méthodes d'instance modifient l'instance, les méthodes statiques créent un vecteur.
export class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  set(x, y) {
    if (typeof x === "object") { this.x = x.x; this.y = x.y; } else { this.x = x; this.y = y ?? 0; }
    return this;
  }
  add(v, y) { if (typeof v === "number") { this.x += v; this.y += y; } else { this.x += v.x; this.y += v.y; } return this; }
  sub(v, y) { if (typeof v === "number") { this.x -= v; this.y -= y; } else { this.x -= v.x; this.y -= v.y; } return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { this.x /= n; this.y /= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { const m = this.mag(); if (m !== 0) this.mult(1 / m); return this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { const m2 = this.magSq(); if (m2 > n * n) this.div(Math.sqrt(m2)).mult(n); return this; }
  heading() { return Math.atan2(this.y, this.x); }
  setHeading(a) { const m = this.mag(); this.x = m * Math.cos(a); this.y = m * Math.sin(a); return this; }
  rotate(a) { const h = this.heading() + a; return this.setHeading(h); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  dist(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
  lerp(v, t) { this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; return this; }
  equals(v) { return this.x === v.x && this.y === v.y; }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static mult(a, n) { return new Vector(a.x * n, a.y * n); }
  static div(a, n) { return new Vector(a.x / n, a.y / n); }
  static dot(a, b) { return a.x * b.x + a.y * b.y; }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static lerp(a, b, t) { return new Vector(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t); }
  static fromAngle(a, l = 1) { return new Vector(l * Math.cos(a), l * Math.sin(a)); }
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
  "textAlign", "textStyle", "image", "imageMode", "triangle", "point", "beginShape", "endShape",
  "vertex", "quad", "rectMode", "strokeCap", "strokeJoin", "background", "describe"];

// p5.map(value, start1, stop1, start2, stop2, withinBounds)
function mapP5(n, a1, b1, a2, b2, borne = false) {
  const v = ((n - a1) / (b1 - a1)) * (b2 - a2) + a2;
  if (!borne) return v;
  return a2 < b2 ? Math.min(b2, Math.max(a2, v)) : Math.min(a2, Math.max(b2, v));
}

// Charge les fichiers (chemins relatifs au dossier de l'exemple) dans un contexte
// isolé qui imite le mode global de p5, puis expose les noms demandés.
export function chargerExemple(fichiers, { graine = 1, extras = {}, noms = [] } = {}) {
  const etat = { alea: creerAlea(graine), dessins: [] };
  const random = (a, b) => {
    if (Array.isArray(a)) return a[Math.floor(etat.alea() * a.length)];
    if (a === undefined) return etat.alea();
    if (b === undefined) return etat.alea() * a;
    return a + etat.alea() * (b - a);
  };
  const contexte = {
    p5: {
      Vector: Object.assign(Vector, {
        random2D: () => { const t = etat.alea() * Math.PI * 2; return new Vector(Math.cos(t), Math.sin(t)); }
      })
    },
    Math, Number, String, Array, Object, JSON, Map, Set, Infinity, NaN, console, isFinite,
    width: 1200, height: 800, mouseX: 0, mouseY: 0, frameCount: 1,
    PI: Math.PI, TWO_PI: Math.PI * 2, HALF_PI: Math.PI / 2, CENTER: "center", CORNER: "corner",
    LEFT: "left", RIGHT: "right", TOP: "top", BOTTOM: "bottom", CLOSE: "close", BOLD: "bold",
    ROUND: "round", SQUARE: "square", ESCAPE: 27,
    createVector: (x = 0, y = 0) => new Vector(x, y),
    random,
    map: mapP5,
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    constrain: (v, a, b) => Math.min(b, Math.max(a, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    cos: Math.cos, sin: Math.sin, atan2: Math.atan2, abs: Math.abs, min: Math.min, max: Math.max,
    sqrt: Math.sqrt, floor: Math.floor, round: Math.round,
    color: (...args) => ({ args, setAlpha(a) { this.alpha = a; } }),
    drawingContext: { setLineDash() {} },
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
  // Les classes et const déclarées au niveau global ne sont pas des propriétés
  // de l'objet global : on les expose explicitement pour les tests.
  const exposes = {};
  for (const nom of noms) {
    exposes[nom] = vm.runInContext(`typeof ${nom} !== 'undefined' ? ${nom} : undefined`, contexte);
  }
  return { contexte, etat, ...exposes, executer: code => vm.runInContext(code, contexte) };
}

// Remet la graine pour rejouer la même suite de nombres aléatoires.
export function reinitialiserAlea(etat, graine) {
  etat.alea = creerAlea(graine);
}

// Raccourci : vecteur proche (tolérance absolue).
export function procheVecteur(assert, v, x, y, eps = 1e-9, message = "") {
  assert.ok(Math.abs(v.x - x) <= eps && Math.abs(v.y - y) <= eps,
    `${message} attendu (${x}, ${y}), obtenu (${v.x}, ${v.y})`);
}
