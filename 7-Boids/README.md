# Boids — perroquets Minecraft

Une nuée de perroquets façon Minecraft (en 2D) vole dans un ciel pixelisé au-dessus de l'herbe. Un vieil homme aux cheveux blancs, armé d'une épée en diamant, les poursuit lentement. Quand il arrive à portée, il frappe, le perroquet meurt et ses plumes s'éparpillent.

## Ce qui n'a pas changé

La mécanique de l'exemple d'origine est conservée telle quelle. `boids.js` (classe `Boid`) et `obstacle.js` ne sont pas modifiés.

- **Perroquets** : `flock()` d'origine, soit alignement, cohésion, séparation, confinement (`boundaries`) et évitement d'obstacles, avec les mêmes formules et le même `maxForce = 0.2`. Chaque perroquet fuit chaque chasseur et l'obstacle de la souris avec `fleeWithTargetRadius` : zone = `r + 10`, force `flee × 100`.
- **Chasseur** (remplace le requin) : `wander × poidsWander` (1 par défaut), plus `seek × poidsSeek` (7 par défaut) vers le perroquet le plus proche s'il est à moins de `rayonDetection` (70 px). Il grossit de 1 px à chaque perroquet tué, comme le requin.

## Ce qui a été ajouté

| Fichier | Rôle |
|---|---|
| `perroquet.js` | `Perroquet extends Boid` : dessin en pixel art (5 couleurs du jeu), battement d'ailes, cri au clic. La fuite reprend le calcul de `Boid` ; le cercle rouge n'est dessiné qu'en mode debug. |
| `chasseur.js` | `Chasseur extends Boid` : skin du vieil homme, épée en diamant, animation de frappe (armer, frapper, revenir) avec une trace de balayage. |
| `plume.js` | Plumes décoratives (pas de steering) : gravité faible, frottement, balancement, durée de vie de 1,5 à 2,7 s. |
| `obstacleMinecraft.js` | `ObstacleMinecraft extends Obstacle` : bloc de feuillage. L'obstacle de la souris est invisible (visible en debug). |
| `decor.js` + `shaders/` | Ciel (shader) et herbe façon Minecraft. |
| `soundbox.js` + `soundbox.html` | Tous les sons, synthétisés. La page `soundbox.html` permet de les écouter. |
| `reglages.js`, `panneau.js` | Valeurs des réglages et panneau repliable. |
| `pixelart.js` | Aide pour dessiner un motif de pixels. |

### Frappe

La portée de l'épée vaut `0,8 × r` du chasseur, soit 32 px par défaut. Quand le perroquet le plus proche est à portée, la frappe dure 22 images. À la 11ᵉ image (impact), le perroquet est tué s'il est encore à moins de `1,6 × portée` ; sinon le coup est raté.

## Le shader utilisé

Il n'y a **qu'un seul shader** : celui du ciel, dans `shaders/ciel.vert` et `shaders/ciel.frag`.

Un shader est un petit programme exécuté par la carte graphique **pour chaque pixel**. Ici, il calcule la couleur de chaque pixel du ciel :

1. un **dégradé bleu** du haut de l'écran jusqu'à l'horizon, par bandes de 8 px ;
2. un **soleil carré** avec un halo ;
3. des **nuages en blocs** de 12 px, obtenus par un « bruit » pseudo-aléatoire, qui défilent avec le temps. Le bloc du bas de chaque nuage est un peu ombré.

- `ciel.vert` (vertex shader) étire simplement un rectangle sur tout le calque.
- `ciel.frag` (fragment shader) calcule la couleur.

Le ciel est calculé dans un calque WEBGL quatre fois plus petit que l'écran, puis agrandi sans lissage : c'est peu coûteux et cela donne l'aspect pixelisé. L'herbe, elle, est dessinée une seule fois en 2D, sans shader.

## Commandes

| Action | Effet |
|---|---|
| Clic sur un perroquet | Cui-cui rapide et petite note de musique |
| Glisser sur le ciel | Ajoute des perroquets |
| ⚙ (en haut à droite) ou `P` | Ouvre ou ferme le panneau de réglages ; `Échap` le ferme |
| `O` | Ajoute un feuillage (obstacle) sous la souris |
| `R` | Tailles aléatoires des perroquets |
| `D` | Mode debug (zones de détection, de portée, de fuite, vecteurs) |

Le clic ne crée plus d'obstacle : il sert à faire chanter les perroquets. La touche `O` le fait toujours.

## Réglages (panneau ⚙)

| Groupe | Réglage | Défaut | Plage |
|---|---|---|---|
| Perroquets | Nombre | 80 | 0–250 |
| | Taille (px, largeur du dessin = `r`) | 30 | 12–64 |
| | Vitesse max (`maxSpeed`, px/image) | 1,4 | 0,3–5 |
| Chasseurs | Nombre | 1 | 0–6 |
| | Taille (rayon `r`, px) | 40 | 20–90 |
| | Vitesse max (px/image) | 1,1 | 0,3–5 |
| Poids de la nuée | Alignement / Cohésion / Séparation | 1,5 / 1 / 3 | 0–2 / 0–2 / 0–15 |
| | Bords / Rayon de perception (px) | 10 / 25 | 0–15 / 15–60 |
| Poids des chasseurs | Wander / Seek | 1 / 7 | 0–5 / 0–15 |
| | Rayon de détection (px) | 70 | 20–300 |
| Son | Volume | 0,6 | 0–1 |

Les perroquets sont lents pour qu'on puisse cliquer dessus, et les chasseurs encore plus lents. `maxForce` n'est jamais modifié par les réglages.

## Sons (soundbox)

Ouvrir `soundbox.html` pour écouter chaque son. Ils sont tous synthétisés par la Web Audio API, sans fichier audio. Ils ne démarrent qu'après un premier clic ou une première touche (règle des navigateurs). Au plus 24 sons peuvent jouer en même temps.

| Nom | Quand |
|---|---|
| `cuiPerroquet` | Clic sur un perroquet |
| `mortPerroquet` | Perroquet touché |
| `coupEpee` | Début de la frappe |
| `impactEpee` | L'épée touche |
| `alerteChasseur` | Le chasseur repère un perroquet (au plus toutes les 2 s) |

## Lancement

Les shaders sont chargés par fichier : il faut un serveur local, par exemple depuis la racine du dépôt :

```bash
python -m http.server 8754
```

puis ouvrir `http://localhost:8754/7-Boids/`.

## Tests

Depuis `7-Boids` (Node.js 18+) :

```bash
node --test tests/*.test.mjs
```

Les tests utilisent un adaptateur p5 minimal (`tests/adaptateur-p5.mjs`) et un faux AudioContext. Ils ne remplacent pas la vérification dans le navigateur (rendu, audio réel).
