// Réseau de neurones de 9b réécrit en JavaScript pur (sans TensorFlow.js),
// généralisé à un nombre quelconque de couches cachées (topologie décrite dans
// network-config.js). Sortie : sigmoïde (valeurs dans ]0, 1[). Le RNG est
// injecté pour des tests reproductibles ; toJSON / fromJSON servent au garage.
const NN_INIT_RANGE = 1;        // poids initiaux uniformes dans [-1, 1]
const NN_MUTATION_SD = 0.1;     // écart-type de la mutation gaussienne (comme 9b)
const NETWORK_OUTPUTS = ["direction", "accélérateur"];

const ACTIVATIONS = {
  sigmoid: (x) => 1 / (1 + Math.exp(-x)),
  tanh: (x) => Math.tanh(x),
  relu: (x) => Math.max(0, x)
};

function sigmoid(x) {
  return ACTIVATIONS.sigmoid(x);
}

// Tirage gaussien (Box-Muller) à partir d'un rng uniforme.
function gaussian(rng, mean = 0, sd = 1) {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const MAX_RAYS = 15;

// Angles répartis régulièrement sur une ouverture (ancienne écriture rays + rayFovDegrees).
function evenRayAngles(count, fovDegrees) {
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, i) => -fovDegrees / 2 + (i * fovDegrees) / (count - 1));
}

// Angles des rayons (degrés, 0 = droit devant, + = vers la droite) d'une configuration :
// liste rayAngles si elle existe, sinon rays rayons répartis sur rayFovDegrees.
function rayAnglesFromConfig(config) {
  if (Array.isArray(config.rayAngles)) return config.rayAngles.slice();
  return evenRayAngles(config.rays, config.rayFovDegrees);
}

// Message d'erreur si la liste d'angles n'est pas utilisable, sinon null.
function validateRayAngles(angles) {
  if (!Array.isArray(angles) || angles.length < 1 || angles.length > MAX_RAYS) return `de 1 à ${MAX_RAYS} rayons`;
  if (!angles.every((a) => Number.isFinite(a) && a >= -180 && a <= 180)) return "angles entre -180° et 180°";
  if (new Set(angles.map((a) => Math.round(a * 1000))).size !== angles.length) return "deux rayons ont le même angle";
  return null;
}

// Vérifie network-config.js et retourne la liste des tailles de couches.
// Couche d'entrée = un neurone par rayon + un neurone pour la vitesse.
function layerSizesFromConfig(config) {
  const errors = [];
  if (Array.isArray(config.rayAngles)) {
    const problem = validateRayAngles(config.rayAngles);
    if (problem) errors.push(`rayAngles : ${problem}`);
  } else {
    if (!Number.isInteger(config.rays) || config.rays < 1 || config.rays > MAX_RAYS) {
      errors.push(`rays doit être un entier entre 1 et ${MAX_RAYS}`);
    }
    if (!(config.rayFovDegrees >= 10 && config.rayFovDegrees <= 360)) {
      errors.push("rayFovDegrees doit être entre 10 et 360");
    }
  }
  if (!Array.isArray(config.hiddenLayers) ||
      !config.hiddenLayers.every((n) => Number.isInteger(n) && n >= 1 && n <= 64)) {
    errors.push("hiddenLayers doit être une liste d'entiers entre 1 et 64, ex. [20] ou [16, 8]");
  }
  if (!(config.hiddenActivation in ACTIVATIONS)) {
    errors.push(`hiddenActivation doit valoir ${Object.keys(ACTIVATIONS).join(", ")}`);
  }
  if (errors.length > 0) throw new Error("network-config.js invalide : " + errors.join(" ; "));
  return [rayAnglesFromConfig(config).length + 1, ...config.hiddenLayers, NETWORK_OUTPUTS.length];
}

class NeuralNetwork {
  // layers : tailles des couches, ex. [6, 20, 2].
  constructor(layers, rng = Math.random, hiddenActivation = "sigmoid") {
    if (!(hiddenActivation in ACTIVATIONS)) throw new Error(`Activation inconnue : ${hiddenActivation}`);
    this.layers = layers.slice();
    this.hiddenActivation = hiddenActivation;
    const init = () => (rng() * 2 - 1) * NN_INIT_RANGE;
    // weights[l][j][i] : poids du neurone i de la couche l vers le neurone j de la couche l+1.
    this.weights = [];
    this.biases = [];
    for (let l = 0; l < layers.length - 1; l++) {
      this.weights.push(Array.from({ length: layers[l + 1] }, () => Array.from({ length: layers[l] }, init)));
      this.biases.push(Array.from({ length: layers[l + 1] }, init));
    }
  }

  get inputNodes() {
    return this.layers[0];
  }

  get outputNodes() {
    return this.layers[this.layers.length - 1];
  }

  // Propagation avant ; retourne les activations de toutes les couches
  // (utile pour la visualisation). La dernière est la sortie.
  activations(inputs) {
    if (inputs.length !== this.inputNodes) {
      throw new Error(`predict : ${this.inputNodes} entrées attendues, ${inputs.length} reçues`);
    }
    const result = [inputs.slice()];
    let current = inputs;
    for (let l = 0; l < this.weights.length; l++) {
      const isOutput = l === this.weights.length - 1;
      const activate = isOutput ? ACTIVATIONS.sigmoid : ACTIVATIONS[this.hiddenActivation];
      current = this.weights[l].map((row, j) => {
        let sum = this.biases[l][j];
        for (let i = 0; i < row.length; i++) sum += row[i] * current[i];
        return activate(sum);
      });
      result.push(current);
    }
    return result;
  }

  predict(inputs) {
    const all = this.activations(inputs);
    return all[all.length - 1];
  }

  copy() {
    return NeuralNetwork.fromJSON(this.toJSON());
  }

  // Chaque poids mute avec la probabilité `rate` (bruit gaussien). Retourne this.
  mutate(rate, rng = Math.random) {
    const mutateValue = (w) => (rng() < rate ? w + gaussian(rng, 0, NN_MUTATION_SD) : w);
    this.weights = this.weights.map((layer) => layer.map((row) => row.map(mutateValue)));
    this.biases = this.biases.map((layer) => layer.map(mutateValue));
    return this;
  }

  // Nombre de paramètres entraînables (poids + biais).
  parameterCount() {
    let count = 0;
    for (let l = 0; l < this.weights.length; l++) count += this.weights[l].length * (this.layers[l] + 1);
    return count;
  }

  // Description lisible de la topologie, ex. "6 → 20 → 2 (sigmoid)".
  describe() {
    return `${this.layers.join(" → ")} (${this.hiddenActivation})`;
  }

  toJSON() {
    return {
      layers: this.layers.slice(),
      hiddenActivation: this.hiddenActivation,
      weights: this.weights.map((layer) => layer.map((row) => row.slice())),
      biases: this.biases.map((layer) => layer.slice())
    };
  }

  static fromJSON(data) {
    const nn = new NeuralNetwork(data.layers, () => 0.5, data.hiddenActivation);
    nn.weights = data.weights.map((layer) => layer.map((row) => row.slice()));
    nn.biases = data.biases.map((layer) => layer.slice());
    return nn;
  }

  static fromConfig(config, rng = Math.random) {
    return new NeuralNetwork(layerSizesFromConfig(config), rng, config.hiddenActivation);
  }
}
