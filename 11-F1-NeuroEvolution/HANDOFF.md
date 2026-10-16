# Passation – 11 F1 Neuroévolution

Note pour reprendre le travail dans une nouvelle session (rédigée le 16 octobre 2026, contexte de la session précédente presque plein). À lire avec [ARCHITECTURE.md](ARCHITECTURE.md) (pile des étapes + rôle de chaque fichier), [README.md](README.md) (fonctionnement détaillé) et les consignes du dépôt [AGENTS.md](../AGENTS.md).

## 1. État actuel

- **Branche** : `f1-neuroevolution` (locale, jamais poussée ; l'utilisateur a dit « garde la branche en local »).
- **Commits** : `e81425a` (étapes 1 à 11), `e9341ec` (étape 12, vitrine des circuits).
- **Commits** (suite) : `c62f074` (étapes 13 à 15).
- **Étape 16** (vitrine des obstacles) commitée (`4bc0062`). **Étape 17** (décor léger) commitée (`8d43ebf`). **Étape 18** (flammes) commitée (`063a587`). **Étape 19** (niveaux 4 fois plus petits) commitée (`2dae9d2`). **Étape 20** (niveaux 6 à 10 : drift gauche/droite, freinage, virage qui se referme, haricot) faite, non commitée. À faire : 21 à 23 (plus de circuits F1, voitures plus distinctes, rayons jusqu'à la largeur de l'écran). Ne commiter que sur accord de l'utilisateur, uniquement `11-F1-NeuroEvolution/` (+ `.claude/launch.json` s'il change).
- **Tests** : `node --test tests/*.test.mjs` depuis `11-F1-NeuroEvolution` → **172/172** au dernier passage (≈ 15 s).
- **Navigateur** : vérifié pour les étapes 13 à 15 (menu, vitrines, éditeur de rayons avec longueur, retrait d'obstacle, entraînement).
- Les autres dossiers du dépôt ont des modifications de l'utilisateur (`1-Seek`, `3-Arrival_correction`, `4-Wander`, dont des `vehicle.js`) : **ne pas y toucher, ne pas les inclure dans les commits**.

## 2. Étapes (détail dans ARCHITECTURE.md)

| # | Contenu | État |
|---|---|---|
| 1–12 | Circuits F1, herbe Minecraft, marques parodiques, rayons, réseau + génétique, garage, confiance, niveaux d'entraînement, architecture éditable, longueur des rayons, confiance par circuit, vitrine des voitures, accélération, modèles en fichier, obstacles, vitrine des circuits | DONE, commité |
| 13 | Règle de confiance : gén. 0 = 100 %, gén. 1-2 = 50 %, puis progrès entre les 2 générations précédentes (< 1 pt → −50, < 2 → −25, < 4 → −12,5, ≥ 4 → 100 %), plancher 50 %, circuit complété = 100 % | DONE, non commité |
| 14 | Rayons à angles libres (`rayAngles`), un rayon = un neurone d'entrée (+ 1 neurone vitesse) ; vitrine des voitures sans fiche technique | DONE, non commité |
| 15 | Menu épuré : lignées en piste en haut, puis uniquement des boutons (Circuit, Voitures, Réseau de neurones, Rayons, Entraîner/Arrêter, Parcours, vitesses, rayons du leader, obstacles) ; garage dans la vitrine des voitures ; longueur des rayons dans l'éditeur de rayons ; « Retirer un obstacle » par clic | DONE, non commité |

## 3. Façon de travailler attendue par l'utilisateur

- Échanges **en français**. L'utilisateur est étudiant (Master MIAGE IA2) ; projet pédagogique p5.js.
- **Une étape à la fois** : faire l'étape demandée, la tester, puis rendre la main (bouton « étape suivante » / « corriger d'abord »). Quand il liste plusieurs étapes, n'en faire qu'une. Toute nouvelle demande = nouvelle étape ajoutée à la pile d'`ARCHITECTURE.md`, marquée **DONE** une fois testée.
- Toujours : tests unitaires (`node:test`, adaptateur p5 `tests/p5-adapter.mjs`, graine fixe) + vérification dans le navigateur, puis README et ARCHITECTURE.md à jour, puis proposer le commit.
- `vehicle.js` est protégé (AGENTS.md) : ne jamais le modifier ; tout passe par `Car extends Vehicle`, `Obstacle extends Vehicle`.
- Il aime des menus sobres (« ne laisse que des boutons ») ; l'information doit être dans les libellés de boutons, le résumé des lignées ou le bandeau en haut du circuit.

