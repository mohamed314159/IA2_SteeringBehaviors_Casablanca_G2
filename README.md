# IA2 — Steering behaviors · Casablanca G2

Mes projets du cours IA2 sur les *steering behaviors* de Craig Reynolds, en JavaScript et p5.js.

**Site en ligne : <https://mohamed314159.github.io/IA2_SteeringBehaviors_Casablanca_G2/>**

## À voir en priorité

### 1. F1 Neuroévolution — [`11-F1-NeuroEvolution/`](11-F1-NeuroEvolution/)

Des voitures de Formule 1 apprennent à piloter seules par **neuro-évolution** : des rayons capteurs alimentent un réseau de neurones configurable depuis l'interface, et un algorithme génétique fait évoluer chaque lignée de génération en génération.

- 8 circuits inspirés de la F1, dont 2 extrêmes, et 50 niveaux d'entraînement enchaînés automatiquement.
- Vitrines des voitures, des circuits et des obstacles ; éditeur d'obstacles et de rayons.
- Sauvegarde et chargement d'un modèle ; accélération de la simulation jusqu'à ×100.
- Décors en shader, désactivables.

▶ [Lancer](https://mohamed314159.github.io/IA2_SteeringBehaviors_Casablanca_G2/11-F1-NeuroEvolution/) · [README](11-F1-NeuroEvolution/README.md) · [Architecture et étapes](11-F1-NeuroEvolution/ARCHITECTURE.md)

### 2. Parking Casanearshore — [`12-ParkingCasanearshore/`](12-ParkingCasanearshore/)

Une matinée de 8h30 à 9h05 au parc d'affaires Casanearshore, sur la vraie carte OpenStreetMap, où l'on voit à l'œuvre **les 8 comportements du cours** :

| Comportement | Où le voir |
|---|---|
| Seek | Retardataires qui courent vers leur porte |
| Pursue / Evade | Chats qui chassent un papillon ; piétons qui s'écartent des voitures |
| Arrive | Voitures sur leur place, tram au quai, employés à leur porte |
| Wander | Employés qui flânent près des stands de café |
| Path following | Voitures sur les vraies routes, tram sur ses rails, piétons sur les trottoirs |
| Obstacle avoidance | Piétons autour des bâtiments, voitures autour des poteaux des garages |
| Boids | Collègues qui descendent du tram et marchent ensemble |
| Leader following | Convoi G4S de quatre véhicules |

En plus : six garages souterrains visitables, des oiseaux neuro-évolutifs (8 neurones cachés) qui apprennent à attraper un morceau de pain, un écran d'accueil qui explique tout, un bouton « Voir sur la carte » pour chaque comportement et 122 tests.

▶ [Lancer](https://mohamed314159.github.io/IA2_SteeringBehaviors_Casablanca_G2/12-ParkingCasanearshore/) · [README](12-ParkingCasanearshore/README.md) · [Architecture et étapes](12-ParkingCasanearshore/ARCHITECTURE.md) · [Prompts](12-ParkingCasanearshore/PROMPTS.md)

## En second

### 3. Boids — [`7-Boids/`](7-Boids/)

Une implémentation du jeu des requins vu en cours : les boids deviennent des perroquets façon Minecraft (alignement, cohésion, séparation, fuite), et le requin devient un vieux chasseur armé d'une épée en diamant (wander, puis seek vers le perroquet le plus proche).

▶ [Lancer](https://mohamed314159.github.io/IA2_SteeringBehaviors_Casablanca_G2/7-Boids/) · [README](7-Boids/README.md)

## Lancer en local

Les projets n'ont besoin d'aucune installation, mais certains chargent des fichiers (shaders, sons) : il faut les ouvrir par un petit serveur web. Depuis la racine du dépôt :

```bash
python -m http.server 8000
```

puis ouvrir <http://localhost:8000>.

Chaque projet a ses tests, à lancer depuis son dossier avec Node.js 18 ou plus :

```bash
node --test tests/*.test.mjs
```

## Origine

Le dépôt de départ est celui du cours (micbuffa/IA2_SteeringBehaviors_Casablanca_G2). Les exemples du cours restent dans l'historique Git et sur la branche `f1-neuroevolution` ; cette branche principale ne garde que ces trois projets.
