# Spécification technique — 7-Boids « Perroquets Minecraft »

*Document pour développeurs. Le résumé grand public est dans [RESUME_NON_EXPERT.md](RESUME_NON_EXPERT.md).*

- Pile technique : p5.js **1.7.0** en mode global, scripts classiques (pas de modules), Web Audio API, un seul shader GLSL ES 1.0.
- Unités : le mouvement est intégré **par image**, comme dans la base ; aucun `deltaTime` n'est utilisé.
- Légende des statuts :
  - **[existant]** : code d'origine, non modifié ;
  - **[remplacé]** : code d'origine réécrit ;
  - **[ajouté]** : nouveau code.

---

## 1. Vue d'ensemble

```text
index.html  → p5.min.js → boids.js → obstacle.js            (base, inchangée)
            → pixelart.js → perroquet.js → chasseur.js → plume.js
            → obstacleMinecraft.js → decor.js → soundbox.js
            → reglages.js → panneau.js → sketch.js           (contrôleur)

Boid ──┬── Perroquet          (nuée, fuite, rendu sprite)
       └── Chasseur           (wander + seek, frappe, rendu skin)
Obstacle ── ObstacleMinecraft (rendu feuillage / invisible)
Plume, Decor, SoundBox        (classes hors simulation, sans steering)
```

Le découpage suit Reynolds :

| Niveau | Où |
|---|---|
| Sélection d'action | `Chasseur.chasser()` choisit la proie ; `sketch.js` décide la frappe et la mort |
| Steering | méthodes de `Boid`, réutilisées sans modification |
| Locomotion | `Boid.update()`, appelée via `super.update()` |
| Règles de scène | `tuerPerroquet`, `edges`, `ajusterEffectif` |

### Fichiers

| Fichier | Lignes | Statut |
|---|---:|---|
| `boids.js` | 530 | **[existant]**, non modifié (md5 `d44cf384…`) |
| `obstacle.js` | 17 | **[existant]**, non modifié (md5 `bfcc7932…`) |
| `libraries/p5.min.js`, `p5.sound.min.js` | — | **[existant]**, non modifiés ; `p5.sound` n'est plus chargé |
| `assets/*` | — | **[existant]**, plus utilisés, conservés sur le disque |
| `jsconfig.json` | — | **[existant]** |
| `sketch.js` | 240 | **[remplacé]**, voir §11 |
| `index.html`, `style.css` | — | **[remplacé]** |
| `pixelart.js`, `perroquet.js`, `chasseur.js`, `plume.js`, `obstacleMinecraft.js`, `decor.js`, `soundbox.js`, `reglages.js`, `panneau.js` | — | **[ajouté]** |
| `shaders/ciel.vert`, `shaders/ciel.frag` | 14 / 76 | **[ajouté]** |
| `soundbox.html`, `README.md`, `tests/*` | — | **[ajouté]** |

---

## 2. Base existante : `Boid` (`boids.js`) [existant]

Rappel du contrat réutilisé ; rien n'a été modifié.

### Attributs (fixés dans le constructeur)

| Attribut | Valeur | Rôle |
|---|---|---|
| `pos`, `vel`, `acc` | `p5.Vector` | `vel` aléatoire de norme comprise entre 2 et 4 |
| `maxForce` | 0.2 | norme maximale d'une force élémentaire |
| `maxSpeed` | 5 | vitesse maximale |
| `r` | 6 | rayon (taille de dessin) |
| `perceptionRadius` | 25 | ×2 pour la cohésion |
| `alignWeight`, `cohesionWeight`, `separationWeight` | 1.5, 1, 2 | poids de la nuée |
| `boundariesWeight`, `avoidWeight` | 10, 15 | poids du confinement et de l'évitement |
| `boundariesX/Y/Width/Height/Distance` | 0, 0, `width`, `height`, 25 | rectangle de confinement |
| `distanceCercle`, `wanderRadius`, `wanderTheta`, `displaceRange` | 150, 50, 0, 0.1 | paramètres de `wander` |
| `largeurZoneEvitementDevantVaisseau` | `r/2` | calculé avec `r = 6`, donc 3 |
| `static debug` | `false` | active les dessins de diagnostic |

### Méthodes

| Méthode | Contrat |
|---|---|
| `flock(boids, obstacles)` | applique `avoid`, `align`, `cohesion`, `separation`, `boundaries`, chacune multipliée par son poids |
| `align`, `separation`, `cohesion` | retournent une force limitée à `maxForce` |
| `avoid(obstacles)` | exige au moins 1 obstacle |
| `seek(target: p5.Vector)` | force de recherche, limitée à `maxForce` |
| `flee(target)` | `seek × −1` |
| `fleeWithTargetRadius(target)` | fuit si `d < target.r + 10` : `flee × 100` ; dessine toujours un cercle rouge |
| `wander()` | force de norme `maxForce` ; fait varier `wanderTheta` aléatoirement |
| `boundaries(...)` | particularité de la base : retourne la vitesse désirée limitée, et non `désirée − vitesse` |
| `getVehiculeLePlusProche(v)` | plus proche voisin |
| `getObstacleLePlusProche(o)` | obstacle le plus proche |
| `applyForce(f)` | `acc += f` |
| `update()` | `pos += vel`, puis `vel += acc`, `limit(maxSpeed)`, `acc = 0` |
| `edges()` | bouclage torique de la position |
| `show()`, `drawVector()` | rendu |

