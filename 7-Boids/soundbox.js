// SoundBox : tous les sons de l'exemple, synthétisés avec la Web Audio API.
// Aucun fichier audio n'est nécessaire. Chaque son du CATALOGUE est une
// "recette" : des oscillateurs ou du bruit, des filtres et une enveloppe
// de volume. La page soundbox.html permet de les écouter un par un.
//
// Règles :
// - aucun son avant une action de l'utilisateur (deverrouiller() au clic) ;
// - nombre de sons simultanés limité (maxVoix) ;
// - arreterTout() coupe et déconnecte toutes les sources en cours.
// Ce fichier ne dépend pas de p5 : il fonctionne aussi dans soundbox.html.

// Volume quasi nul pour les rampes exponentielles (elles refusent 0).
const SILENCE = 0.0001;

// Enveloppe : montée rapide jusqu'à niveau, puis descente exponentielle.
function enveloppe(parametre, debut, attaque, duree, niveau) {
  parametre.setValueAtTime(SILENCE, debut);
  parametre.exponentialRampToValueAtTime(niveau, debut + attaque);
  parametre.exponentialRampToValueAtTime(SILENCE, debut + duree);
}

class SoundBox {
  static CATALOGUE = {
    cuiPerroquet: {
      titre: 'Cui-cui du perroquet',
      quand: 'Clic sur un perroquet',
      description: '3 à 5 gazouillis très courts (onde triangle de 1 900 à 2 600 Hz qui monte puis redescend, 45 ms chacun, toutes les 60 ms).',
      jouer(o) {
        const nombre = 3 + Math.floor(o.alea() * 3);
        const base = 1900 + o.alea() * 700;
        for (let i = 0; i < nombre; i++) {
          const t = o.t + i * 0.06;
          const f = base * (0.92 + o.alea() * 0.16);
          const osc = o.oscillateur('triangle', f, t, t + 0.07);
          osc.frequency.exponentialRampToValueAtTime(f * 1.45, t + 0.025);
          osc.frequency.exponentialRampToValueAtTime(f * 0.9, t + 0.05);
          const g = o.gain();
          enveloppe(g.gain, t, 0.004, 0.05, 0.3);
          osc.connect(g);
          g.connect(o.sortie);
        }
        return o.t + nombre * 0.06 + 0.08;
      }
    },

    mortPerroquet: {
      titre: 'Cri de mort du perroquet',
      quand: 'Un perroquet est touché par l\'épée',
      description: 'Cri rauque qui descend de 1 250 à 330 Hz en 0,4 s (dent de scie + vibrato à 28 Hz, filtre passe-bande), suivi d\'un petit "pouf" de bruit.',
      jouer(o) {
        const t = o.t;
        const osc = o.oscillateur('sawtooth', 1250, t, t + 0.45);
        osc.frequency.exponentialRampToValueAtTime(330, t + 0.4);
        const vibrato = o.oscillateur('sine', 28, t, t + 0.45);
        const profondeur = o.gain();
        profondeur.gain.setValueAtTime(60, t);
        vibrato.connect(profondeur);
        profondeur.connect(osc.frequency);

        const filtre = o.filtre('bandpass', 1400, 1.5);
        const g = o.gain();
        enveloppe(g.gain, t, 0.01, 0.42, 0.28);
        osc.connect(filtre);
        filtre.connect(g);
        g.connect(o.sortie);

        const bruit = o.bruit(t + 0.05, t + 0.3);
        const passeBas = o.filtre('lowpass', 900, 0.7);
        const gb = o.gain();
        enveloppe(gb.gain, t + 0.05, 0.01, 0.22, 0.15);
        bruit.connect(passeBas);
        passeBas.connect(gb);
        gb.connect(o.sortie);
        return t + 0.5;
      }
    },

    coupEpee: {
      titre: 'Coup d\'épée (whoosh)',
      quand: 'Le chasseur commence sa frappe',
      description: 'Souffle de bruit blanc dans un filtre passe-bande qui balaie de 500 à 3 200 Hz en 0,16 s.',
      jouer(o) {
        const t = o.t;
        const bruit = o.bruit(t, t + 0.25);
        const filtre = o.filtre('bandpass', 500, 0.9);
        filtre.frequency.exponentialRampToValueAtTime(3200, t + 0.16);
        const g = o.gain();
        enveloppe(g.gain, t, 0.03, 0.22, 0.35);
        bruit.connect(filtre);
        filtre.connect(g);
        g.connect(o.sortie);
        return t + 0.26;
      }
    },

    impactEpee: {
      titre: 'Impact de l\'épée',
      quand: 'L\'épée touche un perroquet',
      description: 'Coup sourd (onde carrée de 170 à 55 Hz, filtre passe-bas) et petit claquement de bruit aigu.',
      jouer(o) {
        const t = o.t;
        const osc = o.oscillateur('square', 170, t, t + 0.16);
        osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
        const passeBas = o.filtre('lowpass', 1200, 0.8);
        const g = o.gain();
        enveloppe(g.gain, t, 0.002, 0.14, 0.4);
        osc.connect(passeBas);
        passeBas.connect(g);
        g.connect(o.sortie);

        const bruit = o.bruit(t, t + 0.05);
        const passeHaut = o.filtre('highpass', 2000, 0.7);
        const gb = o.gain();
        enveloppe(gb.gain, t, 0.002, 0.04, 0.25);
        bruit.connect(passeHaut);
        passeHaut.connect(gb);
        gb.connect(o.sortie);
        return t + 0.17;
      }
    },

    alerteChasseur: {
      titre: '« Hmm ! » du vieux chasseur',
      quand: 'Le chasseur repère un perroquet (au plus une fois toutes les 2 s)',
      description: 'Voix grave façon villageois : dent de scie de 150 → 175 → 125 Hz à travers deux filtres "formants" (650 et 1 100 Hz).',
      jouer(o) {
        const t = o.t;
        const osc = o.oscillateur('sawtooth', 150, t, t + 0.5);
        osc.frequency.linearRampToValueAtTime(175, t + 0.12);
        osc.frequency.linearRampToValueAtTime(125, t + 0.45);
        const g = o.gain();
        enveloppe(g.gain, t, 0.04, 0.48, 0.35);
        const formant1 = o.filtre('bandpass', 650, 3);
        const formant2 = o.filtre('bandpass', 1100, 4);
        osc.connect(formant1);
        osc.connect(formant2);
        formant1.connect(g);
        formant2.connect(g);
        g.connect(o.sortie);
        return t + 0.5;
      }
    }
  };

