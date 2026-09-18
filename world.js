// ---------- World data & procedural terrain ----------

const WORLD_SIZE = 40;      // blocks along X and Z (world spans -SIZE/2 .. SIZE/2)
const WORLD_HEIGHT = 20;    // max Y layers
const CHUNK_ORIGIN = -WORLD_SIZE / 2;

const BLOCK = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
};

const BLOCK_COLOR = {
  [BLOCK.GRASS]: 0x5bab4c,
  [BLOCK.DIRT]:  0x8a5a34,
  [BLOCK.STONE]: 0x8c8c8c,
  [BLOCK.WOOD]:  0x6b4a2b,
  [BLOCK.LEAVES]:0x3f8f2f,
  [BLOCK.SAND]:  0xdccb7a,
};

const BLOCK_NAME = {
  [BLOCK.GRASS]: 'Grass',
  [BLOCK.DIRT]:  'Dirt',
  [BLOCK.STONE]: 'Stone',
  [BLOCK.WOOD]:  'Wood',
  [BLOCK.LEAVES]:'Leaves',
  [BLOCK.SAND]:  'Sand',
};

// Simple deterministic pseudo-random value noise (no external deps)
function hashNoise(x, z) {
  let n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const v00 = hashNoise(xi, zi);
  const v10 = hashNoise(xi + 1, zi);
  const v01 = hashNoise(xi, zi + 1);
  const v11 = hashNoise(xi + 1, zi + 1);
  const i1 = v00 * (1 - xf) + v10 * xf;
  const i2 = v01 * (1 - xf) + v11 * xf;
  return i1 * (1 - zf) + i2 * zf;
}

function terrainHeight(x, z) {
  // Layered noise for rolling hills
  let h = 0;
  h += smoothNoise(x * 0.06, z * 0.06) * 6;
  h += smoothNoise(x * 0.15, z * 0.15) * 2;
  return Math.floor(6 + h);
}

// blocks stored in a flat Map keyed "x,y,z" -> blockType
class World {
  constructor() {
    this.blocks = new Map();
    this.generate();
  }

  key(x, y, z) { return x + ',' + y + ',' + z; }

  get(x, y, z) {
    if (y < 0 || y >= WORLD_HEIGHT) return BLOCK.AIR;
    return this.blocks.get(this.key(x, y, z)) || BLOCK.AIR;
  }

  set(x, y, z, type) {
    const k = this.key(x, y, z);
    if (type === BLOCK.AIR) this.blocks.delete(k);
    else this.blocks.set(k, type);
  }

  generate() {
    const half = WORLD_SIZE / 2;
    for (let x = -half; x < half; x++) {
      for (let z = -half; z < half; z++) {
        const h = terrainHeight(x, z);
        for (let y = 0; y <= h; y++) {
          let type;
          if (y === h) type = h <= 5 ? BLOCK.SAND : BLOCK.GRASS;
          else if (y >= h - 2) type = BLOCK.DIRT;
          else type = BLOCK.STONE;
          this.set(x, y, z, type);
        }
        // Occasional tree
        if (h > 5 && hashNoise(x * 3.1, z * 7.7) > 0.965) {
          this.placeTree(x, h + 1, z);
        }
      }
    }
  }

  placeTree(x, y, z) {
    const trunkHeight = 4;
    for (let i = 0; i < trunkHeight; i++) {
      this.set(x, y + i, z, BLOCK.WOOD);
    }
    const topY = y + trunkHeight - 1;
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        for (let dy = 0; dy <= 2; dy++) {
          if (Math.abs(dx) + Math.abs(dz) + dy <= 3 && !(dx === 0 && dz === 0 && dy === 0)) {
            const bx = x + dx, by = topY + dy, bz = z + dz;
            if (this.get(bx, by, bz) === BLOCK.AIR) this.set(bx, by, bz, BLOCK.LEAVES);
          }
        }
      }
    }
  }

  isSolid(x, y, z) {
    return this.get(x, y, z) !== BLOCK.AIR;
  }

  heightAt(x, z) {
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (this.isSolid(x, y, z)) return y;
    }
    return 0;
  }
}
