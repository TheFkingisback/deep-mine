/**
 * Easing functions for smooth animations.
 * All functions take t in range [0, 1] and return eased value.
 */

/**
 * Linear easing (no easing).
 */
export function linear(t: number): number {
  return t;
}

/**
 * Quadratic ease-out.
 * Starts fast, slows down at end.
 */
export function easeOutQuad(t: number): number {
  return t * (2 - t);
}

/**
 * Quadratic ease-in-out.
 * Slow start, fast middle, slow end.
 */
export function easeInOutQuad(t: number): number {
  return t < 0.5
    ? 2 * t * t
    : -1 + (4 - 2 * t) * t;
}

/**
 * Cubic ease-out.
 * Smooth deceleration.
 */
export function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

/**
 * Cubic ease-in.
 * Smooth acceleration.
 */
export function easeInCubic(t: number): number {
  return t * t * t;
}

/**
 * Elastic ease-out.
 * Overshoots then settles with oscillation.
 */
export function easeOutElastic(t: number): number {
  const c4 = (2 * Math.PI) / 3;

  return t === 0
    ? 0
    : t === 1
    ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

/**
 * Bounce ease-out.
 * Bouncing ball effect at the end.
 */
export function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    const t2 = t - 1.5 / d1;
    return n1 * t2 * t2 + 0.75;
  } else if (t < 2.5 / d1) {
    const t2 = t - 2.25 / d1;
    return n1 * t2 * t2 + 0.9375;
  } else {
    const t2 = t - 2.625 / d1;
    return n1 * t2 * t2 + 0.984375;
  }
}

/**
 * Back ease-out.
 * Slight overshoot then settle.
 */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/**
 * Exponential ease-out.
 * Very fast deceleration.
 */
export function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}
