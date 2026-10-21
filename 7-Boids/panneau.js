// Panneau de réglages séparé du dessin : un petit bouton ⚙ en haut à droite
// l'ouvre ou le ferme (touche P aussi, Échap pour fermer).
// Le panneau est créé une seule fois dans setup().
// surChangement(cle, valeur) est appelé pendant le glissement d'un curseur.

function creerPanneauReglages(reglages, definitions, surChangement) {
  let ouvert = false;
  let dernierCompteur = null;

  const bouton = createButton('⚙');
  bouton.class('bouton-reglages');
  bouton.attribute('type', 'button');
  bouton.attribute('aria-label', 'Réglages (touche P)');
  bouton.attribute('title', 'Réglages (touche P)');
  bouton.attribute('aria-controls', 'panneau-reglages');
  bouton.attribute('aria-expanded', 'false');

  const panneau = createDiv();
  panneau.id('panneau-reglages');
  panneau.class('panneau-reglages');
  panneau.attribute('role', 'dialog');
  panneau.attribute('aria-label', 'Réglages');

  const entete = createDiv();
  entete.class('entete');
  entete.parent(panneau);
  createElement('h2', 'Réglages').parent(entete);
  const boutonFermer = createButton('✕');
  boutonFermer.attribute('type', 'button');
  boutonFermer.attribute('aria-label', 'Fermer les réglages');
  boutonFermer.class('fermer');
  boutonFermer.parent(entete);

  const compteur = createP('');
  compteur.class('compteur');
  compteur.attribute('aria-live', 'polite');
  compteur.parent(panneau);

  const curseurs = {};
  const groupes = {};
  for (const def of definitions) {
    if (groupes[def.groupe] === undefined) {
      const fieldset = createElement('fieldset');
      fieldset.parent(panneau);
      createElement('legend', def.groupe).parent(fieldset);
      groupes[def.groupe] = fieldset;
    }
    curseurs[def.cle] = creerLigneCurseur(def, reglages, groupes[def.groupe], surChangement);
  }

  const aide = createP('Clic : faire chanter un perroquet · glisser : en ajouter · O : feuillage · R : tailles · D : debug');
  aide.class('aide');
  aide.parent(panneau);

  function appliquerEtat() {
    if (ouvert) panneau.addClass('ouvert');
    else panneau.removeClass('ouvert');
    bouton.attribute('aria-expanded', ouvert ? 'true' : 'false');
  }

  function ouvrir() { ouvert = true; appliquerEtat(); }
  function fermer() { ouvert = false; appliquerEtat(); }
  function basculer() { ouvert = !ouvert; appliquerEtat(); }

  // 'click' fonctionne à la souris et au clavier (Entrée, Espace).
  bouton.elt.addEventListener('click', basculer);
  boutonFermer.elt.addEventListener('click', fermer);
  appliquerEtat();

  return {
    ouvrir,
    fermer,
    basculer,
    estOuvert: () => ouvert,
    curseurs,
    // N'écrit dans le DOM que si le nombre a changé.
    majCompteur(nombre) {
      if (nombre === dernierCompteur) return;
      dernierCompteur = nombre;
      compteur.html(`Perroquets en vie : ${nombre}`);
    },
    // Remet un curseur à une valeur (ex. : nombre après ajout à la souris).
    afficherValeur(cle, valeur) {
      const c = curseurs[cle];
      if (c === undefined) return;
      c.curseur.value(valeur);
      c.affichage.html(formaterValeur(valeur, c.def.pas));
    },
    retirer() {
      bouton.elt.removeEventListener('click', basculer);
      boutonFermer.elt.removeEventListener('click', fermer);
      bouton.remove();
      panneau.remove();
    }
  };
}

function creerLigneCurseur(def, reglages, parent, surChangement) {
  const id = `reglage-${def.cle}`;
  const ligne = createDiv();
  ligne.class('ligne');
  ligne.parent(parent);

  const etiquette = createElement('label', def.libelle);
  etiquette.attribute('for', id);
  etiquette.parent(ligne);

  const curseur = createSlider(def.min, def.max, reglages[def.cle], def.pas);
  curseur.id(id);
  curseur.parent(ligne);

  const affichage = createSpan(formaterValeur(reglages[def.cle], def.pas));
  affichage.class('valeur');
  affichage.parent(ligne);

  // 'input' : mise à jour immédiate pendant le glissement.
  curseur.input(() => {
    const valeur = Number(curseur.value());
    reglages[def.cle] = valeur;
    affichage.html(formaterValeur(valeur, def.pas));
    surChangement(def.cle, valeur);
  });

  return { def, curseur, affichage };
}
