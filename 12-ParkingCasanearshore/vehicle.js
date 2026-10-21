class Vehicle {
  static debug = false;

  constructor(x, y) {
    // position du véhicule
    this.pos = createVector(x, y);
    // vitesse du véhicule
    this.vel = createVector(0, 0);
    // accélération du véhicule
    this.acc = createVector(0, 0);
    // vitesse maximale du véhicule
    this.maxSpeed = 4;
    // force maximale appliquée au véhicule
    this.maxForce = 0.1;
    // rayon du véhicule
    this.r = 16;
    this.rayonZoneDeFreinage = 100;

    // Paramètres du comportement wander : le point de pilotage est placé
    // devant le véhicule et sa direction évolue graduellement dans le temps.
    this.distanceCercle = 150;
    this.wanderRadius = 50;
    this.wanderTheta = -Math.PI / 2;
    this.displaceRange = 0.3;
  }

  
  applyBehaviors(target) {
    let force = this.seek(target);
    this.applyForce(force);
  }

  // seek est un comportement qui permet de faire se rapprocher le véhicule de 
  // la cible passée en paramètre (un vecteur p5.Vector, par exemple la position de 
  // la souris)
  seek(target, arrival = false, distanceArret = 0) {
 
    // on calcule la direction vers la cible : la vitesse DESIREE
    // C'est l'ETAPE 1 (action : se diriger vers une cible)
    let desiredSpeed = p5.Vector.sub(target, this.pos);

    if (arrival && desiredSpeed.mag() < this.rayonZoneDeFreinage) {
      const vitesse = map(
        desiredSpeed.mag(),
        distanceArret,
        this.rayonZoneDeFreinage,
        0,
        this.maxSpeed
      );
      desiredSpeed.setMag(vitesse);
    } else {
      desiredSpeed.setMag(this.maxSpeed);
    }

    // Dessous c'est l'ETAPE 2 : le pilotage (comment on se dirige vers la cible)
    // on limite ce vecteur à la longueur maxSpeed
    // Si on s'arrête ici, force = desiredSpeed

    // on calcule maintenant LA FORMULE MAGIQUE : force = desiredSpeed - currentSpeed
    let force = p5.Vector.sub(desiredSpeed, this.vel);

    // et on limite cette force à la longueur maxForce
    force.limit(this.maxForce);

    return force;
  }

  arrive(target, distanceArret = 0) {
    return this.seek(target, true, distanceArret);
  }

  wander() {
    const center = this.vel.copy();
    center.setMag(this.distanceCercle);
    center.add(this.pos);

    const angle = this.wanderTheta + this.vel.heading();
    const target = createVector(
      this.wanderRadius * cos(angle),
      this.wanderRadius * sin(angle)
    ).add(center);

    if (Vehicle.debug) {
      push();
      noFill();
      stroke(255);
      circle(center.x, center.y, this.wanderRadius * 2);
      stroke(255, 255, 255, 80);
      drawingContext.setLineDash([5, 15]);
      line(this.pos.x, this.pos.y, center.x, center.y);
      drawingContext.setLineDash([]);
      stroke('yellow');
      line(this.pos.x, this.pos.y, target.x, target.y);
      fill('green');
      noStroke();
      circle(target.x, target.y, 10);
      pop();
    }

    this.wanderTheta += random(-this.displaceRange, this.displaceRange);
    return p5.Vector.sub(target, this.pos).limit(this.maxForce);
  }

  boundaries(left, top, width, height, margin) {
    const horizontalMargin = Math.min(margin, width / 2);
    const verticalMargin = Math.min(margin, height / 2);
    const desiredVelocity = this.vel.copy();
    let steeringNeeded = false;

    if (this.pos.x < left + horizontalMargin) {
      desiredVelocity.x = this.maxSpeed;
      steeringNeeded = true;
    } else if (this.pos.x > left + width - horizontalMargin) {
      desiredVelocity.x = -this.maxSpeed;
      steeringNeeded = true;
    }
    if (this.pos.y < top + verticalMargin) {
      desiredVelocity.y = this.maxSpeed;
      steeringNeeded = true;
    } else if (this.pos.y > top + height - verticalMargin) {
      desiredVelocity.y = -this.maxSpeed;
      steeringNeeded = true;
    }

    if (!steeringNeeded) return createVector(0, 0);
    desiredVelocity.setMag(this.maxSpeed);
    const force = p5.Vector.sub(desiredVelocity, this.vel).limit(this.maxForce);
    if (Vehicle.debug) {
      push();
      noFill();
      stroke('white');
      rect(left, top, width, height);
      stroke('red');
      rect(left + horizontalMargin, top + verticalMargin,
        width - horizontalMargin * 2, height - verticalMargin * 2);
      pop();
    }
    return force;
  }

  // comportement de fuite : vitesse désirée opposée à la menace,
  // puis steering = vitesse désirée - vitesse courante.
  // si on inverse juste le signe de seek(),
  // on obtient une version simplifiée de flee() mais qui
  // ne tient pas compte de la vitesse courante du véhicule.
  // voir article de Craig Reynolds : https://www.red3d.com/cwr/steer/gdc99/
  flee(target) {
    const targetPosition = target.pos || target;
    const desiredVelocity = p5.Vector.sub(this.pos, targetPosition);
    if (desiredVelocity.magSq() === 0) return createVector(0, 0);
    desiredVelocity.setMag(this.maxSpeed);
    const force = p5.Vector.sub(desiredVelocity, this.vel);
    force.limit(this.maxForce);
    return force;
  }

  // --------------------------------------------
  // LES DEUX METHODES SUIVANTES SONT INCHANGEES QUEL QUE SOIT LE COMPORTEMENT
  // --------------------------------------------
  // applyForce est une méthode qui permet d'appliquer une force au véhicule
  // en fait on additionne le vecteur force au vecteur accélération
  applyForce(force) {
    this.acc.add(force);
  }

  // appelée 60 fois par seconde par la boucle d'animation de p5 (la fonction draw 
  // dans sketch.js)
  update() {
    // on ajoute l'accélération à la vitesse. 
    // L'accélération est un incrément de vitesse
    // (accélératiion = dérivée de la vitesse)
    this.vel.add(this.acc);
    // on contraint la vitesse à la valeur maxSpeed
    this.vel.limit(this.maxSpeed);
    // on ajoute la vitesse à la position. La vitesse est un incrément de position, 
    // (la vitesse est la dérivée de la position)
    this.pos.add(this.vel);

    // on remet l'accélération à zéro
    this.acc.set(0, 0);
  }

  // On dessine le véhicule
  show() {
    // sauvegarde du contexte graphique (couleur pleine, fil de fer, 
    // épaisseur du trait, position et rotation du repère de référence)
    push();
    // formes fil de fer en blanc
    stroke("white");
    // épaisseur du trait = 2
    strokeWeight(2);

    // formes pleines en bleu
    fill("blue");

    // on déplace le repère de référence.
    translate(this.pos.x, this.pos.y);
    // et on le tourne. heading() renvoie l'angle du vecteur vitesse 
    // (c'est l'angle du véhicule)
    rotate(this.vel.heading());

    //circle(0, 0, this.r * 2);

    // Dessin d'un véhicule sous la forme d'un triangle. Comme s'il était droit, 
    // avec le 0, 0 en haut à gauche
    triangle(-this.r, -this.r / 2, -this.r, this.r / 2, this.r, 0);
    
    pop();

    // dessin sous la forme d'une flèche du vecteur vitesse
    this.drawVelocityVector();
  }

  drawVelocityVector() {
    push();

    // Dessin du vecteur vitesse
    // Il part du centre du véhicule et va dans la direction du vecteur vitesse
    strokeWeight(3);
    stroke("red");
    line(this.pos.x, this.pos.y, this.pos.x + this.vel.x * 10, this.pos.y + this.vel.y * 10);
    // dessine une petite fleche au bout du vecteur vitesse
    let arrowSize = 5;
    translate(this.pos.x + this.vel.x * 10, this.pos.y + this.vel.y * 10);
    rotate(this.vel.heading());
    translate(-arrowSize / 2, 0);
    triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);

    pop();
  }
  
  // que fait cette méthode ?
  edges() {
    if (this.pos.x > width + this.r) {
      this.pos.x = -this.r;
    } else if (this.pos.x < -this.r) {
      this.pos.x = width + this.r;
    }
    if (this.pos.y > height + this.r) {
      this.pos.y = -this.r;
    } else if (this.pos.y < -this.r) {
      this.pos.y = height + this.r;
    }
  }
}
