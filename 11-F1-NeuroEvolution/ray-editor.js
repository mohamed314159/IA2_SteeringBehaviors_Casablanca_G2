// Éditeur de rayons (barre « Changer les paramètres de la simulation ») :
// ajouter, modifier ou supprimer des rayons à des angles différents.
// Un rayon = un neurone de la couche d'entrée (+ 1 neurone pour la vitesse).
// Appliquer change donc l'architecture du réseau : toutes les générations sont
// effacées (architecture.js), après confirmation.
const RAY_PREVIEW_SIZE = 260;

// ---------- Fonctions pures (testées) ----------

// Ajoute un angle (degrés) à la liste triée ; retourne { angles, error }.
function addRayAngle(angles, angle) {
  const value = Number(angle);
  const next = [...angles, value].sort((a, b) => a - b);
  const error = validateRayAngles(next);
  return error ? { angles: angles.slice(), error } : { angles: next, error: null };
}

// Remplace l'angle du rayon i ; retourne { angles, error }.
function setRayAngle(angles, index, angle) {
  const next = angles.slice();
  next[index] = Number(angle);
  next.sort((a, b) => a - b);
  const error = validateRayAngles(next);
  return error ? { angles: angles.slice(), error } : { angles: next, error: null };
}

// Supprime le rayon i (au moins un rayon reste) ; retourne { angles, error }.
function removeRayAngle(angles, index) {
  if (angles.length <= 1) return { angles: angles.slice(), error: "au moins 1 rayon" };
  return { angles: angles.filter((_, i) => i !== index), error: null };
}

// Texte de la couche d'entrée correspondante.
function inputLayerDescription(angles) {
  const n = angles.length;
  return `Couche d'entrée : ${n} rayon${n > 1 ? "s" : ""} + 1 vitesse = ${n + 1} neurones`;
}

// ---------- Interface (navigateur) ----------

class RayEditor {
  // options : { dialog, canvas, list, angleInput, addButton, info, status,
  //             applyButton, resetButton, confirmBox, confirmText, confirmButton,
  //             cancelButton, storage: () => Storage, garage: () => Garage, onApplied() }
  constructor(options) {
    this.options = options;
    this.angles = [];
    this.pending = null;
    this.ctx = options.canvas.getContext("2d");
    options.canvas.width = RAY_PREVIEW_SIZE;
    options.canvas.height = RAY_PREVIEW_SIZE;
    options.addButton.addEventListener("click", () => this.update(addRayAngle(this.angles, options.angleInput.value)));
    options.angleInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") this.update(addRayAngle(this.angles, options.angleInput.value));
    });
    options.applyButton.addEventListener("click", () => this.askConfirmation(this.angles));
    options.resetButton.addEventListener("click", () => {
      this.angles = rayAnglesFromConfig(currentNetworkConfig());
      this.render("Brouillon remis aux rayons actuels.");
    });
    options.confirmButton.addEventListener("click", () => this.confirm());
    options.cancelButton.addEventListener("click", () => this.hideConfirmation());
  }

  open() {
    this.angles = rayAnglesFromConfig(currentNetworkConfig());
    this.hideConfirmation();
    this.render("");
    this.options.dialog.showModal();
  }

  close() {
    this.options.dialog.close();
  }

  update({ angles, error }) {
    this.angles = angles;
    this.hideConfirmation();
    this.render(error ? `Impossible : ${error}.` : "");
  }

  render(message) {
    const { list, info, status, applyButton } = this.options;
    list.innerHTML = "";
    this.angles.forEach((angle, i) => {
      const row = document.createElement("li");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "-180";
      input.max = "180";
      input.step = "1";
      input.value = angle;
      input.id = `ray-angle-${i}`;
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = `Rayon ${i + 1} : `;
      label.style.display = "inline";
      input.addEventListener("change", () => this.update(setRayAngle(this.angles, i, input.value)));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "small";
      remove.textContent = "Supprimer";
      remove.setAttribute("aria-label", `Supprimer le rayon ${i + 1}`);
      remove.addEventListener("click", () => this.update(removeRayAngle(this.angles, i)));
      row.append(label, input, "° ", remove);
      list.appendChild(row);
    });
    this.options.addButton.disabled = this.angles.length >= MAX_RAYS;
    const current = rayAnglesFromConfig(currentNetworkConfig());
    const changed = !sameNumbers(this.angles, current);
    info.textContent = `${inputLayerDescription(this.angles)}${changed ? " — non appliqué" : " — rayons actuels"}`;
    applyButton.disabled = !changed;
    status.textContent = message;
    this.drawPreview();
  }

  // Aperçu : la voiture vue de dessus, nez vers le haut, et ses rayons.
  drawPreview() {
    const ctx = this.ctx;
    const c = RAY_PREVIEW_SIZE / 2;
    ctx.fillStyle = "#3e4044";
    ctx.fillRect(0, 0, RAY_PREVIEW_SIZE, RAY_PREVIEW_SIZE);
    ctx.save();
    ctx.translate(c, c);
    const length = RAY_PREVIEW_SIZE * 0.42;
    ctx.lineWidth = 2;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const angle of this.angles) {
      // 0° = devant (vers le haut), + = vers la droite.
      const rad = (angle * Math.PI) / 180;
      const x = Math.sin(rad) * length;
      const y = -Math.cos(rad) * length;
      ctx.strokeStyle = "#ffd800";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.fillText(`${angle}°`, x * 1.12, y * 1.12);
    }
    // Voiture (rectangle rouge, nez vers le haut).
    ctx.fillStyle = "#e10600";
    ctx.fillRect(-7, -20, 14, 40);
    ctx.fillStyle = "#111";
    ctx.fillRect(-11, -14, 4, 8); ctx.fillRect(7, -14, 4, 8);
    ctx.fillRect(-11, 8, 4, 9); ctx.fillRect(7, 8, 4, 9);
    ctx.restore();
  }

  askConfirmation(angles) {
    const error = validateRayAngles(angles);
    if (error) {
      this.options.status.textContent = `Impossible : ${error}.`;
      return;
    }
    this.pending = angles.slice();
    const lineages = this.options.garage().keys().length;
    this.options.confirmText.textContent = `Appliquer ${angles.length} rayon(s) (${angles.map((a) => `${a}°`).join(", ")}) ? ` +
      `La couche d'entrée passe à ${angles.length + 1} neurones : ${lineages} lignée(s) sauvegardée(s) et toutes leurs générations seront effacées.`;
    this.options.confirmBox.hidden = false;
  }

  hideConfirmation() {
    this.pending = null;
    this.options.confirmBox.hidden = true;
  }

  confirm() {
    if (!this.pending) return;
    const architecture = { ...architectureOf(currentNetworkConfig()), rayAngles: this.pending };
    const result = applyArchitecture(architecture, this.options.storage(), this.options.garage());
    this.hideConfirmation();
    this.angles = rayAnglesFromConfig(currentNetworkConfig());
    this.render(result.changed
      ? `Rayons appliqués. ${result.erased} lignée(s) effacée(s) : réentraînez les voitures.`
      : "Aucun changement.");
    this.options.onApplied(result);
  }
}
