// Aide de dessin "pixel art" façon Minecraft.
// Un motif est un tableau de chaînes : chaque caractère désigne une couleur
// de la palette, '.' est transparent. Les pixels voisins de même couleur
// d'une ligne sont fusionnés en un seul rectangle pour limiter les appels.
// Cette fonction ne fait que dessiner : elle ne touche à aucune force.
// cible : un p5.Graphics optionnel (sinon on dessine sur le canvas). Dans
// un calque à 1 pixel par pixel de motif, on ne met pas de recouvrement.

// Léger recouvrement pour éviter les fines lignes entre deux rectangles
// lorsque la taille d'un pixel n'est pas un nombre entier.
const RECOUVREMENT_PIXEL = 0.35;

function dessinerMotif(motif, palette, x, y, taille, cible) {
  const dessin = cible || { fill, rect };
  const recouvrement = cible ? 0 : RECOUVREMENT_PIXEL;
  for (let ligne = 0; ligne < motif.length; ligne++) {
    const rangee = motif[ligne];
    let debut = 0;
    while (debut < rangee.length) {
      const code = rangee[debut];
      let fin = debut + 1;
      while (fin < rangee.length && rangee[fin] === code) fin++;
      const couleur = palette[code];
      if (code !== '.' && couleur !== undefined) {
        dessin.fill(couleur);
        dessin.rect(
          x + debut * taille,
          y + ligne * taille,
          (fin - debut) * taille + recouvrement,
          taille + recouvrement
        );
      }
      debut = fin;
    }
  }
}
