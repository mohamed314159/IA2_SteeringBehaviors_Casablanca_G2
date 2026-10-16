// Marques et modèles parodiques (noms volontairement déformés).
// Chaque modèle a sa livrée (motif dessiné dans car-design.js) et son numéro.
// Chaque modèle définit des plages de paramètres ; chaque voiture lâchée tire
// ses valeurs au hasard dans ces plages.
//   speed : vitesse max (px/image ; 4,7 px/image ≈ 90 m/s à 60 images/s)
//   grip  : force max de steering (px/image²) : adhérence / agilité
//   (la longueur des rayons est un réglage commun : sensor-settings.js)
const CAR_BRANDS = [
  {
    name: "Tiyoti", color: "#d81e2a", accent: "#ffffff",
    models: [
      { name: "Supraa GT", livery: "bande", number: 7, speed: [3.8, 4.4], grip: [0.22, 0.30] },
      { name: "Corolo Sprint", livery: "double-bande", number: 12, speed: [3.4, 3.9], grip: [0.26, 0.34] }
    ]
  },
  {
    name: "Ferraaa", color: "#e10600", accent: "#ffd800",
    models: [
      { name: "F40o", livery: "unie", number: 16, speed: [4.4, 5.0], grip: [0.18, 0.25] },
      { name: "Testarosso", livery: "bande", number: 55, speed: [4.1, 4.7], grip: [0.20, 0.27] }
    ]
  },
  {
    name: "Limbargana", color: "#f5b800", accent: "#1b1b1b",
    models: [
      { name: "Huracano", livery: "flèche", number: 63, speed: [4.3, 4.9], grip: [0.19, 0.26] },
      { name: "Aventadoro", livery: "damier", number: 88, speed: [4.6, 5.2], grip: [0.16, 0.22] }
    ]
  },
  {
    name: "Mercedas", color: "#00a19c", accent: "#c0c0c0",
    models: [
      { name: "Flecha W15", livery: "flèche", number: 44, speed: [4.3, 4.9], grip: [0.21, 0.28] }
    ]
  },
  {
    name: "McLaran", color: "#ff8000", accent: "#47c7fc",
    models: [
      { name: "MCL Papaya", livery: "double-bande", number: 4, speed: [4.2, 4.8], grip: [0.22, 0.29] }
    ]
  },
  {
    name: "Porshe", color: "#f2f2f2", accent: "#b12b28",
    models: [
      { name: "911 Turbu", livery: "bande", number: 11, speed: [4.0, 4.6], grip: [0.23, 0.31] }
    ]
  },
  {
    name: "Bugotti", color: "#1e3f8f", accent: "#7fb2ff",
    models: [
      { name: "Chirone", livery: "damier", number: 17, speed: [4.7, 5.3], grip: [0.15, 0.21] }
    ]
  },
  {
    name: "Alpinne", color: "#2173b8", accent: "#ff87bc",
    models: [
      { name: "A110 Rally", livery: "unie", number: 10, speed: [3.7, 4.3], grip: [0.25, 0.33] }
    ]
  }
];

function findModel(brandName, modelName) {
  const brand = CAR_BRANDS.find((b) => b.name === brandName);
  const model = brand ? brand.models.find((m) => m.name === modelName) : null;
  if (!model) throw new Error(`Modèle inconnu : ${brandName} ${modelName}`);
  return { brand, model };
}

// Paramètres tirés au hasard dans les plages d'un modèle donné (rng injectable).
function createRandomSpecForModel(brandName, modelName, rng) {
  const { brand, model } = findModel(brandName, modelName);
  return {
    brand: brand.name,
    model: model.name,
    color: brand.color,
    accent: brand.accent,
    livery: model.livery,
    number: model.number,
    maxSpeed: randomBetween(rng, model.speed[0], model.speed[1]),
    maxForce: randomBetween(rng, model.grip[0], model.grip[1])
  };
}

// Tire une marque, un modèle et des paramètres au hasard.
function createRandomCarSpec(rng) {
  const brand = randomPick(rng, CAR_BRANDS);
  const model = randomPick(rng, brand.models);
  return createRandomSpecForModel(brand.name, model.name, rng);
}

// Mutation des paramètres hérités : décalage aléatoire d'au plus `amount` x
// la largeur de la plage, puis bornage dans la plage du modèle. Retourne une copie.
function mutateSpec(spec, rng, amount = 0.1) {
  const { model } = findModel(spec.brand, spec.model);
  const nudge = (value, [min, max]) => {
    const next = value + (rng() * 2 - 1) * amount * (max - min);
    return Math.min(max, Math.max(min, next));
  };
  return {
    ...spec,
    maxSpeed: nudge(spec.maxSpeed, model.speed),
    maxForce: nudge(spec.maxForce, model.grip)
  };
}
