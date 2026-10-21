// Caméra 2D : zoom et déplacement de la vue sur le monde (élément
// d'interface, pas une entité). Les entités restent en coordonnées du monde ;
// seuls le rendu et la conversion du pointeur passent par la caméra.
class Camera {
  constructor(viewWidth, viewHeight) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
    this.x = 0; // centre de la vue, en coordonnées du monde
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 0.1;
    this.maxZoom = 6;
  }

  resize(viewWidth, viewHeight) {
    this.viewWidth = viewWidth;
    this.viewHeight = viewHeight;
  }

  setZoom(z) {
    this.zoom = Math.min(this.maxZoom, Math.max(this.minZoom, z));
  }

  // Cadre un rectangle du monde dans la vue (avec une marge en px écran).
  fit(x, y, w, h, marge = 20) {
    const z = Math.min((this.viewWidth - 2 * marge) / w, (this.viewHeight - 2 * marge) / h);
    this.setZoom(z);
    this.x = x + w / 2;
    this.y = y + h / 2;
  }

  focus(x, y, zoom = this.zoom) {
    this.x = x;
    this.y = y;
    this.setZoom(zoom);
  }

  worldToScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.viewWidth / 2,
      y: (wy - this.y) * this.zoom + this.viewHeight / 2
    };
  }

  screenToWorld(sx, sy) {
    return {
      x: (sx - this.viewWidth / 2) / this.zoom + this.x,
      y: (sy - this.viewHeight / 2) / this.zoom + this.y
    };
  }

  // Zoom autour d'un point de l'écran (le point du monde sous le pointeur
  // reste sous le pointeur).
  zoomAt(sx, sy, facteur) {
    const avant = this.screenToWorld(sx, sy);
    this.setZoom(this.zoom * facteur);
    const apres = this.screenToWorld(sx, sy);
    this.x += avant.x - apres.x;
    this.y += avant.y - apres.y;
  }

  // Déplacement de la vue d'un glissement écran (dx, dy).
  pan(dx, dy) {
    this.x -= dx / this.zoom;
    this.y -= dy / this.zoom;
  }

  // Rectangle du monde visible (pour ne dessiner que ce qui est à l'écran).
  visibleRect(marge = 0) {
    const a = this.screenToWorld(-marge, -marge);
    const b = this.screenToWorld(this.viewWidth + marge, this.viewHeight + marge);
    return { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y };
  }

  // À appeler entre push() et pop() avant de dessiner le monde.
  apply() {
    translate(this.viewWidth / 2, this.viewHeight / 2);
    scale(this.zoom);
    translate(-this.x, -this.y);
  }
}
