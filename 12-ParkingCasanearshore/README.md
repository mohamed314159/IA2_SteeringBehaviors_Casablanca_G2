# 12 — Parking Casanearshore (simulation de steering behaviors)

Une matinée au parc d'affaires **Casanearshore** (Casablanca), de **8h30 à 9h05**, vue de dessus sur la **vraie carte OpenStreetMap**, complétée par le plan réel du parc (Shores 1 à 28, UIR, Ibis, restaurant). À 9h05, une nouvelle matinée commence toute seule.

- Des **voitures de luxe** arrivent par les bords de la carte, suivent les vraies routes jusqu'à la **porte nord ou sud**, reçoivent **leur place au passage de la barrière** puis vont s'y garer : en surface, ou dans l'un des **six garages souterrains** placés sous les rampes OSM réelles. Elles ne tournent jamais en cherchant une place.
- Le **tram à deux caisses de 32 m** (65 m) s'arrête à la station « Casa Nearshore », au nord du parc. Sa seconde caisse suit la tête comme les anneaux du serpent de 1-Seek.
- Les **employés** (costume, chemise, tailleur) marchent sur les **trottoirs et chemins piétons**, pas sur les chaussées. Avant 8h55, ils flânent près des **stands de café** installés à côté des bâtiments, discutent en petits groupes ou s'assoient sur les **bancs**. À 8h55, chacun rejoint son bâtiment.
- Des **gardiens en uniforme blanc** sont postés aux portes réelles et font des rondes. Un **convoi G4S de quatre véhicules** (un leader, trois suiveurs) fait le tour du parc.
- **Faune** : deux chats chassent un papillon (*pursue* / *evade*) ; des **oiseaux neuro-évolutifs** apprennent à attraper un morceau de pain qui se déplace au hasard.
- Le temps **s'accélère seulement quand tout le monde est entré au travail**, jusqu'à 9h05.

Voir aussi [ARCHITECTURE.md](ARCHITECTURE.md) (architecture et toutes les étapes du développement) et [PROMPTS.md](PROMPTS.md) (les demandes qui ont guidé le projet).

## Lancer

Depuis ce dossier :

```bash
python outils/serveur.py 8771
```

puis ouvrir <http://localhost:8771>. Ce petit serveur désactive le cache du navigateur. Tous les fichiers sont locaux, donc l'ouverture directe de `index.html` fonctionne aussi.

Un **écran d'accueil** décrit la simulation, chaque comportement (avec une vignette dessinée par les fonctions des entités) et chaque commande. La simulation démarre avec **« Commencer »**.

## Commandes

La barre, en haut à droite, n'affiche que l'heure (HH:MM) et quatre petits boutons.

| Bouton ou touche | Effet |
|---|---|
| `⏸` ou `Espace` | Pause / reprise |
| `P-1` ou `G` | Garages souterrains : chaque appui montre le garage suivant, puis revient à la surface |
| `◐` ou `B` | **Véhicules seuls** : la carte devient noire, il ne reste que ce qui bouge (voitures, convoi, tram, piétons, gardiens, animaux), chacun avec son halo ; même bouton pour revenir |
| `⚙` ou `P` (`Échap` pour fermer) | Réglages : vitesse et taille de chaque comportement, brillance des véhicules, **places libres de chaque parking et de chaque garage**, statistiques de la matinée et des oiseaux |
| **📍 Voir sur la carte** (dans chaque comportement du panneau ⚙) | Indique combien d'entités exécutent ce comportement en ce moment, centre la vue sur l'une d'elles (passe au sous-sol si besoin) et la suit ; un nouveau clic montre la suivante. Glisser la vue, une flèche ou `Échap` arrête le suivi |
| `?` ou `H` | Revoir l'écran d'accueil (la simulation se met en pause) |
| Glisser, molette, `+` `-`, flèches | Déplacer et zoomer la vue |
| `V` `N` `S` `T` | Vue d'ensemble, porte nord, porte sud, station du tram |
| `1` à `8` | Entourer les entités qui exécutent ce comportement (même touche pour enlever) |
| `D` | Debug : rayons de freinage, vecteur *ahead*, points prédits, places de formation, cercle du *wander*, nom du comportement |
| `R` | Nouvelle matinée tout de suite (sinon elle démarre seule à 9h05) |

## Les 8 comportements du cours

