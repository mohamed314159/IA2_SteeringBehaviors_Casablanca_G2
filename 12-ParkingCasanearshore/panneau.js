// Panneau de réglages (repris de 7-Boids/panneau.js) : un bouton ⚙ l'ouvre
// ou le ferme (touche P aussi, Échap pour fermer). Créé une seule fois dans
// setup(). surChangement(cle, valeur) est appelé pendant le glissement.

function creerPanneauReglages(reglages, definitions, surChangement) {
  let ouvert = false;

  const bouton = createButton("⚙ Réglages");
  bouton.class("bouton-reglages");
  bouton.attribute("type", "button");
  bouton.attribute("aria-label", "Réglages par comportement (touche P)");
  bouton.attribute("title", "Réglages par comportement (touche P)");
  bouton.attribute("aria-controls", "panneau-reglages");
  bouton.attribute("aria-expanded", "false");

  const panneau = createDiv();
  panneau.id("panneau-reglages");
  panneau.class("panneau-reglages");
  panneau.attribute("role", "dialog");
  panneau.attribute("aria-label", "Réglages par comportement");

  const entete = createDiv();
  entete.class("entete");
  entete.parent(panneau);
  createElement("h2", "Réglages par comportement").parent(entete);
  const boutonFermer = createButton("✕");
  boutonFermer.attribute("type", "button");
  boutonFermer.attribute("aria-label", "Fermer les réglages");
  boutonFermer.class("fermer");
  boutonFermer.parent(entete);

  const boutonDefaut = createButton("Valeurs par défaut");
  boutonDefaut.attribute("type", "button");
  boutonDefaut.class("defaut");
  boutonDefaut.parent(panneau);

  const curseurs = {};
  const groupes = {};
  for (const def of definitions) {
    if (groupes[def.groupe] === undefined) {
      const fieldset = createElement("fieldset");
      fieldset.parent(panneau);
      createElement("legend", def.groupe).parent(fieldset);
      groupes[def.groupe] = fieldset;
    }
    curseurs[def.cle] = creerLigneCurseur(def, reglages, groupes[def.groupe], surChangement);
  }

  function appliquerEtat() {
    if (ouvert) panneau.addClass("ouvert");
    else panneau.removeClass("ouvert");
    bouton.attribute("aria-expanded", ouvert ? "true" : "false");
  }

  function ouvrir() { ouvert = true; appliquerEtat(); }
  function fermer() { ouvert = false; appliquerEtat(); }
  function basculer() { ouvert = !ouvert; appliquerEtat(); }

  function remettreParDefaut() {
    for (const def of definitions) {
      const [groupe, nom] = def.cle.split(".");
      const v = ecrireReglage(reglages, def.cle, REGLAGES_INITIAUX[groupe][nom]);
      afficherValeur(def.cle, v);
      surChangement(def.cle, v);
    }
  }

  function afficherValeur(cle, valeur) {
    const c = curseurs[cle];
    if (c === undefined) return;
    c.curseur.value(valeur);
    c.affichage.html(formaterValeur(valeur, c.def.pas));
  }

  // 'click' fonctionne à la souris et au clavier (Entrée, Espace).
  bouton.elt.addEventListener("click", basculer);
  boutonFermer.elt.addEventListener("click", fermer);
  boutonDefaut.elt.addEventListener("click", remettreParDefaut);
  appliquerEtat();

  return {
    ouvrir,
    fermer,
    basculer,
    estOuvert: () => ouvert,
    curseurs,
    afficherValeur,
    retirer() {
      bouton.elt.removeEventListener("click", basculer);
      boutonFermer.elt.removeEventListener("click", fermer);
      boutonDefaut.elt.removeEventListener("click", remettreParDefaut);
      bouton.remove();
      panneau.remove();
    }
  };
}

function creerLigneCurseur(def, reglages, parent, surChangement) {
  const id = `reglage-${def.cle.replace(".", "-")}`;
  const ligne = createDiv();
  ligne.class("ligne");
  ligne.parent(parent);

  const etiquette = createElement("label", def.libelle);
  etiquette.attribute("for", id);
  etiquette.parent(ligne);

  const valeur = lireReglage(reglages, def.cle);
  const curseur = createSlider(def.min, def.max, valeur, def.pas);
  curseur.id(id);
  curseur.parent(ligne);

  const affichage = createSpan(formaterValeur(valeur, def.pas));
  affichage.class("valeur");
  affichage.parent(ligne);

  // 'input' : mise à jour immédiate pendant le glissement.
  curseur.input(() => {
    const v = ecrireReglage(reglages, def.cle, curseur.value());
    affichage.html(formaterValeur(v, def.pas));
    surChangement(def.cle, v);
  });

  return { def, curseur, affichage };
}
