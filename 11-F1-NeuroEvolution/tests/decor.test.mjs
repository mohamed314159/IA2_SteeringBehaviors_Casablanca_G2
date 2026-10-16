import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createMemoryStorage, loadExample } from "./p5-adapter.mjs";

// drawTrackLayer utilise les constantes globales de p5 : valeurs factices.
const ex = loadExample(undefined, { ROUND: "round", SQUARE: "square", CLOSE: "close", color: (...rgb) => rgb });
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

// Faux p5.Graphics : compte les appels de dessin (ne prouve pas le rendu réel).
function recordingGraphics(width = 1200, height = 760) {
  const calls = {};
  return new Proxy({ width, height, calls }, {
    get: (target, key) => (key in target ? target[key] : (...args) => { (calls[key] ||= []).push(args); })
  });
}

test("mode du décor : valeurs reconnues, bascule, libellé du bouton", () => {
  assert.equal(ex.normalizeDecor("light"), ex.DECOR_LIGHT);
  assert.equal(ex.normalizeDecor("grass"), ex.DECOR_GRASS);
  for (const bad of [null, undefined, "", "LIGHT", 3]) assert.equal(ex.normalizeDecor(bad), ex.DECOR_GRASS);
  assert.equal(ex.toggledDecor(ex.DECOR_GRASS), ex.DECOR_LIGHT);
  assert.equal(ex.toggledDecor(ex.DECOR_LIGHT), ex.DECOR_GRASS);
  assert.equal(ex.toggledDecor("n'importe quoi"), ex.DECOR_LIGHT);
  assert.equal(ex.decorButtonLabel(ex.DECOR_GRASS), "Décor : herbe");
  assert.equal(ex.decorButtonLabel(ex.DECOR_LIGHT), "Décor : léger");
});

test("densité de pixels : 1 en mode léger, celle de l'écran sinon (valeur invalide → 1)", () => {
  assert.equal(ex.decorPixelDensity(ex.DECOR_LIGHT, 2), 1);
  assert.equal(ex.decorPixelDensity(ex.DECOR_LIGHT, 1.25), 1);
  assert.equal(ex.decorPixelDensity(ex.DECOR_GRASS, 1.5), 1.5);
  assert.equal(ex.decorPixelDensity(ex.DECOR_GRASS, 0), 1);
  assert.equal(ex.decorPixelDensity(ex.DECOR_GRASS, NaN), 1);
  assert.equal(ex.decorPixelDensity(ex.DECOR_GRASS, undefined), 1);
});

test("décor mémorisé ; absent, invalide ou stockage bloqué → herbe, sans erreur", () => {
  const storage = createMemoryStorage();
  assert.equal(ex.loadDecor(storage), ex.DECOR_GRASS);
  ex.saveDecor(storage, ex.DECOR_LIGHT);
  assert.equal(storage.data[ex.DECOR_STORAGE_KEY], "light");
  assert.equal(ex.loadDecor(storage), ex.DECOR_LIGHT);
  ex.saveDecor(storage, "bizarre");
  assert.equal(ex.loadDecor(storage), ex.DECOR_GRASS);
  assert.equal(ex.loadDecor(createMemoryStorage({ [ex.DECOR_STORAGE_KEY]: "autre" })), ex.DECOR_GRASS);
  assert.equal(ex.loadDecor(null), ex.DECOR_GRASS);
  const blocked = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("bloqué"); } };
  assert.equal(ex.loadDecor(blocked), ex.DECOR_GRASS);
  assert.doesNotThrow(() => ex.saveDecor(blocked, ex.DECOR_LIGHT));
});

test("mode léger : fond uni, aucun carré d'herbe ; mode herbe : la texture complète", () => {
  const light = recordingGraphics();
  ex.drawDecorBackground(light, ex.DECOR_LIGHT, ex.createRng(42));
  assert.deepEqual(light.calls.background, [[ex.LIGHT_BACKGROUND]]);
  assert.equal(light.calls.rect, undefined);

  const grass = recordingGraphics();
  ex.drawDecorBackground(grass, ex.DECOR_GRASS, ex.createRng(42));
  const block = 16 * 3; // texture 16 × 16, texels de 3 px
  const expected = Math.ceil(1200 / block) * Math.ceil(760 / block) * 16 * 16;
  assert.equal(grass.calls.rect.length, expected);
  assert.equal(grass.calls.background, undefined);
});

test("drawTrackLayer : la piste (asphalte, bords, vibreurs, départ) est identique dans les deux décors", () => {
  const circuit = new ex.Circuit(ex.F1_CIRCUITS.monza, { key: "monza" });
  const light = recordingGraphics();
  const grass = recordingGraphics();
  ex.drawTrackLayer(light, circuit, ex.createRng(42), ex.DECOR_LIGHT);
  ex.drawTrackLayer(grass, circuit, ex.createRng(42), ex.DECOR_GRASS);
  for (const call of ["vertex", "line", "quad"]) {
    assert.ok(light.calls[call].length > 0, call);
    assert.equal(light.calls[call].length, grass.calls[call].length, call);
  }
  assert.ok(grass.calls.rect.length > 50000, "l'herbe coûte des dizaines de milliers de carrés");
  // Par défaut (ancien appel sans décor) : herbe.
  const byDefault = recordingGraphics();
  ex.drawTrackLayer(byDefault, circuit, ex.createRng(42));
  assert.equal(byDefault.calls.rect.length, grass.calls.rect.length);
});

test("page : bouton du décor hors du menu, avant le canevas, libellé et état accessibles", () => {
  const button = html.match(/<button id="decorButton"[^>]*>([^<]*)<\/button>/);
  assert.ok(button, "bouton decorButton absent");
  assert.equal(button[1], "Décor : herbe");
  assert.match(button[0], /aria-pressed="false"/);
  const menu = html.slice(html.indexOf('<aside id="menu"'), html.indexOf("</aside>"));
  assert.equal(menu.includes("decorButton"), false, "le bouton n'est pas dans le menu");
  assert.ok(html.indexOf('src="decor.js"') < html.indexOf('src="track-renderer.js"'));
  const css = fs.readFileSync(new URL("../style.css", import.meta.url), "utf8");
  const rule = css.slice(css.indexOf(".decor-toggle {"), css.indexOf("}", css.indexOf(".decor-toggle {")));
  assert.match(rule, /position: fixed/);
  assert.match(rule, /top: \d+px/);
  assert.match(rule, /right: \d+px/);
});
