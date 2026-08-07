// form-coach-logic.js — pure functions for the Posing & Lift-Form Coach
// (joint-angle math, symmetry scoring, rep segmentation, ROM/tempo/
// stability scoring). No DOM, no camera, no MediaPipe — see
// form-coach.html for the wiring. Dual export like gym-volume-logic.js
// so this can be self-checked with plain `node` and also loaded as a
// plain <script>.
(function () {
  'use strict';

  // Angle in degrees at vertex b, formed by rays b->a and b->c.
  // Points are {x, y} (MediaPipe landmarks or any 2D coords — scale-
  // and axis-direction-invariant). Returns null if either ray has
  // zero length (a, b, or c coincide) rather than NaN.
  function angleDeg(a, b, c) {
    var abx = a.x - b.x, aby = a.y - b.y;
    var cbx = c.x - b.x, cby = c.y - b.y;
    var magAB = Math.sqrt(abx * abx + aby * aby);
    var magCB = Math.sqrt(cbx * cbx + cby * cby);
    if (magAB === 0 || magCB === 0) return null;
    var cos = (abx * cbx + aby * cby) / (magAB * magCB);
    cos = Math.max(-1, Math.min(1, cos));
    return Math.acos(cos) * (180 / Math.PI);
  }

  var api = {
    angleDeg: angleDeg
  };
  if (typeof window !== 'undefined') window.FormCoachLogic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
