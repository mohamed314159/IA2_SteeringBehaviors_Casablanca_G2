// Générateur pseudo-aléatoire à graine (mulberry32) : rend les tirages
// reproductibles dans les tests. Retourne une fonction () => [0, 1).
function createRng(seed) {
  let state = seed >>> 0;
  return function rng() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBetween(rng, min, max) {
  return min + (max - min) * rng();
}

function randomPick(rng, list) {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}
