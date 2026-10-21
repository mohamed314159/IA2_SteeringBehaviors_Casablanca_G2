// Panneau de réglages (repris de 7-Boids/panneau.js) : un petit bouton ⚙
// l'ouvre ou le ferme (touche P aussi, Échap pour fermer). Créé une seule fois
// dans setup(). surChangement(cle, valeur) est appelé pendant le glissement.
// En tête du panneau, une zone d'informations (places libres, statistiques)
// que le sketch remplit avec afficherInfos(html). Dans chaque groupe de
// comportement (options.comportements), une ligne « Voir sur la carte »
// indique combien d'entités l'exécutent en ce moment (majComptes) et appelle
// options.surLocaliser(groupe) au clic.

function creerPanneauReglages(reglages, definitions, surChangement, options = {}) {
  let ouvert = false;

  const bouton = createButton("⚙");
  bouton.class("icone");
  if (options.parentBouton) bouton.parent(options.parentBouton);
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
  createElement("h2", "Réglages").parent(entete);
  const boutonFermer = createButton("✕");
  boutonFermer.attribute("type", "button");
  boutonFermer.attribute("aria-label", "Fermer les réglages");
  boutonFermer.class("fermer");
  boutonFermer.parent(entete);

  const infos = createDiv();
  infos.class("infos");
  infos.parent(panneau);

  const boutonDefaut = createButton("Valeurs par défaut");
  boutonDefaut.attribute("type", "button");
  boutonDefaut.class("defaut");
  boutonDefaut.parent(panneau);

  const curseurs = {};
  const groupes = {};
  const localisateurs = {};
  for (const def of definitions) {
    if (groupes[def.groupe] === undefined) {
      const fieldset = createElement("fieldset");
      fieldset.parent(panneau);
      createElement("legend", def.groupe).parent(fieldset);
      groupes[def.groupe] = fieldset;
      const cleGroupe = def.cle.split(".")[0];
      if (options.comportements && options.comportements[cleGroupe]) {
        localisateurs[cleGroupe] = creerLigneLocaliser(cleGroupe, options.comportements[cleGroupe].nom, fieldset, options.surLocaliser);
      }
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
    afficherInfos(html) {
      infos.html(html);
    },
    // Nombre d'entités par comportement : texte et bouton (désactivé à 0).
    majComptes(comptes) {
      for (const [cle, l] of Object.entries(localisateurs)) {
        const n = comptes[cle] ?? 0;
        const texte = n === 0 ? "aucun en ce moment" : n === 1 ? "1 en ce moment" : `${n} en ce moment`;
        if (l.compte.html() !== texte) l.compte.html(texte);
        l.bouton.elt.disabled = n === 0;
      }
    },
    afficherValeur,
    retirer() {
      bouton.elt.removeEventListener("click", basculer);
      boutonFermer.elt.removeEventListener("click", fermer);
      boutonDefaut.elt.removeEventListener("click", remettreParDefaut);
      for (const l of Object.values(localisateurs)) l.retirer();
      bouton.remove();
      panneau.remove();
    }
  };
}

// Ligne « Voir sur la carte » d'un comportement : compteur et bouton.
function creerLigneLocaliser(cleGroupe, nom, parent, surLocaliser) {
  const ligne = createDiv();
  ligne.class("localiser");
  ligne.parent(parent);
  const compte = createSpan("…");
  compte.class("compte");
  compte.parent(ligne);
  const bouton = createButton("📍 Voir sur la carte");
  bouton.attribute("type", "button");
  bouton.attribute("aria-label", `Montrer sur la carte une entité qui fait ${nom} (cliquer encore : la suivante)`);
  bouton.attribute("title", `Montrer une entité qui fait ${nom} ; cliquer encore pour la suivante`);
  bouton.parent(ligne);
  const auClic = () => surLocaliser && surLocaliser(cleGroupe);
  bouton.elt.addEventListener("click", auClic);
  return {
    compte,
    bouton,
    retirer() {
      bouton.elt.removeEventListener("click", auClic);
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
