# Architecture — 12 · Parking Casanearshore

Ce document décrit l'architecture de la simulation et **toutes les étapes** de son développement (versions 1, 2 et 3). Le mode d'emploi est dans [README.md](README.md) ; les demandes qui ont guidé le projet sont dans [PROMPTS.md](PROMPTS.md).

## 1. Règles suivies

Elles viennent d'`AGENTS.md` et d'`ARCHITECTURE.md` du dépôt du cours (version micbuffa, commit `62cca18`).

1. **`vehicle.js` est protégé.** C'est la copie exacte de `1-Seek/vehicle.js` (micbuffa) ; un test vérifie son empreinte SHA-256. Tout comportement nouveau ou corrigé va dans une sous-classe.
2. **Une entité = une sous-classe = un fichier.** Toute entité du monde est un `Vehicle`, même immobile (bâtiment, place, poteau, banc, stand, point de rassemblement).
3. **Les trois niveaux de Reynolds** : sélection d'action (choisir l'objectif), steering (calculer une force), locomotion (`update()` hérité, appelé une seule fois par pas). Aucune téléportation, sauf les apparitions et disparitions documentées comme règles de scène.
4. **Le debug ne recalcule rien** : il lit ce que les comportements ont rangé dans `debugInfo` pendant le pas.
5. **Tests `node:test` obligatoires**, tous verts avant de proposer un essai, complétés par une validation dans le navigateur avec le vrai p5.js.

## 2. Vue d'ensemble

```text
données (OSM + plan réel)
   └─► construction de la scène (campus, parkings, garages, décor)      une fois
          └─► entités (sous-classes de Vehicle)
                 └─► gestionnaires de scène (trafic, transports, foule, faune)
                        └─► Simulation : un pas = un pas de chaque gestionnaire
                               └─► sketch.js : boucle, entrées, rendu        à chaque image
```

### Couches et fichiers