`Obstacle(x, y, r, couleur)` a les attributs `pos`, `r`, `color` et une méthode `show()` (cercle).

---

## 3. `pixelart.js` [ajouté]

| Élément | Spécification |
|---|---|
| `const RECOUVREMENT_PIXEL = 0.35` | px ajoutés à chaque rectangle sur le canvas, pour masquer les jointures quand la taille d'un pixel est fractionnaire |
| `dessinerMotif(motif, palette, x, y, taille, cible?)` | dessine un motif de pixels (détails ci-dessous) |

Détails de `dessinerMotif` :
- `motif` est un tableau de chaînes ; chaque caractère est une clé de `palette`, `'.'` est transparent.
- Dans chaque ligne, les pixels voisins de même couleur sont fusionnés en un seul `rect`.
- `cible` est un `p5.Graphics` optionnel :
  - s'il est fourni, on dessine dedans, sans recouvrement ;
  - sinon, on dessine sur le canvas via les fonctions globales `fill` et `rect`.
- Aucun effet sur l'état de la simulation.

---

## 4. `Perroquet extends Boid` (`perroquet.js`) [ajouté]

### Constantes statiques

| Nom | Valeur | Rôle |
|---|---|---|
| `VARIANTES` | 5 objets `{nom, B, W, T}` : rouge, bleu, vert, cyan, gris | couleurs du corps (`B`), de l'aile (`W`) et des bouts (`T`) |
| `COULEURS_COMMUNES` | `{Y, K, e, E, F}` | bec, bout du bec, blanc de l'œil, pupille, pattes |
| `CORPS`, `CORPS_CRI` | motifs 12×11 | profil tourné vers la droite ; `CORPS_CRI` a le bec ouvert |
| `AILES` | 3 motifs | aile haute, milieu, basse (superposée au corps) |
| `LARGEUR_MOTIF`, `HAUTEUR_MOTIF` | 12, 11 | taille des motifs en pixels |
| `DUREE_CRI` | 16 | durée du cri, en images |
| `palettes` | `Map<nomVariante, {code: p5.Color}>` | cache ; `S` est l'ombre du corps (`lerpColor(B, noir, 0.25)`) |
| `sprites` | `Map<"nom-aile-becOuvert", p5.Graphics>` | cache ; 30 sprites au maximum (5 × 3 × 2) |

### Attributs d'instance

Ils s'ajoutent à ceux de `Boid`.

| Attribut | Type / initialisation | Rôle |
|---|---|---|
| `variante` | élément de `VARIANTES` (aléatoire si non fourni) | couleurs |
| `facteurTaille` | `random(0.85, 1.15)` | `r = taillePerroquets × facteurTaille` |
| `phaseAiles` | `random(0, 3)` | phase du battement d'ailes (visuel) |
| `regardeADroite` | `vel.x >= 0` | orientation du sprite |
| `cri` | 0 | nombre d'images restantes de l'animation de cri |

### Méthodes

| Signature | Comportement |
|---|---|
| `constructor(x, y, variante?)` | `super(x, y)` sans image |
| `fleeWithTargetRadius(target)` | **surcharge** (détails ci-dessous) |
| `update()` | `super.update()` puis `animer()` ; aucune intégration supplémentaire |
| `animer()` | met à jour l'état visuel (détails ci-dessous) |
| `contientPoint(x, y)` → `bool` | `dist < 0.6 r + 4` (zone de clic un peu plus large que le dessin) |
| `crier()` | `cri = DUREE_CRI` ; ne touche ni la vitesse ni les forces |
| `couleursPlumes()` → `[B, W, T]` | couleurs utilisées pour les plumes |
| `indexAile()` → 0, 1 ou 2 | cycle `[0, 1, 2, 1]` sur `floor(phaseAiles)` |
| `static paletteDe(variante)` | crée la palette p5 une fois par variante, puis la met en cache |
| `static spriteDe(variante, indexAile, becOuvert)` | crée un `createGraphics(12, 11)` (`pixelDensity(1)`) une fois par combinaison, puis le met en cache |
| `show()` | dessin du sprite (détails ci-dessous) |
| `dessinerNote(progression)` | `text('♪')` qui monte et s'estompe pendant le cri |

`fleeWithTargetRadius(target)` reprend le calcul de la base :
- même zone (`target.r + 10`) et même force (`flee(target.pos) × 100`) ;
- seule différence : le cercle rouge n'est dessiné que si `Boid.debug` est vrai.

