// Rendu des décors en shader (étape 27). Le canvas du jeu reste en 2D : le
// shader dessine dans un p5.Graphics WEBGL séparé (densité de pixels 1), affiché
// ensuite avec image() à la place du décor pré-rendu. Les voitures, rayons,
// obstacles et flammes sont dessinés par-dessus, en 2D, comme avant.
//
// Textures envoyées au shader :
//   u_track : le décor pré-rendu (track-renderer.js), copié une fois par circuit
//   u_mask  : masque du circuit, copié une fois par circuit
//             (rouge = asphalte, vert = lignes blanches de bord ; le reste, dégagement
//             compris, est traité comme de l'herbe)
//   u_heat  : carte de chaleur (heat-map.js), petite texture mise à jour 6 fois par seconde
//   u_trail : traînée du leader, framebuffer estompé à chaque image (double tampon)
// Les images source gardent la même identité : p5 met à jour leur texture au
// lieu d'en créer une nouvelle (pas de fuite de mémoire graphique).
const HEAT_UPLOAD_EVERY = 10;        // images entre deux envois de la carte de chaleur
const TRAIL_FADE = 0.965;            // part de la traînée gardée à chaque image
const TRAIL_COLOR = [1.0, 0.82, 0.25];
const TRAIL_GLOW_PER_PX = 0.1;       // intensité ajoutée par px parcouru : trait d'égale luminosité
const TRAIL_GLOW_MIN = 0.05;         // quelle que soit la vitesse (plus de segments si la voiture
const TRAIL_GLOW_MAX = 0.6;          // est lente, chacun plus faible)

// Sommet commun : le rectangle unité de p5 couvre tout l'écran ; vTexCoord a son
// origine en haut à gauche, comme les coordonnées du canvas.
const SHADER_VERT = `
attribute vec3 aPosition;
varying vec2 vTexCoord;
void main() {
  vTexCoord = aPosition.xy;
  gl_Position = vec4(aPosition.x * 2.0 - 1.0, 1.0 - aPosition.y * 2.0, 0.0, 1.0);
}`;

const SHADER_PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vTexCoord;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}`;

// Décor complet : ambiance, herbe au vent, phares, carte de chaleur, traînée.
const BACKGROUND_FRAG = `${SHADER_PRECISION}
uniform sampler2D u_track;
uniform sampler2D u_mask;
uniform sampler2D u_heat;
uniform sampler2D u_trail;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_wind;
uniform float u_night;
uniform float u_rain;
uniform float u_haze;
uniform float u_snow;
uniform float u_fog;
uniform float u_neon;
uniform float u_dusk;
uniform float u_heatmap;
uniform float u_trailOn;
uniform vec3 u_lights[${MAX_HEADLIGHTS}];
uniform int u_lightCount;