| # | Comportement | Qui, quand | Où dans le code | Origine |
|---|---|---|---|---|
| 1 | **Seek** | Retardataires de 8h54 qui courent vers leur porte en visant un à un les points de leur itinéraire ; employés qui foncent au café ; oiseaux (vitesse désirée choisie par leur réseau) | `Employee` (`run`, `seekCoffee`), `Bird` | `vehicle.js` de 1-Seek (hérité), 10-missiles |
| 2 | **Pursue** | Deux chats qui chassent le papillon en visant sa position future (horizon borné) ; quand l'un l'attrape, un autre papillon apparaît | `Cat` | 2-PursueEvade |
| 2 | **Evade** | Le papillon esquive les chats ; piétons et gardiens s'écartent des voitures. Rayon de détection distinct de la distance de sortie | `SteeringAgent.evadeThreats`, `Butterfly` | 2-PursueEvade |
| 3 | **Arrive** | Voir la liste ci-dessous | `SteeringAgent.arriveAt` | `vehicle.js` de 1-Seek (`rayonZoneDeFreinage`) |
| 4 | **Wander** | Flâneurs avant 8h55, papillon, morceau de pain | `Employee`, `Butterfly`, `Bread` | `vehicle.js` de 1-Seek (direction persistante) |
| 5 | **Path following** | Voitures (routes OSM), tram (voie), piétons (trottoirs), ronde des gardiens, leader du convoi | `SteeringAgent.follow` | 5-1, 5-2, 5-3 |
| 6 | **Obstacle avoidance** | Piétons autour des bâtiments, stands et bancs ; voitures autour des poteaux des garages | `SteeringAgent.avoid` | 6-ObstacleAvoidance, 7-Boids |
| 7 | **Boids** | Collègues d'un même bâtiment qui descendent du tram et marchent ensemble | `Employee` (`flock`) | 7-Boids |
| 8 | **Leader following** | **Convoi G4S** : trois suiveurs restent sur la route et règlent leur vitesse par un *arrive* sur leur place derrière le véhicule de devant (distance mesurée le long de la route, jamais à moins de 1 m), avec évasion de la zone devant lui ; ils cèdent à une voiture qui s'intercale. Groupes de piétons en formation derrière un guide | `G4SVehicle`, `SteeringAgent.followLeader` | Slides p. 50-51 |

Le mot « leader » n'apparaît plus au-dessus des voitures ordinaires : leur attente derrière la voiture de devant s'appelle **« file »** (debug et surbrillance). Elle reste réglée par le groupe « Leader following » du panneau.

### Les *arrive* de la simulation

| Qui | Arrive sur… |
|---|---|
| Voiture | La ligne d'arrêt de la barrière ; le point derrière le véhicule de devant (file, freinage ≥ v²/maxForce) ; un point avant un piéton sur sa voie |
| Voiture | Sa place de surface, ⚡ ou ♿ ; la bouche de son garage, puis la borne badge, puis sa place au sous-sol |
| Tram | Le quai (150 m de freinage, véhicule lourd) ; la seconde caisse sur la tête (espacement fixe) |
| Gardien | Son poste à côté de la barrière, au retour de sa ronde |
| Employé | Sa place dans un cercle de discussion, le comptoir du stand, une place de banc, la porte de son bâtiment, la porte de l'ascenseur |
| Suiveur | Sa place de formation derrière le guide, ou derrière le véhicule de devant dans le convoi |

### Bonus : les oiseaux neuro-évolutifs

Comme les missiles du dossier 10, mais avec un réseau de neurones :

- **6 entrées** : direction du pain (vecteur unitaire), distance du pain (rapportée à 60 m), vitesse de l'oiseau (x, y), vitesse du pain vers l'oiseau.
- **8 neurones cachés** (tanh), **2 sorties** : la vitesse désirée. Le steering reste celui de Reynolds : force = vitesse désirée − vitesse courante, bornée par `maxForce`.
- Un oiseau qui **s'arrête** (immobile 2 s, ou énergie de 15 s épuisée) sans avoir attrapé le pain **disparaît** et réapparaît au nid avec une **copie mutée du meilleur cerveau** (15 % des poids, bruit gaussien σ = 0,4).
- Score : part de la distance de départ parcourue vers le pain (0 à 1) ; une capture vaut 1, plus un bonus de rapidité (0 à 1). Le score du meilleur vieillit de 1 % à chaque remplacement, pour qu'un record chanceux cède la place à un cerveau régulier.
- Un test compare avec des cerveaux tirés au hasard sans hérédité : sur 15 minutes, la sélection attrape le pain au moins trois fois plus souvent.

