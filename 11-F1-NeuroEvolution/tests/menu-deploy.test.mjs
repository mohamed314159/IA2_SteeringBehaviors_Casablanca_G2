import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../style.css", import.meta.url), "utf8")
  .replace(/\r/g, "").replace(/\/\*[\s\S]*?\*\//g, ""); // sans commentaires
const sketch = fs.readFileSync(new URL("../sketch.js", import.meta.url), "utf8").replace(/\r/g, "");

// Valeur d'une propriété dans la dernière règle CSS dont le sélecteur est exactement `selector`.
function cssValue(selector, property) {
  const rules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => m[1].trim() === selector);
  assert.ok(rules.length > 0, `règle absente : ${selector}`);
  const match = new RegExp(`(?:^|;|\\s)${property}:\\s*([^;]+);`).exec(rules.at(-1)[2]);
  return match ? match[1].trim() : null;
}

const COMMON = "#menu .menu-buttons button,\n#menu .menu-buttons .button-like";

test("le bouton vert s'appelle « Déploiement » et lance toujours le parcours d'entraînement", () => {
  assert.match(html, /<button id="curriculumButton" type="button" class="curriculum deploy">Déploiement<\/button>/);
  assert.ok(sketch.includes('ui.curriculumButton.addEventListener("click", startCurriculum);'));
  // Libellé construit par le contrôleur : « Déploiement » + nombre de niveaux en petit.
  const source = /function deployButtonHtml[\s\S]*?\n\}/.exec(sketch)[0];
  const deployButtonHtml = vm.runInNewContext(`(${source})`);
  assert.equal(deployButtonHtml(10), "Déploiement<small>parcours de 10 niveaux d'entraînement</small>");
});

test("Déploiement est le bouton le plus grand du menu", () => {
  const deployFont = parseFloat(cssValue("#menu .menu-buttons button.deploy", "font-size"));
  const normalFont = parseFloat(cssValue(COMMON, "font-size"));
  assert.ok(deployFont >= normalFont * 1.5, `${deployFont} px contre ${normalFont} px`);
  const deployHeight = parseFloat(cssValue("#menu .menu-buttons button.deploy", "min-height"));
  const normalHeight = parseFloat(cssValue(COMMON, "min-height"));
  assert.ok(deployHeight > normalHeight * 1.5, `${deployHeight} px contre ${normalHeight} px`);
  assert.equal(cssValue("#menu .menu-buttons button.deploy:disabled", "box-shadow"), "none", "grisé sans ombre tant qu'aucune voiture n'est choisie");
});

test("boutons harmonisés : hauteur minimale commune, libellés centrés, vitesses en grille de 4", () => {
  assert.equal(cssValue(COMMON, "min-height"), "42px");
  assert.equal(cssValue(COMMON, "box-sizing"), "border-box", "le remplissage ne s'ajoute pas à la hauteur");
  assert.equal(cssValue(COMMON, "justify-content"), "center");
  assert.equal(cssValue("#menu .speed-buttons", "grid-template-columns"), "repeat(4, 1fr)");
});