void main() {
  vec2 uv = vTexCoord;
  vec2 px = uv * u_resolution;
  vec2 q = floor(px / 3.0) * 3.0;              // texels de 3 px, comme l'herbe Minecraft
  vec4 mask = texture2D(u_mask, uv);
  float track = clamp(mask.r + mask.g, 0.0, 1.0);
  float grass = 1.0 - track;

  // Canicule : l'air chaud fait onduler l'image, surtout au-dessus de l'asphalte.
  vec2 wobble = vec2(noise(px * 0.04 + vec2(0.0, u_time * 2.0)), noise(px * 0.04 + vec2(7.0, u_time * 1.7))) - 0.5;
  vec2 suv = uv + u_haze * wobble * (0.6 + track) * vec2(3.0, 2.0) / u_resolution;
  vec3 color = texture2D(u_track, suv).rgb;

  // Herbe au vent : rafales qui éclaircissent puis assombrissent l'herbe.
  float gust = noise(vec2(q.x * 0.006 - u_time * 0.7, q.y * 0.012));
  float wave = 0.5 + 0.5 * sin((q.x + q.y * 0.6) * 0.025 - u_time * 2.2);
  color += grass * u_wind * (gust * 0.7 + wave * 0.3 - 0.5) * 0.22 * vec3(0.55, 0.8, 0.25);

  // Canicule : herbe jaunie, lumière chaude.
  color = mix(color, color * vec3(1.12, 1.0, 0.72) + grass * vec3(0.06, 0.04, 0.0), u_haze * 0.8);

  // Crépuscule : lumière orangée qui vient du haut, ombres violettes en bas.
  vec3 dusk = color * mix(vec3(1.25, 0.82, 0.55), vec3(0.7, 0.55, 0.85), uv.y) + vec3(0.06, 0.01, 0.04);
  color = mix(color, dusk, u_dusk * 0.85);

  // Neige : herbe recouverte, piste froide, flocons qui tombent.
  float snowCover = grass * (0.82 + 0.18 * noise(q * 0.08));
  color = mix(color, vec3(0.93, 0.96, 1.0) * (0.86 + 0.14 * noise(q * 0.21)), snowCover * u_snow * 0.9);
  color = mix(color, color * vec3(0.85, 0.92, 1.08), track * u_snow * 0.6);
  for (int layer = 0; layer < 2; layer++) {
    float size = layer == 0 ? 26.0 : 15.0;
    vec2 cellPos = px / size + vec2(sin(u_time * 0.8 + float(layer)) * 0.6, -u_time * (layer == 0 ? 1.6 : 1.0));
    vec2 id = floor(cellPos);
    vec2 offset = vec2(hash(id), hash(id + 3.1)) * 0.6 + 0.2;
    float flake = step(0.6, hash(id + 9.7)) * (1.0 - smoothstep(0.05, 0.12, length(fract(cellPos) - offset)));
    color = mix(color, vec3(1.0), flake * u_snow * 0.9);
  }

  // Pluie : lumière grise, asphalte mouillé et brillant, gouttes en traits obliques.
  color = mix(color, color * vec3(0.72, 0.78, 0.88), u_rain);
  float puddle = smoothstep(0.55, 0.8, fbm(px * 0.015)) * track;
  color += u_rain * puddle * vec3(0.18, 0.22, 0.28) * (0.7 + 0.3 * sin(u_time * 3.0 + px.x * 0.05));
  vec2 r = vec2(px.x + px.y * 0.22, px.y);
  float column = floor(r.x / 3.0);
  float fall = r.y / u_resolution.y * 3.0 + u_time * (2.6 + hash(vec2(column, 1.0))) + hash(vec2(column, 7.0)) * 10.0;
  float seg = fract(fall);
  float drop = step(0.965, hash(vec2(column, floor(fall)))) * smoothstep(0.0, 0.04, seg) * (1.0 - smoothstep(0.06, 0.16, seg));
  color = mix(color, vec3(0.8, 0.86, 0.95), drop * 0.55 * u_rain);

  // Brouillard : nappes de brume qui dérivent lentement.
  float mist = fbm(px * 0.004 + vec2(u_time * 0.04, u_time * 0.015));
  color = mix(color, vec3(0.8, 0.83, 0.86), u_fog * (0.3 + 0.45 * mist));

  // Néon : scène sombre, lignes de bord lumineuses, quadrillage sur l'herbe.
  float glow = 0.0;
  for (int k = 0; k < 8; k++) {
    float a = float(k) * 0.785398;
    vec2 dir = vec2(cos(a), sin(a)) / u_resolution;
    glow += texture2D(u_mask, uv + dir * 3.0).g + texture2D(u_mask, uv + dir * 7.0).g * 0.6;
  }
  glow /= 12.8;
  vec3 neonColor = mix(vec3(1.0, 0.15, 0.85), vec3(0.1, 0.95, 1.0), 0.5 + 0.5 * sin(px.x * 0.008 + px.y * 0.006 + u_time * 1.2));
  vec2 gridPos = abs(fract(px / 40.0) - 0.5);
  float grid = grass * (1.0 - smoothstep(0.0, 0.03, min(gridPos.x, gridPos.y)));
  color = mix(color, color * 0.16 + vec3(0.02, 0.0, 0.06), u_neon);
  color += u_neon * (neonColor * (mask.g * 1.1 + glow * 0.9) + vec3(0.25, 0.1, 0.45) * grid * 0.35);

  // Nuit : scène sombre ; chaque voiture éclaire un cône devant elle.
  vec3 light = vec3(0.0);
  for (int i = 0; i < ${MAX_HEADLIGHTS}; i++) {
    if (i >= u_lightCount) break;
    vec3 car = u_lights[i];
    vec2 d = px - car.xy;
    vec2 forward = vec2(cos(car.z), sin(car.z));
    float along = dot(d, forward);
    float side = abs(dot(d, vec2(-forward.y, forward.x)));
    float cone = along > 0.0 ? exp(-along / 170.0) * (1.0 - smoothstep(0.18, 0.42, side / (along + 12.0))) : 0.0;
    light += (cone + exp(-dot(d, d) / 300.0) * 0.5) * vec3(1.0, 0.94, 0.78);
  }
  vec3 nightColor = color * vec3(0.2, 0.24, 0.38) + color * min(light, vec3(1.4)) * 1.1;
  color = mix(color, nightColor, u_night);

  // Carte de chaleur : passages (bleu → cyan) puis sorties de piste (rouge).
  vec4 heat = texture2D(u_heat, uv);
  color = mix(color, mix(vec3(0.1, 0.3, 1.0), vec3(0.2, 1.0, 0.9), heat.r), u_heatmap * heat.r * 0.65);
  color = mix(color, vec3(1.0, 0.15, 0.05), u_heatmap * clamp(heat.g * 0.9, 0.0, 0.85));

  // Traînée du leader (couleur prémultipliée, ajoutée).
  vec4 trail = texture2D(u_trail, vec2(uv.x, 1.0 - uv.y));
  color += u_trailOn * trail.rgb;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}`;

// Traînée : l'image précédente estompée + le segment parcouru par le leader.
const TRAIL_FRAG = `${SHADER_PRECISION}
uniform sampler2D u_prev;
uniform vec2 u_resolution;
uniform vec4 u_segment;
uniform float u_active;
uniform float u_fade;
uniform vec3 u_color;

