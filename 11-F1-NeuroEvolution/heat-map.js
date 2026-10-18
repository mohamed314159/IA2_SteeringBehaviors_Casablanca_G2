// Carte de chaleur (étape 27) : où passent les voitures (bleu → cyan) et où
// elles sortent de piste (rouge). Elle aide à voir le virage qui bloque la
// population. Grille de cases de `cell` px, accumulée à chaque pas de
// simulation, estompée à chaque image, puis envoyée au shader comme petite
// texture (canal rouge = passages, canal vert = sorties de piste).
const HEAT_CELL = 8;                 // px par case : 150 x 95 cases pour le canvas
const HEAT_VISIT = 1;                // par voiture en course et par pas
const HEAT_CRASH = 40;               // par sortie de piste (case touchée et ses 8 voisines / 2)
const HEAT_DECAY = 0.996;            // par image : une trace s'efface en ~20 s
const HEAT_FLOOR = 1e-3;             // en dessous : case remise à 0

class HeatMap {
  constructor(width, height, cell = HEAT_CELL) {
    this.cell = cell;
    this.cols = Math.max(1, Math.ceil(width / cell));
    this.rows = Math.max(1, Math.ceil(height / cell));
    this.visits = new Float32Array(this.cols * this.rows);
    this.crashes = new Float32Array(this.cols * this.rows);
    this.counted = new WeakSet();    // voitures dont la sortie est déjà comptée
  }

  clear() {
    this.visits.fill(0);
    this.crashes.fill(0);
    this.counted = new WeakSet();
  }

  // Indice de la case d'un point, -1 en dehors de la grille ou si invalide.
  indexAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return -1;
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  }

  addVisit(x, y, amount = HEAT_VISIT) {
    const i = this.indexAt(x, y);
    if (i >= 0) this.visits[i] += amount;
  }

  // Sortie de piste : la case et ses voisines (moitié), pour une tache visible.
  addCrash(x, y, amount = HEAT_CRASH) {
    const i = this.indexAt(x, y);
    if (i < 0) return;
    const cx = i % this.cols;
    const cy = Math.floor(i / this.cols);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x2 = cx + dx;
        const y2 = cy + dy;
        if (x2 < 0 || y2 < 0 || x2 >= this.cols || y2 >= this.rows) continue;
        this.crashes[y2 * this.cols + x2] += dx === 0 && dy === 0 ? amount : amount / 2;
      }
    }
  }

  // Un pas de simulation : passage de chaque voiture en course, sortie de piste
  // des voitures éliminées (une seule fois chacune). Les voitures arrivées ne
  // comptent pas comme sorties.
  record(cars) {
    for (const car of cars) {
      if (car.racing) {
        this.addVisit(car.pos.x, car.pos.y);
      } else if (car.dead && !this.counted.has(car)) {
        this.counted.add(car);
        this.addCrash(car.pos.x, car.pos.y);
      }
    }
  }

  decay(factor = HEAT_DECAY) {
    for (const grid of [this.visits, this.crashes]) {
      for (let i = 0; i < grid.length; i++) {
        grid[i] = grid[i] * factor < HEAT_FLOOR ? 0 : grid[i] * factor;
      }
    }
  }

  // Remplit un tableau RGBA (cols × rows × 4) : rouge = passages, vert = sorties,
  // normalisés par le maximum de chaque grille (échelle logarithmique : les
  // passages rares restent visibles), bleu = 0, alpha = 255.
  writePixels(pixels) {
    const maxVisit = Math.max(...this.visits, 0);
    const maxCrash = Math.max(...this.crashes, 0);
    const scale = (value, max) => (max > 0 ? Math.round((255 * Math.log1p(value)) / Math.log1p(max)) : 0);
    for (let i = 0; i < this.visits.length; i++) {
      pixels[i * 4] = scale(this.visits[i], maxVisit);
      pixels[i * 4 + 1] = scale(this.crashes[i], maxCrash);
      pixels[i * 4 + 2] = 0;
      pixels[i * 4 + 3] = 255;
    }
    return pixels;
  }
}
