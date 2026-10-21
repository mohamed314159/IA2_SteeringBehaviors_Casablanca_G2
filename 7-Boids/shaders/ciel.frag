// Fragment shader du ciel façon Minecraft.
// Il est exécuté pour chaque pixel du calque du ciel et calcule sa couleur :
// 1. un dégradé bleu, du haut de l'écran jusqu'à l'horizon ;
// 2. un soleil carré avec un halo ;
// 3. des nuages en blocs qui défilent lentement vers la gauche.
precision mediump float;

varying vec2 vTexCoord;

uniform vec2 u_resolution; // taille du canvas principal, en pixels
uniform float u_time;      // temps écoulé, en secondes
uniform float u_horizon;   // ordonnée de l'horizon (haut de l'herbe), en pixels

// Taille d'un bloc de nuage, en pixels du canvas.
const float BLOC = 12.0;

// Nombre pseudo-aléatoire stable pour une case de la grille.
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Bruit de valeur : interpolation douce entre les hash des 4 coins.
float bruit(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// 1.0 si la case contient un bloc de nuage, 0.0 sinon.
float nuage(vec2 cellule) {
  float hauteur = cellule.y * BLOC / u_horizon; // 0 en haut, 1 à l'horizon
  if (hauteur < 0.04 || hauteur > 0.5) return 0.0;
  // Bruit étiré horizontalement : nuages plats et larges.
  float n = bruit(cellule * vec2(0.08, 0.25)) * 0.75 + bruit(cellule * 0.33) * 0.25;
  // Moins de nuages près de l'horizon.
  float seuil = 0.6 + smoothstep(0.3, 0.5, hauteur) * 0.2;
  return step(seuil, n);
}

void main() {
  // Coordonnées en pixels du canvas, y = 0 en haut.
  vec2 px = vec2(vTexCoord.x, 1.0 - vTexCoord.y) * u_resolution;

  // 1. Dégradé par bandes de 8 px pour un rendu "pixel".
  float yBande = floor(px.y / 8.0) * 8.0;
  float t = clamp(yBande / u_horizon, 0.0, 1.0);
  vec3 haut = vec3(0.40, 0.60, 1.00);
  vec3 horizon = vec3(0.76, 0.86, 1.00);
  vec3 couleur = mix(haut, horizon, t * t);

  // 2. Soleil carré et halo.
  vec2 centreSoleil = vec2(u_resolution.x * 0.82, u_horizon * 0.18);
  vec2 ecart = abs(px - centreSoleil);
  float distanceCarree = max(ecart.x, ecart.y);
  couleur += vec3(1.0, 0.95, 0.7) * 0.35 * exp(-length(px - centreSoleil) / 90.0);
  if (distanceCarree < 34.0) couleur = mix(couleur, vec3(1.0, 0.96, 0.62), 0.55);
  if (distanceCarree < 24.0) couleur = vec3(1.0, 0.99, 0.86);

  // 3. Nuages : la grille glisse avec le temps.
  vec2 decalage = vec2(u_time * 9.0, 0.0);
  vec2 cellule = floor((px + decalage) / BLOC);
  float estNuage = nuage(cellule);
  if (estNuage > 0.5) {
    // Bloc du bas d'un nuage : légèrement ombré, comme dans le jeu.
    float dessous = nuage(cellule + vec2(0.0, 1.0));
    vec3 blanc = dessous > 0.5 ? vec3(0.98, 0.99, 1.0) : vec3(0.84, 0.88, 0.95);
    couleur = mix(couleur, blanc, 0.9);
  }

  gl_FragColor = vec4(couleur, 1.0);
}
