// Générateur pseudo-aléatoire à graine (mulberry32), repris de
// 11-F1-NeuroEvolution/random.js : rend les tirages de la simulation
// reproductibles (arrivées des voitures, tenues, groupes) et testables.
// Retourne une fonction () => [0, 1).
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
