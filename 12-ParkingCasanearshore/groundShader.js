// Sol réaliste calculé par shader (carte graphique), à la résolution de
// l'écran, à chaque image (comme le ciel de 7-Boids) : pelouse, parc,
// pavés, asphalte, terre nue, eau. Le shader lit deux masques de matériaux
// dessinés une seule fois (mapRenderer.js) et ajoute le détail procédural :
// bruit, bandes de tonte, joints des pavés, grain de l'asphalte, reflets.
// Ce n'est que du rendu : aucun effet sur la simulation.
const GROUND_VERT = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aTexCoord;
  vec4 p = vec4(aPosition, 1.0);
  p.xy = p.xy * 2.0 - 1.0;
  gl_Position = p;
}`;

const GROUND_FRAG = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D masqueA;   // R pelouse, G pavés, B asphalte
uniform sampler2D masqueB;   // R terre, G eau, B parc
uniform vec2 monde;          // taille du monde (px)
uniform vec3 camera;         // centre x, y et zoom
uniform vec2 vue;            // taille de la vue (px écran)
uniform float pxParMetre;
uniform float temps;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bruit(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0; float a = 0.5;
  for (int k = 0; k < 4; k++) { v += a * bruit(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main() {
  vec2 ecran = vec2(vTexCoord.x, 1.0 - vTexCoord.y) * vue;
  vec2 w = (ecran - vue * 0.5) / camera.z + camera.xy;   // coordonnées du monde (px)
  vec2 m = w / pxParMetre;                               // en mètres
  vec2 uv = w / monde;
  vec3 ville = vec3(0.86, 0.84, 0.79) * (0.96 + 0.06 * fbm(m * 0.08));
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { gl_FragColor = vec4(ville, 1.0); return; }
  vec4 a = texture2D(masqueA, uv);
  vec4 b = texture2D(masqueB, uv);

  // Pelouse : deux verts mêlés par du bruit, bandes de tonte, brins.
  float tonte = 0.035 * sign(sin((m.x + m.y) * 0.45));
  vec3 herbe = mix(vec3(0.33, 0.52, 0.22), vec3(0.47, 0.64, 0.29), fbm(m * 0.12));
  herbe *= 0.9 + 0.18 * bruit(m * 3.1) + tonte;
  // Parc : herbe plus sombre et sèche par endroits, sous-bois.
  vec3 parc = mix(vec3(0.30, 0.45, 0.20), vec3(0.55, 0.52, 0.33), smoothstep(0.55, 0.8, fbm(m * 0.05)));
  parc *= 0.88 + 0.2 * bruit(m * 2.3);
  // Pavés : dalles de 0,6 m avec joints.
  vec2 dalle = fract(m / 0.6);
  float joint = step(0.92, max(dalle.x, dalle.y));
  vec3 pave = vec3(0.83, 0.80, 0.73) * (0.94 + 0.08 * hash(floor(m / 0.6))) * (1.0 - 0.18 * joint);
  // Asphalte : gris avec grain et taches.
  vec3 asphalte = vec3(0.31, 0.32, 0.34) * (0.86 + 0.16 * bruit(m * 6.0) + 0.06 * fbm(m * 0.3));
  // Terre nue (chantiers, terrains vagues).
  vec3 terre = mix(vec3(0.74, 0.56, 0.39), vec3(0.62, 0.44, 0.30), fbm(m * 0.25));
  terre *= 0.92 + 0.12 * bruit(m * 4.0);
  // Eau : bleu piscine avec reflets mobiles.
  float reflet = 0.5 + 0.5 * sin(m.x * 3.0 + temps * 1.5) * sin(m.y * 2.7 - temps);
  vec3 eau = mix(vec3(0.20, 0.62, 0.85), vec3(0.55, 0.85, 0.97), reflet * 0.35);

  float total = a.r + a.g + a.b + b.r + b.g + b.b;
  vec3 c = herbe * a.r + pave * a.g + asphalte * a.b + terre * b.r + eau * b.g + parc * b.b;
  c += ville * max(0.0, 1.0 - total);
  gl_FragColor = vec4(c / max(1.0, total), 1.0);
}`;

class GroundRenderer {
  constructor(masqueA, masqueB, mondeW, mondeH, pxParMetre, echelle = 0.75) {
    this.masqueA = masqueA;
    this.masqueB = masqueB;
    this.monde = [mondeW, mondeH];
    this.pxParMetre = pxParMetre;
    this.echelle = echelle; // résolution du calque par rapport à l'écran
    this.creerCalque(width, height);
  }

  creerCalque(w, h) {
    if (this.calque) this.calque.remove();
    this.calque = createGraphics(Math.max(2, Math.round(w * this.echelle)), Math.max(2, Math.round(h * this.echelle)), WEBGL);
    this.calque.pixelDensity(1);
    this.shader = this.calque.createShader(GROUND_VERT, GROUND_FRAG);
  }

  resize(w, h) {
    this.creerCalque(w, h);
  }

  // Dessine le sol visible pour la caméra donnée, en coordonnées écran.
  draw(camera, t) {
    const g = this.calque;
    g.shader(this.shader);
    this.shader.setUniform("masqueA", this.masqueA);
    this.shader.setUniform("masqueB", this.masqueB);
    this.shader.setUniform("monde", this.monde);
    this.shader.setUniform("camera", [camera.x, camera.y, camera.zoom]);
    this.shader.setUniform("vue", [camera.viewWidth, camera.viewHeight]);
    this.shader.setUniform("pxParMetre", this.pxParMetre);
    this.shader.setUniform("temps", t);
    g.noStroke();
    g.rect(0, 0, g.width, g.height);
    image(g, 0, 0, camera.viewWidth, camera.viewHeight);
  }
}