  constructor({ ContexteAudio, alea = Math.random, maxVoix = 24, volume = 0.6 } = {}) {
    this.ContexteAudio = ContexteAudio !== undefined
      ? ContexteAudio
      : (globalThis.AudioContext || globalThis.webkitAudioContext);
    this.alea = alea;
    this.maxVoix = maxVoix;
    this.volume = SoundBox.bornerVolume(volume);
    this.ctx = null;
    this.sortie = null;
    this.tamponBruit = null;
    this.voix = [];
  }

  static bornerVolume(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return Math.min(1, Math.max(0, n));
  }

  // À appeler depuis une action de l'utilisateur (clic, touche).
  deverrouiller() {
    if (!this.ContexteAudio) return false;
    if (this.ctx === null) {
      this.ctx = new this.ContexteAudio();
      this.sortie = this.ctx.createGain();
      this.sortie.gain.value = this.volume;
      this.sortie.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  }

  estPret() {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  setVolume(v) {
    this.volume = SoundBox.bornerVolume(v);
    if (this.sortie !== null) this.sortie.gain.setValueAtTime(this.volume, this.ctx.currentTime);
  }

  nombreDeVoix() {
    this.oublierVoixTerminees();
    return this.voix.length;
  }

  oublierVoixTerminees() {
    if (this.ctx === null) return;
    const maintenant = this.ctx.currentTime;
    this.voix = this.voix.filter(v => v.fin > maintenant);
  }

  // Joue un son du catalogue. Retourne true s'il a été lancé.
  jouer(nom) {
    const son = SoundBox.CATALOGUE[nom];
    if (son === undefined || !this.estPret()) return false;
    this.oublierVoixTerminees();
    if (this.voix.length >= this.maxVoix) return false;

    const sources = [];
    const noeuds = [];
    const fin = son.jouer(this.outils(sources, noeuds));
    this.voix.push({ nom, fin, sources, noeuds });
    return true;
  }

  // Petites fabriques passées aux recettes : elles enregistrent les nœuds
  // créés pour pouvoir tout arrêter et déconnecter.
  outils(sources, noeuds) {
    const ctx = this.ctx;
    const enregistrer = n => { noeuds.push(n); return n; };
    return {
      t: ctx.currentTime,
      sortie: this.sortie,
      alea: this.alea,
      gain: () => enregistrer(ctx.createGain()),
      filtre: (type, frequence, q) => {
        const f = enregistrer(ctx.createBiquadFilter());
        f.type = type;
        f.frequency.setValueAtTime(frequence, ctx.currentTime);
        f.Q.setValueAtTime(q, ctx.currentTime);
        return f;
      },
      oscillateur: (type, frequence, debut, fin) => {
        const osc = enregistrer(ctx.createOscillator());
        osc.type = type;
        osc.frequency.setValueAtTime(frequence, debut);
        osc.start(debut);
        osc.stop(fin);
        sources.push(osc);
        return osc;
      },
      bruit: (debut, fin) => {
        const source = enregistrer(ctx.createBufferSource());
        source.buffer = this.obtenirTamponBruit();
        source.start(debut);
        source.stop(fin);
        sources.push(source);
        return source;
      }
    };
  }

  // Une demi-seconde de bruit blanc, créée une seule fois.
  obtenirTamponBruit() {
    if (this.tamponBruit === null) {
      const longueur = Math.floor(this.ctx.sampleRate * 0.5);
      const tampon = this.ctx.createBuffer(1, longueur, this.ctx.sampleRate);
      const donnees = tampon.getChannelData(0);
      for (let i = 0; i < longueur; i++) donnees[i] = this.alea() * 2 - 1;
      this.tamponBruit = tampon;
    }
    return this.tamponBruit;
  }

  // Coupe immédiatement tous les sons en cours et libère leurs nœuds.
  arreterTout() {
    for (const voix of this.voix) {
      for (const source of voix.sources) {
        try { source.stop(); } catch (e) { /* déjà arrêtée */ }
      }
      for (const noeud of voix.noeuds) noeud.disconnect();
    }
    this.voix = [];
  }

  fermer() {
    this.arreterTout();
    if (this.ctx !== null) {
      this.sortie.disconnect();
      this.ctx.close();
    }
    this.ctx = null;
    this.sortie = null;
    this.tamponBruit = null;
  }
}