`animer()` :
- `phaseAiles += 0.18 + 0.22 × |vel| / maxSpeed`, avec garde si `maxSpeed = 0` ;
- l'orientation ne change que si `|vel.x| > 0.15 × maxSpeed` (hystérésis contre le clignotement) ;
- `cri` diminue de 1 tant qu'il est positif.

`show()` :
- dans un `push()` / `pop()` : `translate`, puis `scale(-1, 1)` si le perroquet regarde à gauche ;
- `rotate` d'une inclinaison égale à `atan2(vel.y, |vel.x|)` bornée à ±0.5 rad ;
- `image(sprite)` de taille `r × r·11/12`, centrée sur la position ;
- saut visuel pendant le cri : `−sin(π·p) × 0.18 r`.

---

## 5. `Chasseur extends Boid` (`chasseur.js`) [ajouté]

Il remplace le requin et reprend sa logique.

### Constantes statiques

| Nom | Contenu |
|---|---|
| `PALETTE` | 14 couleurs du skin (H, h, s, n, e, b, w, m, C, c, L, P, p, Z) |
| `TETE` | motif 8×8 : cheveux, sourcils blancs, yeux bleus, barbe |
| `CORPS` | motif 8×12 : gilet brun, chemise, ceinture |
| `JAMBES` | motif 8×12 |
| `BRAS` | motif 4×12 : manche, main |
| `EPEE` | `{manche, pommeau, garde, contour, lame, reflet}` : couleurs de l'épée en diamant |
| `ANGLE_REPOS`, `ANGLE_ARME`, `ANGLE_FIN_FRAPPE` | −0.9, −2.6, 0.5 rad (angle du bras ; 0 = bras pendant) |

### Attributs d'instance

| Attribut | Défaut | Rôle |
|---|---|---|
| `r`, `maxSpeed`, `maxForce` | 40, 7, 0.5 | valeurs du requin d'origine ; `maxSpeed` est ensuite fixée à 1.1 par les réglages |
| `poidsWander`, `poidsSeek` | 1, 7 | poids du requin d'origine |
| `rayonDetection` | 70 | rayon de détection, en px |
| `enChasse`, `cible` | `false`, `null` | état de la sélection d'action |
| `delaiEntreCris`, `imagesDepuisCri` | 120, 120 | anti-répétition du son d'alerte (environ 2 s) |
| `dureeFrappe` | 22 | durée de la frappe, en images |
| `toleranceImpact` | 1.6 | la proie doit être à moins de `portée × 1.6` à l'impact |
| `frappe` | `null` ou `{cible, t, impact}` | état de l'animation de frappe |
| `regardeADroite`, `pas` | `true`, 0 | état visuel |

### Méthodes

| Signature | Comportement |
|---|---|
| `chasser(proies)` → `{proie, debutDeChasse}` | sélection d'action et steering (détails ci-dessous) |
| `porteeEpee()` → `0.8 r` | portée de l'épée, en px |
| `peutFrapper(proie)` → `bool` | pas de frappe en cours, proie définie et `d < portée` (seuil strict) |
| `commencerFrappe(proie)` → `bool` | crée `frappe` ; `false` si une frappe est déjà en cours |
| `estEnTrainDeFrapper()` | `frappe !== null` |
| `avancerFrappe()` → proie ou `null` | avance l'animation d'une image (détails ci-dessous) |
| `angleBrasEpee()` | angle du bras armé (détails ci-dessous) |
| `update()` | `super.update()` puis `animer()` |
| `animer()` | `pas += 0.08 + 0.12 × |vel|` ; orientation vers la cible si elle existe (seuil 2 px), sinon selon `vel.x` |
| `show()` | dessin du skin (détails ci-dessous) |
| `dessinerBrasEtEpee(u)`, `dessinerEpee(su)` | bras pivotant autour de l'épaule `(6u, −7u)` ; épée le long de l'axe x local du bras |
| `dessinerBalayage(u)` | deux arcs blancs translucides pour `p` entre 0.4 et 0.75 |
| `dessinerDebug()` | cercle jaune (détection) et cercle rouge (portée), si `Boid.debug` |

`chasser(proies)` reprend la logique du requin :
1. applique `wander() × poidsWander` ;
2. cherche le boid le plus proche avec `getVehiculeLePlusProche` ;
3. si `d < rayonDetection` (seuil strict), applique `seek(proie.pos) × poidsSeek` et marque la chasse ;
4. `debutDeChasse` vaut vrai au passage de « pas en chasse » à « en chasse », seulement si `imagesDepuisCri ≥ delaiEntreCris`.

`avancerFrappe()` :
- incrémente `t` ;
- à `t = round(0.5 × dureeFrappe)` (image 11), un impact unique : retourne la cible si elle est encore à moins de `portée × toleranceImpact`, sinon `null` (coup raté) ;
- remet `frappe` à `null` quand `t ≥ dureeFrappe`.