| Couche | Fichiers | Rôle |
|---|---|---|
| Base protégée | `vehicle.js` | seek, arrive (`rayonZoneDeFreinage`, distance d'arrêt), wander, flee, update |
| Aides pures | `random.js`, `simUnits.js`, `geometry.js`, `path.js`, `mapProjection.js`, `roadNetwork.js`, `collisions.js` | Aléatoire à graine, unités (1 m = 2 px, 1 pas = 0,2 s), géométrie, chemins, projection, plus court chemin, composante connexe, rectangles orientés |
| Données | `data/casanearshore.js`, `data/osm-brut.json`, `data/reel.js` | Carte OSM projetée ; plan réel (noms, usages, toits, bâtiments relevés, rampes, restaurant, piscine) |
| Comportements | `steeringAgent.js` | `SteeringAgent extends Vehicle` : les 8 comportements et leur composition par priorités |
| Construction | `campus.js`, `parkingLot.js`, `parkingSpot.js`, `gate.js`, `pillar.js`, `garage.js`, `parkingAllocator.js`, `parkingWorld.js`, `esplanade.js`, `trees.js` | Bâtiments et portes, réseau routier et piéton, trottoirs et itinéraires à pied, découpage des parkings, six garages, attribution des places, stands, bancs, points de rassemblement, arbres |
| Entités mobiles | `roadVehicle.js`, `luxuryCar.js`, `g4sVehicle.js`, `tram.js`, `tramCar.js`, `employee.js`, `securityGuard.js`, `cat.js`, `butterfly.js`, `bread.js`, `bird.js`, `neuralNetwork.js` | Voitures, convoi, tram, piétons, gardiens, faune |
| Entités immobiles | `building.js`, `coffeeKiosk.js`, `bench.js`, `assemblyPoint.js` (+ places, portes, poteaux) | Obstacles, destinations, décor interactif |
| Règles de scène | `traffic.js`, `transit.js`, `crowd.js`, `wildlife.js`, `clock.js`, `schedule.js`, `simSpeed.js`, `simulation.js` | Apparitions, files, convoi, groupes, évolution des oiseaux, horloge, programme, accélération |
| Rendu | `groundShader.js`, `mapRenderer.js`, `vehicleGlow.js`, `carModels.js`, `outfits.js`, `debug.js`, `camera.js` | Sol par shader, calque de décor, halos, dessins, debug, caméra |
| Interface | `reglages.js`, `panneau.js`, `localisation.js`, `accueil.js`, `sketch.js`, `index.html`, `style.css` | Réglages, panneau ⚙, « Voir sur la carte », écran d'accueil, boucle et entrées |

### Hiérarchie des classes

```text
Vehicle (vehicle.js, protégé)
├── SteeringAgent — seek/arrive hérités ; flee, pursue, evade, wander, follow, avoid,
│   │               separate, align, cohesion, followLeader ; combineForces (priorités)
│   ├── RoadVehicle — route, file d'attente, barrière, priorités, interblocages, virages
│   │   ├── LuxuryCar — place attribuée à la porte, surface ou garage, stationnement
│   │   └── G4SVehicle — convoi : leader (path) et suiveurs (leader following sur la route)
│   ├── Tram, TramCar — tête sur les rails ; seconde caisse en « snake » (arrive sur la tête)
│   ├── Employee — flânerie, café, banc, discussion, groupes, formation, retard, entrée
│   ├── SecurityGuard — poste (arrive) et ronde (path following)
│   ├── Cat (pursue), Butterfly (wander + evade), Bread (wander)
│   └── Bird — vitesse désirée choisie par un NeuralNetwork (6 → 8 → 2)
└── Building, ParkingSpot, Gate, Pillar, CoffeeKiosk, Bench, AssemblyPoint — immobiles
```

### Ordre d'un pas (`simulation.js`)

1. Événements dus : apparitions de voitures, trams, retardataires ; départ général à 8h55.
2. Trafic : barrières, puis chaque véhicule (voitures et convoi), puis comptage des contacts.
3. Trams.
4. Foule (grille spatiale pour les voisins).
5. Gardiens.
6. Faune : chats et papillon, pain, oiseaux (remplacement des oiseaux arrêtés).
7. Horloge.

Dans chaque entité : **sélection d'action** (`chooseForces` selon l'état) → **forces** composées par `combineForces` (allocation prioritaire : les forces sont ajoutées dans l'ordre tant que le budget `maxForce` n'est pas épuisé) → **locomotion** (`update()` hérité, une fois) → **transitions** d'état.

### Temps

- Mouvement « par pas » comme dans les bases du cours, sans `deltaTime`.
- À ×N, une image exécute N pas identiques (principe de `runSimulationSteps` du dossier 11) : le résultat ne dépend pas de l'accélération (testé).
- Accélération automatique seulement quand tout le monde est entré au travail ; nouvelle matinée (nouvelle graine) à 9h05.

### Rendu

- Masques de matériaux et calque de décor dessinés **une seule fois** ; le sol est calculé par un shader à chaque image (pelouse, parc, pavés, asphalte, terre, eau).
- Les entités se dessinent dans `show()`, isolées par `push()` / `pop()`. Les halos des véhicules ont une épaisseur constante à l'écran.

## 3. Les étapes du développement

