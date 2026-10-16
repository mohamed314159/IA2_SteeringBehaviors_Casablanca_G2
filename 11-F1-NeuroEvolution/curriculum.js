// Parcours d'entraînement : enchaîne les niveaux (training-circuits-data.js).
// Une lignée valide un niveau quand le meilleur d'une de ses générations a
// bouclé le tour demandé sur ce circuit. Quand toutes les lignées entraînées
// ont validé le niveau, on passe automatiquement au suivant.
class Curriculum {
  // levelKeys : clés des niveaux dans l'ordre ; lineages : clés des lignées.
  constructor(levelKeys, lineages) {
    if (levelKeys.length === 0) throw new Error("Aucun niveau d'entraînement");
    this.levelKeys = levelKeys.slice();
    this.lineages = lineages.slice();
    this.index = 0;
    this.passed = new Map(this.lineages.map((key) => [key, new Set()]));
    this.passedAt = new Map(); // lignée → génération à laquelle elle a tout validé
  }

  get currentLevel() {
    return this.finished ? null : this.levelKeys[this.index];
  }

  get finished() {
    return this.index >= this.levelKeys.length;
  }

  hasPassed(lineage, levelKey = this.currentLevel) {
    return this.passed.get(lineage)?.has(levelKey) ?? false;
  }

  // Marque le niveau courant comme validé par une lignée (tour bouclé, ou
  // circuit déjà validé auparavant d'après le garage).
  markPassed(lineage, generation = null) {
    if (this.finished || !this.passed.has(lineage)) return;
    this.passed.get(lineage).add(this.currentLevel);
    if (this.index === this.levelKeys.length - 1 && generation !== null) this.passedAt.set(lineage, generation);
  }

  // Lignées qui n'ont pas encore validé le niveau courant.
  remainingLineages() {
    return this.finished ? [] : this.lineages.filter((lineage) => !this.hasPassed(lineage));
  }

  // Passe au niveau suivant si toutes les lignées ont validé le niveau courant.
  // Retourne "level-passed", "finished" ou "continue".
  advanceIfComplete() {
    if (this.finished) return "finished";
    if (this.remainingLineages().length > 0) return "continue";
    this.index++;
    return this.finished ? "finished" : "level-passed";
  }

  // À appeler en fin de génération avec, pour chaque lignée, son meilleur
  // { progress, raceLaps, generation }. Retourne "level-passed", "finished" ou
  // "continue".
  recordGeneration(bestByLineage) {
    if (this.finished) return "finished";
    for (const [lineage, best] of bestByLineage) {
      if (best.progress >= (best.raceLaps ?? 1)) this.markPassed(lineage, best.generation);
    }
    return this.advanceIfComplete();
  }
}