`angleBrasEpee()`, avec `p = t / dureeFrappe` :
- au repos : `ANGLE_REPOS + 0.06 × sin(pas)` ;
- `p < 0.4` : armement, avec un amorti (ease-out) vers `ANGLE_ARME` ;
- `p < 0.55` : coup linéaire jusqu'à `ANGLE_FIN_FRAPPE` ;
- ensuite : retour au repos.

`show()` :
- l'unité vaut `u = r / 20`, ce qui donne un skin de 32u, soit 1.6 r de haut ;
- léger rebond vertical ;
- `scale(-1, 1)` s'il regarde à gauche ;
- ombre au sol, puis bras gauche, jambes, corps, tête, et enfin bras droit avec l'épée.

---

## 6. `Plume` (`plume.js`) [ajouté]

Particule décorative : ce n'est pas un `Boid` et elle n'a pas de steering.

### Constantes statiques

| Nom | Valeur | Rôle |
|---|---|---|
| `GRAVITE` | 0.035 | ajoutée à `vel.y` à chaque image |
| `FROTTEMENT` | 0.965 | multiplie `vel` à chaque image |
| `MAX_PLUMES` | 400 | nombre maximal de plumes en même temps dans la scène |

### Attributs

| Attribut | Initialisation |
|---|---|
| `pos` | point d'impact |
| `vel` | direction aléatoire, norme 0.8 à 3.4, plus −1.2 en y (poussée vers le haut) |
| `couleur` | une des couleurs du perroquet |
| `angle`, `rotation` | orientation, et rotation de ±0.1 rad par image |
| `phase` | phase du balancement |
| `taille` | `(4 + alea·4) × echelle` (demi-longueur, en px) |
| `dureeVie` | 90 à 159 images |
| `age` | 0 |

### Méthodes

| Signature | Comportement |
|---|---|
| `constructor(x, y, couleur, alea = Math.random, echelle = 1)` | générateur aléatoire injectable (tests) |
| `static eclater(x, y, couleurs, nombre = 14, alea, echelle)` → `Plume[]` | crée une gerbe ; les couleurs sont distribuées à tour de rôle |
| `update()` | frottement, gravité, `pos += vel`, balancement de `0.35 × sin`, rotation, `age++` |
| `estMorte()` | `age ≥ dureeVie` |
| `opacite()` | de 255 à 0 sur la seconde moitié de la vie |
| `show()` | 3 rectangles tournés, dans un `push()` / `pop()` |

---

## 7. `ObstacleMinecraft extends Obstacle` (`obstacleMinecraft.js`) [ajouté]

| Élément | Spécification |
|---|---|
| `static COULEURS_FEUILLES` | 4 verts |
| `constructor(x, y, r, invisible = false)` | `super(x, y, r, '#4f9a2b')` ; `motif` = 36 teintes tirées une seule fois (pas de hasard dans `draw`) |
| `invisible` | utilisé pour l'obstacle de la souris : rien n'est dessiné, sauf `super.show()` en mode debug |
| `show()` | grille 6×6 de carrés de feuillage, limitée aux cellules dont le centre est à moins de `r` du centre (le cercle de collision) |

`pos` et `r` ne changent pas, donc l'évitement par `Boid.avoid` est identique.

---

## 8. `decor.js` [ajouté]

### Constantes et fonctions pures

| Élément | Spécification |
|---|---|
| `ECHELLE_CIEL = 4` | le calque du ciel mesure 1/4 de l'écran |
| `PIXEL_SOL = 4` | taille d'un pixel de texture du sol, en px |
| `hauteurDuSol(h)` | `round(0.14 h / 8) × 8`, bornée entre 48 et 160 |
| `creerAleatoire(graine)` | générateur mulberry32 qui retourne une fonction `() → [0, 1)` |
| `genererSol(largeur, graine = 7)` | retourne `{nbColonnes, epaisseursHerbe[3..5], touffes[{colonne, hauteur}], fleurs[{colonne, type: 'coquelicot'\|'pissenlit'}], alea}` ; déterministe |

### Classe `Decor`

| Élément | Spécification |
|---|---|
| `static COULEURS_TERRE`, `COULEURS_HERBE` | 4 teintes chacune |
| `static MARGE_HAUT` | `6 × PIXEL_SOL`, place laissée au-dessus du sol pour les touffes et les fleurs |
| `constructor(sourcesCiel: {vert, frag})` | textes du shader |
| Attributs | `sourcesCiel`, `shaderCiel`, `calqueCiel`, `calqueSol`, `cielSecours`, `largeur`, `hauteur`, `hauteurSol`, `yHorizon` |
| `redimensionner(l, h)` | tailles bornées à au moins 1 px (fenêtre masquée) ; recrée les deux calques |
| `creerCalqueCiel()` | voir ci-dessous |
| `creerCielSecours(l, h)` | dégradé 2D fixe |
| `creerCalqueSol()` | calque 2D dessiné une seule fois : herbe et terre tachetées, ombre, touffes, fleurs |
| `dessinerCiel(t)` | voir ci-dessous |
| `dessinerSol()` | `image(calqueSol)` au niveau de `yHorizon − MARGE_HAUT` |