## 4. Décisions et interprétations à connaître

- **Confiance (étape 13)** : baisses comptées en **points** (100 → 87,5), progrès = meilleur % dernière génération − avant-dernière (un recul compte comme < 1 point), différence arrondie au millionième (0,42 − 0,40 = 2 points exactement). Générations comptées **par circuit** ; l'état `{ confidence, runs, lastProgress }` est porté par `spec.confidenceState` et mémorisé dans la fiche du circuit au garage.
- **Couche d'entrée** : l'utilisateur pensait « 6 rayons » ; il y a 5 rayons + 1 neurone de vitesse. Le neurone de vitesse a été gardé (utile pour freiner) et l'éditeur l'affiche : « 5 rayons + 1 vitesse = 6 neurones ».
- **Changer rayons ou couches cachées efface toutes les générations** (architecture différente) ; changer la longueur des rayons ne les efface pas.
- **Une seule génération de reprise** : depuis l'étape 15, plus de choix d'une génération ancienne ; la reprise part toujours du dernier champion (`garage.snapshot(key)`).
- **1 tour maximum** à l'entraînement (`MAX_LAPS = 1`) ; un modèle qui boucle un circuit y est « entraîné » (100 %) et ne s'y réentraîne plus.
- **Générations indépendantes par type** (`advanceStoppedLineages`).
- Les vitesses diffèrent légèrement selon le modèle (3,4 à 5,3 px/image) même si l'utilisateur les perçoit identiques ; rien n'a été uniformisé.

## 5. Pièges techniques rencontrés

- **Cache du navigateur** : après modification des fichiers, la page peut garder d'anciens scripts (erreur « drawTrackThumbnail is not defined »). Forcer : Ctrl+F5, ou dans l'outil navigateur `fetch(fichier, { cache: "reload" })` sur chaque script puis `location.reload()`.
- **Serveur d'aperçu** : `.claude/launch.json`, configuration `f1-neuroevolution` (`python -m http.server 8761 --directory 11-F1-NeuroEvolution`), à lancer avec `preview_start`. Si le port 8761 est pris par une autre session, utiliser `f1-neuroevolution-alt` (port 8763) : le port est écrit dans la commande Python, le changement automatique de port ne fonctionne pas.
- **Panneau du navigateur masqué** : `draw()` ne tourne pas tout seul ; faire avancer la simulation avec des boucles `redraw()` courtes (< 9 s par appel, sinon l'outil coupe et p5 reste bloqué → recharger la page).
- **Coordonnées des clics** : la page fait 1024 × 768 alors que les captures font 800 × 600 ; pour cliquer sur un canvas, diviser les coordonnées CSS par 1,28 (ou utiliser les `ref` de `find`).
- **Après chaque test navigateur**, vider le `localStorage` touché (`f1-neuroevolution-garage-v1`, `-architecture-v1`, `-obstacles-v1`, `-obstacle-protos-v1`, `-decor-v1`, `-ray-length-v1`, `-sim-speed-v1`) pour rendre un état propre.
- **Tests Node** : les objets créés dans le contexte `vm` ont d'autres prototypes → comparer avec `JSON.parse(JSON.stringify(x))` dans `deepEqual`. Ajouter chaque nouveau fichier à `SCRIPTS` et chaque fonction exportée à la liste de `tests/p5-adapter.mjs`.
- **Éditions de fichiers** : les heredocs Bash avec apostrophes françaises cassent parfois ; écrire les scripts Python d'édition dans le dossier scratchpad puis les exécuter.

## 6. Pistes proposées, non demandées (à ne faire que sur demande)

Constat (simulation) : une voiture valide souvent le niveau circulaire **par chance** (volant presque fixe) puis bloque sur le carré. Pistes déjà suggérées à l'utilisateur :
1. Départ de chaque circuit sur une ligne droite (le carré démarre dans un coin).
2. L'élite garde la confiance de sa propre course pour la rejouer à l'identique (sinon le record peut régresser).
3. Mutation plus forte quand le record stagne.
4. Niveau intermédiaire « ligne droite + chicane douce ».
5. Validation du cercle plus exigeante (2 tours ou deux sens).

## 7. Commandes utiles

```bash
cd 11-F1-NeuroEvolution && node --test tests/*.test.mjs
```

```bash
git status --short -- 11-F1-NeuroEvolution
```