### Version 1 (20-21 octobre)

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | Dossier, base protégée et outils de test | `index.html`, `style.css`, `libraries/`, `vehicle.js` (copie de 1-Seek micbuffa), `random.js` (11), `tests/adaptateur-p5.mjs` (7-Boids) | La base se charge ; empreinte SHA-256 enregistrée |
| 2 | `SteeringAgent extends Vehicle` : les 8 comportements | `steeringAgent.js` — seek/arrive hérités, pursue/evade (2), follow (5-2, 5-3), avoid (6, 7), separate/align/cohesion (7), followLeader (slides p. 50-51), composition par priorités | Direction et grandeur des forces, `maxForce`/`maxSpeed`, seuils exacts, cible confondue, vitesse nulle, entrées non finies, aucune mutation, wander reproductible |
| 3 | La carte réelle | `outils/exporter-carte.mjs`, `data/casanearshore.js`, `mapProjection.js`, `roadNetwork.js` (Dijkstra, sens uniques), `building.js`, `campus.js` | Échelle à 1 %, chemins continus, chaque porte atteignable, plus court chemin |
| 4 | Parkings et garage | `parkingLot.js` (découpage en places de 2,5 × 5 m), `parkingSpot.js` (normale, ⚡, ♿), `gate.js`, `pillar.js`, `garage.js`, `parkingAllocator.js`, `parkingWorld.js` | Places sans chevauchement, attribution unique et compatible, barrières, accès à chaque place |
| 5 | Voitures de luxe | `carModels.js`, `roadVehicle.js`, `luxuryCar.js`, `traffic.js`, `collisions.js` (6) | Cycle complet en surface, aucun wander, file à la porte sans collision, trafic dense |
| 6 | Vue intérieure du garage | `garage.js`, `luxuryCar.js` (rampe, borne badge, place) | Cycle garage : bouche, rampe, badge, place, disparition de la surface |
| 7 | Navette G4S | `shuttle.js` (remplacée par le convoi en version 2) | Arrêt sans dépassement, portes à l'arrêt complet |
| 8 | Tram à deux caisses | `tram.js`, `tramCar.js` (mécanisme snake de 1-Seek et 5-3), `transit.js` | Seconde caisse à distance constante, arrêt au quai, portes à l'arrêt |
| 9 | Employés | `outfits.js`, `employee.js`, `crowd.js`, `coffeeKiosk.js`, `bench.js`, `esplanade.js` | Discussions, café, 8h55, groupes, formation, retardataire, évasion, évitement, ascenseur |
| 10 | Horloge, programme, temps accéléré | `clock.js`, `schedule.js`, `simSpeed.js` (11), `simulation.js`, `sketch.js` | Résultats identiques à ×1 et ×8, déclenchements à l'heure exacte, réinitialisation |
| 11 | Réglages par comportement | `reglages.js`, `panneau.js` (7-Boids) | Plages, écriture bornée, vitesse et taille par comportement |
| 12 | Rendu, debug, accessibilité | `mapRenderer.js`, `debug.js`, `camera.js`, `describe()` | Le debug ne modifie rien ; touches 1 à 8 |
| 13 | Validation et livraison | `README.md`, `outils/serveur.py` | 82 tests ; matinée complète dans le navigateur |

Problèmes rencontrés et corrigés en version 1 : routes OSM hors cadre, barrières nord inversées, itinéraires traversant le parc, contacts entre voitures (file à la porte, échantillonnage du chemin, zone de freinage ≥ v²/maxForce, hiérarchie de priorité, déblocage des attentes mutuelles), performances (14 → 59 images/s), groupes boids qui dérivaient (ordre séparation → chemin → alignement → cohésion).