## Réglages (panneau ⚙)

Chaque comportement a sa **vitesse (×)** et sa **taille (×)**, comme les perroquets et les chasseurs de 7-Boids. La vitesse multiplie la vitesse max des entités qui exécutent ce comportement ; la taille agrandit leur dessin. `maxForce` n'est jamais modifié.

| Groupe | Paramètres en plus de vitesse et taille |
|---|---|
| Seek (retardataire, café, oiseaux) | — |
| Pursue (chats → papillon) | Horizon de prédiction (pas) |
| Evade (papillon, piétons, gardiens) | Rayon de détection (×), distance de sortie (×), poids |
| Arrive | Rayon de freinage (×) |
| Wander (flâneurs, papillon, pain) | Rayon du cercle (×), distance du cercle (×), variation (rad/pas) |
| Path following (routes, rails, rondes) | Anticipation (×) |
| Obstacle avoidance | Portée du vecteur *ahead* (×), largeur de la zone (×), poids |
| Boids | Poids alignement, cohésion, séparation ; rayon de perception (×) |
| Leader following (convoi G4S, formation) | Distance derrière le guide (×), zone interdite devant (×) |
| Scène | Accélération auto (×2 à ×20) ; **brillance des véhicules** (halo, 0 à 2) ; voitures et employés présents de la matinée suivante |

## Organisation

Un seul `class Vehicle` peut exister dans une page. La base protégée est donc **`vehicle.js` de 1-Seek (version micbuffa), copié sans modification** ; un test vérifie son empreinte. Tout le reste passe par héritage :

```text
Vehicle (vehicle.js, protégé)
├── SteeringAgent (steeringAgent.js) — les 8 comportements, composition par priorités
│   ├── RoadVehicle (roadVehicle.js) — route, file, barrière, priorités, interblocages en cercle
│   │   ├── LuxuryCar (luxuryCar.js) — place, garage, stationnement
│   │   └── G4SVehicle (g4sVehicle.js) — convoi : leader (path) et suiveurs (leader following)
│   ├── Tram (tram.js), TramCar (tramCar.js) — tête et seconde caisse (snake)
│   ├── Employee (employee.js), SecurityGuard (securityGuard.js) — piétons
│   ├── Cat (cat.js), Butterfly (butterfly.js), Bread (bread.js) — faune
│   └── Bird (bird.js) — oiseau piloté par NeuralNetwork (neuralNetwork.js)
└── Building, ParkingSpot, Gate, Pillar, CoffeeKiosk, Bench, AssemblyPoint — entités immobiles
```

| Fichier | Rôle |
|---|---|
| `data/casanearshore.js` | Carte OSM projetée (générée par `outils/exporter-carte.mjs` à partir de `data/osm-brut.json`) |
| `data/reel.js` | Plan réel : noms des Shores, usages, toitures solaires, bâtiments relevés sur l'imagerie, rampes des garages, restaurant, piscine |
| `mapProjection.js`, `geometry.js`, `path.js`, `roadNetwork.js`, `collisions.js` | Aides pures : projection, géométrie, chemins, plus court chemin, composante connexe, rectangles orientés (repris de 6) |
| `campus.js`, `parkingLot.js`, `parkingWorld.js`, `garage.js`, `parkingAllocator.js`, `esplanade.js`, `trees.js` | Construction de la scène : bâtiments, trottoirs et itinéraires à pied, parkings, garages, attribution des places, stands, bancs, points de rassemblement, arbres |
| `traffic.js`, `transit.js`, `crowd.js`, `wildlife.js`, `simulation.js` | Règles de scène : apparitions, convoi, tram, foule, faune et évolution des oiseaux, ordre de mise à jour |
| `clock.js`, `schedule.js`, `simSpeed.js` | Horloge, programme de la matinée, temps accéléré (inspiré de 11-F1) |
| `groundShader.js`, `mapRenderer.js`, `vehicleGlow.js`, `carModels.js`, `outfits.js`, `debug.js`, `camera.js` | Rendu uniquement (dont les halos des véhicules) |
| `localisation.js` | « Voir sur la carte » : entités mobiles, comptage par comportement, entité suivante, garage où elle se trouve (lecture seule, comme le debug) |
| `reglages.js`, `panneau.js`, `accueil.js` | Réglages, panneau (repris de 7-Boids) et écran d'accueil |
| `sketch.js` | Contrôleur : setup, entrées, pas de simulation, dessin, nouvelle matinée à 9h05 |