`creerCalqueCiel()` :
- crée `createGraphics(ceil(l/4), ceil(h/4), WEBGL)` avec `pixelDensity(1)` ;
- **compile le shader avec `calque.createShader()`**. Un `p5.Shader` est lié au contexte WebGL qui l'a compilé : réutiliser l'ancien shader après un redimensionnement laissait le calque transparent, et des images fantômes apparaissaient ;
- en cas d'échec, utilise le ciel de secours.

`dessinerCiel(t)` :
- passe les uniforms `u_resolution`, `u_time` et `u_horizon` ;
- dessine un `rect` plein calque, puis `image()` agrandie à la taille de l'écran ;
- le canvas est en `noSmooth()`, donc l'agrandissement reste pixelisé.

### Shader `shaders/ciel.frag`

| Uniform | Sens |
|---|---|
| `vec2 u_resolution` | taille du canvas principal, en px |
| `float u_time` | temps écoulé, en s |
| `float u_horizon` | y du haut de l'herbe, en px depuis le haut |

| Élément | Spécification |
|---|---|
| `const float BLOC = 12.0` | taille d'un bloc de nuage, en px |
| `hash(vec2)`, `bruit(vec2)` | hash sinus et bruit de valeur avec interpolation lissée |
| `nuage(cellule)` | 0 ou 1 (détails ci-dessous) |
| `main()` | calcul de la couleur (détails ci-dessous) |

`nuage(cellule)` :
- bruit étiré : `0.75 × bruit(c × (0.08, 0.25)) + 0.25 × bruit(c × 0.33)` ;
- seuil 0.6, qui monte jusqu'à 0.8 près de l'horizon ;
- nuages seulement entre 4 % et 50 % de la hauteur du ciel.

`main()` :
1. `px = (vTexCoord.x, 1 − vTexCoord.y) × u_resolution` ;
2. dégradé en bandes de 8 px, de `(0.40, 0.60, 1.00)` à `(0.76, 0.86, 1.00)` suivant `t²` ;
3. soleil carré à `(0.82 W, 0.18 horizon)` : cœur de demi-côté 24 px, anneau de demi-côté 34 px, halo `exp(−d/90)` ;
4. nuages : grille décalée de `9 px/s × u_time` ; un bloc dont la cellule du dessous est vide est ombré à `(0.84, 0.88, 0.95)`.

`ciel.vert` fait seulement passer `aTexCoord` et étire `aPosition` de [0, 1] vers [−1, 1].

---

## 9. `SoundBox` (`soundbox.js`) [ajouté]

Indépendante de p5 : le même fichier sert dans `sketch.js` et dans `soundbox.html`.

### Éléments de module

| Élément | Spécification |
|---|---|
| `const SILENCE = 0.0001` | cible des rampes exponentielles, qui refusent 0 |
| `enveloppe(param, debut, attaque, duree, niveau)` | `SILENCE`, puis rampe exponentielle vers `niveau` en `attaque` s, puis vers `SILENCE` à `debut + duree` |

### `static CATALOGUE`

Chaque entrée a la forme `{titre, quand, description, jouer(o) → instantDeFin}`.

| Clé | Synthèse |
|---|---|
| `cuiPerroquet` | 3 à 5 oscillateurs `triangle` espacés de 60 ms ; fréquence de base 1 900 à 2 600 Hz (±8 %), rampe ×1.45 puis ×0.9, chacun dure 70 ms ; crête 0.3 |
| `mortPerroquet` | `sawtooth` de 1 250 à 330 Hz en 0.4 s ; vibrato sinusoïdal à 28 Hz (profondeur 60 Hz) ; passe-bande 1 400 Hz (Q 1.5) ; plus du bruit passe-bas à 900 Hz |
| `coupEpee` | bruit blanc dans un passe-bande de 500 à 3 200 Hz en 0.16 s ; crête 0.35 |
| `impactEpee` | `square` de 170 à 55 Hz, passe-bas à 1 200 Hz ; plus un claquement de bruit passe-haut à 2 000 Hz |
| `alerteChasseur` | `sawtooth` 150 → 175 → 125 Hz, deux formants passe-bande (650 Hz Q 3 et 1 100 Hz Q 4) ; 0.5 s |

### Instance

