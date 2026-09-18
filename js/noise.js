// Small dependency-free seeded 2D value-noise implementation.
// Good enough to fake Perlin-style rolling terrain without any external libs.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class ValueNoise2D {
  constructor(seed) {
    this.seed = seed;
    this.rand = mulberry32(seed);
    this.grid = {};
  }
  _hash(x, y) {
    const key = x + ',' + y;
    if (this.grid[key] === undefined) {
      // deterministic pseudo-random per integer coordinate
      let h = Math.sin(x * 127.1 + y * 311.7 + this.seed * 0.001) * 43758.5453123;
      this.grid[key] = h - Math.floor(h);
    }
    return this.grid[key];
  }
  _smooth(t) { return t * t * (3 - 2 * t); }
  noise(x, y) {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const x1 = x0 + 1, y1 = y0 + 1;
    const sx = this._smooth(x - x0), sy = this._smooth(y - y0);
    const n00 = this._hash(x0, y0);
    const n10 = this._hash(x1, y0);
    const n01 = this._hash(x0, y1);
    const n11 = this._hash(x1, y1);
    const ix0 = n00 + (n10 - n00) * sx;
    const ix1 = n01 + (n11 - n01) * sx;
    return ix0 + (ix1 - ix0) * sy;
  }
  // fractal/octave noise, returns roughly 0..1
  fractal(x, y, octaves = 4, persistence = 0.5, scale = 1) {
    let total = 0, amp = 1, freq = 1, maxAmp = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * scale * freq, y * scale * freq) * amp;
      maxAmp += amp;
      amp *= persistence;
      freq *= 2;
    }
    return total / maxAmp;
  }
}