### Ordre d'un pas (`simulation.js`)

1. Les événements dus sont traités : apparitions et départ de 8h55.
2. Le trafic avance (voitures et convoi G4S) : barrières, puis chaque véhicule, puis le comptage des contacts.
3. Les trams avancent.
4. La foule avance (grille spatiale pour les voisins).
5. Les gardiens avancent.
6. La faune avance : chats et papillon, pain, oiseaux (remplacement des oiseaux arrêtés).
7. L'horloge avance.

Chaque entité calcule ses forces, les compose (allocation prioritaire de Reynolds : la force finale ne dépasse jamais `maxForce`), puis appelle `update()` hérité **une seule fois**.

### Unités et temps

- 1 m = 2 px ; un pas = 0,2 s de l'horloge.
- Le mouvement est « par pas », comme dans les bases du cours, sans `deltaTime`.
- À ×N, chaque image exécute N pas identiques (même principe que `runSimulationSteps` de 11-F1), dans une limite de 14 ms de calcul par image : **accélérer ne change pas le résultat**, et un test le vérifie.
- Après 8h55, ceux qui marchent encore **pressent le pas** (×1,35), sans courir.
- **Accélération automatique** seulement quand tout le monde est entré au travail : 8h55 passé, plus aucun employé dehors, plus aucune voiture d'employé en mouvement, plus de tram ni d'arrivée prévue. Le convoi, les gardiens et la faune continuent pendant l'accélération. Personne ne disparaît : on ne saute aucun pas.
- Programme : dernier tram à 8h44, dernière voiture à 8h55 (pic vers 8h45), pour que les derniers arrivés aient le temps d'entrer avant 9h05.

## Données

- Carte : extrait **OpenStreetMap** téléchargé avec l'API Overpass (cadre 33.5195, -7.6480 → 33.5320, -7.6320 : périmètre du parc, bâtiments, routes, chemins, parkings, barrières, arrêts, rampes de parking souterrain). Pour la régénérer : `node outils/exporter-carte.mjs`.
- Noms des bâtiments : plan du parc (Shores 1 à 28, UIR au milieu, Ibis). Les **Shores 2, 21 à 24** et le **chantier du Shore 25**, absents d'OSM, ont été relevés sur l'imagerie satellite, puis recalés pour laisser libres les routes et chemins OSM voisins (un test le vérifie).
- Portes : barrières OSM réelles (entrée nord `5688433271`, sortie nord `5688433270`, porte sud `5673669986`). Gardiens aussi aux portes nord secondaire et est.
- Garages : un par groupe de rampes souterraines OSM (`parking_entrance`), sous le bâtiment le plus proche. Leur plan intérieur (places de 2,5 × 5 m, allées de 6 m, rampe à 15 %) est schématique, dimensionné d'après la surface du bâtiment.
- Tram : tracé OSM du **Casabusway BW1** au nord du parc, station « Casa Nearshore ».
- Faute de source publique, on a retenu l'emplacement le plus probable pour : les stands de café (à côté de l'entrée des plus grands bâtiments), les bancs, les points de rassemblement (pelouses les plus dégagées), la ronde du convoi (circuit entre les carrefours des Shores 1 et 22), les arbres (alignements, bosquets, parc arboré OSM).

## Rendu

- **Sol par shader** (`groundShader.js`) : pelouse avec bandes de tonte, parc arboré, pavés, asphalte, terre du chantier, eau de la piscine avec reflets. Le shader lit deux masques de matériaux dessinés une seule fois.
- **Halo des véhicules** (`vehicleGlow.js`) : un liseré clair entouré d'une ombre floue sombre détache les voitures, le convoi et le tram des pavés clairs et de l'herbe ensoleillée. Épaisseur constante à l'écran ; intensité réglable (0 à 2). En vue d'ensemble, une voiture qui roule fait au moins 8 px de long.
- **Mode « véhicules seuls »** : fond noir, seulement les entités qui bougent, avec un halo (disque clair pour les piétons et les animaux).
- **Calque de décor** dessiné une seule fois : bordures et marquages, voie du tram et station (quais, abris), places, ombres portées et toits des bâtiments (panneaux solaires, patios, toit courbe, grue du chantier), arbres avec dégradé et ombre, maisons alentour.

## Tests

```bash
node --test tests/*.test.mjs
```