### Version 2 (21 octobre)

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | Sauvegarde GitHub de la version 1 | commit `f8ce416` | — |
| 2 | Plan réel du parc | `data/reel.js` : Shores 1 à 28, UIR (Shore 13) au milieu de la boucle, Ibis, restaurant, piscine ; Shores 2, 21 à 25 relevés sur l'imagerie puis recalés pour libérer les routes OSM ; toits solaires | Noms, UIR près du centre, chaque nom écrit une fois, bâtiments relevés sans route au travers |
| 3 | Six garages sous les rampes réelles | `parkingWorld.js` (regroupement des entrées souterraines OSM à moins de 60 m, sommet d'entrée atteignable depuis les deux portes) | Six garages, bouche à moins de 60 m d'une rampe, plans séparés, garage le plus pratique |
| 4 | Décor réaliste | `groundShader.js` (sol par shader), `mapRenderer.js` (masques et calque : trottoirs, voie du tram, station, ombres, toits, piscine), `trees.js`, `building.js` (ombres, toits, chantier avec grue) | Validation dans le navigateur |
| 5 | Espaces piétons | `campus.js` : réseau piéton sans voie rapide, plus grande composante connexe, trottoirs à 1,6 m du bord, itinéraires qui ne traversent aucun bâtiment ; `esplanade.js` : 12 stands de café à côté des entrées, bancs, points de rassemblement, parvis | Trottoirs, itinéraires depuis la station et les stands, discussions hors chaussée |
| 6 | Employés | `employee.js` : banc (s'asseoir), retardataire qui vise un à un les points de son itinéraire (seek), pas pressé après 8h55 ; `crowd.js` : apparitions hors bâtiments et hors chaussées ; badge oublié supprimé | Banc, retardataire lointain jamais bloqué, allure après 8h55 |
| 7 | Gardiens en blanc | `securityGuard.js`, `simulation.js` (portes réelles) | Uniforme, poste, ronde puis retour |
| 8 | Convoi G4S | `g4sVehicle.js`, `transit.js` : boucle sans demi-tour (aller et retour par des rues différentes), leader en path following, suiveurs en leader following | Boucle, colonne, dix minutes sans contact, cession à une voiture qui s'intercale |
| 9 | Tram réaliste | `tram.js`, `tramCar.js` : 2 × 32 m, 8 portes ; rayon de freinage de la caisse > espacement (exigence de l'arrive de la base) | Arrêt au quai, écart constant, portes côté quai |
| 10 | Faune | `cat.js`, `butterfly.js` (pursue / evade), `bread.js`, `bird.js`, `neuralNetwork.js` (8 neurones cachés), `wildlife.js` (clone muté du meilleur, nid au bord de la zone du pain) | Réseau, oiseaux, évolution meilleure que le hasard, chats et papillon, zones dans le parc |
| 11 | Trafic | `roadVehicle.js` : interblocage en cercle (2 ou 3 voitures), file nommée « file » (le mot « leader » est réservé au convoi) | Interblocage en cercle, file ordinaire non touchée |
| 12 | Temps et scène | `schedule.js` (dernier tram 8h44, dernière voiture 8h55), `simulation.js` (accélération seulement quand tout le monde est entré, nouvelle matinée à 9h05) | Accélération, nouvelle matinée |
| 13 | Interface | `accueil.js` (écran d'accueil avec vignettes), `index.html` (barre minimale : heure HH:MM et quatre boutons), `panneau.js` (places libres et statistiques), `sketch.js` ; copyright retiré | Validation dans le navigateur |
| 14 | Tests et validation | `tests/fichiers.mjs` (scripts lus dans `index.html`), suites carte, parkings, voitures, transports, foule, faune, temps ; cinq matinées complètes | 114 tests ; 110 voitures garées, tout le monde entré avant 9h05 |

### Version 3 (21 octobre)

| # | Étape | Fichiers | Tests |
|---|---|---|---|
| 1 | Véhicules en « brillance » | `vehicleGlow.js` (liseré clair et ombre floue, épaisseur constante à l'écran), réglage « Brillance des véhicules » ; en vue d'ensemble, une voiture qui roule fait au moins 8 px | Épaisseurs, état graphique restauré, intensité 0 |
| 2 | Retrouver un comportement | `localisation.js`, `panneau.js` (« 📍 Voir sur la carte » dans chaque comportement, compteur en direct), `sketch.js` (caméra qui suit l'entité, passage au garage si besoin) | Cohérence avec la surbrillance 1 à 8, tour des entités, null si personne |
| 3 | Mode « véhicules seuls » | `sketch.js` (fond noir, seulement ce qui bouge, avec halos), bouton ◐ et touche `B` | Entités mobiles (pas les voitures garées) |
| 4 | Voitures sur la chaussée | `roadVehicle.js` : ralentir avant un virage serré (courbe de freinage, jamais plus de `maxForce` par pas), rester lent hors de sa voie, tolérance de voie 0,75 m, vitesse de départ limitée ; routes de service dessinées à 6,5 m | Virage : vitesse, freinage, déport ; formule de la vitesse de virage |
| 5 | Documents | `README.md`, `ARCHITECTURE.md`, `PROMPTS.md` | 122 tests ; cinq matinées complètes : 110 voitures garées, tout le monde entré avant 9h05 |

## 4. Choix faute de source

Quand aucune source publique n'existe, l'emplacement le plus probable a été retenu et documenté : stands de café (à côté de l'entrée des plus grands bâtiments), bancs, points de rassemblement (pelouses les plus dégagées), postes des gardiens (barrières OSM réelles), ronde du convoi (circuit entre les carrefours des Shores 1 et 22), plans intérieurs des garages (dimensions usuelles, taille d'après le bâtiment).
