// Chasseur : un vieil homme aux cheveux blancs (skin Minecraft, vu de face)
// qui tient une épée en diamant. Il remplace le requin de l'exemple d'origine
// avec EXACTEMENT les mêmes comportements :
// - wander en permanence (poids poidsWander, 1 par défaut) ;
// - seek vers le perroquet le plus proche s'il est dans rayonDetection
//   (poids poidsSeek, 7 par défaut), comme le requin.
// La sous-classe ajoute une animation de frappe : quand une proie est à
// portée d'épée, il arme puis frappe ; la proie est touchée à mi-animation.

class Chasseur extends Boid {
  // Pixel art du skin (unités : 1/20 du rayon r).
  // H cheveux, h cheveux ombrés, s peau, n nez, e blanc des yeux, b iris,
  // w barbe, m moustache, C gilet, c chemise, L ceinture, P pantalon,
  // p pantalon ombré, Z chaussures.
  static PALETTE = {
    H: '#f2f2f2', h: '#cfcfcf', s: '#e2ad8b', n: '#c78e6d', e: '#ffffff', b: '#3d5aa8',
    w: '#ececec', m: '#d2d2d2', C: '#6e4f3a', c: '#ddd5c4', L: '#3e2b1f',
    P: '#4b4d57', p: '#3e4048', Z: '#33261b'
  };

  static TETE = [
    'HHHHHHHH',
    'HHhHHhHH',
    'HssssssH',
    'HHHssHHH',
    'HebssbeH',
    'HssnnssH',
    'wwmmmmww',
    'wwwwwwww'
  ];

  static CORPS = [
    'CwwwwwwC',
    'CCwwwwCC',
    'CCCccCCC',
    'CCCccCCC',
    'CCCccCCC',
    'CCCccCCC',
    'CCCccCCC',
    'LLLLLLLL',
    'CCCccCCC',
    'CCCccCCC',
    'CCCccCCC',
    'CCCccCCC'
  ];

  static JAMBES = [
    'PPPppPPP', 'PPPppPPP', 'PPPppPPP', 'PPPppPPP', 'PPPppPPP',
    'PPPppPPP', 'PPPppPPP', 'PPPppPPP', 'PPPppPPP',
    'ZZZZZZZZ', 'ZZZZZZZZ', 'ZZZZZZZZ'
  ];

  static BRAS = [
    'CCCC', 'CCCC', 'CCCC', 'CCCC', 'CCCC', 'CCCC',
    'CCCC', 'CCCC', 'CCCC', 'ssss', 'ssss', 'ssss'
  ];

  // Couleurs de l'épée en diamant.
  static EPEE = { manche: '#6b4a2b', pommeau: '#1a6f63', garde: '#1f8f80', contour: '#0f5c52', lame: '#3fe6cf', reflet: '#b5fff3' };

  // Angles du bras armé (radians, 0 = bras pendant vers le bas,
  // négatif = vers l'avant/le haut).
  static ANGLE_REPOS = -0.9;
  static ANGLE_ARME = -2.6;
  static ANGLE_FIN_FRAPPE = 0.5;

  constructor(x, y) {
    super(x, y);
    // Valeurs du requin d'origine (rayon, vitesse, force).
    this.r = 40;
    this.maxSpeed = 7;
    this.maxForce = 0.5;

    // Sélection d'action : poids et rayon de détection du requin d'origine.
    this.poidsWander = 1;
    this.poidsSeek = 7;
    this.rayonDetection = 70;
    this.enChasse = false;
    this.cible = null;
    // Images minimales entre deux cris d'alerte (son de début de chasse).
    this.delaiEntreCris = 120;
    this.imagesDepuisCri = this.delaiEntreCris;

    // Frappe : durée en images ; la proie est touchée à mi-animation
    // si elle est encore à moins de portee * toleranceImpact.
    this.dureeFrappe = 22;
    this.toleranceImpact = 1.6;
    this.frappe = null;

    // Animation visuelle.
    this.regardeADroite = true;
    this.pas = 0;
  }

