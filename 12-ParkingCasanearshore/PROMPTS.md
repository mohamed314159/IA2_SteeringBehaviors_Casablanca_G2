# Prompts du projet 12 — Parking Casanearshore

Tous les messages tapés pendant la conception et le développement de la simulation, **mot pour mot** (orthographe d'origine conservée), dans l'ordre, avec leur date (heure de Casablanca). Ils sont extraits de l'historique de la session de travail avec l'assistant (Claude Code).

Les réponses données aux questions à choix de l'assistant figurent à leur place, en citation. Le message 20 (« Réessayez ») relance une réponse interrompue.

## Découverte du cours

### 1. 19 octobre à 15:03

> @"C:\Users\user\Downloads\Steering behaviors Master Miage IA2 (1).pdf"
> print moi les titres de tout les steering behaviours vu en classe

### 2. 19 octobre à 15:05

> oublie les comportements évolutifs

## Choix du projet (dossier 12)

### 3. 20 octobre à 23:30

> je veux que tu fasse un folder 12, où tu implémentes dans un même index.html tout les comportement 1 à 8 en faisant un jeu
> propose moi des jeux

### 4. 20 octobre à 23:31

> quelque chose de plus originale et compréhensible en 15 minutes

### 5. 20 octobre à 23:32

> aucun je veux quelque chose de réel comme dans une entreprise à casanearshore

### 6. 20 octobre à 23:34

> j'aime ces idée propose moi d'autre qui me plairont plus

### 7. 20 octobre à 23:46

> le 4 je veux que tu proposes plus de comportements arrive

### 8. 20 octobre à 23:48

> regarde un plan de casa nearshore, je veux qu'on puisse aussi entrer dans le garage, cherche les plan de garage

### 9. 20 octobre à 23:50

> tu peux faire la même carte de casanearshore et faire des batiments dans l'endroit des batiments

### 10. 20 octobre à 23:53

> fais moi le tableau de comportements montre moi le design des voitures

### 11. 20 octobre à 23:58

> je veux voir les étapes que tu vas faire n'oublie pas les règles spécifé dans le dossier architecture.md du dépat github micbuffa

### 12. 21 octobre à 00:04

> je veux que tu me décrives les étapes

## Version 1 : cahier des charges et développement

### 13. 21 octobre à 00:18

> je veux que les voitues arrivent aux garages et disparaissent, je peux cliquer sur un bouton pour voir le garage à l'intérieur, je veux seulement des véhicules de luxes comme voitures par défaut, navette g4s, et un tram qui utilise le même mécanisme que snake avec 2 longues caisses, tu sais que le tram arrive en haut du casa nearshore et les gens descendent, je veux des hommes avec costumes cravates, ou chemise bleu et divers tenues professionnelles, chaque voiture entre dans le décore à partir de la bordure de la map puis entre dans casanearshore à partir de la porte sud ou de la parte nord, quand elle entre sa place est attribuée et ne fait pas de wonder, les employés avant 8h55 font du wonder et boivent du café et discutent en groupes, à 8h55 chacun fait arrive dans un batiment et disparait, les employé qui sortent du tramways après avoir fini son arrive, marchent en groupes, quand ils entrent, certains marchent en groupe s'ils ont les mêmes batiments de travails ou bien un leader et les autres le suivent en formation, après que les voitures finissents leurs arrive, les employés qui sortent font arrive dans leurs batiments et disparaissent idem pour ceux au garage,
> est ce que tout les comportements sont implémentés ?

### 14. 21 octobre à 00:24

> je veux que tu implémentes tes propositions, c'est juste une simulation, donne moi les étpae du développement de jeu, je veux que pour chaque comportement je puisse controler la vitesse et la taille comme ce qu'on a fait avec le jeu du chasseur de perroquets, les étapes:

### 15. 21 octobre à 00:30

> tu as vu la derniere version de micbuffa dans github ? celle que je possède est ancienne, pourquoi implémenter le vehicle.js du dossier 6 seulement ?, hypothèse fausses il y a plein de parkings dans la carte chaque voiture connait sa place lorsqu'elle entre à casanearshore, fait en sorte d'accélerer le temps quand rien ne se passe

### 16. 21 octobre à 00:31

> tu dois t'inspirer de tout les dossiers

### 17. 21 octobre à 00:32

> donne moi les étapes

### 18. 21 octobre à 00:34

> on commence

## Version 2

### 19. 21 octobre à 08:44

> où est le shore 28 ? tu n'as pas inclu d'autres shores aussi, pourquoi le tramway est minuscul il doit couvrir une distance plus grande, essaye de faire une recherche web sur l'image de chaque shore et d'essayer de la retranscrire à la place de simples rectangles, les arbres aussi les parcs, situe le terrain de paddle et place le aussi, la pelouse, la station tram, les gardiens de sécurités en blancs, simuler le décor de maniere réalisiste, utilise les shaders pour faire de bons paysages, les restaurants tu ne les as pas mis, il y a aussi un batiment pour l'uir qui est presque au milieu, dans la vraie vie il y a des stands de vente de café juste à côté où les employés discutent avant 8h55, ne fais pas disparaitre les gens en accélérant, l'acclération automatique doit se passer quand tout le mondre est enté travailler, les employés ne partages pas la même route que les voitures, dans les espaces où il n'y a pas d'arbres il y a des espaces où les gens peuvent marcher et des bancs où ils peuvent s'asseoire, il y a aussi les trottoirs, fait une recherche pour savoir les espaces où les gens marchents, les chemins, les points de rassemblements, tout doit avoir un minimum d'exactitude avec la réalité sinon on fait l'approche plus problable, enleve le mot 'leader' en dessus des voitures, laisse 'leader' pour les voiture g4s qui se déplacent en groupent de 4 avec un leader, simule quelques petits oiseaux comme missile à tête chercheuse implémenté dans 10 qui doivent s'entrainer à capturer un morceau de pain qui se déplace aléatoirement dans la carte, s'ils s'arrêtent sans avoir capturé le pain ils disparaissent pour réapparaitre avec des nouveaux parametres, celui qui est allé plus loin est cloné pour en faire d'autres jusqu'à ce qu'ils arrivents met 8 neurones seulement dans la couche caché, enleve le "Pursue (badge oublié)" enleve le copyright je ne vais pas vendre ce projet ou le rendre public, fais plus de recherche poussé sur l'exterieur du parc casanearshore pour comprenre mieux comment il est, si 9h05 fin de matinée commence automatiquement une autre matinée enleve ces cases moches 'pause', "x1' 'x2'  'x4' et les carré à coché, insere le détail des place libres etc dans les reglages, et met les bouton en plus petit et soit concis dans leur descriptions met des jolis bouton, enleve l'heure en gros et met une seulement avec l'heure et minute en plus ptit, avant de commencer le jeu je veux une interface qui décrit le jeu très en détail, sur ce que chaque bouton fait, comme ça tu enleveras aussi les boutons au lieu de les mettre petit, en bref le détail des comportements avec un peu d'images avec un bouton pour commencer en bas, avant de modfier quoi que ce soit je veux pouvoir retourner à ces modifications via github

**Réponses aux questions de l'assistant (21 octobre à 09:00)**

- *Sans le badge oublié, quel scénario doit illustrer le comportement Pursue ?*
  > tu ajoute un ou 2 chats qui poursuivent un papillon et l'attrape, quand un d'eux l'attrape, un autre papillon apparait
- *Que faire de la navette G4S existante ?*
  > Remplacer par le convoi
- *Où placer le terrain de padel ?*
  > abondonne le
- *Quel bâtiment est celui de l'UIR, « presque au milieu » ?*
  > tu vois l'espece de route qui constitue un cercle au mileu de casa nearshore, en son milieu il y a une piscine un petit peu au nord de cette piscine y a ce batiment, sinon il ne differe pas trop des autes

### 20. 21 octobre à 15:10

> Réessayez

## Version 3 : visibilité des véhicules, retrouver un comportement, mode noir

### 21. 21 octobre à 18:21

> j'aime le rendu de cette 2eme version je suis satisfait, je veux que tu mette un peu les vehicule en brillance les couleurs lumineuses avalent les véhicules et les rendent presque invisible, dans le menu en paramètres, mettre pour chaque comportement quelque chose qui me permet de le retrouver dans la carte s'il y est actuellement, je veux un bouton qui rend tout en noir et laisse juste les vehicules si on veut voir juste eux

## Publication

### 22. 21 octobre (soir)

> après que je te valide le commit écrit dans un readme que je veux qu'il voit les projets f1 et le parking en essentiel puis celui de boids en second car c juste une implémentation du jeu de requins, dans un readme, je veux que tu enleves tout les folders et ne laisser que ces 3 projets dans dépot je veux que tu m'aides à héberger sur github "pagiz" (jsp si ça se dit comme ça)
> pour se projet aussi un fichier architecture.md pour lui seul avec toute les étapes, aussi un fichier prompts.md avec tout les prompts que je t'ai tapé,
