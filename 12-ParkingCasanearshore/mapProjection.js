// Projection locale latitude/longitude → pixels du monde (fonctions pures).
// Sur moins de 2 km, une projection équirectangulaire centrée sur la zone
// est assez précise (erreur bien inférieure à 1 %).
// x croît vers l'est, y croît vers le sud (repère du canvas).
const METRES_PAR_DEGRE_LAT = 111320;

function createProjection(minLat, minLon, maxLat, maxLon, pxPerMeter) {
  const lat0 = (minLat + maxLat) / 2;
  return {
    minLat, minLon, maxLat, maxLon, pxPerMeter,
    metresParDegreLon: METRES_PAR_DEGRE_LAT * Math.cos((lat0 * Math.PI) / 180)
  };
}

function projectLatLon(lat, lon, proj) {
  return {
    x: (lon - proj.minLon) * proj.metresParDegreLon * proj.pxPerMeter,
    y: (proj.maxLat - lat) * METRES_PAR_DEGRE_LAT * proj.pxPerMeter
  };
}

function unprojectXY(x, y, proj) {
  return {
    lat: proj.maxLat - y / (METRES_PAR_DEGRE_LAT * proj.pxPerMeter),
    lon: proj.minLon + x / (proj.metresParDegreLon * proj.pxPerMeter)
  };
}

// Taille du monde en pixels.
function projectionSize(proj) {
  const coin = projectLatLon(proj.minLat, proj.maxLon, proj);
  return { width: coin.x, height: coin.y };
}

// Conversion mètres ↔ pixels du monde.
function metres(m, proj) {
  return m * proj.pxPerMeter;
}