void main() {
  vec2 uv = vTexCoord;
  vec2 px = uv * u_resolution;
  vec4 previous = max(texture2D(u_prev, vec2(uv.x, 1.0 - uv.y)) * u_fade - 0.004, 0.0);
  vec2 a = u_segment.xy;
  vec2 ab = u_segment.zw - a;
  float t = clamp(dot(px - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
  float d = length(px - a - ab * t);
  float glow = u_active * exp(-d * d / 10.0);
  gl_FragColor = clamp(previous + vec4(u_color * glow, glow), 0.0, 1.0);
}`;

// ---------- Fonctions pures (testées) ----------

// Noms des uniforms déclarés dans un source GLSL.
function declaredUniforms(source) {
  return [...source.matchAll(/uniform\s+\w+\s+(\w+)/g)].map((m) => m[1]);
}

// Uniforms du décor complet pour une image. `state` :
//   textures { track, mask, heat, trail }, width, height, frame, ambiance,
//   settings (shader-settings.js), lights (headlightData).
function backgroundUniforms(state) {
  const settings = normalizeShaderSettings(state.settings);
  const params = ambianceParams(state.ambiance);
  const lights = state.lights ?? { data: new Array(MAX_HEADLIGHTS * 3).fill(0), count: 0 };
  return {
    u_track: state.textures.track,
    u_mask: state.textures.mask,
    u_heat: state.textures.heat,
    u_trail: state.textures.trail,
    u_resolution: [state.width, state.height],
    u_time: shaderTime(state.frame),
    u_wind: settings.wind ? 1 : 0,
    u_night: params.night,
    u_rain: params.rain,
    u_haze: params.haze,
    u_snow: params.snow,
    u_fog: params.fog,
    u_neon: params.neon,
    u_dusk: params.dusk,
    u_heatmap: settings.heatmap ? 1 : 0,
    u_trailOn: settings.trail ? 1 : 0,
    u_lights: lights.data,
    u_lightCount: params.night > 0 ? lights.count : 0
  };
}

// Intensité d'un segment de traînée : proportionnelle à sa longueur, bornée.
// Sans elle, une voiture lente repasse plusieurs fois sur les mêmes pixels et
// le trait sature en blanc.
function trailIntensity(segment) {
  if (!segment.active) return 0;
  const length = Math.hypot(segment.x1 - segment.x0, segment.y1 - segment.y0);
  return Math.min(TRAIL_GLOW_MAX, Math.max(TRAIL_GLOW_MIN, length * TRAIL_GLOW_PER_PX));
}

// Uniforms de la traînée pour une image (segment : TrailTracker.update).
function trailUniforms(previous, segment, width, height) {
  return {
    u_prev: previous,
    u_resolution: [width, height],
    u_segment: [segment.x0, segment.y0, segment.x1, segment.y1],
    u_active: trailIntensity(segment),
    u_fade: TRAIL_FADE,
    u_color: TRAIL_COLOR
  };
}

// Masque du circuit dans un p5.Graphics 2D : asphalte en rouge, lignes de bord en vert.
function drawTrackMask(g, circuit) {
  g.push();
  g.background(0);
  g.noFill();
  g.strokeJoin(ROUND);
  g.stroke(255, 0, 0);
  g.strokeWeight(circuit.trackWidth);
  drawClosedPolyline(g, circuit.center);
  g.stroke(0, 255, 0);
  g.strokeWeight(3);
  drawClosedPolyline(g, circuit.leftEdge);
  drawClosedPolyline(g, circuit.rightEdge);
  g.pop();
}

// ---------- Rendu WebGL (navigateur) ----------

class ShaderDecor {
  // create : fonction (width, height) → p5.Graphics WEBGL ; par défaut createGraphics.
  constructor(width, height, create = (w, h) => createGraphics(w, h, WEBGL)) {
    this.width = width;
    this.height = height;
    this.create = create;
    this.available = null;           // null : pas encore essayé ; false : WebGL indisponible
    this.error = null;
    this.trackDirty = true;
    this.heat = new HeatMap(width, height);
    this.trail = new TrailTracker();
  }

  // Création à la première utilisation : rien n'est alloué si les shaders restent coupés.
  ensureReady() {
    if (this.available !== null) return this.available;
    try {
      this.fx = this.create(this.width, this.height);
      this.fx.pixelDensity(1);
      this.backgroundShader = this.fx.createShader(SHADER_VERT, BACKGROUND_FRAG);
      this.trailShader = this.fx.createShader(SHADER_VERT, TRAIL_FRAG);
      this.trailBuffers = [this.fx.createFramebuffer(), this.fx.createFramebuffer()];
      this.maskLayer = createGraphics(this.width, this.height);
      this.maskLayer.pixelDensity(1);
      this.trackImage = createImage(this.width, this.height);
      this.maskImage = createImage(this.width, this.height);
      this.heatImage = createImage(this.heat.cols, this.heat.rows);
      this.heatImage.loadPixels();
      this.uploadHeat();
      // Compilation tout de suite : une erreur GLSL désactive les shaders proprement.
      for (const program of [this.backgroundShader, this.trailShader]) {
        if (!program.init()) throw new Error("shader non compilé (voir la console)");
      }
      this.available = true;
    } catch (error) {
      this.error = error;
      this.available = false;
      if (this.fx) this.fx.remove();
      this.fx = null;
    }
    return this.available;
  }

  // Nouveau décor pré-rendu (changement de circuit ou de décor) : copié au prochain dessin.
  setTrack(trackLayer, circuit) {
    this.trackLayer = trackLayer;
    this.circuit = circuit;
    this.trackDirty = true;
  }

  // Changement de circuit : carte de chaleur et traînée effacées.
  clearHistory() {
    this.heat.clear();
    this.trail.clear();
  }

  copyTrack() {
    this.trackImage.drawingContext.drawImage(this.trackLayer.elt, 0, 0, this.width, this.height);
    this.trackImage.setModified(true);
    drawTrackMask(this.maskLayer, this.circuit);
    this.maskImage.drawingContext.drawImage(this.maskLayer.elt, 0, 0, this.width, this.height);
    this.maskImage.setModified(true);
    this.trackDirty = false;
  }

  uploadHeat() {
    this.heat.writePixels(this.heatImage.pixels);
    this.heatImage.updatePixels();
  }

  // Une image : traînée (double tampon) puis décor complet. Retourne le
  // p5.Graphics à afficher, ou null si les shaders ne sont pas disponibles.
  render({ frame, ambiance, settings, cars, leader }) {
    if (!this.ensureReady()) return null;
    if (this.trackDirty) this.copyTrack();
    const s = normalizeShaderSettings(settings);
    if (s.heatmap) {
      this.heat.decay();
      if (frame % HEAT_UPLOAD_EVERY === 0) this.uploadHeat();
    }
    const [previous, next] = this.trailBuffers;
    const segment = s.trail ? this.trail.update(leader) : this.trail.update(null);
    next.begin();
    this.fx.clear();
    this.fx.noStroke();
    this.fx.shader(this.trailShader);
    for (const [name, value] of Object.entries(trailUniforms(previous, segment, this.width, this.height))) {
      this.trailShader.setUniform(name, value);
    }
    this.fx.rect(0, 0, 1, 1);
    next.end();
    this.trailBuffers = [next, previous];

    this.fx.noStroke();
    this.fx.shader(this.backgroundShader);
    const uniforms = backgroundUniforms({
      textures: { track: this.trackImage, mask: this.maskImage, heat: this.heatImage, trail: next },
      width: this.width, height: this.height, frame, ambiance, settings: s,
      lights: headlightData(cars)
    });
    for (const [name, value] of Object.entries(uniforms)) this.backgroundShader.setUniform(name, value);
    this.fx.rect(0, 0, 1, 1);
    return this.fx;
  }
}
