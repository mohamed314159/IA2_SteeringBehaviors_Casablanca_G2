// Outil (Node, hors navigateur) : convertit l'extrait OpenStreetMap brut
// data/osm-brut.json en data/casanearshore.js, projeté en pixels du monde.
//
//   node outils/exporter-carte.mjs
//
// L'extrait brut a été téléchargé avec l'API Overpass (voir README).
// Données © OpenStreetMap contributors, licence ODbL.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const dossier = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const brut = JSON.parse(fs.readFileSync(path.join(dossier, "data/osm-brut.json"), "utf8"));

// Réutilise les fonctions de projection de l'exemple.
const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(dossier, "mapProjection.js"), "utf8") +
  "\nthis.createProjection = createProjection; this.projectLatLon = projectLatLon; this.projectionSize = projectionSize;", ctx);

const PX_PAR_METRE = 2;
const proj = ctx.createProjection(33.5195, -7.6480, 33.5320, -7.6320, PX_PAR_METRE);
const taille = ctx.projectionSize(proj);
const arrondi = v => Math.round(v * 10) / 10;
const pt = g => { const p = ctx.projectLatLon(g.lat, g.lon, proj); return [arrondi(p.x), arrondi(p.y)]; };
const pts = geometry => geometry.map(pt);

function dedans([x, y], poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const centre = p => p.reduce((a, q) => [a[0] + q[0] / p.length, a[1] + q[1] / p.length], [0, 0]);
// Retire le dernier point s'il répète le premier (polygone fermé OSM).
const ouvert = p => (p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1] ? p.slice(0, -1) : p);

const ways = brut.elements.filter(e => e.type === "way" && e.geometry);
const nodes = brut.elements.filter(e => e.type === "node");

const siteWay = ways.find(e => e.id === 331720689);
const site = ouvert(pts(siteWay.geometry));

const ROUTES = new Set(["trunk", "trunk_link", "primary", "primary_link", "secondary", "tertiary",
  "unclassified", "residential", "service", "living_street"]);
const PIETONS = new Set(["footway", "pedestrian", "path", "steps"]);

const dansLeCadre = ([x, y]) => x >= 0 && y >= 0 && x <= taille.width && y <= taille.height;

const buildings = ways.filter(e => e.tags?.building).map(e => {
  const p = ouvert(pts(e.geometry));
  return { id: e.id, name: e.tags.name || "", type: e.tags.building, inSite: dedans(centre(p), site), points: p };
}).filter(b => dansLeCadre(centre(b.points)));

// Overpass renvoie la géométrie complète des voies, même hors du cadre :
// on découpe chaque voie en tronçons continus de nœuds situés dans le cadre.
function troncons(e) {
  const morceaux = [];
  let courant = null;
  e.geometry.forEach((g, i) => {
    const p = pt(g);
    if (g && dansLeCadre(p)) {
      if (!courant) {
        courant = { nodes: [], points: [] };
        morceaux.push(courant);
      }
      courant.nodes.push(e.nodes[i]);
      courant.points.push(p);
    } else {
      courant = null;
    }
  });
  return morceaux.filter(m => m.points.length >= 2);
}

const roads = ways.filter(e => ROUTES.has(e.tags?.highway)).flatMap(e => troncons(e).map(t => ({
  id: e.id,
  type: e.tags.highway,
  service: e.tags.service || "",
  name: e.tags.name || "",
  oneway: e.tags.oneway === "yes" || e.tags.junction === "roundabout",
  nodes: t.nodes,
  points: t.points
})));

const footways = ways.filter(e => PIETONS.has(e.tags?.highway)).flatMap(e => troncons(e).map(t => ({ type: e.tags.highway, nodes: t.nodes, points: t.points })));

const busway = ways.filter(e => e.tags?.highway === "busway").flatMap(e => troncons(e).map(t => ({
  id: e.id, from: e.tags.from || "", to: e.tags.to || "", nodes: t.nodes, points: t.points
})));

const parkings = ways.filter(e => e.tags?.amenity === "parking").map(e => {
  const p = ouvert(pts(e.geometry));
  return { id: e.id, parking: e.tags.parking || "surface", access: e.tags.access || "", inSite: dedans(centre(p), site) || p.some(q => dedans(q, site)), points: p };
});

const greens = ways.filter(e => e.tags?.leisure === "park" || e.tags?.leisure === "pitch" || e.tags?.landuse === "grass")
  .map(e => ({ type: e.tags.leisure || e.tags.landuse, points: ouvert(pts(e.geometry)) })).filter(g => dansLeCadre(centre(g.points)));

const stops = nodes.filter(n => n.tags?.public_transport === "platform" || n.tags?.highway === "bus_stop")
  .map(n => ({ id: n.id, name: (n.tags.name || "").replace(/ platform$/i, ""), bus: n.tags.highway === "bus_stop", point: pt(n) }));

const gates = nodes.filter(n => n.tags?.barrier).map(n => ({ id: n.id, kind: n.tags.barrier, point: pt(n) }));

const donnees = {
  source: "© OpenStreetMap contributors, ODbL — extrait du " + (brut.osm3s?.timestamp_osm_base || ""),
  projection: proj,
  width: arrondi(taille.width),
  height: arrondi(taille.height),
  site, buildings, roads, footways, busway, parkings, greens, stops, gates
};

const sortie = "// Généré par outils/exporter-carte.mjs — ne pas modifier à la main.\n" +
  "// " + donnees.source + "\n" +
  "const CASANEARSHORE = " + JSON.stringify(donnees) + ";\n";
fs.writeFileSync(path.join(dossier, "data/casanearshore.js"), sortie);

console.log(JSON.stringify({
  monde: [donnees.width, donnees.height],
  batiments: buildings.length, dansLeParc: buildings.filter(b => b.inSite).length,
  routes: roads.length, pietons: footways.length, busway: busway.length,
  parkings: parkings.map(p => [p.id, p.inSite]), arrets: stops.map(s => s.name),
  portes: gates.map(g => [g.id, g.kind, g.point, dedans(g.point, site)])
}, null, 1));
