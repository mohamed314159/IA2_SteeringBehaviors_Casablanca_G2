// Vitrine des voitures : chaque modèle dessiné en grand (car-design.js), sa
// sélection pour l'entraînement, son menu « Confiance par circuit » et, s'il est
// au garage, « Télécharger le modèle » et « Repartir de zéro ».
// Aucune voiture n'est sélectionnée au départ.
const SHOWROOM_PREVIEW_WIDTH = 260;
const SHOWROOM_PREVIEW_HEIGHT = 110;
const SHOWROOM_CAR_LENGTH = 220;   // px dans la vitrine (≈ 12 fois la taille sur le circuit)

// ---------- Fonctions pures (testées) ----------

// Libellé du bouton « Voitures » du menu.
function carsButtonLabel(count) {
  if (count === 0) return "Voitures : aucune sélectionnée";
  return `Voitures : ${count} sélectionnée${count > 1 ? "s" : ""}`;
}

// Tous les modèles de toutes les marques : [{ key, brand, model, brandData, modelData }].
function allModelEntries() {
  const entries = [];
  for (const brandData of CAR_BRANDS) {
    for (const modelData of brandData.models) {
      entries.push({
        key: lineageKey({ brand: brandData.name, model: modelData.name }),
        brand: brandData.name, model: modelData.name, brandData, modelData
      });
    }
  }
  return entries;
}

// Lignes du menu « Confiance par circuit » d'une lignée.
// circuits : [{ key, name, group }] ; retourne, pour chaque circuit, la
// confiance (celle de départ si la voiture n'y a jamais roulé), le meilleur
// pourcentage et la validation.
function circuitConfidenceRows(garage, lineage, circuits) {
  return circuits.map(({ key, name, group }) => {
    const record = garage.circuitRecord(lineage, key);
    return {
      key, name, group,
      confidence: record ? record.confidence : CONFIDENCE_START,
      neverDriven: !record,
      bestProgress: record ? record.bestProgress : 0,
      trained: Boolean(record && record.trained),
      trainedGeneration: record?.trained?.generation ?? null
    };
  });
}

// ---------- Interface (navigateur) ----------

class Showroom {
  // options : { dialog, grid, confidenceDialog, confidenceTitle, confidenceTable,
  //             garage: () => Garage, circuits: () => [{ key, name, group }],
  //             onSelectionChange(count), onDownload(key), onReset(key) }
  constructor(options) {
    this.options = options;
    this.selected = new Set();
    this.cards = new Map();
    for (const entry of allModelEntries()) this.buildCard(entry);
  }

  selectedModels() {
    return allModelEntries()
      .filter((entry) => this.selected.has(entry.key))
      .map(({ brand, model }) => ({ brand, model }));
  }

  open() {
    this.refresh();
    this.options.dialog.showModal();
  }

  close() {
    this.options.dialog.close();
  }

  toggle(key) {
    if (this.selected.has(key)) this.selected.delete(key);
    else this.selected.add(key);
    this.refresh();
    this.options.onSelectionChange(this.selected.size);
  }

  buildCard(entry) {
    const { brandData, modelData } = entry;
    const card = document.createElement("article");
    card.className = "car-card";

    // Aperçu dessiné une seule fois dans un p5.Graphics.
    const g = createGraphics(SHOWROOM_PREVIEW_WIDTH, SHOWROOM_PREVIEW_HEIGHT);
    g.background(62, 64, 68);
    g.stroke(235);
    g.strokeWeight(2);
    g.line(0, 6, g.width, 6);
    g.line(0, g.height - 6, g.width, g.height - 6);
    g.translate(g.width / 2, g.height / 2);
    const spec = { color: brandData.color, accent: brandData.accent, livery: modelData.livery, number: modelData.number };
    const length = SHOWROOM_CAR_LENGTH;
    drawCarDesign(g, spec, length, length * F1_CAR_WIDTH_M / F1_CAR_LENGTH_M, { detailed: true });
    g.elt.style.display = "block";
    g.elt.setAttribute("role", "img");
    g.elt.setAttribute("aria-label", `${entry.brand} ${entry.model} vue de dessus`);

    const title = document.createElement("h3");
    title.innerHTML = `<span class="swatch" style="background:${brandData.color}"></span>${entry.brand} <span class="model-name">${entry.model}</span>`;

    const status = document.createElement("p");
    status.className = "status";

    const select = document.createElement("button");
    select.type = "button";
    select.className = "select-car";
    select.addEventListener("click", () => this.toggle(entry.key));

    const confidence = document.createElement("button");
    confidence.type = "button";
    confidence.className = "small";
    confidence.textContent = "Confiance par circuit";
    confidence.addEventListener("click", () => this.showConfidence(entry));

    const download = document.createElement("button");
    download.type = "button";
    download.className = "small";
    download.textContent = "Télécharger le modèle";
    download.addEventListener("click", () => this.options.onDownload(entry.key));

    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "small";
    reset.textContent = "Repartir de zéro";
    reset.addEventListener("click", () => {
      this.options.onReset(entry.key);
      this.refresh();
    });

    const buttons = document.createElement("div");
    buttons.className = "buttons wrap";
    buttons.append(select, confidence, download, reset);
    card.append(g.elt, title, status, buttons);
    this.options.grid.appendChild(card);
    this.cards.set(entry.key, { card, select, status, download, reset });
  }

  // Met à jour sélection et état d'entraînement de chaque carte.
  refresh() {
    const garage = this.options.garage();
    for (const [key, { card, select, status, download, reset }] of this.cards) {
      const isSelected = this.selected.has(key);
      card.classList.toggle("selected", isSelected);
      select.textContent = isSelected ? "Sélectionnée ✓" : "Sélectionner";
      select.setAttribute("aria-pressed", String(isSelected));
      const snapshot = garage.snapshot(key);
      const trained = garage.trainedCircuits(key).length;
      status.textContent = snapshot
        ? `gén. ${snapshot.generation} au garage · ${trained} circuit(s) validé(s)`
        : "jamais entraînée";
      download.hidden = !snapshot;
      reset.hidden = !snapshot;
    }
  }

  showConfidence(entry) {
    const { confidenceDialog, confidenceTitle, confidenceTable } = this.options;
    confidenceTitle.textContent = `${entry.brand} ${entry.model} : confiance par circuit`;
    const rows = circuitConfidenceRows(this.options.garage(), entry.key, this.options.circuits());
    let html = "<thead><tr><th scope=\"col\">Circuit</th><th scope=\"col\">Confiance</th>" +
      "<th scope=\"col\">Meilleur %</th><th scope=\"col\">État</th></tr></thead><tbody>";
    let group = null;
    for (const row of rows) {
      if (row.group !== group) {
        group = row.group;
        html += `<tr class="group"><th colspan="4" scope="rowgroup">${group}</th></tr>`;
      }
      const confidence = `${(row.confidence * 100).toFixed(0)} %${row.neverDriven ? " (départ)" : ""}`;
      const state = row.trained
        ? `voiture entraînée ✓ (gén. ${row.trainedGeneration})`
        : row.neverDriven ? "jamais entraînée ici" : "en apprentissage";
      html += `<tr${row.trained ? " class=\"trained\"" : ""}><td>${row.name}</td>` +
        `<td><span class="bar" style="--value:${(row.confidence * 100).toFixed(0)}%"></span>${confidence}</td>` +
        `<td>${(row.bestProgress * 100).toFixed(1)} %</td><td>${state}</td></tr>`;
    }
    confidenceTable.innerHTML = html + "</tbody>";
    confidenceDialog.showModal();
  }
}
