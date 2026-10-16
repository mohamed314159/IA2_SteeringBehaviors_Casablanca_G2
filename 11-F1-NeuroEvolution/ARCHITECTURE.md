# Architecture et étapes – 11 F1 Neuroévolution

Ce document décrit l'architecture du **projet** (fichiers, responsabilités, boucle de simulation) et la **pile des étapes** demandées. Il complète, sans les remplacer, [AGENTS.md](../AGENTS.md) et [ARCHITECTURE.md](../ARCHITECTURE.md) à la racine du dépôt. À ne pas confondre avec `architecture.js`, qui gère l'architecture du **réseau de neurones** (couches cachées).

Règle de mise à jour : chaque nouvelle demande est ajoutée à la pile sous la forme d'une étape. Une étape réalisée, testée (tests unitaires passés + vérification dans le navigateur) est marquée **DONE**. On ne réalise qu'une étape à la fois, puis on rend la main.

## 1. Pile des étapes

| # | Étape | État |
|---|---|---|
| 1 | Circuits F1, herbe Minecraft, marques parodiques, rayons, progression sans checkpoints | **DONE** |
| 2 | Réseau de neurones + algorithme génétique, liste de marques à cocher, Entraîner / Arrêter, garage, réseau visualisable | **DONE** |
| 3 | Confiance : la vitesse dépend des résultats de la génération précédente | **DONE** |
| 4 | Niveaux d'entraînement enchaînés automatiquement, démonstration finale | **DONE** |
| 5 | Architecture du réseau modifiable depuis l'interface (efface les générations) | **DONE** |
| 6 | Réglage de la longueur des rayons | **DONE** |
| 7 | Confiance par circuit, circuit validé à 100 %, 1 tour max, pourcentage seul | **DONE** |
| 8 | Vitrine des voitures, aucune sélection par défaut, générations indépendantes par type, noms sans la vraie marque | **DONE** |
| 9 | Accélération de la simulation par un facteur choisi | **DONE** |
| 10 | Sauvegarde / chargement d'un modèle en fichier, avec sa génération | **DONE** |
| 11 | Éditeur d'obstacles : dessiner un obstacle dans le menu et le placer sur le circuit | **DONE** |
| 12 | Vitrine des circuits à la place de la liste déroulante | **DONE** |
| 13 | Nouvelle règle de confiance (100 %, puis 50 %, puis paliers selon le progrès) | **DONE** |
| 14 | Rayons à des angles différents (un rayon = un neurone d'entrée) ; vitrine sans fiche technique | **DONE** |
| 15 | Menu épuré : lignées en haut, uniquement des boutons ; garage dans la vitrine des voitures ; longueur des rayons dans l'éditeur de rayons | **DONE** |
| 16 | Vitrine des obstacles : obstacles dessinés enregistrés comme prototypes (`proto_1`, `proto_2`…), obstacles de série déjà dessinés, placement depuis la vitrine, placement aléatoire (types et nombres choisis dans la vitrine) | **DONE** |
| 17 | Bouton en haut à droite de l'écran : retirer le décor d'herbe pour un rendu plus léger | **DONE** |
| 18 | Effet de flammes sur la ligne d'arrivée quand une voiture la franchit | **DONE** |
| 19 | Circuits d'entraînement actuels plus petits : surface divisée par 4 | **DONE** |
| 20 | 5 nouveaux circuits d'entraînement pour les bases de la course (drift à gauche, drift à droite…) | **DONE** |
| 21 | Plus de circuits de Formule 1 | à faire |
| 22 | Designs de voitures plus faciles à distinguer (deux voitures rouges de marques différentes se ressemblent trop) | à faire |
| 23 | Longueur des rayons : plage bien plus grande que 300 px, maximum = largeur de l'écran | à faire |

### Étape 1 – Circuit, décor, marques, rayons — **DONE**
- Trois circuits F1 stylisés (Monza, Spa, Interlagos) lissés par Catmull-Rom ; bords sans croisement vérifiés par les tests.
- Herbe façon Minecraft sans shader (texture 16 × 16 répétée, dessinée une fois).
- Voiture aux proportions F1 : 5,6 × 2 m pour une piste de 14 m (44 px).
- Marques aux noms déformés (Tiyoti, Ferraaa, Limbargana…) avec modèles et paramètres tirés au hasard ; la vraie marque n'est pas affichée.
- 5 rayons sur 120° (repris de 9b) ; tours et pourcentage de tour par abscisse curviligne, sans checkpoints.

### Étape 2 – Réseau, génétique, garage — **DONE**
- Réseau 6 → 20 → 2 (comme 9b) en JavaScript pur ; topologie dans `network-config.js`, visualisation dans `network.html`.
- Liste de marques et modèles à cocher (remplacée par la vitrine à l'étape 8) ; « Entraîner » lâche la génération 0 avec cerveaux et paramètres aléatoires ; « Arrêter ».
- Une lignée par modèle : le meilleur sert de base (élite + enfants mutés).
- Garage (`localStorage`) : champion de chaque génération record, reprise depuis la dernière génération (choix d'une génération retiré à l'étape 15).
- Longueur de chaque rayon et vitesse affichées à côté du pourcentage.

### Étape 3 – Confiance — **DONE**
- Confiance qui multiplie la vitesse max, recalculée à chaque génération (règle remplacée à l'étape 13).
- Une génération qui progresse peu roule moins vite que la précédente.
- À l'arrivée, la voiture la plus rapide devient parent.

### Étape 4 – Niveaux d'entraînement — **DONE**
- Niveaux circulaire, carré, drift, épingles aller-retour, passage coincé (1 tour chacun), à côté des circuits F1 dans la liste.
- Bouton « Faire entraîner la voiture dans des circuits d'entraînement » : changement de circuit automatique quand toutes les lignées ont validé le niveau.
- À la fin : démonstration sur le circuit F1 avec « Gén. N – voiture entraînée sur les circuits d'entraînement » sous la voiture.
- Ajout d'un niveau : demande « circuit entraînement à ajouter: … » → nouvelle entrée dans `training-circuits-data.js`.

### Étape 5 – Architecture du réseau depuis l'interface — **DONE**
- Dans `network.html` : neurones par couche cachée, ajout / suppression de couches (6 max), activation.
- « Appliquer » après confirmation : architecture mémorisée et **toutes les générations effacées** ; l'onglet du jeu s'arrête et relit le garage.

### Étape 6 – Longueur des rayons — **DONE**
- Menu : curseur 40–300 px, boutons − / +, « Par défaut » (160 px ≈ 51 m) ; agit en direct sur toutes les voitures, mémorisé.

### Étape 7 – Confiance par circuit — **DONE**
- Chaque circuit possède sa propre confiance par lignée (fiche du circuit dans le garage : meilleur pourcentage, confiance, validation).
- Si la génération précédente termine le circuit : confiance 100 %, la lignée est marquée « voiture entraînée dans le circuit X » et ne peut plus s'y entraîner (retirée des générations suivantes, relance refusée avec un message).
- À l'entraînement, une voiture ne parcourt jamais plus d'un tour (`MAX_LAPS` = 1, circuits F1 compris).
- Affichage du seul pourcentage, calculé pour le circuit sélectionné : changer de circuit change le pourcentage affiché de chaque voiture.
- Parcours d'entraînement : les niveaux déjà validés sont sautés.

### Étape 8 – Vitrine des voitures et générations par type — **DONE**
- Plus aucune voiture cochée par défaut ; bouton « Choisir les voitures » et compteur « N voiture(s) sélectionnée(s) » en dessous.
- Vitrine : chaque modèle dessiné en grand avec plus de détails (livrée et numéro propres au modèle), sa fiche, un bouton de sélection.
- Pour chaque voiture, bouton « Confiance par circuit » : tableau de tous les circuits avec la confiance, le meilleur pourcentage et l'état.
- Générations indépendantes : dès que toutes les voitures d'un même type sont arrêtées, ce type passe à sa génération suivante sans attendre les autres.
- Noms de marques déformés conservés, sans la vraie marque entre parenthèses.

### Étape 9 – Accélération de la simulation — **DONE**
- Contrôle pour choisir un facteur d'accélération (par exemple ×1, ×2, ×5, ×10, ×20…).
- Accélérer autant que la machine le permet : plusieurs pas de simulation par image affichée ; si le calcul d'une image dépasse le budget de temps, le facteur effectif est réduit et affiché.
- Note technique : la simulation (rayons, réseau, déplacements) est calculée par le processeur en JavaScript ; la carte graphique ne fait que dessiner l'image. Le gain dépend donc surtout du processeur.
- Les résultats doivent rester identiques à vitesse ×1 (même nombre de pas, même ordre de mise à jour).
- Réalisé : boutons ×1 … ×100 et max, budget de 12 ms de calcul par image, facteur atteint affiché (« limite de la machine »), choix mémorisé ; test de déterminisme ×1 / ×5 / ×20.

### Étape 10 – Modèle en fichier — **DONE**
- Télécharger un champion du garage (cerveau, paramètres, génération, architecture, longueur des rayons, fiches par circuit) dans un fichier JSON `Marque_Modele_genN.json` ; le recharger plus tard.
- Chargement vérifié (format, version, modèle connu, cohérence, cerveau, architecture courante) ; remplacement d'une lignée existante après confirmation ; reprise de l'entraînement à la génération suivante.

### Étape 11 – Éditeur d'obstacles — **DONE**
- Dessiner un obstacle dans le menu (sommets cliqués sur une grille ou forme toute faite, taille en mètres), le placer sur le circuit au clic (R tourne, Échap annule).
- Les côtés de l'obstacle sont des murs pour les rayons (`extraWalls` de `Car.sense()`) ; contact → voiture éliminée (`Car.crashIntoObstacles`).
- `Obstacle extends Vehicle`, immobile ; obstacles mémorisés par circuit.

### Étape 12 – Vitrine des circuits — **DONE**
- Le circuit actuel se choisit dans une vitrine (bouton « Choisir le circuit ») et non plus dans une liste déroulante.
- Une carte par circuit (F1 puis niveaux) : miniature du tracé avec ligne de départ et obstacles, longueur et largeur en mètres, compétence, obstacles, voitures entraînées ici ; « Choisir ce circuit » / « Circuit actuel ✓ ».

### Étape 13 – Nouvelle règle de confiance — **DONE**
- Génération 0 sur un circuit : 100 % ; générations 1 et 2 : 50 %.
- Ensuite, progrès entre les 2 générations précédentes (meilleur %, en points) : < 1 → −50 points ; < 2 → −25 ; < 4 → −12,5 ; ≥ 4 → 100 %. Plancher 50 %.
- Circuit complété : 100 %.
- État de confiance (`confidence`, `runs`, `lastProgress`) porté par les voitures et mémorisé par circuit au garage.

### Étape 14 – Paramètres de la simulation et rayons — **DONE**
- Vitrine des voitures : fiche technique retirée (numéro, livrée, vitesse, adhérence).
- Bouton « Changer les paramètres de la simulation » → barre avec « Modifier le réseau de neurones » et « Ajouter des rayons à des degrés différents » (remplacée à l'étape 15 par deux boutons directs).
- Rayons définis par une liste d'angles libres (`rayAngles`) ; un rayon = un neurone d'entrée (+ 1 neurone pour la vitesse). Appliquer change l'architecture et efface toutes les générations après confirmation.

### Étape 15 – Menu épuré — **DONE**
- Ordre : lignées en piste (avec un résumé), puis « Circuit : … » et « Voitures : … », puis « Réseau de neurones : … » et « Rayons : … », puis entraînement, vitesse, obstacles.
- Plus de numéro d'étape ni de textes d'état dans le menu : l'information est dans le libellé des boutons, le résumé des lignées ou un bandeau en haut du circuit.
- Garage déplacé dans la vitrine des voitures (Charger, Télécharger le modèle, Repartir de zéro) ; plus de liste des générations précédentes : la reprise part toujours de la dernière.
- Longueur des rayons réglée dans l'éditeur de rayons ; « Retirer un obstacle » par clic sur le circuit.

### Étape 16 – Vitrine des obstacles — **DONE**
- Menu : « Vitrine des obstacles », « Obstacles au hasard », « Retirer un obstacle », « Retirer tous » (« Dessiner un obstacle » passe dans la vitrine).
- Vitrine : 9 obstacles de série déjà dessinés + les prototypes dessinés, nommés `proto_1`, `proto_2`… ; « Placer sur le circuit » (placement au clic comme à l'étape 11) ; « Retirer de la vitrine » pour un prototype.
- L'éditeur n'envoie plus la forme directement sur le circuit : « Enregistrer dans la vitrine » crée le prototype (forme normalisée + taille en mètres, mémorisée).
- Mode « Placer au hasard » : nombre par obstacle (0 à 10, total ≤ 30) ; placement en essais bornés, hors zone de départ, passage libre ≥ 3 largeurs de voiture, écart ≥ 3 largeurs entre obstacles, sans déborder sur une autre portion du tracé ; les obstacles impossibles à placer sont comptés et signalés.

### Étape 17 – Décor léger — **DONE**
- Bouton « Décor : herbe / Décor : léger » fixé en haut à droite de l'écran (hors du menu), état mémorisé.
- Mode léger : fond uni au lieu de l'herbe texturée et densité de pixels 1 (canevas + décor) ; la piste est identique.
- Seul le décor pré-rendu est reconstruit (`buildTrackLayer`) : l'entraînement continue. Construction mesurée : 871 ms (herbe) → 14 ms (léger) ; par image, le gain dépend de la densité de l'écran.

### Étape 18 – Flammes sur la ligne d'arrivée — **DONE**
- `FinishFlames` (`finish-flames.js`) : effet décoratif, pas un véhicule. Particules nées sur la ligne (bord gauche → bord droit au point de départ), montant vers le haut de l'écran, jaune → orange → rouge → transparent, dessin additif isolé par `push()` / `pop()`.
- Détection à chaque pas de simulation (un tour de plus selon `LapTracker`, jamais recompté), avant le remplacement des lignées ; animation une fois par image, donc indépendante de l'accélération. Émission 40 images, plafond 400 particules, extinction au changement de circuit.

### Étape 19 – Niveaux d'entraînement plus petits — **DONE**
- Nouveau champ de tracé `areaRatio` (part de la surface du canvas, ]0, 1], 1 par défaut) : `Circuit.fitToCanvas` applique le facteur linéaire √areaRatio en gardant le tracé centré. Niveaux : `TRAINING_AREA_RATIO` = 1/4 ; circuits F1 inchangés.
- Même largeur de piste et même voiture : slalom (amplitude 5 → 4) et épingles (5 → 3 demi-tours plus larges) redessinés pour éviter les croisements de bords.
- Les validations « entraînée » déjà mémorisées au garage pour ces niveaux datent des anciens tracés (même identifiant de circuit).

### Étape 20 – Bases de la course : 5 nouveaux niveaux — **DONE**
- Niveaux 6 à 10, à la suite des 5 premiers : drift à gauche (tracé en D anti-horaire), drift à droite (miroir, `mirrorX`), freinage avant l'épingle, virage qui se referme (`spiralPoints`, rayon 24 → 12), haricot (droite puis gauche).
- Tous à 1/4 de surface, piste de 14 m, 1 tour ; tracés validés numériquement (pas de croisement, rayon minimal > demi-largeur de piste, ≥ 20 px entre deux portions).
- Le parcours d'entraînement enchaîne les 10 niveaux ; le libellé du bouton est calculé d'après `trainingLevelKeys()`.

## 2. Modèle (Reynolds)

```text
Perception : rayons capteurs (ray.js) contre les murs proches (circuit.js)
                  |
                  v
Sélection d'action + steering : réseau de neurones (neural-network.js)
   sortie 0 → rotation du cap désiré, sortie 1 → vitesse désirée
   steering = vitesse désirée − vitesse, borné par maxForce   (Car.think)
                  |
                  v
Locomotion : Vehicle.applyForce() puis Vehicle.update()       (vehicle.js, protégé)
                  |
                  v
Règles de course (scène) : sortie de piste, immobilité, tours  (Car.applyRaceRules)
```

`Car extends Vehicle` (`car.js`). `vehicle.js` est la base protégée de l'exemple : ne pas la modifier sans accord explicite. Unités : pixels, pixels par image, pixels par image² ; une intégration par image.

## 3. Fichiers et responsabilités

| Fichier | Rôle |
|---|---|
| `vehicle.js` | Base protégée : `pos`, `vel`, `acc`, `seek`, `applyForce`, `update` |
| `car.js` | Voiture F1 : capteurs, décision du réseau, règles de course, rendu, légende |
| `ray.js` | Intersection rayon / segment |
| `sensor-settings.js` | Longueur des rayons (réglage commun, mémorisé) |
| `circuit.js` | Géométrie : ligne médiane, bords, grille spatiale, projection, `LapTracker` |
| `circuits-data.js` / `training-circuits-data.js` | Tracés F1 / niveaux d'entraînement |
| `track-renderer.js`, `grass.js` | Décor statique dessiné une seule fois |
| `finish-flames.js` | Flammes sur la ligne d'arrivée : détection des tours bouclés, particules, dessin |
| `decor.js` | Décor herbe ou léger (fond uni, densité de pixels 1), mémorisé |
| `brands.js` | Marques, modèles (livrée, numéro), tirage et mutation des paramètres |
| `car-design.js` | Dessin de la voiture : simple sur le circuit, détaillé dans la vitrine |
| `showroom.js` | Vitrine : sélection des voitures, menu « Confiance par circuit » |
| `ray-editor.js` | Éditeur de rayons (angles libres) de la barre « Paramètres de la simulation » |
| `network-config.js` | Topologie par défaut du réseau (fichier modifiable) |
| `neural-network.js` | Réseau multicouche, mutation, copie, JSON |
| `architecture.js` | Architecture du réseau choisie dans l'interface |
| `confidence.js` | Règle de confiance par circuit (100 %, 50 %, paliers selon le progrès, 100 % quand le circuit est bouclé) |
| `evolution.js` | Lignées, fitness, générations |
| `curriculum.js` | Enchaînement des niveaux d'entraînement |
| `garage.js` | Champions par lignée et fiche par circuit (record, confiance, validation), import d'un modèle |
| `model-file.js` | Modèle en fichier JSON : export, nom de fichier, lecture et vérifications |
| `obstacle.js` | `Obstacle extends Vehicle` (immobile) : polygone, murs, collision, mémorisation par circuit |
| `obstacle-editor.js` | Éditeur de forme d'obstacle : le dessin devient un prototype de la vitrine |
| `obstacle-catalog.js` | Obstacles de série, prototypes `proto_N` (nommage, création, mémorisation), forme en pixels |
| `obstacle-placement.js` | Placement aléatoire (règle de scène) : zone de départ, passage libre, espacement, essais bornés |
| `obstacle-showroom.js` | Vitrine des obstacles : modes « placer » et « au hasard », cartes, nombres saisis |
| `circuit-showroom.js` | Vitrine des circuits : liste des circuits, miniatures, fiches, choix du circuit actuel |
| `random.js` | Générateur aléatoire à graine (tests reproductibles) |
| `sim-speed.js` | Accélération : pas de simulation par image, budget de temps, vitesse atteinte |
| `sketch.js` | Contrôleur : menu, modes (entraînement, parcours, démo), boucle `draw()` |
| `network.html`, `network-viewer.js` | Visualisation et édition du réseau |
| `tests/` | Tests `node:test` avec un adaptateur p5 minimal |

## 4. Boucle d'une image (`sketch.js`)

1. Afficher le décor pré-rendu et les obstacles.
2. Répéter N pas de simulation selon la vitesse choisie (budget de 12 ms, `runSimulationSteps`). Un pas : pour chaque voiture en course, `sense()` (murs du circuit + côtés des obstacles) → `think()` → `applyForce()` → `update()` (une seule intégration) → règles de course (dont contact avec un obstacle).
   À la fin de chaque pas, pour chaque lignée dont toutes les voitures sont arrêtées (sans attendre les autres) : sauvegarde du champion (et fiche du circuit), retrait si elle a bouclé le tour, sinon sa génération suivante ; parcours d'entraînement éventuel.
   Après le déplacement des voitures : détection des tours bouclés (flammes de la ligne d'arrivée).
3. Dessiner les voitures une seule fois (le leader avec ses rayons), puis animer et dessiner les flammes de la ligne d'arrivée.
4. Rafraîchir le panneau et la vitesse atteinte toutes les 10 images.

## 5. Données mémorisées dans le navigateur

| Clé `localStorage` | Contenu |
|---|---|
| `f1-neuroevolution-garage-v1` | Lignées : champions par génération, dernier champion, fiches par circuit, statut « entraînée » |
| `f1-neuroevolution-architecture-v1` | Architecture du réseau choisie dans l'interface |
| `f1-neuroevolution-ray-length-v1` | Longueur des rayons |
| `f1-neuroevolution-sim-speed-v1` | Vitesse de simulation choisie |
| `f1-neuroevolution-obstacles-v1` | Obstacles posés, par circuit |
| `f1-neuroevolution-decor-v1` | Décor choisi : `grass` ou `light` |
| `f1-neuroevolution-obstacle-protos-v1` | Prototypes d'obstacles dessinés (`proto_N`, forme normalisée, taille en mètres) |

## 6. Tests et livraison

Depuis le dossier `11-F1-NeuroEvolution` :

```bash
node --test tests/*.test.mjs
```

Chaque étape ajoute ses tests unitaires (vraies méthodes, graine fixe, cas limites) puis une vérification dans le navigateur. Une étape n'est marquée **DONE** qu'après réussite de toute la suite.