| Élément | Spécification |
|---|---|
| `constructor({ContexteAudio, alea = Math.random, maxVoix = 24, volume = 0.6})` | `ContexteAudio` vaut par défaut `AudioContext` ou `webkitAudioContext` ; on peut l'injecter (tests) |
| Attributs | `ContexteAudio`, `alea`, `maxVoix`, `volume`, `ctx`, `sortie` (gain principal), `tamponBruit`, `voix[{nom, fin, sources, noeuds}]` |
| `static bornerVolume(v)` | ramène dans [0, 1] ; une valeur non finie donne 0 |
| `deverrouiller()` → `bool` | crée le contexte et la sortie au premier geste de l'utilisateur, puis `resume()` si le contexte est suspendu |
| `estPret()` | contexte créé et dans l'état `running` |
| `setVolume(v)` | met à jour la sortie si elle existe |
| `jouer(nom)` → `bool` | `false` si le nom est inconnu, si le contexte n'est pas prêt ou si `maxVoix` est atteint ; sinon exécute la recette |
| `outils(sources, noeuds)` | fabriques fournies aux recettes : `t`, `sortie`, `alea`, `gain()`, `filtre(type, f, q)`, `oscillateur(type, f, début, fin)`, `bruit(début, fin)` ; elles enregistrent chaque nœud créé |
| `obtenirTamponBruit()` | 0.5 s de bruit blanc, créé une seule fois |
| `nombreDeVoix()`, `oublierVoixTerminees()` | purge les voix dont `fin ≤ currentTime` |
| `arreterTout()` | `stop()` sur chaque source et `disconnect()` sur chaque nœud ; la sortie reste branchée |
| `fermer()` | arrête tout, déconnecte la sortie, `ctx.close()`, remet l'état à zéro |

---

## 10. Réglages et panneau

### `reglages.js` [ajouté]

| Élément | Spécification |
|---|---|
| `REGLAGES_INITIAUX` | valeurs par défaut (tableau ci-dessous) ; `sketch.js` en fait une copie (`{...}`) |
| `DEFINITIONS_REGLAGES` | 15 entrées `{groupe, cle, libelle, min, max, pas}` |
| `CLES_PERROQUET` | 7 clés appliquées à tous les perroquets |
| `CLES_CHASSEUR` | 5 clés appliquées à tous les chasseurs |
| `appliquerAuPerroquet(p, reg)` | `r = taille × facteurTaille`, `maxSpeed`, 4 poids, `perceptionRadius` ; **ne modifie jamais `maxForce`** |
| `appliquerAuChasseur(c, reg)` | `r`, `maxSpeed`, `poidsWander`, `poidsSeek`, `rayonDetection` |
| `ajusterEffectif(liste, n, creer)` | voir ci-dessous |
| `formaterValeur(v, pas)` | autant de décimales que le pas |

`ajusterEffectif(liste, n, creer)` :
- `n` est converti par `floor(Number(n))`, borné à au moins 0 ; une valeur non numérique donne 0 ;
- ajoute des entités avec `creer()` ou coupe la fin de la liste ;
- conserve l'identité des entités restantes.

| Groupe | Clé | Défaut | Min | Max | Pas |
|---|---|---:|---:|---:|---:|
| Perroquets | `nbPerroquets` | 80 | 0 | 250 | 1 |
| | `taillePerroquets` | 30 | 12 | 64 | 1 |
| | `vitessePerroquets` | 1.4 | 0.3 | 5 | 0.1 |
| Chasseurs | `nbChasseurs` | 1 | 0 | 6 | 1 |
| | `tailleChasseurs` | 40 | 20 | 90 | 1 |
| | `vitesseChasseurs` | 1.1 | 0.3 | 5 | 0.1 |
| Poids de la nuée | `alignWeight` | 1.5 | 0 | 2 | 0.1 |
| | `cohesionWeight` | 1 | 0 | 2 | 0.1 |
| | `separationWeight` | 3 | 0 | 15 | 0.1 |
| | `boundariesWeight` | 10 | 0 | 15 | 1 |
| | `perceptionRadius` | 25 | 15 | 60 | 1 |
| Poids des chasseurs | `poidsWander` | 1 | 0 | 5 | 0.1 |
| | `poidsSeek` | 7 | 0 | 15 | 0.5 |
| | `rayonDetection` | 70 | 20 | 300 | 5 |
| Son | `volume` | 0.6 | 0 | 1 | 0.05 |

### `panneau.js` [ajouté]

`creerPanneauReglages(reglages, definitions, surChangement)` est appelée une fois dans `setup()`.

**DOM créé :**
- `button.bouton-reglages` (⚙), avec `aria-expanded`, `aria-controls` et `aria-label` ;
- `div#panneau-reglages.panneau-reglages[role=dialog]`, qui contient :
  - un en-tête avec le titre et un bouton de fermeture ✕ ;
  - `p.compteur[aria-live=polite]` ;
  - un `fieldset` / `legend` par groupe ;
  - une ligne d'aide.

**État :** fermeture `ouvert` et `dernierCompteur`. La visibilité passe par la classe CSS `.ouvert`.

**Écouteurs :** événement `click` natif (souris et clavier) sur les deux boutons.

**Objet retourné :**

| Membre | Rôle |
|---|---|
| `ouvrir()`, `fermer()`, `basculer()`, `estOuvert()` | gestion de la visibilité |
| `curseurs` | `{cle: {def, curseur, affichage}}` |
| `majCompteur(n)` | n'écrit dans le DOM que si le nombre a changé |
| `afficherValeur(cle, v)` | remet un curseur et son affichage à une valeur |
| `retirer()` | retire les écouteurs et les éléments |

