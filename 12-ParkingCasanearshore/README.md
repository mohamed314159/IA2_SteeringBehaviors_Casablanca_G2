# 12 — Parking Casanearshore (simulation de steering behaviors)

Une matinée au parc d'affaires **Casanearshore** (Casablanca), de **8h30 à 9h05**, vue de dessus sur la **vraie carte OpenStreetMap** : 29 bâtiments, routes, parkings, portes à barrière et ligne de transport au nord du parc.

- Des **voitures de luxe** entrent par un **bord de la carte**, suivent les routes jusqu'à la **porte nord ou sud**, reçoivent **leur place au passage de la barrière** puis vont s'y garer : en surface, sur les parkings découpés en vraies places, ou au **garage souterrain**. Elles ne tournent jamais en cherchant une place.
- Une voiture qui va au garage s'arrête à la bouche de la rampe et **disparaît de la surface**. Le bouton **« Voir le garage »** montre l'intérieur : rampe, borne badge, places, poteaux, ascenseur.
- Le **tram à deux longues caisses** arrive à la station en haut du parc. Ses caisses suivent la tête comme les anneaux du serpent de 1-Seek. Les passagers descendent quand le tram est complètement arrêté.
- La **navette G4S** entre par la porte nord, s'arrête au centre du parc puis repart.
- Les **employés** portent des tenues professionnelles : costume-cravate, chemise bleue, chemise blanche, tailleur, veste.
  - Avant 8h55, ils flânent, vont chercher un café et discutent en groupes.
  - À 8h55, chacun rejoint son bâtiment (*arrive*) et disparaît.
  - Les passagers du tram et de la navette marchent en groupes (*boids*) ou en formation derrière un guide.
  - Les conducteurs vont à pied jusqu'à leur bâtiment, ou jusqu'à l'ascenseur du garage.
- **Le temps s'accélère tout seul quand rien ne se passe**, puis revient à la vitesse normale avant l'événement suivant.

## Lancer

Depuis ce dossier :

```bash
python outils/serveur.py 8771
```

puis ouvrir <http://localhost:8771>. Ce petit serveur désactive le cache du navigateur. Tous les fichiers sont locaux, donc l'ouverture directe de `index.html` fonctionne aussi.

## Commandes

| Action | Effet |
|---|---|
| Glisser / molette | Déplacer / zoomer la vue |
| Boutons de vue | Vue d'ensemble, porte nord, porte sud, station du tram |
| **Voir le garage** ou `G` | Vue intérieure du garage (la simulation continue partout) |
| ⏸ Pause ou `Espace` | Pause / lecture |
| ×1 / ×2 / ×4 | Vitesse manuelle |
| « Accélérer quand rien ne se passe » | Accélération automatique (×8 par défaut) |
| ↺ Recommencer ou `R` | Rejoue la même matinée (même graine) |
| ⚙ Réglages ou `P` (`Échap` pour fermer) | Panneau des réglages par comportement |
| `D` | Mode debug : rayons de freinage, vecteur ahead, points prédits, places de formation, cercle du wander, nom du comportement actif |
| `1` à `8` | Surbrillance des entités qui exécutent un comportement (1 Seek, 2 Pursue/Evade, 3 Arrive, 4 Wander, 5 Path following, 6 Obstacle avoidance, 7 Boids, 8 Leader following) ; même touche pour enlever |

## Les 8 comportements du cours

| # | Comportement | Qui, quand | Où dans le code | Origine |
|---|---|---|---|---|
| 1 | **Seek** | Employé en retard (8h54) qui court vers sa porte ; passager du tram qui fonce au café | `Employee` (`run`, `seekCoffee`) | `vehicle.js` de 1-Seek (hérité) |
| 2 | **Pursue** | Conducteur qui a le badge d'un collègue et le rattrape en anticipant sa trajectoire | `Employee` (`pursue`) | 2-PursueEvade (prédiction, horizon borné) |
| 2 | **Evade** | Piétons qui s'écartent des voitures. Le rayon de détection est distinct de la distance de sortie | `SteeringAgent.evadeThreats` | 2-PursueEvade (`predictThreatPosition`) |
| 3 | **Arrive** | Voir la liste ci-dessous | `SteeringAgent.arriveAt` | `vehicle.js` de 1-Seek (`rayonZoneDeFreinage`) |
| 4 | **Wander** | Employés qui flânent sur l'esplanade avant 8h55, confinés à leur zone | `Employee` (`wander`) | `vehicle.js` de 1-Seek (direction persistante) |
| 5 | **Path following** | Voitures (routes réelles OSM), navette, tram (voie), piétons (trottoirs) | `SteeringAgent.follow` | 5-1 (projection), 5-2, 5-3 |
| 6 | **Obstacle avoidance** | Piétons autour des bâtiments (polygones), kiosques, bancs, jardinières ; voitures autour des poteaux du garage | `SteeringAgent.avoid` | 6-ObstacleAvoidance, 7-Boids |
| 7 | **Boids** | Collègues d'un même bâtiment qui marchent ensemble (alignement, cohésion, séparation) | `Employee` (`flock`) | 7-Boids |
| 8 | **Leader following** | Groupe en formation sur deux colonnes derrière un guide ; file des voitures derrière la voiture de devant ; seconde caisse du tram | `SteeringAgent.followLeader`, `RoadVehicle.queueConstraint`, `TramCar` | Slides p. 50-51, 1-Seek (snake) |

