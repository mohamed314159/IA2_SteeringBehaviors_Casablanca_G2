# Perroquets Minecraft : ce qui a été fait

*Résumé pour un lecteur non spécialiste du code. La version technique est dans [SPECIFICATION_TECHNIQUE.md](SPECIFICATION_TECHNIQUE.md).*

## 1. Le point de départ

Le dossier contenait déjà une simulation de **boids**, un modèle inventé par Craig Reynolds en 1986. Des poissons y nageaient en banc sur un fond noir, et un requin les chassait.

Dans ce modèle, chaque animal ne regarde que ses voisins proches et applique trois règles simples :

| Règle | Ce que l'animal se dit |
|---|---|
| **Séparation** | « Je m'écarte de ceux qui sont trop près. » |
| **Alignement** | « Je vais dans la même direction que mes voisins. » |
| **Cohésion** | « Je me rapproche du centre de mon petit groupe. » |

Personne ne dirige le groupe. Le mouvement collectif naît de ces trois règles appliquées par chacun.

## 2. La règle principale : ne pas toucher au « cerveau »

On peut voir le programme en deux parties :

- **le cerveau** décide où chaque animal veut aller. Ce sont les règles et les calculs de forces du fichier `boids.js` ;
- **l'apparence** décide comment on le dessine, comment il sonne, et ce qu'on voit autour.

**Le cerveau n'a pas été modifié.** Le fichier d'origine est resté intact. On a seulement créé de « nouveaux animaux » qui en héritent : ils pensent exactement comme les poissons d'origine, mais ont un autre costume. En programmation, on appelle ça une *sous-classe* : on part d'un modèle existant et on ajoute ce qui manque, sans réécrire le modèle.

## 3. Ce qui a changé à l'écran

| Avant | Maintenant |
|---|---|
| Fond noir | Ciel bleu avec des nuages en blocs qui défilent et un soleil carré, au-dessus d'une bande d'herbe avec des fleurs |
| Poissons (images) | Perroquets en pixels, aux 5 couleurs des perroquets du jeu (rouge, bleu, vert, cyan, gris), qui battent des ailes |
| Requin rapide | Vieil homme aux cheveux et à la barbe blancs, armé d'une épée en diamant, qui avance lentement |
| Le requin « mange » le poisson | Le vieil homme arme son épée, frappe (avec une trace blanche de balayage), puis le perroquet meurt et ses plumes s'éparpillent |
| Curseurs posés sur le dessin | Petit bouton ⚙ discret qui ouvre ou ferme un panneau de réglages |
| Sons enregistrés du requin | Sons fabriqués par le programme : gazouillis, cri de mort, coup d'épée, impact, « Hmm ! » du vieil homme |

## 4. Ce que l'utilisateur peut faire

- **Cliquer sur un perroquet** : il pousse un petit gazouillis rapide, fait un saut et une note de musique ♪ apparaît. Les perroquets sont volontairement lents pour qu'on puisse les attraper.
- **Glisser la souris** sur le ciel : de nouveaux perroquets apparaissent.
- **Ouvrir les réglages** (⚙ ou touche `P`) et changer en direct :
  - pour les perroquets : nombre, taille, vitesse ;
  - pour les chasseurs : nombre, taille, vitesse ;
  - les « poids » des trois règles du groupe, c'est-à-dire l'importance donnée à chaque règle ;
  - les poids du chasseur : errer au hasard (*wander*) ou foncer sur sa cible (*seek*), et la distance à laquelle il repère un perroquet ;
  - le volume.
- **Touches** : `O` ajoute un buisson-obstacle, `R` donne des tailles au hasard, `D` affiche les zones invisibles (mode d'analyse).

## 5. Comment le chasseur décide

C'est exactement la logique de l'ancien requin :

1. il **erre** en permanence, en tournant un peu au hasard ;
2. s'il voit un perroquet à moins de 70 pixels, il **fonce** vers le plus proche ;
3. **nouveauté** : quand le perroquet est à portée d'épée, il lance un coup qui dure environ un tiers de seconde. Le perroquet meurt au milieu du geste s'il n'a pas réussi à s'éloigner ;
4. comme le requin, il **grossit** un peu à chaque prise.

De leur côté, les perroquets **fuient** dès que le chasseur s'approche trop. C'est aussi la règle d'origine.

## 6. Le « shader », expliqué simplement

Un **shader** est un petit programme exécuté par la carte graphique, qui calcule la couleur **de chaque point de l'écran en même temps**. Il n'y en a **qu'un seul**, pour le ciel. Pour chaque point, il se demande :

1. *« À quelle hauteur suis-je ? »* : plus on descend vers l'herbe, plus le bleu est clair ;
2. *« Suis-je dans le soleil ? »* : si oui, couleur jaune pâle ;
3. *« Suis-je dans un nuage ? »* : un tirage pseudo-aléatoire, toujours le même pour une case donnée, dit si la case de 12 pixels contient un bloc de nuage. Avec le temps, la grille glisse et les nuages défilent.

Pour aller plus vite et obtenir un rendu « pixelisé » comme dans Minecraft, le ciel est calculé en petit puis agrandi. L'herbe est dessinée une seule fois au démarrage, sans shader.

## 7. Les sons

Aucun fichier audio n'est utilisé. Les sons sont **fabriqués** à partir d'ondes simples, un peu comme un synthétiseur :

| Son | Quand | Recette en une phrase |
|---|---|---|
| Cui-cui | Clic sur un perroquet | 3 à 5 notes très aiguës et très courtes qui montent puis redescendent |
| Cri de mort | Perroquet touché | Une note rauque qui chute vite, avec un tremblement |
| Coup d'épée | Début de la frappe | Un souffle (bruit) dont le timbre monte vers l'aigu |
| Impact | L'épée touche | Un coup sourd très bref et un petit claquement |
| « Hmm ! » | Le chasseur repère une proie | Une voix grave qui monte puis descend |

Le fichier **`soundbox.html`** est une page qui affiche ces 5 sons avec un bouton « Écouter » pour chacun. Pour respecter les règles des navigateurs, aucun son ne joue avant le premier clic.

## 8. Comment on sait que ça marche

- **60 tests automatiques** vérifient le comportement. Exemples :
  - un perroquet calcule exactement les mêmes forces qu'un poisson d'origine ;
  - le chasseur n'attaque que si la proie est à portée ;
  - la proie meurt une seule fois, au bon moment ;
  - le son s'arrête vraiment quand on le coupe ;
  - les curseurs modifient bien tous les animaux.
- **Vérification dans un vrai navigateur** :
  - affichage du ciel et des personnages ;
  - vrai clic sur un perroquet ;
  - mort et plumes ;
  - mesure du signal sonore réel, puis retour au silence.
- **Fluidité** : un problème de lenteur a été trouvé et corrigé. Chaque perroquet est maintenant dessiné une seule fois sous forme de petite image réutilisée. Une image d'animation est passée de 23,5 ms à 4 ms avec 80 perroquets. Il faut moins de 16,7 ms pour atteindre 60 images par seconde.

## 9. Limites à connaître

- Le clic sur le ciel **n'ajoute plus d'obstacle** (il sert à faire chanter les perroquets) ; la touche `O` le fait toujours.
- Le chasseur grossit sans limite tant qu'il tue. Le curseur « Taille » des chasseurs le remet à la taille choisie.
- Il faut lancer l'exemple avec un petit serveur local, à cause du fichier du shader (voir le [README](README.md)).
