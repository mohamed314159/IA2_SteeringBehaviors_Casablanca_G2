// Scripts de la simulation dans l'ordre de chargement de index.html (lu dans
// le fichier : les tests chargent exactement ce que charge le navigateur),
// sans p5 ni les fichiers d'interface et de rendu qui exigent un vrai canvas.
import fs from "node:fs";
import path from "node:path";
import { dossierExemple } from "./adaptateur-p5.mjs";

const INTERFACE = new Set(["libraries/p5.min.js", "panneau.js", "debug.js", "camera.js", "groundShader.js",
  "mapRenderer.js", "accueil.js", "sketch.js"]);

export const SCRIPTS_INDEX = [...fs.readFileSync(path.join(dossierExemple, "index.html"), "utf8")
  .matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);

export const FICHIERS_SIMULATION = SCRIPTS_INDEX.filter(f => !INTERFACE.has(f));
