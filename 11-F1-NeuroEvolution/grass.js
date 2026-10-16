// Herbe façon Minecraft (sans shader) : une texture de 16 x 16 texels générée
// une fois, puis répétée par blocs avec une rotation aléatoire, comme le dessus
// d'un bloc d'herbe dans Minecraft.
const GRASS_PALETTE = ["#5b8c32", "#679c3a", "#73a843", "#4f7d2b", "#82b84c", "#466f26"];
const GRASS_TEXTURE_SIZE = 16;

// Indices de couleur (0..palette-1), dominante moyenne avec taches claires/sombres.
function generateGrassTexels(rng, size = GRASS_TEXTURE_SIZE) {
  const weights = [0.30, 0.30, 0.16, 0.12, 0.07, 0.05];
  const texels = [];
  for (let i = 0; i < size * size; i++) {
    let r = rng();
    let index = 0;
    while (index < weights.length - 1 && r >= weights[index]) {
      r -= weights[index];
      index++;
    }
    texels.push(index);
  }
  return texels;
}

// Dessine l'herbe dans un p5.Graphics (ou le canvas) ; texelSize en pixels.
function drawGrass(g, width, height, rng, texelSize = 3) {
  const size = GRASS_TEXTURE_SIZE;
  const texels = generateGrassTexels(rng, size);
  const block = size * texelSize;
  g.push();
  g.noStroke();
  for (let by = 0; by < height; by += block) {
    for (let bx = 0; bx < width; bx += block) {
      const rotation = Math.floor(rng() * 4);
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          // Rotation du bloc par quarts de tour.
          let u = i, v = j;
          if (rotation === 1) { u = size - 1 - j; v = i; }
          if (rotation === 2) { u = size - 1 - i; v = size - 1 - j; }
          if (rotation === 3) { u = j; v = size - 1 - i; }
          g.fill(GRASS_PALETTE[texels[v * size + u]]);
          g.rect(bx + i * texelSize, by + j * texelSize, texelSize, texelSize);
        }
      }
    }
  }
  g.pop();
}
