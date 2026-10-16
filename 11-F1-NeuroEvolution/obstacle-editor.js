// Éditeur d'obstacle (fenêtre du menu) : on dessine un polygone en cliquant
// des points sur une grille, ou on part d'une forme toute faite, puis on
// choisit la taille en mètres. « Enregistrer dans la vitrine » en fait un
// prototype (proto_1, proto_2…) de la vitrine des obstacles.
const EDITOR_SIZE = 240;           // px du canevas de dessin
const EDITOR_CLOSE_DISTANCE = 12;  // cliquer près du 1er point ferme la forme

class ObstacleEditor {
  // options : { dialog, canvas, sizeSlider, sizeValue, status, saveButton,
  //             presets (élément), nextName: () => nom du prochain prototype,
  //             onSave(points, sizeMeters) }
  constructor(options) {
    this.options = options;
    this.points = [];
    this.closed = false;
    this.ctx = options.canvas.getContext("2d");
    options.canvas.width = EDITOR_SIZE;
    options.canvas.height = EDITOR_SIZE;
    options.canvas.addEventListener("pointerdown", (event) => this.addPointFromEvent(event));
    options.sizeSlider.addEventListener("input", () => this.render());
    for (const name of Object.keys(OBSTACLE_PRESETS)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "small";
      button.textContent = name;
      button.addEventListener("click", () => this.usePreset(name));
      options.presets.appendChild(button);
    }
    options.saveButton.addEventListener("click", () => {
      if (this.error()) return;
      this.options.onSave(this.points.map((p) => [p[0], p[1]]), this.sizeMeters);
    });
    this.render();
  }

  get sizeMeters() {
    return Number(this.options.sizeSlider.value);
  }

  open() {
    this.render();
    this.options.dialog.showModal();
  }

  close() {
    this.options.dialog.close();
  }

  // Coordonnées du pointeur converties dans le repère du canevas de dessin.
  addPointFromEvent(event) {
    const rect = this.options.canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * EDITOR_SIZE;
    const y = ((event.clientY - rect.top) / rect.height) * EDITOR_SIZE;
    this.addPoint(x, y);
  }

  addPoint(x, y) {
    if (this.closed) this.clear();
    const first = this.points[0];
    if (first && this.points.length >= OBSTACLE_MIN_POINTS && Math.hypot(x - first[0], y - first[1]) < EDITOR_CLOSE_DISTANCE) {
      this.closed = true;
    } else if (this.points.length < OBSTACLE_MAX_POINTS) {
      this.points.push([x, y]);
    }
    this.render();
  }

  undo() {
    if (this.closed) this.closed = false;
    else this.points.pop();
    this.render();
  }

  clear() {
    this.points = [];
    this.closed = false;
    this.render();
  }

  usePreset(name) {
    const half = EDITOR_SIZE * 0.35;
    this.points = OBSTACLE_PRESETS[name].map(([x, y]) => [EDITOR_SIZE / 2 + x * half, EDITOR_SIZE / 2 + y * half]);
    this.closed = true;
    this.render();
  }

  // Message d'erreur si la forme n'est pas utilisable, sinon null.
  error() {
    const problem = validateShape(this.points);
    if (problem) return `Forme : ${problem}.`;
    return null;
  }

  render() {
    const ctx = this.ctx;
    ctx.fillStyle = "#3e4044";
    ctx.fillRect(0, 0, EDITOR_SIZE, EDITOR_SIZE);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= EDITOR_SIZE; i += 20) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, EDITOR_SIZE); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(EDITOR_SIZE, i); ctx.stroke();
    }
    if (this.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(this.points[0][0], this.points[0][1]);
      for (const [x, y] of this.points.slice(1)) ctx.lineTo(x, y);
      if (this.closed) {
        ctx.closePath();
        ctx.fillStyle = "rgba(225,40,30,0.85)";
        ctx.fill();
      }
      ctx.strokeStyle = "#ffd800";
      ctx.lineWidth = 2;
      ctx.stroke();
      for (const [i, [x, y]] of this.points.entries()) {
        ctx.fillStyle = i === 0 ? "#ffd800" : "#ffffff";
        ctx.beginPath(); ctx.arc(x, y, i === 0 ? 5 : 3, 0, Math.PI * 2); ctx.fill();
      }
    }
    this.options.sizeValue.textContent = `${this.sizeMeters} m`;
    const problem = this.error();
    const ready = !problem;
    this.options.saveButton.disabled = !ready;
    this.options.status.textContent = this.points.length === 0
      ? "Cliquez sur la grille pour poser les points, ou choisissez une forme."
      : ready
        ? `${this.points.length} points${this.closed ? ", forme fermée" : ""} : prête, sera enregistrée sous ${this.options.nextName()}.`
        : problem;
  }
}
