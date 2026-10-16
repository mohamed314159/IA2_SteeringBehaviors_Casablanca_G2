# 11 – F1 Neuroévolution

Jeu de voitures 2D sur des circuits inspirés de la Formule 1, construit par étapes à partir du dossier `9b - Voiture suit circuit version 2` (rayons capteurs + vecteurs). Pas de shader : l'herbe façon Minecraft est dessinée une seule fois en texels dans un `p5.Graphics`.

## Étapes

Le détail de chaque étape et l'architecture du projet sont dans [ARCHITECTURE.md](ARCHITECTURE.md).

| Étape | Contenu | État |
|---|---|---|
| 1 | Circuits F1, herbe Minecraft, marques/modèles parodiques, rayons, tours et % de tour sans checkpoints | ✅ |
| 2 | Liste de marques/modèles à cocher, Entraîner / Arrêter, réseau de neurones configurable et visualisable, algorithme génétique par lignée, garage (reprise depuis la génération x), longueur des rayons et vitesse | ✅ |
| 3 | « Confiance » : la vitesse d'une génération dépend de la progression et du temps de survie de la précédente ; à l'arrivée, la voiture la plus rapide devient parent | ✅ |
| 4 | Niveaux d'entraînement (circulaire, carré, drift, épingles, coincé) enchaînés automatiquement par le bouton « Faire entraîner la voiture dans des circuits d'entraînement » | ✅ |
| 5 | Modifier l'architecture du réseau depuis l'interface (neurones par couche cachée, ajout / suppression de couches, activation) ; l'appliquer efface toutes les générations | ✅ |
| 6 | Réglage de la longueur des rayons dans le menu (curseur, − / +, « Par défaut »), en direct et mémorisé | ✅ |
| 7 | Confiance par circuit, circuit validé à 100 %, 1 tour max à l'entraînement, affichage en pourcentage seul | ✅ |
| 8 | Vitrine des voitures (design détaillé, sélection, confiance par circuit), aucune voiture cochée par défaut, générations indépendantes par type, noms de marques sans la vraie marque | ✅ |
| 9 | Accélération de la simulation par un facteur choisi (×1 à ×100, max), facteur atteint affiché | ✅ |
| 10 | Sauvegarde / chargement d'un modèle en fichier (.json), avec sa génération | ✅ |
| 11 | Éditeur d'obstacles : dessiner un obstacle dans le menu et le placer sur le circuit | ✅ |
| 12 | Vitrine des circuits (miniature et fiche de chaque circuit) à la place de la liste déroulante | ✅ |
| 13 | Nouvelle règle de confiance : 100 %, puis 50 %, puis paliers selon le progrès entre les 2 générations précédentes | ✅ |
| 14 | Rayons à des angles différents (un rayon = un neurone d'entrée) ; vitrine sans fiche technique | ✅ |
| 15 | Menu épuré : lignées en piste en haut, puis uniquement des boutons ; garage dans la vitrine des voitures ; longueur des rayons dans l'éditeur de rayons | ✅ |
| 16 | Vitrine des obstacles : obstacles de série, prototypes dessinés (`proto_1`, `proto_2`…), placement depuis la vitrine ou au hasard (types et nombres choisis) | ✅ |
| 17 | Bouton en haut à droite : retirer le décor d'herbe (rendu plus léger) | ✅ |
| 18 | Flammes sur la ligne d'arrivée quand une voiture la franchit | ✅ |
| 19 | Circuits d'entraînement actuels plus petits : surface divisée par 4 | ✅ |
| 20 | 5 nouveaux circuits d'entraînement pour les bases de la course (drift à gauche, drift à droite…) | ✅ |
| 21 | Plus de circuits de Formule 1 | à faire |
| 22 | Designs de voitures plus faciles à distinguer (deux voitures rouges de marques différentes se ressemblent trop) | à faire |
| 23 | Longueur des rayons : plage bien plus grande que 300 px, maximum = largeur de l'écran | à faire |

## Lancement

Servir le dossier en HTTP (p5.js 1.7.0 est embarqué dans `libraries/`), par exemple depuis ce dossier :

```bash
python -m http.server 8761
```

puis ouvrir `http://localhost:8761`. Après une mise à jour des fichiers, recharger avec **Ctrl+F5** : sinon le navigateur peut garder d'anciens scripts en cache.

## Menu

De haut en bas :

1. **Lignées en piste** : un résumé (générations terminées, voitures en piste, vitesse atteinte, niveau du parcours, dernier message) puis une fiche par lignée. Au repos, les voitures du garage avec leur pourcentage sur le circuit actuel.
2. **Circuit : …** (ouvre la vitrine des circuits) et **Voitures : …** (ouvre la vitrine des voitures). Le nom du circuit et le nombre de voitures sélectionnées sont écrits dans les boutons.
3. **Réseau de neurones : 6 → 20 → 2** (ouvre `network.html`) et **Rayons : 5 · longueur 160 px** (ouvre l'éditeur de rayons).
4. **Entraîner sur ce circuit**, **Arrêter**, **Parcours d'entraînement (10 niveaux)** (nombre calculé d'après les niveaux existants).
5. Vitesse de simulation **×1 … ×100, max**, **Rayons du leader : affichés / masqués**.
6. **Vitrine des obstacles**, **Obstacles au hasard**, **Retirer un obstacle**, **Retirer tous**.

En haut à droite de l'écran, hors du menu : **Décor : herbe / Décor : léger** (voir « Décor léger »).

Pas d'autre texte dans le menu : les consignes (placer ou retirer un obstacle) et les messages courts s'affichent dans un bandeau en haut du circuit. Après une mise à jour des fichiers, recharger avec Ctrl+F5.

## Vitrine des circuits (`circuit-showroom.js`)

Le bouton **Circuit : …** du menu ouvre la vitrine.

- Une carte par circuit, rangées en « Formule 1 » puis « Niveaux d'entraînement » : miniature du tracé (piste, bords, ligne de départ en jaune, obstacles posés en rouge) et fiche (longueur et largeur en mètres à l'échelle du jeu, compétence pour un niveau, nombre d'obstacles, voitures du garage entraînées sur ce circuit).
- **Choisir ce circuit** charge le circuit et ferme la vitrine (l'entraînement en cours s'arrête). Le circuit actuel est encadré en jaune avec « Circuit actuel ✓ ».
- Le parcours d'entraînement change de circuit tout seul ; « Circuit actuel » suit.

## Paramètres

- **Échelle F1** : piste de 44 px ≈ 14 m, donc 3,14 px/m. Voiture 5,6 m × 2 m → 17,6 × 6,3 px. La proportion voiture / largeur de piste est réelle ; la longueur du circuit est compressée pour tenir à l'écran (`circuit.js`).
- **Circuits** (`circuits-data.js`) : tracés stylisés de Monza, Spa-Francorchamps et Interlagos (points de contrôle lissés par Catmull-Rom, pas des relevés GPS).
- **Marques** (`brands.js`) : Tiyoti, Ferraaa, Limbargana, Mercedas, McLaran, Porshe, Bugotti, Alpinne (noms volontairement déformés, sans la vraie marque affichée). Chaque modèle a une livrée et un numéro, et définit des plages ; chaque voiture lâchée tire au hasard :
  - `maxSpeed` (px/image ; 4,7 px/image ≈ 90 m/s à 60 images/s),
  - `maxForce` = adhérence (px/image²).
- **Capteurs** (`car.js`) : par défaut 5 rayons à −60°, −30°, 0°, +30°, +60° (comme 9b) + la vitesse normalisée → 6 neurones d'entrée (proximité : 1 = mur collé, 0 = rien en vue). Les angles se changent dans l'éditeur de rayons (un rayon = un neurone d'entrée).
- **Progression sans checkpoints** : projection de la voiture sur la ligne médiane (recherche locale ±25 segments) → abscisse curviligne. `LapTracker` cumule la distance dans le sens de course : `progress = distance / longueur` (1 = tour bouclé). L'affichage donne seulement le **pourcentage** du tour (0 à 100 %). Rouler à l'envers diminue la progression.
- **Règles de course** : sortie de piste si l'écart à la ligne médiane dépasse `largeur/2 − largeur voiture/2` ; élimination si la voiture n'avance pas d'une longueur en `STALL_FRAMES` = 180 images (~3 s) ; arrivée après **1 tour** (`MAX_LAPS` = 1) : à l'entraînement, une voiture ne parcourt jamais plus d'un tour, sur un circuit F1 comme sur un niveau.
- **Réseau de neurones** (`neural-network.js`, JavaScript pur, sans TensorFlow.js) : par défaut 6 entrées → 20 neurones cachés sigmoïdes → 2 sorties sigmoïdes, comme 9b. Sortie 0 : rotation du cap désiré dans ±`TURN_MAX` = 0,3 rad ; sortie 1 : vitesse désirée dans [0, `maxSpeed`]. `steering = désirée − vitesse`, borné par `maxForce`, appliqué par `applyForce()` ; locomotion de `Vehicle.update()`. Aide au démarrage : 50 % de `maxSpeed` minimum pendant `LAUNCH_FRAMES` = 30 images.
- **Entraînement** (`evolution.js`) : on choisit des voitures dans la vitrine, puis « Entraîner ». Chaque modèle sélectionné forme une **lignée** de `max(8, 60 / nb modèles)` voitures. La génération 0 a des cerveaux (poids uniformes dans [−1, 1]) et des paramètres tirés au hasard : la plupart foncent dans un mur. **Générations indépendantes par type** : dès que toutes les voitures d'une lignée sont arrêtées (sortie, immobilité ou tour bouclé), sa **meilleure voiture** sert de base à la génération suivante de cette lignée, sans attendre les autres types (`advanceStoppedLineages`) :
  - 1 élite : copie exacte (cerveau, paramètres, place sur la grille) → le record ne régresse pas ;
  - les autres : cerveau copié puis muté (chaque poids avec la probabilité `MUTATION_RATE` = 0,15, bruit gaussien σ = 0,1) et paramètres décalés de ±10 % de la plage du modèle.
- **Fitness** (`runIsBetter`) : progression en tours (distance parcourue dans le bon sens) ; à égalité, la voiture qui a survécu le plus longtemps. Si les deux ont bouclé le tour, la **plus rapide** gagne (sinon la sélection favoriserait les voitures lentes).
- **Affichage** (panneau « Lignées en piste ») : pour la meilleure voiture de chaque lignée, pourcentage du tour, record sur ce circuit, temps survécu, confiance et vmax effective, longueur de chaque rayon jusqu'au mur (px) et vitesse (px/image et km/h équivalents : `v / pxParMètre × 60 × 3,6`).

## Confiance (`confidence.js`)

Chaque lignée a une **confiance par circuit**, entre 50 % et 100 %, qui multiplie la vitesse max du modèle : `vmax effective = vmax du modèle × confiance`. Règle (étape 13), avec les générations comptées **sur ce circuit** à partir de 0 :

| Génération sur le circuit | Confiance |
|---|---|
| 0 | 100 % |
| 1 et 2 | 50 % |
| 3 et suivantes | selon le progrès entre les 2 générations précédentes (ci-dessous) |
| circuit complété (tour bouclé) | 100 % |

Progrès = meilleur % de la dernière génération − meilleur % de l'avant-dernière, en points :

| Progrès | Confiance de la génération suivante |
|---|---|
| moins de 1 point (ou recul) | baisse de 50 points |
| moins de 2 points | baisse de 25 points |
| moins de 4 points | baisse de 12,5 points |
| 4 points ou plus | remonte à 100 % |

- Jamais en dessous de **50 %** (plancher).
- Exemple : meilleurs % 10, 30, 40, 42, 43,5, 43,6 → confiances 100, 50, 50, puis 100 (40 − 30 = +10), 87,5 (+2), 62,5 (+1,5), 50 (+0,1).
- Les baisses sont en points de confiance (100 % − 12,5 = 87,5 %). La différence est arrondie au millionième de point : 42 % − 40 % vaut exactement 2 points.
- Une lignée qui stagne (moins de 1 point d'écart) reste au plancher de 50 % ; elle ne repasse à 100 % qu'après un gain d'au moins 4 points.
- L'état de confiance (confiance, nombre de générations sur le circuit, dernier meilleur %) est porté par chaque génération et enregistré dans la fiche du circuit au garage : une reprise sur ce circuit continue la règle là où elle s'était arrêtée ; un circuit jamais parcouru repart de la génération 0 à 100 %.

## Confiance par circuit et circuit validé (étape 7)

- Chaque circuit (F1 ou niveau) a, pour chaque lignée, sa **fiche** dans le garage : meilleur pourcentage (et temps), confiance, validation.
- Entraîner une lignée sur un circuit reprend la **confiance de ce circuit** (100 % s'il n'y a jamais roulé) ; le cerveau, lui, vient du garage (dernière génération).
- Si le meilleur d'une génération **boucle le tour**, la confiance du circuit passe à **100 %** et la lignée est marquée **« voiture entraînée dans le circuit X »** : elle ne s'y entraîne plus (retirée des générations suivantes ; « Entraîner » la refuse ensuite avec un message). Quand toutes les lignées ont validé, l'entraînement s'arrête.
- **Pourcentage propre au circuit sélectionné** : au repos, le panneau liste chaque voiture du garage avec son pourcentage **sur le circuit affiché** ; changer de circuit dans la vitrine change les pourcentages (« 0.0 % (jamais entraînée ici) » sur un circuit inconnu).
- Le garage liste les circuits validés par chaque lignée ; la vitrine donne la confiance de chaque voiture sur chaque circuit.
- Parcours d'entraînement : un niveau déjà validé par une lignée est sauté pour elle ; si toutes l'ont validé, on passe directement au niveau suivant.

## Vitrine des voitures (`showroom.js`, `car-design.js`)

- **Aucune voiture n'est sélectionnée au départ.** Le bouton **Voitures : …** ouvre la vitrine et indique « aucune sélectionnée », « 1 sélectionnée », « 3 sélectionnées »… « Entraîner » et le parcours restent grisés tant que rien n'est choisi.
- Chaque modèle est dessiné en grand (220 px de long, environ 12 fois la taille sur le circuit) avec plus de détails : jantes, suspensions, pointe du nez, livrée propre au modèle (bande, double bande, flèche, damier, unie), entrées d'air, rétroviseurs, casque, halo et numéro. Le même dessin, simplifié, sert sur le circuit.
- Sous le dessin : la marque, le modèle et l'état au garage (pas de fiche technique).
- « Sélectionner » / « Sélectionnée ✓ » ajoute ou retire la voiture de l'entraînement.
- **Télécharger le modèle** et **Repartir de zéro** apparaissent sur une voiture dès qu'elle est au garage ; **Charger un modèle (.json)** est en haut de la vitrine (voir « Modèles en fichier »).
- **« Confiance par circuit »** ouvre un tableau de tous les circuits (F1 puis niveaux) : confiance de la voiture (100 % de départ si elle n'y a jamais roulé), meilleur pourcentage et état (« jamais entraînée ici », « en apprentissage », « voiture entraînée ✓ »).

## Obstacles (`obstacle.js`, `obstacle-editor.js`, `obstacle-catalog.js`, `obstacle-placement.js`, `obstacle-showroom.js`)

Boutons « obstacles » du menu :

- **Vitrine des obstacles** : une carte par obstacle (forme, nom, taille en mètres, nombre de sommets).
  - **Obstacles de série**, déjà dessinés : Pile de pneus (3 m), Bloc béton (4 m), Barrière (9 m), Cône géant (3 m), Chevron (7 m), Muret en L (7 m), Croix (5 m), Étoile (5 m), Losange (5 m).
  - **Prototypes dessinés** : chaque dessin enregistré devient `proto_1`, `proto_2`… (le numéro n'est jamais réutilisé tant qu'un prototype plus récent existe ; 40 prototypes au plus). « Retirer de la vitrine » n'existe que pour eux. Ils sont mémorisés dans le navigateur.
  - **Placer sur le circuit** : la vitrine se ferme, l'obstacle suit le pointeur au-dessus du circuit ; un clic le pose, **R** le tourne de 15°, **Échap** annule.
- **+ Dessiner un prototype** (dans la vitrine) ouvre l'éditeur : chaque clic sur la grille pose un sommet ; cliquer sur le premier point (jaune) ferme la forme. Formes de départ : pile de pneus, bloc, triangle, barrière. « Annuler le dernier point », « Effacer ». Curseur **Taille** : plus grande dimension de 2 à 20 m (même échelle que les voitures, 3,14 px/m). La forme doit avoir de 3 à 24 points, des côtés qui ne se croisent pas et une surface non nulle ; sinon « Enregistrer dans la vitrine » reste grisé et la raison s'affiche. Enregistrer rouvre la vitrine sur le nouveau prototype.
- **Obstacles au hasard** ouvre la vitrine en mode « Placer au hasard » (on peut aussi basculer entre les deux modes dans la vitrine) : un champ **Nombre** (0 à 10) par obstacle, le bouton indique le total (« Placer 9 obstacles au hasard », 30 au maximum). Les obstacles s'ajoutent à ceux déjà posés, avec une rotation au hasard, selon ces règles de scène (`obstacle-placement.js`) :
  - centre sur la piste, jamais dans la zone de départ (12 longueurs de voiture après la ligne, 3 avant) ;
  - un passage libre d'au moins 3 largeurs de voiture (≈ 6 m) à côté de chaque obstacle ;
  - au moins 3 largeurs de voiture entre deux obstacles, et pas de débordement sur une autre portion du tracé ;
  - 80 essais au plus par obstacle : s'il n'y a plus de place, il n'est pas posé et le bandeau l'indique (« 7 obstacle(s) sur 9 placé(s) »).
  Les tirages utilisent le générateur à graine de la page ; les tests utilisent une graine fixe.
- Effet : les côtés de l'obstacle sont des **murs pour les rayons** capteurs (les voitures le voient), et une voiture dont le centre arrive à moins d'une demi-largeur de l'obstacle est **éliminée** (règle de scène). Valable à l'entraînement, dans le parcours et en démonstration.
- **Retirer un obstacle** : cliquer ensuite sur l'obstacle à retirer (le plus récent s'ils se chevauchent ; Échap annule). **Retirer tous les obstacles** vide le circuit actuel.
- Les obstacles sont **mémorisés par circuit** dans le navigateur ; leur nombre s'affiche dans la vitrine des circuits.
- `Obstacle` étend `Vehicle` (entité immobile, sans locomotion), conformément aux consignes du dépôt.

## Décor léger (`decor.js`)

Le bouton **Décor : herbe / Décor : léger**, en haut à droite de l'écran, bascule entre les deux décors. Le choix est mémorisé dans le navigateur ; l'entraînement en cours continue (seul le décor est redessiné).

- **Herbe** : texture façon Minecraft (`grass.js`), environ 100 000 petits carrés dessinés une fois à chaque construction du circuit.
- **Léger** : fond vert uni (`LIGHT_BACKGROUND`) et **densité de pixels 1** pour le canevas et le décor. La piste (asphalte, bords, vibreurs, ligne de départ) reste identique.

Ce que le mode léger allège, en pratique (rendu Canvas 2D de p5, donc surtout le processeur ; la recopie d'image peut être accélérée par la carte graphique) :
- **Construction du décor** (au chargement, changement de circuit, parcours d'entraînement) : mesurée à 871 ms avec l'herbe contre 14 ms en mode léger.
- **Chaque image** : le décor est déjà pré-rendu et simplement recopié, l'herbe ne coûte donc rien de plus à densité égale. Le gain par image vient de la densité de pixels 1 sur un écran haute résolution (Windows à 125 % ou 150 %, écran Retina) : 1,56 à 4 fois moins de pixels. Sur un écran à 100 %, il n'y a pas de gain par image.

## Flammes sur la ligne d'arrivée (`finish-flames.js`)

Quand une voiture boucle un tour (entraînement, parcours ou démonstration), la ligne de départ/arrivée s'embrase : des particules naissent sur toute la largeur de la ligne et montent vers le haut de l'écran en passant du jaune à l'orange puis au rouge, avant de disparaître (dessin additif).

- **Détection** à chaque pas de simulation, d'après le compteur de tours (`LapTracker.laps`) : un tour de plus = un passage. Un même tour n'est jamais compté deux fois (reculer puis refranchir la ligne ne rallume rien). Elle a lieu avant que la lignée terminée soit remplacée, donc aucun passage n'est perdu en accéléré.
- **Animation** une fois par image : la durée est la même quel que soit le facteur de vitesse.
- Paramètres : émission pendant 40 images après un passage (`FLAME_EMIT_FRAMES`), 8 particules par image, vie de 25 à 55 images, montée de 0,5 à 2,4 px/image, diamètre de 7 à 15 px, 400 particules au plus (passages rapprochés en accéléré). Changer de circuit éteint les flammes.

## Modèles en fichier (`model-file.js`)

Dans la vitrine des voitures :

- **Télécharger le modèle** (sur chaque voiture au garage) : enregistre sa dernière génération dans un fichier `Marque_Modele_genN.json` (ex. `Tiyoti_Supraa-GT_gen12.json`). Le fichier contient le cerveau, les paramètres de la voiture, le **numéro de génération**, l'architecture du réseau, la longueur des rayons et les fiches par circuit (confiance, record, circuits validés).
- **Charger un modèle (.json)** : choisit un fichier ; après vérification, le modèle devient le dernier champion de sa lignée au garage. Sélectionnez-le dans la vitrine puis « Entraîner » : l'entraînement reprend à la génération N + 1 avec le même cerveau.
- Si la lignée existe déjà au garage, une confirmation demande de la **remplacer** (« Remplacer » / « Annuler »).
- Refus avec message : fichier qui n'est pas du JSON ou pas un modèle de ce jeu, version inconnue, marque ou modèle inconnus, contenu incohérent, cerveau mal formé, numéro de génération invalide, **architecture différente** de l'architecture actuelle (réseau ou rayons : les appliquer d'abord), entraînement en cours.

## Vitesse de simulation (`sim-speed.js`)

Menu, « Vitesse de simulation » : boutons ×1, ×2, ×5, ×10, ×20, ×50, ×100 et **max**. Le choix est mémorisé.

- À ×N, chaque image affichée calcule **N pas de simulation** (rayons, réseau, déplacement, règles, générations), puis dessine une seule fois. Un pas accéléré est exactement un pas à ×1 : à graine égale, ×1, ×5 et ×20 donnent la même simulation (test de déterminisme).
- Le calcul est fait par le **processeur** (JavaScript) ; la carte graphique ne dessine qu'une image. Pour garder la page fluide, les pas d'une image s'arrêtent après 12 ms de calcul (`SIM_FRAME_BUDGET_MS`) ; au moins un pas est toujours fait.
- Le résumé des lignées affiche la vitesse atteinte, par exemple « vitesse ×8.4 (limite de la machine) » (moyenne sur 30 images). « max » enchaîne autant de pas que le budget le permet (1000 au plus par image).
- Mesure (navigateur de test, 60 voitures au départ, sans autre charge) : ×10 demandé → ×8,4 atteint ; max → environ ×20, davantage quand des voitures sont éliminées (moins de calcul). Le temps d'une image reste proche de 16 ms.
- Le temps survécu (confiance) est compté en pas de simulation : il ne dépend pas de la vitesse choisie.

## Longueur des rayons (`sensor-settings.js`)

Dans l'éditeur de rayons (bouton **Rayons : …** du menu), « Longueur des rayons » : curseur de 40 à 300 px (≈ 13 à 95 m à l'échelle F1), boutons − / + (pas de 10 px) et « Par défaut » (160 px ≈ 51 m). Le curseur réagit pendant le glissement et au clavier.

- Réglage **commun à toutes les voitures** (il remplace l'ancienne portée tirée par modèle) ; lu à chaque image, il agit **tout de suite**, même pendant un entraînement ou une démonstration.
- Mémorisé dans le navigateur (relu au rechargement) ; la longueur est aussi notée dans chaque champion du garage (`rayLength`).
- Les entrées du réseau restent dans [0, 1] (`1 − distance / longueur`) : un cerveau entraîné avec une autre longueur voit les murs à une autre échelle et peut devoir se réadapter. Des rayons courts réagissent tard ; des rayons longs anticipent les virages.
- Le panneau affiche la longueur max à côté des distances mesurées : `rayons (px, max 160) : …`.

## Niveaux d'entraînement (`training-circuits-data.js`, `curriculum.js`)

La vitrine des circuits présente les circuits F1 puis les niveaux. Chaque niveau travaille une compétence et se valide en **1 tour** :

| Niveau | Compétence |
|---|---|
| 1 – Circulaire | tenir un virage constant sans toucher les bords |
| 2 – Carré | freiner et tourner à 90° puis réaccélérer |
| 3 – Drift (slalom) | enchaîner les changements de direction à vitesse élevée |
| 4 – Épingles aller-retour | demi-tours serrés dans un sens puis dans l'autre |
| 5 – Passage coincé | piste étroite (10 m au lieu de 14 m) et chicanes serrées |
| 6 – Drift à gauche | longue courbe à gauche à vitesse élevée : tracé en D parcouru dans le sens anti-horaire, tous les virages à gauche |
| 7 – Drift à droite | le miroir du niveau 6 : tous les virages à droite |
| 8 – Freinage avant l'épingle | deux longues lignes droites (plus de la moitié du tour) terminées par un demi-tour : freiner fort, tourner, réaccélérer |
| 9 – Virage qui se referme | ligne droite puis virage dont le rayon diminue de moitié (24 → 12 dans le repère du tracé) : entrer vite puis ralentir dans le virage |
| 10 – Haricot (droite puis gauche) | tracé surtout à droite avec une courbe à gauche dans chaque creux : changer de côté |

Les niveaux 6 à 10 (étape 20) travaillent les bases de la course. Ils ont la même taille réduite (1/4 de la surface), la même piste de 14 m, et se valident en 1 tour. Ils s'ajoutent à la suite des niveaux 1 à 5 : le parcours d'entraînement compte donc 10 niveaux. Les tests vérifient le sens réel des virages (≥ 95 % à gauche pour le niveau 6, à droite pour le 7), la part de ligne droite du freinage, la diminution du rayon au niveau 9 et la part de virage à gauche du haricot.

- Un niveau choisi à la main dans la vitrine des circuits s'entraîne comme un circuit normal (1 tour pour terminer).
- **« Parcours d'entraînement (10 niveaux) »** : les voitures sélectionnées partent du niveau 1 (depuis leur dernier champion du garage s'il existe). Une lignée valide un niveau quand le meilleur d'une génération boucle le tour. Quand **toutes** les lignées l'ont validé, le circuit change automatiquement pour le niveau suivant ; la génération suivante y part du champion.
- Après le dernier niveau (10), le garage marque les lignées « entraînées sur les circuits d'entraînement » et une **démonstration** démarre sur le circuit F1 choisi avant : un champion par lignée roule avec la légende « Gén. N – voiture entraînée sur les circuits d'entraînement » sous la voiture (la course recommence en boucle, « Arrêter » la termine).
- La voiture garde sa taille F1 sur tous les niveaux (échelle fixe 3,14 px/m) ; seule la piste du niveau 5 est plus étroite.
- **Taille (étape 19)** : chaque niveau occupe **1/4 de la surface** qu'il occupait avant (`areaRatio: TRAINING_AREA_RATIO`, soit 1/4 ; tracé 2 fois plus petit dans chaque direction, centré sur le canvas, tour 2 fois plus court). La surface est mesurée sur la boîte englobante de la ligne médiane. La largeur de piste et la voiture ne changent pas, donc les virages sont plus serrés. Pour que les bords ne se croisent pas, deux tracés ont été redessinés : le slalom garde 2 ondulations mais avec une amplitude de 4 au lieu de 5, et les épingles passent de 5 à 3 demi-tours plus larges. Les tests vérifient le quart de surface (±10 % pour ces deux tracés redessinés), l'absence de croisement et au moins 20 px entre deux portions du tracé.
- Ajouter un niveau : une entrée dans `TRAINING_CIRCUITS` (champs `level`, `skill`, `raceLaps`, `points`, `areaRatio`, `trackWidthMeters` facultatif) ; les tests vérifient qu'elle est valide.

Mesure de l'étape 4 (2 lignées, graine fixe, tracés d'avant l'étape 19) : parcours complet terminé en 39 générations.

## Architecture du réseau depuis l'interface (`network.html`, `architecture.js`)

Bouton **Réseau de neurones : …** du menu. Section « Architecture (couches cachées) » :

- un champ par couche cachée (1 à 64 neurones), « Supprimer » par couche, « + Ajouter une couche cachée » (6 couches au maximum, 0 possible) et le choix de l'activation ;
- le schéma montre le brouillon en direct (poids d'exemple) ;
- **Appliquer** demande une confirmation qui indique le nombre de lignées sauvegardées ; « Confirmer et effacer » mémorise l'architecture dans le navigateur et **efface toutes les générations du garage** : il faut réentraîner les voitures ;
- **network-config.js** revient à l'architecture du fichier (même effacement si elle diffère) ;
- appliquer la même architecture que l'actuelle n'efface rien ;
- un onglet du jeu ouvert en même temps arrête son entraînement, relit le garage vidé et affiche la nouvelle topologie sur le bouton « Réseau de neurones ». Garde-fou : le jeu retire du garage toute lignée dont le réseau n'a pas l'architecture courante.

Les entrées (rayons + vitesse) et les sorties (direction, accélérateur) ne changent pas.

## Topologie du réseau : `network-config.js`

Architecture par défaut (utilisée tant qu'aucune architecture n'est appliquée depuis l'interface). Fichier à modifier, puis recharger la page :

```js
const NETWORK_CONFIG = {
  rayAngles: [-60, -30, 0, 30, 60], // angle de chaque rayon (°) : 0 = devant, + = droite (1 à 15)
  hiddenLayers: [20],       // ex. [16, 8] = deux couches cachées, [] = aucune
  hiddenActivation: "sigmoid" // "sigmoid" | "tanh" | "relu"
};
```

Couche d'entrée = un neurone par rayon + 1 neurone pour la vitesse. L'ancienne écriture `rays: 5, rayFovDegrees: 120` (rayons répartis régulièrement) reste comprise.

## Éditeur de rayons (`ray-editor.js`)

Bouton **Rayons : …** du menu (angles et longueur des rayons) :

  - Aperçu de la voiture vue de dessus avec chaque rayon et son angle (0° = droit devant, positif = vers la droite, négatif = vers la gauche, ±180° = vers l'arrière).
  - Chaque rayon : son angle modifiable et « Supprimer ». « + Ajouter le rayon » avec un angle de −180° à 180°. De 1 à 15 rayons, deux rayons ne peuvent pas avoir le même angle ; la liste reste triée.
  - « Couche d'entrée : 6 rayons + 1 vitesse = 7 neurones » se met à jour pendant l'édition.
  - **Appliquer** demande une confirmation : changer les rayons change la couche d'entrée, donc **toutes les générations sont effacées** (même règle que l'architecture du réseau). L'entraînement en cours s'arrête. « Annuler les changements » revient aux rayons actuels.
  - Les rayons choisis sont mémorisés dans le navigateur avec l'architecture et repris par `network.html`.
  - **Longueur des rayons** (même fenêtre) : voir « Longueur des rayons » ; elle s'applique tout de suite, sans effacer les générations.

Une configuration invalide est refusée avec un message (bandeau du circuit). `network.html` (bouton « Réseau de neurones ») dessine la topologie du fichier ou un champion du garage : connexions bleues (poids positifs) / rouges (négatifs), épaisseur ∝ |poids|, et des curseurs d'entrée pour voir les activations.

## Entraîner, arrêter, reprendre (garage)

- **Entraîner sur ce circuit** : chaque voiture sélectionnée repart du **dernier champion sauvegardé** de sa lignée ; sans sauvegarde, elle part de la génération 0.
- **Arrêter** : stoppe l'entraînement ; la génération en cours (incomplète) est abandonnée, les générations terminées sont déjà sauvegardées.
- **Garage** (`garage.js`, `localStorage` du navigateur) : à chaque fin de génération, le champion de chaque lignée est enregistré (cerveau, paramètres, place sur la grille, génération, progression, circuit). L'historique garde les générations qui ont battu le record (`GARAGE_HISTORY_LIMIT` = 40 par lignée) plus la dernière. « Repartir de zéro » (vitrine des voitures) supprime la lignée.
- Un modèle sauvegardé garde sa topologie et ses capteurs, même si `network-config.js` change ensuite.

## Fichiers

`vehicle.js` (base protégée), `car.js` (`Car extends Vehicle`), `network-config.js`, `neural-network.js`, `architecture.js`, `confidence.js`, `evolution.js`, `training-circuits-data.js`, `curriculum.js`, `garage.js`, `network.html` + `network-viewer.js`, `ray.js`, `ray-editor.js`, `sensor-settings.js`, `sim-speed.js`, `car-design.js`, `showroom.js`, `circuit-showroom.js`, `model-file.js`, `obstacle.js`, `obstacle-editor.js`, `obstacle-catalog.js`, `obstacle-placement.js`, `obstacle-showroom.js`, `circuit.js` (géométrie, `LapTracker`), `circuits-data.js`, `brands.js`, `random.js` (RNG à graine), `grass.js`, `decor.js`, `track-renderer.js`, `finish-flames.js`, `sketch.js`.

## Tests

Depuis ce dossier (Node.js 18+) :

```bash
node --test tests/*.test.mjs
```

Les tests utilisent un adaptateur p5 minimal (`tests/p5-adapter.mjs`) : ils ne prouvent pas la compatibilité avec p5 réel, complétée par une vérification dans le navigateur.