### Les *arrive* de la simulation

| Qui | Arrive sur… |
|---|---|
| Voiture | La ligne d'arrêt de la barrière (25 m de freinage) |
| Voiture | Le point de sa voie situé derrière le véhicule de devant (file d'attente, freinage ≥ v²/maxForce) |
| Voiture | Un point avant un piéton qui se trouve sur sa voie |
| Voiture | Sa place de surface, ⚡ (électrique) ou ♿ (PMR) |
| Voiture | La bouche de la rampe du garage, puis la borne badge au bas de la rampe |
| Voiture | Sa place au sous-sol, entre les poteaux |
| Tram | Le quai (150 m de freinage, véhicule lourd) |
| Navette | Son arrêt au centre du parc |
| Passager | Un point à quelques mètres de la porte du tram ou de la navette |
| Employé | Sa place dans le cercle de discussion, le comptoir du kiosque, la porte de son bâtiment, la porte de l'ascenseur |
| Suiveur | Sa place de formation derrière le guide |

## Réglages (panneau ⚙)

Chaque comportement a sa **vitesse (×)** et sa **taille (×)**, comme les perroquets et les chasseurs de 7-Boids :
- la vitesse multiplie la vitesse max des entités qui exécutent ce comportement ;
- la taille agrandit leur dessin.

Les facteurs de l'évasion et de l'évitement s'ajoutent (par multiplication) pendant que ces comportements sont actifs. `maxForce` n'est jamais modifié.

| Groupe | Paramètres en plus de vitesse et taille |
|---|---|
| Pursue | Horizon de prédiction (pas) |
| Evade | Rayon de détection (×), distance de sortie (×), poids |
| Arrive | Rayon de freinage (×) |
| Wander | Rayon du cercle (×), distance du cercle (×), variation (rad/pas) |
| Path following | Anticipation (×) |
| Obstacle avoidance | Portée du vecteur ahead (×), largeur de la zone (×), poids |
| Boids | Poids alignement, cohésion, séparation ; rayon de perception (×) |
| Leader following | Distance derrière le guide (×), zone interdite devant (×) |
| Scène | Accélération auto (×2 à ×20) ; voitures (10 à 250) et employés présents, pris en compte au prochain ↺ |

## Organisation

Un seul `class Vehicle` peut exister dans une page. La base protégée est donc **`vehicle.js` de 1-Seek (version micbuffa), copié sans modification** ; un test vérifie son empreinte. Tout le reste passe par héritage :

```text
Vehicle (vehicle.js, protégé)
├── SteeringAgent (steeringAgent.js) — les 8 comportements, composition par priorités
│   ├── RoadVehicle (roadVehicle.js) — route, file, barrière, priorités, interblocages
│   │   ├── LuxuryCar (luxuryCar.js) — place, garage, stationnement
│   │   └── Shuttle (shuttle.js) — navette G4S
│   ├── Tram (tram.js) — tête du tram
│   ├── TramCar (tramCar.js) — seconde caisse (snake)
│   └── Employee (employee.js) — piétons
├── Building, ParkingSpot, Gate, Pillar, CoffeeKiosk, Bench, Planter — entités immobiles
```

| Fichier | Rôle |
|---|---|
| `data/casanearshore.js` | Carte OSM projetée (généré par `outils/exporter-carte.mjs` à partir de `data/osm-brut.json`) |
| `mapProjection.js`, `geometry.js`, `path.js`, `roadNetwork.js`, `collisions.js` | Aides pures : projection, géométrie, chemins, plus court chemin, rectangles orientés (repris de 6) |
| `campus.js`, `parkingLot.js`, `parkingWorld.js`, `garage.js`, `parkingAllocator.js`, `esplanade.js` | Construction de la scène : bâtiments et portes, découpage des parkings, garage, attribution des places, esplanades |
| `traffic.js`, `transit.js`, `crowd.js`, `simulation.js` | Règles de scène : apparitions, ordre de mise à jour, groupes, transferts surface → garage |
| `clock.js`, `schedule.js`, `simSpeed.js` | Horloge, programme de la matinée, temps accéléré (inspiré de 11-F1) |
| `carModels.js`, `outfits.js`, `mapRenderer.js`, `debug.js`, `camera.js` | Rendu uniquement |
| `reglages.js`, `panneau.js` | Réglages et panneau (repris de 7-Boids) |
| `sketch.js` | Contrôleur : setup, entrées, pas de simulation, dessin |

### Ordre d'un pas (`simulation.js`)

1. Les événements dus sont traités : apparitions et départ de 8h55.
2. Le trafic avance : barrières, puis chaque véhicule, puis le comptage des contacts.
3. Les trams avancent.
4. La foule avance (grille spatiale pour les voisins).
5. L'horloge avance.

Chaque entité calcule ses forces, les compose (allocation prioritaire de Reynolds : la force finale ne dépasse jamais `maxForce`), puis appelle `update()` hérité **une seule fois**.

### Unités et temps

- 1 m = 2 px ; un pas = 0,2 s de l'horloge.
- Le mouvement est « par pas », comme dans les bases du cours, sans `deltaTime`.
- À ×N, chaque image exécute N pas identiques (même principe que `runSimulationSteps` de 11-F1), dans une limite de 14 ms de calcul par image : **accélérer ne change pas le résultat**, et un test le vérifie.
- « Rien ne se passe » signifie :
  - aucun véhicule dans le parc ou à moins de 150 m d'une porte ;
  - aucun tram à moins de 300 m de la station ;
  - aucun piéton en marche (flâneurs et discussions exceptés).

  Le temps repasse à ×1 20 s avant l'événement suivant.

## Données

- Carte : **© OpenStreetMap contributors, licence ODbL**. Extrait téléchargé avec l'API Overpass (cadre 33.5195, -7.6480 → 33.5320, -7.6320 : périmètre du parc, bâtiments, routes, chemins, parkings, barrières, arrêts).
- Pour régénérer la carte : `node outils/exporter-carte.mjs`.
- Portes : barrières OSM réelles. L'entrée nord est à sens unique (`5688433271`), sa voisine sert de sortie (`5688433270`) ; la porte sud est à double sens (`5673669986`).
- La voie du tram suit le tracé OSM du **Casabusway BW1** au nord du parc. La station est l'arrêt « Casa Nearshore ».
- Ce que OSM ne décrit pas a été construit avec des dimensions usuelles :
  - le garage souterrain : places de 2,5 × 5 m, allées de 6 m, rampe de 3 m à 15 % ;
  - le découpage des parkings en places ;
  - les noms « Shore N » des bâtiments sans nom dans OSM (numérotation fictive) ;
  - les kiosques à café.

## Tests

```bash
node --test tests/*.test.mjs
```

Les tests se lancent depuis ce dossier, avec Node.js 18 ou plus. **Résultat de la dernière exécution : 82 tests, 82 réussis, 0 échec.**

Ils exécutent les vraies classes dans un adaptateur p5 minimal (`tests/adaptateur-p5.mjs`). Ils couvrent :
- la base protégée (empreinte) ;
- chaque comportement : direction et grandeur des forces, limites, seuils exacts, vitesse nulle, entrées invalides, absence de mutation ;
- la carte et le réseau routier ;
- les parkings : places sans chevauchement, attribution unique et compatible ;
- les barrières ;
- les cycles complets d'une voiture en surface et au garage, et la file sans collision ;
- le tram (*snake*, arrêt au quai, portes) et la navette ;
- la foule : discussions, café, 8h55, groupes, formation, badge, retardataire, évasion, évitement, ascenseur ;
- l'horloge, le programme, l'accélération (même résultat à ×1 et ×8) et le recommencement ;
- les réglages et le debug (qui ne modifie rien).

L'adaptateur ne prouve pas la compatibilité avec p5 réel. La simulation a donc aussi été validée dans le navigateur :
- aucune erreur dans la console ;
- matinée complète de 8h30 à 9h05 ;
- vue du garage, panneau de réglages (événement `input`) et mode debug vérifiés.

## Limites connues

- **Contacts résiduels entre véhicules** : entre 40 et 90 selon l'exécution, sur une matinée de 110 voitures et 3 navettes (compteur « contacts » dans le bandeau ; le *wander* utilise l'aléatoire de p5, donc deux exécutions diffèrent). Ils se produisent surtout aux carrefours du parc, lors des insertions sur les routes publiques (y compris quand la navette rejoint le boulevard), et lors de manœuvres simultanées dans deux places voisines. Les voitures ne se traversent pas durablement : un mécanisme de déblocage traite les attentes mutuelles. Dans les tests de trafic seul (12 et 30 voitures), on mesure 0 contact.
- Les piétons marchent sur une ligne décalée de 3,5 m à droite de l'axe des routes et chemins OSM. C'est une approximation des trottoirs.
- À 9h05, les passagers des derniers trams marchent encore vers leurs bâtiments : la scène s'arrête à l'heure prévue.
- Au démarrage, la construction de la scène (carte, découpage des places, esplanades) prend environ 1 seconde.