  // Même logique que le requin dans le sketch d'origine :
  // wander * poidsWander, puis seek * poidsSeek vers le boid le plus proche
  // s'il est à moins de rayonDetection.
  // Retourne { proie, debutDeChasse } ; debutDeChasse sert à jouer le son.
  chasser(proies) {
    const wanderForce = this.wander();
    wanderForce.mult(this.poidsWander);
    this.applyForce(wanderForce);

    const etaitEnChasse = this.enChasse;
    this.enChasse = false;
    this.cible = null;

    const plusProche = this.getVehiculeLePlusProche(proies);
    if (plusProche) {
      const d = p5.Vector.dist(this.pos, plusProche.pos);
      if (d < this.rayonDetection) {
        const seekForce = this.seek(plusProche.pos);
        seekForce.mult(this.poidsSeek);
        this.applyForce(seekForce);
        this.enChasse = true;
        this.cible = plusProche;
      }
    }

    this.imagesDepuisCri++;
    let debutDeChasse = false;
    if (this.enChasse && !etaitEnChasse && this.imagesDepuisCri >= this.delaiEntreCris) {
      debutDeChasse = true;
      this.imagesDepuisCri = 0;
    }
    return { proie: this.cible, debutDeChasse };
  }

  // Portée de l'épée, proportionnelle à la taille du chasseur.
  porteeEpee() {
    return this.r * 0.8;
  }

  peutFrapper(proie) {
    return this.frappe === null && proie !== null && proie !== undefined &&
      this.pos.dist(proie.pos) < this.porteeEpee();
  }

  commencerFrappe(proie) {
    if (this.frappe !== null) return false;
    this.frappe = { cible: proie, t: 0, impact: false };
    return true;
  }

  estEnTrainDeFrapper() {
    return this.frappe !== null;
  }

  // Avance l'animation d'une image. Retourne la proie touchée à l'image
  // d'impact (une seule fois), sinon null.
  avancerFrappe() {
    if (this.frappe === null) return null;

    this.frappe.t++;
    let touchee = null;
    const imageImpact = Math.round(this.dureeFrappe * 0.5);
    if (!this.frappe.impact && this.frappe.t >= imageImpact) {
      this.frappe.impact = true;
      const cible = this.frappe.cible;
      if (this.pos.dist(cible.pos) < this.porteeEpee() * this.toleranceImpact) {
        touchee = cible;
      }
    }
    if (this.frappe.t >= this.dureeFrappe) this.frappe = null;
    return touchee;
  }

  // Angle du bras qui tient l'épée : repos, armement, frappe, retour.
  angleBrasEpee() {
    const repos = Chasseur.ANGLE_REPOS + Math.sin(this.pas) * 0.06;
    if (this.frappe === null) return repos;

    const p = this.frappe.t / this.dureeFrappe;
    if (p < 0.4) {
      const k = p / 0.4;
      return repos + (Chasseur.ANGLE_ARME - repos) * (1 - (1 - k) * (1 - k));
    }
    if (p < 0.55) {
      const k = (p - 0.4) / 0.15;
      return Chasseur.ANGLE_ARME + (Chasseur.ANGLE_FIN_FRAPPE - Chasseur.ANGLE_ARME) * k;
    }
    const k = Math.min(1, (p - 0.55) / 0.45);
    return Chasseur.ANGLE_FIN_FRAPPE + (repos - Chasseur.ANGLE_FIN_FRAPPE) * k;
  }

  // Locomotion héritée, puis animation visuelle.
  update() {
    super.update();
    this.animer();
  }

  animer() {
    this.pas += 0.08 + this.vel.mag() * 0.12;
    // Pendant la chasse, il regarde sa cible ; sinon sa direction de marche.
    const dx = this.cible ? this.cible.pos.x - this.pos.x : this.vel.x;
    const seuil = this.cible ? 2 : 0.15 * this.maxSpeed;
    if (dx > seuil) this.regardeADroite = true;
    else if (dx < -seuil) this.regardeADroite = false;
  }

