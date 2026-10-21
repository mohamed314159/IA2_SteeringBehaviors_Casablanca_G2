// Réseau de neurones minimal (inspiré de 11-F1-NeuroEvolution/neural-network.js) :
// entrées → une couche cachée (8 neurones par défaut, tanh) → sorties (tanh).
// Il sert de « cerveau » aux oiseaux ; il est copié et muté par l'algorithme
// génétique (principe de 10-missiles genetic algo). Le générateur aléatoire
// est injecté pour des tests reproductibles.
const NN_HIDDEN = 8;

function nnGaussian(rng) {
  const u = Math.max(1e-12, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

class NeuralNetwork {
  constructor(entrees, cachees = NN_HIDDEN, sorties = 2, rng = Math.random) {
    this.tailles = [entrees, cachees, sorties];
    const matrice = (l, c) => Array.from({ length: l }, () => Array.from({ length: c }, () => rng() * 2 - 1));
    this.w1 = matrice(cachees, entrees);
    this.b1 = Array.from({ length: cachees }, () => rng() * 2 - 1);
    this.w2 = matrice(sorties, cachees);
    this.b2 = Array.from({ length: sorties }, () => rng() * 2 - 1);
  }

  predict(x) {
    if (x.length !== this.tailles[0]) throw new Error(`${this.tailles[0]} entrées attendues`);
    const h = this.w1.map((ligne, i) => Math.tanh(ligne.reduce((s, w, j) => s + w * x[j], this.b1[i])));
    return this.w2.map((ligne, i) => Math.tanh(ligne.reduce((s, w, j) => s + w * h[j], this.b2[i])));
  }

  copy() {
    const c = Object.create(NeuralNetwork.prototype);
    c.tailles = this.tailles.slice();
    c.w1 = this.w1.map(l => l.slice());
    c.b1 = this.b1.slice();
    c.w2 = this.w2.map(l => l.slice());
    c.b2 = this.b2.slice();
    return c;
  }

  // Chaque poids est modifié avec la probabilité `taux` (bruit gaussien).
  mutate(taux, ecartType, rng = Math.random) {
    const muter = v => (rng() < taux ? v + nnGaussian(rng) * ecartType : v);
    this.w1 = this.w1.map(l => l.map(muter));
    this.b1 = this.b1.map(muter);
    this.w2 = this.w2.map(l => l.map(muter));
    this.b2 = this.b2.map(muter);
    return this;
  }

  weightCount() {
    return this.w1.length * this.w1[0].length + this.b1.length + this.w2.length * this.w2[0].length + this.b2.length;
  }
}