**`creerLigneCurseur(def, reglages, parent, surChangement)` :**
- crée un `label[for]`, un `createSlider` avec l'id `reglage-<cle>` et un `span.valeur` ;
- sur l'événement `input` (pendant le glissement) : `reglages[cle] = Number(valeur)`, mise à jour de l'affichage, puis `surChangement(cle, valeur)`.

---

## 11. `sketch.js` : ancien et nouveau

### Supprimé ou remplacé

| Ancien | Remplacé par |
|---|---|
| `fishImage`, `requinImage`, `loadImage` | `Perroquet` et `Chasseur` dessinés en pixel art |
| `eatSound`, `aie`, `ouuu` (`loadSound`, p5.sound) | `soundbox: SoundBox` |
| `alignSlider`, `cohesionSlider`, `separationSlider`, `labelNbBoids`, `creerUnSlider()` | `panneau` et `reglages` |
| `requin: Boid` | `chasseurs: Chasseur[]` |
| `target` et son ellipse verte | supprimés (ils n'avaient aucun rôle mécanique) |
| Cercle jaune de détection toujours visible | dessiné seulement en mode debug |
| `mousePressed` qui ajoutait un obstacle | clic qui fait crier un perroquet |
| `background(0)` | `decor.dessinerCiel()` puis `dessinerSol()` |
| Double dessin des obstacles | un seul, en fin de `draw` |

### Variables globales

| Variable | Type | Rôle |
|---|---|---|
| `flock` | `const Perroquet[]` | nom d'origine conservé |
| `chasseurs` | `Chasseur[]` | |
| `plumes` | `Plume[]` | |
| `obstacleSouris`, `obstacles` | `ObstacleMinecraft` et `Obstacle[]` | `obstacles[0]` est la souris, invisible |
| `reglages` | objet | copie de `REGLAGES_INITIAUX` |
| `panneau`, `soundbox`, `decor` | instances | |
| `sourcesCiel` | `{vert: string[], frag: string[]}` | lignes renvoyées par `loadStrings` |
| `elementCanvas` | `HTMLCanvasElement` | pour filtrer les événements souris |

### Fonctions

| Fonction | Comportement |
|---|---|
| `preload()` | `loadStrings` des deux fichiers du shader |
| `setup()` | initialisation (détails ci-dessous) |
| `creerPerroquet(x, y)` | `new Perroquet`, puis réglages ; confinement `boundariesWidth = width`, `boundariesHeight = decor.yHorizon` (les perroquets restent dans le ciel) |
| `creerChasseur()` | position aléatoire dans le ciel, puis réglages |
| `appliquerReglage(cle, v)` | dispatch : effectifs, volume, ou application à toutes les entités concernées |
| `draw()` | boucle principale (détails ci-dessous) |
| `mettreAJourChasseur(c)` | une image d'un chasseur (détails ci-dessous) |
| `tuerPerroquet(p, c)` → `bool` | voir ci-dessous |
| `perroquetSousLaSouris(x, y)` | parcours à l'envers, pour prendre le perroquet dessiné au-dessus |
| `estSurLeCanvas(event)` | `event.target === elementCanvas` ; les événements souris de p5 1.x sont écoutés sur `window`, y compris pendant les clics dans le panneau |
| `mousePressed(event)` | `soundbox.deverrouiller()` ; si on est sur le canvas et sur un perroquet : `crier()` et `jouer('cuiPerroquet')` |
| `mouseDragged(event)` | sur le canvas : ajoute un perroquet à la position de la souris |
| `keyPressed()` | `d` : debug ; `r` : `facteurTaille` aléatoire entre 0.5 et 1.5 ; `o` : feuillage ; `p`/`P` : panneau ; Échap : ferme le panneau |
| `windowResized()` | `decor.redimensionner` **avant** `resizeCanvas`, qui redessine immédiatement ; puis mise à jour des limites des perroquets |

`setup()` :
- crée le canvas, appelle `noSmooth()` et `describe()` ;
- crée la `SoundBox`, le `Decor` et le panneau ;
- règle les effectifs avec `ajusterEffectif` ;
- crée l'obstacle invisible de la souris.

`draw()`, dans cet ordre :
1. ciel, puis sol ;
2. `majCompteur` ;
3. pour chaque perroquet : `flock`, puis `fleeWithTargetRadius` pour chaque chasseur, puis `fleeWithTargetRadius(obstacles[0])`, puis `update`, puis `show` (ordre séquentiel d'origine) ;
4. pour chaque chasseur : `mettreAJourChasseur` ;
5. plumes : `update`, `show`, puis on retire les plumes mortes ;
6. l'obstacle de la souris suit le pointeur ;
7. dessin des obstacles.

`mettreAJourChasseur(c)` :
1. `chasser(flock)` ; son d'alerte si `debutDeChasse` ;
2. si `peutFrapper` : `commencerFrappe` et son `coupEpee` ;
3. `avancerFrappe()` ; si une proie est touchée, `tuerPerroquet` ;
4. `edges()`, `update()`, `show()`.

`tuerPerroquet(p, c)` :
- `splice` dans `flock` ; retourne `false` si le perroquet est déjà absent ;
- `c.r += 1` (comme le requin) ;
- 14 plumes à l'échelle `p.r / 30`, avec un plafond `MAX_PLUMES` ;
- sons `impactEpee` et `mortPerroquet`.

---

## 12. Tests (`tests/`, `node --test tests/*.test.mjs`)

`adaptateur-p5.mjs` fournit un contexte `vm` qui imite le minimum de p5 :
- `Vector` minimal ;
- générateur aléatoire à graine fixe (mulberry32) que l'on peut réinitialiser ;
- fonctions de dessin qui enregistrent leurs appels ;
- faux `createGraphics`.

Il expose les classes via `chargerExemple(fichiers)`.

| Fichier | Tests | Couverture |
|---|---:|---|
| `perroquet.test.mjs` | 14 | voir ci-dessous |
| `chasseur.test.mjs` | 12 | voir ci-dessous |
| `soundbox.test.mjs` | 10 | voir ci-dessous |
| `plume-decor.test.mjs` | 5 | gerbe, échelle, gravité, durée de vie bornée, `hauteurDuSol`, `genererSol` déterministe |
| `scene.test.mjs` | 19 | voir ci-dessous |
| **Total** | **60** | **60 réussis** |

`perroquet.test.mjs` :
- héritage sans surcharge du steering ;
- force de `flock` identique à celle de `Boid` (même graine) ;
- fuite identique, sans dessin hors debug ;
- seuil strict `r + 10` ;
- `update` identique à celui de la base, respect de `maxSpeed` ;
- hystérésis de l'orientation ;
- `maxSpeed = 0` sans NaN ;
- clic : test de `contientPoint` ;
- cri : animation qui se termine, sans changer la vitesse ;
- cache de 30 sprites, sprite à la taille `r` ;
- dimensions des motifs.

`chasseur.test.mjs` :
- `wander × poids` seul ;
- `wander + seek × 7` vers la proie la plus proche ;
- seuil strict de détection ;
- liste de proies vide ;
- anti-répétition du cri ;
- portée, impact unique à l'image 11, coup raté ;
- angles finis ;
- locomotion héritée ;
- orientation vers la cible ;
- `push` / `pop` équilibrés.

`soundbox.test.mjs` (faux `AudioContext` qui rejette, comme un navigateur, une rampe exponentielle vers une valeur ≤ 0) :
- aucun son avant `deverrouiller()` ;
- absence de Web Audio ;
- 3 à 5 gazouillis aigus ;
- les 5 recettes ;
- nom inconnu ;
- volume borné ;
- limite de voix ;
- `arreterTout` et `fermer` ;
- bruit créé une seule fois.

`scene.test.mjs` (faux DOM p5) :
- effectifs initiaux ;
- un libellé par curseur ;
- événement `input` qui met à jour l'affichage et les entités, sans toucher `maxForce` ;
- variation d'effectif avec identité conservée ;
- entrées invalides ;
- ouverture et fermeture par bouton, `P` et Échap ;
- nettoyage du panneau ;
- compteur ;
- clic sur un perroquet, dans le vide, dans le panneau ;
- glisser ;
- mort, plumes, sons, chasseur qui grossit ;
- plafond de plumes ;
- frappe de bout en bout à l'image 11 ;
- valeurs finies sur 30 images ;
- touches ;
- redimensionnement ;
- vecteurs non partagés.

### Validation dans le navigateur (p5 réel, Chromium)

- Rendu : ciel, sol, sprites, skin, frappe, plumes.
- Pas d'image fantôme après redimensionnement ; aucune erreur sur 120 images.
- Vrai clic qui déclenche `cuiPerroquet`.
- Signal mesuré avec un `AnalyserNode` : RMS de 0.011 à 0.028 pour chaque son, puis **0** après `arreterTout()`.

### Performance mesurée

| Situation | Avant le cache de sprites | Après |
|---|---:|---:|
| 80 perroquets | 23.5 ms par image | 4.1 ms par image |
| 250 perroquets | 85 ms par image | 14.6 ms par image |

---

## 13. Limites connues

- `Boid.boundaries` retourne la vitesse désirée au lieu d'une force de pilotage. C'est un défaut de la base, conservé volontairement.
- `largeurZoneEvitementDevantVaisseau` est calculée avec `r = 6` dans le constructeur de la base. Elle ne suit donc pas la taille réglée.
- La recherche de voisins reste en O(n²), comme dans la base (pas de grille spatiale).
- Le chasseur grossit sans limite ; le curseur « Taille » le réinitialise.
- `loadStrings` impose un serveur HTTP local : le mode `file://` n'est pas pris en charge.
- L'adaptateur de test ne prouve pas la compatibilité avec p5 ; le rendu et l'audio ont été validés à part, dans le navigateur.