  show() {
    const u = this.r / 20;
    const rebond = -Math.abs(Math.sin(this.pas)) * u * 0.8;

    if (Boid.debug) this.dessinerDebug();

    push();
    translate(this.pos.x, this.pos.y + rebond);
    if (!this.regardeADroite) scale(-1, 1);
    noStroke();

    // Ombre légère sous les pieds.
    fill(0, 0, 0, 40);
    ellipse(0, 17 * u, 10 * u, 2.5 * u);

    dessinerMotif(Chasseur.BRAS, Chasseur.PALETTE, -8 * u, -8 * u, u);
    dessinerMotif(Chasseur.JAMBES, Chasseur.PALETTE, -4 * u, 4 * u, u);
    dessinerMotif(Chasseur.CORPS, Chasseur.PALETTE, -4 * u, -8 * u, u);
    dessinerMotif(Chasseur.TETE, Chasseur.PALETTE, -4 * u, -16 * u, u);

    this.dessinerBrasEtEpee(u);
    pop();
  }

  // Bras droit + épée, tournés autour de l'épaule.
  dessinerBrasEtEpee(u) {
    const angle = this.angleBrasEpee();
    push();
    translate(6 * u, -7 * u);

    this.dessinerBalayage(u);

    rotate(angle);
    dessinerMotif(Chasseur.BRAS, Chasseur.PALETTE, -2 * u, -1 * u, u);
    // L'épée part de la main, lame dirigée selon l'axe x local du bras.
    translate(0, 9.5 * u);
    this.dessinerEpee(u * 0.95);
    pop();
  }

  dessinerEpee(su) {
    const c = Chasseur.EPEE;
    noStroke();
    fill(c.pommeau);
    rect(-5 * su, -1 * su, 1.2 * su, 2 * su);
    fill(c.manche);
    rect(-3.9 * su, -0.6 * su, 4 * su, 1.2 * su);
    fill(c.contour);
    rect(0, -2.6 * su, 1.4 * su, 5.2 * su);
    fill(c.garde);
    rect(0.2 * su, -2.2 * su, 1 * su, 4.4 * su);
    fill(c.contour);
    rect(1.3 * su, -1.4 * su, 11 * su, 2.8 * su);
    rect(12.2 * su, -0.9 * su, 1 * su, 1.8 * su);
    rect(13.1 * su, -0.45 * su, 0.8 * su, 0.9 * su);
    fill(c.lame);
    rect(1.3 * su, -0.9 * su, 10.9 * su, 1.8 * su);
    fill(c.reflet);
    rect(2 * su, -0.5 * su, 9.4 * su, 0.55 * su);
  }

  // Trace blanche de balayage pendant le coup (comme dans Minecraft).
  dessinerBalayage(u) {
    if (this.frappe === null) return;
    const p = this.frappe.t / this.dureeFrappe;
    if (p < 0.4 || p > 0.75) return;

    const opacite = 220 * (1 - (p - 0.4) / 0.35);
    const rayon = 24 * u;
    push();
    noFill();
    stroke(255, 255, 255, opacite);
    strokeWeight(3 * u);
    arc(0, 0, rayon * 2, rayon * 2, -1.5, 0.9);
    stroke(200, 255, 245, opacite * 0.6);
    strokeWeight(1.5 * u);
    arc(0, 0, rayon * 1.6, rayon * 1.6, -1.3, 0.7);
    pop();
  }

  dessinerDebug() {
    push();
    noFill();
    stroke('yellow');
    ellipse(this.pos.x, this.pos.y, this.rayonDetection * 2, this.rayonDetection * 2);
    stroke('red');
    ellipse(this.pos.x, this.pos.y, this.porteeEpee() * 2, this.porteeEpee() * 2);
    pop();
  }
}
