// Visualisation et édition du réseau de neurones (page network.html).
// - Éditeur : nombre de neurones par couche cachée, ajout / suppression de
//   couches, activation. « Appliquer » mémorise l'architecture (architecture.js)
//   et efface toutes les générations du garage, après confirmation.
// - Schéma : architecture en cours d'édition (poids d'exemple) ou champion du
//   garage (poids entraînés) ; les curseurs d'entrée montrent les activations.
const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 620;
const VIEW_MARGIN = 120;
const MAX_HIDDEN_NEURONS = 64;
const DEFAULT_NEW_LAYER = 8;

// Positions des neurones : une colonne par couche, neurones centrés verticalement.
function networkLayout(layers, width, height, margin) {
  const columns = layers.length;
  return layers.map((count, l) => {
    const x = columns === 1 ? width / 2 : margin + (l * (width - 2 * margin)) / (columns - 1);
    const spacing = Math.min(48, (height - 60) / Math.max(1, count));
    const top = height / 2 - ((count - 1) * spacing) / 2;
    return Array.from({ length: count }, (_, i) => ({ x, y: top + i * spacing }));
  });
}

// Libellés des entrées et sorties : `rays` est la liste des angles des rayons
// (degrés) ou une ouverture totale (rayons répartis régulièrement).
function networkLabels(layers, rays) {
  const count = layers[0] - 1;
  const angles = Array.isArray(rays) && rays.length === count ? rays : evenRayAngles(count, Number.isFinite(rays) ? rays : 120);
  const inputs = angles.map((angle, i) => `rayon ${i + 1} (${angle >= 0 ? "+" : ""}${angle.toFixed(0)}°)`);
  inputs.push("vitesse");
  return { inputs, outputs: NETWORK_OUTPUTS.slice(0, layers[layers.length - 1]) };
}

let viewer = { network: null, fov: 120, inputs: [], title: "" };
let draft = null;        // architecture en cours d'édition { hiddenLayers, hiddenActivation }
let viewUi = {};
let viewStorage = null;

function setup() {
  const canvas = createCanvas(VIEW_WIDTH, VIEW_HEIGHT);
  canvas.parent("network-canvas");
  describe("Schéma du réseau de neurones : colonnes de neurones (entrées, couches cachées, sorties) reliées par des connexions bleues (poids positifs) ou rouges (poids négatifs), épaisses selon l'importance du poids.");
  viewStorage = safeStorage();
  useStoredArchitecture(viewStorage);
  draft = architectureOf(currentNetworkConfig());

  viewUi.source = document.getElementById("sourceSelect");
  viewUi.inputs = document.getElementById("inputSliders");
  viewUi.info = document.getElementById("networkInfo");
  viewUi.rows = document.getElementById("layerRows");
  viewUi.activation = document.getElementById("activationSelect");
  viewUi.draftText = document.getElementById("architectureDraft");
  viewUi.status = document.getElementById("architectureStatus");
  viewUi.confirmBox = document.getElementById("confirmBox");
  viewUi.confirmText = document.getElementById("confirmText");

  document.getElementById("addLayerButton").addEventListener("click", addLayer);
  document.getElementById("applyArchitectureButton").addEventListener("click", () => askConfirmation(draft));
  document.getElementById("resetArchitectureButton").addEventListener("click", () => askConfirmation(architectureOf(NETWORK_CONFIG)));
  document.getElementById("confirmApplyButton").addEventListener("click", confirmArchitecture);
  document.getElementById("cancelApplyButton").addEventListener("click", hideConfirmation);
  viewUi.activation.addEventListener("change", () => {
    draft.hiddenActivation = viewUi.activation.value;
    onDraftChange();
  });
  viewUi.source.addEventListener("change", () => loadSource(viewUi.source.value));

  renderEditor();
  fillSourceSelect();
  loadSource("draft");
  noLoop();
}

function safeStorage() {
  try {
    const storage = window.localStorage;
    storage.getItem(ARCHITECTURE_STORAGE_KEY);
    return storage;
  } catch (error) {
    return null;
  }
}

// ---------- Éditeur d'architecture ----------