Les tests se lancent depuis ce dossier, avec Node.js 18 ou plus. Les fichiers chargés sont lus dans `index.html` (`tests/fichiers.mjs`) : les tests chargent exactement ce que charge le navigateur. **Résultat de la dernière exécution : 122 tests, 122 réussis, 0 échec.**

Ils exécutent les vraies classes dans un adaptateur p5 minimal (`tests/adaptateur-p5.mjs`). Ils couvrent :
- la base protégée (empreinte) et chaque comportement : direction et grandeur des forces, limites, seuils exacts, vitesse nulle, entrées invalides, absence de mutation ;
- la carte, le plan réel (noms, UIR, restaurant, bâtiments relevés sans route au travers), le réseau routier et piéton (plus grande composante, pas de voie rapide) ;
- les parkings et les six garages ; les cycles complets d'une voiture en surface et au garage ; les files sans collision ; l'interblocage en cercle de trois voitures ;
- le tram (deux caisses de 32 m, arrêt au quai, 8 portes côté quai) et le convoi G4S (boucle sans demi-tour, dix minutes sans contact, cession à une voiture qui s'intercale) ;
- la foule : stands, bancs, discussions hors chaussée, café, 8h55, groupes, formation, retardataire (même très loin de sa porte), évasion, évitement, trottoirs, itinéraires qui ne traversent aucun bâtiment, gardiens ;
- la faune : réseau à 8 neurones cachés, oiseaux (entrées, force, capture, arrêt, score), évolution (clone muté du meilleur, mieux que le hasard), chats et papillon, zones dans le parc ;
- l'horloge, le programme, l'accélération (même résultat à ×1 et ×8 ; seulement quand tout le monde est entré) et la nouvelle matinée ;
- les réglages et le debug (qui ne modifie rien) ;
- l'affichage : halo (épaisseur constante à l'écran, état graphique restauré, intensité 0 → rien), « Voir sur la carte » (cohérent avec la surbrillance 1 à 8, tour des entités, null si personne), entités du mode « véhicules seuls » ;
- la conduite dans les virages (ralentir avant, freiner dans le budget de force, rester sur sa voie).

L'adaptateur ne prouve pas la compatibilité avec p5 réel. La simulation a donc aussi été validée dans le navigateur : aucune erreur dans la console, écran d'accueil et vignettes, sol par shader, garages, panneau, boutons, nouvelle matinée à 9h05.

## Limites connues

- **Contacts résiduels entre véhicules** : entre 42 et 191 par matinée sur cinq graines mesurées après la version 3 (110 voitures et le convoi G4S ; 42, 85, 106, 108 et 191). Le compteur ajoute 1 chaque fois que deux carrosseries se touchent, même brièvement. Ils se produisent surtout aux carrefours du parc et lors de manœuvres simultanées dans deux places voisines. Les interblocages (deux ou trois voitures qui s'attendent en cercle) sont détectés et levés. Dans les tests de trafic seul (12 voitures, convoi seul pendant 10 minutes), on mesure 0 contact.
- **Virages** : une voiture ralentit avant un virage serré (8 km/h à angle droit, courbe de freinage v² = v_virage² + 2 · maxForce · d, jamais plus de `maxForce` par pas) et reste lente tant qu'elle n'est pas revenue sur sa voie ; elle ne s'écarte de sa voie que de 0,75 m. Les routes de service du parc sont dessinées à 6,5 m (double sens). Il reste environ 3 % d'instants où une carrosserie dépasse la chaussée de plus de 30 cm (contre 33 % avant), surtout aux carrefours.
- Les piétons marchent sur une ligne décalée de 1,6 m au-delà du bord de la chaussée (trottoir). Environ 13 % de la longueur d'un trajet à pied est sur une chaussée : surtout des traversées des routes du parc (6,5 m de large) ; moins de 8 % longe une route, aux carrefours denses et le long des allées parallèles des rampes de garage.
- Sur cinq matinées mesurées (graines 3, 7, 11, 42 et 2026), toutes les voitures sont garées et tout le monde est entré entre 9h03 et 9h05 : l'accélération finale ne dure que les dernières minutes. Une matinée plus chargée (réglage « Voitures ») peut ne pas en avoir.
- Les oiseaux ont attrapé le pain entre 41 et 254 fois par matinée sur ces cinq graines : l'apprentissage dépend du hasard des premiers cerveaux.
- Au démarrage, la construction de la scène (carte, découpage des places, décor) prend quelques secondes.
