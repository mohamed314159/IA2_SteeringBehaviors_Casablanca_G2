// Données réelles complétant OpenStreetMap (longitude, latitude).
// Sources : plan d'accès de nearcasashore.com (numérotation Shore 1 à 19 et
// position de l'hôtel Ibis), adresses des entreprises (Shore 22 sur le
// boulevard 60…), OpenStreetMap (entrées de parkings souterrains, restaurant,
// café Boca) et relevés sur imagerie satellite pour les bâtiments absents
// d'OSM (Shore 2 courbé et extension sud-est). Quand aucune source ne donne
// la numérotation (Shores 20 à 28), on retient l'hypothèse la plus probable.
const CASANEARSHORE_REEL = {
  // Bâtiment OSM → nom réel (plan de nearcasashore.com).
  noms: {
    331720661: "Shore 1",
    331720694: "Shore 6",
    331720665: "Shore 5",
    331720684: "Shore 4",
    331720660: "Shore 3",
    331720664: "Shore 7",
    331720675: "Shore 8",
    331720682: "Shore 8",
    331720662: "Shore 9",
    331720686: "Shore 9",
    331720677: "Shore 10",
    331720669: "Shore 11",
    331720670: "UIR (Shore 13)",
    331720691: "Shore 14",
    331720680: "Shore 15",
    1107874669: "Ibis",
    331720667: "Shore 12",
    405302747: "Shore 16",
    405302749: "Shore 17",
    1107874676: "Shore 18",
    405302750: "Shore 19",
    1107874668: "Shore 20",
    // Groupe nord-est, livré après le plan : numérotation la plus probable.
    1174740417: "Shore 26",
    1174740418: "Shore 27",
    1174740422: "Shore 28",
    1174740421: "Shore 2B",
    1174740423: "Shore 9B",
    1174740420: "Annexe",
    1174740419: "Annexe"
  },
  // Usage des bâtiments (dessin du toit, détails).
  usages: {
    "Ibis": "hotel",
    "UIR (Shore 13)": "universite",
    "Shore 11": "cafe"
  },
  // Bâtiments absents d'OSM, relevés sur l'imagerie satellite, puis recalés
  // pour laisser libres les routes et chemins OSM voisins (façade nord des
  // Shores 21, 23 et 24 à 3 m du chemin piéton ; chantier limité à la partie
  // sans route).
  ajouts: [
    { nom: "Shore 2", toit: "courbe", points: [[-7.639673, 33.529485], [-7.639227, 33.529596], [-7.638718, 33.52974], [-7.638241, 33.529904], [-7.638098, 33.529697], [-7.638718, 33.529485], [-7.639227, 33.529336], [-7.639694, 33.529198]] },
    { nom: "Shore 21", toit: "solaire", points: [[-7.639018, 33.524017], [-7.638384, 33.524017], [-7.638384, 33.523574], [-7.638989, 33.523567]] },
    { nom: "Shore 22", toit: "solaire", points: [[-7.638911, 33.523232], [-7.638014, 33.523232], [-7.638014, 33.523026], [-7.637594, 33.523026], [-7.637594, 33.52257], [-7.63884, 33.522534]] },
    { nom: "Shore 23", toit: "solaire", points: [[-7.637665, 33.524046], [-7.636974, 33.524046], [-7.63696, 33.523596], [-7.637565, 33.523589]] },
    { nom: "Shore 24", toit: "solaire", points: [[-7.636903, 33.52406], [-7.63634, 33.52406], [-7.636355, 33.523631], [-7.636825, 33.523617]] },
    { nom: "Shore 25 (chantier)", toit: "chantier", points: [[-7.640897, 33.52298], [-7.639188, 33.52298], [-7.639188, 33.522354], [-7.640897, 33.522354]] }
  ],
  // Toits avec panneaux solaires visibles sur l'imagerie (bâtiments OSM).
  toitsSolaires: [1107874668, 405302747, 405302749, 1107874676, 405302750, 331720691, 331720680, 331720670],
  // Entrées réelles des parkings souterrains (OSM amenity=parking_entrance).
  entreesSouterraines: [
    [-7.64147, 33.52566], [-7.64150, 33.52566],
    [-7.63826, 33.52899], [-7.63823, 33.52900],
    [-7.64097, 33.52918],
    [-7.63711, 33.52359], [-7.63638, 33.52371], [-7.63896, 33.52355], [-7.63841, 33.52366]
  ],
  // Restaurant d'entreprise (OSM : « Nearshore Casablanca », réservé aux employés).
  restaurant: { nom: "Restaurant", point: [-7.64068, 33.52863] },
  // Piscine au milieu de la boucle centrale (imagerie), au sud de l'UIR.
  piscine: { point: [-7.641094, 33.525358], largeurM: 10, longueurM: 5 },
  // Abris solaires du parking le long du boulevard 60 (imagerie).
  abrisSolaires: [[-7.63865, 33.52234], [-7.63650, 33.52230]]
};