function renderEditor() {
  viewUi.rows.innerHTML = "";
  draft.hiddenLayers.forEach((count, i) => {
    const row = document.createElement("li");
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = String(MAX_HIDDEN_NEURONS);
    input.step = "1";
    input.value = count;
    input.id = `layer-${i}`;
    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.textContent = `Couche cachée ${i + 1} : `;
    label.style.display = "inline";
    input.addEventListener("input", () => {
      const value = parseInt(input.value, 10);
      if (Number.isInteger(value)) {
        draft.hiddenLayers[i] = Math.min(MAX_HIDDEN_NEURONS, Math.max(1, value));
        onDraftChange();
      }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "small";
    remove.textContent = "Supprimer";
    remove.setAttribute("aria-label", `Supprimer la couche cachée ${i + 1}`);
    remove.addEventListener("click", () => {
      draft.hiddenLayers.splice(i, 1);
      renderEditor();
      onDraftChange();
    });
    row.append(label, input, " neurones ", remove);
    viewUi.rows.appendChild(row);
  });
  if (draft.hiddenLayers.length === 0) {
    viewUi.rows.innerHTML = "<li><small>Aucune couche cachée : entrées reliées directement aux sorties.</small></li>";
  }
  document.getElementById("addLayerButton").disabled = draft.hiddenLayers.length >= MAX_HIDDEN_LAYERS;
  viewUi.activation.value = draft.hiddenActivation;
  updateDraftText();
}

function addLayer() {
  if (draft.hiddenLayers.length >= MAX_HIDDEN_LAYERS) return;
  draft.hiddenLayers.push(DEFAULT_NEW_LAYER);
  renderEditor();
  onDraftChange();
}

function updateDraftText() {
  const current = architectureOf(currentNetworkConfig());
  const changed = !sameArchitecture(draft, current);
  const layers = [rayAnglesFromConfig(currentNetworkConfig()).length + 1, ...draft.hiddenLayers, NETWORK_OUTPUTS.length];
  viewUi.draftText.textContent = `Brouillon : ${layers.join(" → ")} (${draft.hiddenActivation})` +
    (changed ? " — non appliqué" : " — architecture en cours");
}

function onDraftChange() {
  hideConfirmation();
  updateDraftText();
  viewUi.source.value = "draft";
  loadSource("draft");
}

// Confirmation en ligne avant d'effacer les générations.
function askConfirmation(architecture) {
  try {
    validateArchitecture(architecture);
  } catch (error) {
    viewUi.status.textContent = error.message;
    return;
  }
  if (sameArchitecture(architecture, architectureOf(currentNetworkConfig()))) {
    viewUi.status.textContent = "C'est déjà l'architecture en cours : rien n'est effacé.";
    return;
  }
  viewUi.pending = architecture;
  const lineages = viewerGarage().keys().length;
  viewUi.confirmText.textContent = `Appliquer ${[(architecture.rayAngles ?? rayAnglesFromConfig(currentNetworkConfig())).length + 1, ...architecture.hiddenLayers, 2].join(" → ")} (${architecture.hiddenActivation}) ? ` +
    `${lineages} lignée(s) sauvegardée(s) et toutes leurs générations seront effacées.`;
  viewUi.confirmBox.hidden = false;
}

function hideConfirmation() {
  viewUi.confirmBox.hidden = true;
  viewUi.pending = null;
}

function confirmArchitecture() {
  if (!viewUi.pending) return;
  const result = applyArchitecture(viewUi.pending, viewStorage, viewerGarage());
  hideConfirmation();
  draft = architectureOf(currentNetworkConfig());
  renderEditor();
  fillSourceSelect();
  loadSource("draft");
  viewUi.status.textContent = result.changed
    ? `Architecture appliquée. ${result.erased} lignée(s) effacée(s) : réentraînez les voitures.`
    : "Aucun changement.";
}

// ---------- Schéma ----------

function viewerGarage() {
  return new Garage(viewStorage);
}

function fillSourceSelect() {
  viewUi.source.innerHTML = "";
  const current = document.createElement("option");
  current.value = "draft";
  current.textContent = "Architecture de l'éditeur (poids d'exemple)";
  viewUi.source.appendChild(current);
  const garage = viewerGarage();
  for (const key of garage.keys()) {
    for (const gen of garage.generations(key).reverse()) {
      const option = document.createElement("option");
      option.value = JSON.stringify({ key, gen });
      option.textContent = `${key} — génération ${gen}`;
      viewUi.source.appendChild(option);
    }
  }
  viewUi.source.value = "draft";
}

function loadSource(value) {
  try {
    if (value === "draft") {
      const config = { ...currentNetworkConfig(), ...draft };
      viewer.network = NeuralNetwork.fromConfig(config, createRng(1));
      viewer.fov = rayAnglesFromConfig(config);
      viewer.title = sameArchitecture(draft, architectureOf(currentNetworkConfig())) ? "Architecture en cours" : "Brouillon";
    } else {
      const { key, gen } = JSON.parse(value);
      const snapshot = viewerGarage().snapshot(key, gen);
      viewer.network = NeuralNetwork.fromJSON(snapshot.brain);
      viewer.fov = snapshot.spec.rayAngles ?? snapshot.spec.rayFovDegrees ?? 120;
      viewer.title = `${key}, génération ${gen} (entraîné sur ${snapshot.circuit})`;
    }
  } catch (error) {
    viewUi.info.textContent = error.message;
    viewer.network = null;
    redraw();
    return;
  }
  viewer.inputs = new Array(viewer.network.inputNodes).fill(0.5);
  buildInputSliders();
  viewUi.info.textContent = `${viewer.title} : ${viewer.network.describe()} · ${viewer.network.parameterCount()} paramètres`;
  redraw();
}

function buildInputSliders() {
  viewUi.inputs.innerHTML = "";
  const labels = networkLabels(viewer.network.layers, viewer.fov).inputs;
  labels.forEach((label, i) => {
    const row = document.createElement("label");
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = "1";
    slider.step = "0.01";
    slider.value = viewer.inputs[i];
    const value = document.createElement("span");
    value.textContent = viewer.inputs[i].toFixed(2);
    slider.addEventListener("input", () => {
      viewer.inputs[i] = parseFloat(slider.value);
      value.textContent = viewer.inputs[i].toFixed(2);
      redraw();
    });
    row.append(`${label} `, slider, value);
    viewUi.inputs.appendChild(row);
  });
}

function draw() {
  background(32, 35, 42);
  if (!viewer.network) return;
  const nn = viewer.network;
  const layout = networkLayout(nn.layers, width, height, VIEW_MARGIN);
  const activations = nn.activations(viewer.inputs);
  const maxWeight = Math.max(1e-6, ...nn.weights.flat(2).map(Math.abs));

  push();
  // Connexions : bleu = poids positif, rouge = négatif ; épaisseur ∝ |poids|.
  for (let l = 0; l < nn.weights.length; l++) {
    nn.weights[l].forEach((row, j) => {
      row.forEach((w, i) => {
        const a = layout[l][i];
        const b = layout[l + 1][j];
        const strength = Math.abs(w) / maxWeight;
        stroke(w >= 0 ? color(80, 160, 255, 40 + 180 * strength) : color(255, 80, 80, 40 + 180 * strength));
        strokeWeight(0.5 + 3 * strength);
        line(a.x, a.y, b.x, b.y);
      });
    });
  }
  // Neurones : remplissage = activation (noir 0 → jaune 1), valeur au centre.
  const labels = networkLabels(nn.layers, viewer.fov);
  const radius = Math.min(26, Math.max(10, (height - 60) / Math.max(...nn.layers) - 4));
  textSize(radius >= 20 ? 11 : 8);
  layout.forEach((column, l) => {
    column.forEach((p, i) => {
      const value = activations[l][i];
      stroke(230);
      strokeWeight(1.5);
      fill(lerpColor(color(20), color(255, 216, 0), constrain(value, 0, 1)));
      circle(p.x, p.y, radius);
      noStroke();
      if (radius >= 16) {
        fill(value > 0.55 ? 0 : 255);
        textAlign(CENTER, CENTER);
        text(value.toFixed(2), p.x, p.y);
      }
      fill(235);
      textSize(11);
      if (l === 0) {
        textAlign(RIGHT, CENTER);
        text(labels.inputs[i], p.x - radius / 2 - 6, p.y);
      } else if (l === layout.length - 1) {
        textAlign(LEFT, CENTER);
        text(labels.outputs[i], p.x + radius / 2 + 6, p.y);
      }
      textSize(radius >= 20 ? 11 : 8);
    });
  });
  // Titres des colonnes.
  textAlign(CENTER, TOP);
  textSize(13);
  fill(235);
  layout.forEach((column, l) => {
    const name = l === 0 ? "entrées" : l === layout.length - 1 ? "sorties" : `cachée ${l}`;
    text(`${name} (${nn.layers[l]})`, column[0].x, 8);
  });
  pop();
}
