// ============================================================================
// World: block storage, terrain generation, and instanced-mesh rendering.
// ============================================================================

const _threeTexCache = {};
function getThreeTexture(canvasKey) {
  if (_threeTexCache[canvasKey]) return _threeTexCache[canvasKey];
  const canvas = TEX[canvasKey] || TEX.stone;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  _threeTexCache[canvasKey] = tex;
  return tex;
}

function makeBlockMaterials(def) {
  // BoxGeometry default group order: px, nx, py, ny, pz, nz
  const sideKey = def.side || def.all;
  const topKey = def.top || def.all;
  const bottomKey = def.bottom || def.all;
  const frontKey = def.front || sideKey;
  const mkMat = (key) => {
    const tex = getThreeTexture(key);
    const opts = { map: tex };
    if (def.transparent) { opts.transparent = true; opts.opacity = def.liquid ? 0.75 : 0.92; opts.side = THREE.DoubleSide; opts.depthWrite = !def.liquid; }
    if (def.key === 'torch') { opts.transparent = true; opts.alphaTest = 0.3; opts.emissive = new THREE.Color(0x996622); opts.emissiveIntensity = 0.6; }
    return new THREE.MeshLambertMaterial(opts);
  };
  return [
    mkMat(sideKey), mkMat(sideKey), // px, nx
    mkMat(topKey), mkMat(bottomKey), // py, ny
    mkMat(sideKey), mkMat(frontKey), // pz, nz (nz = "front" for furnace)
  ];
}

const SHARED_BOX_GEO = new THREE.BoxGeometry(1, 1, 1);

class World {
  constructor(sizeX, sizeY, sizeZ, seed) {
    this.sizeX = sizeX; this.sizeY = sizeY; this.sizeZ = sizeZ;
    this.seaLevel = 9;
    this.data = new Uint8Array(sizeX * sizeY * sizeZ);
    this.noise = new ValueNoise2D(seed);
    this.noise2 = new ValueNoise2D(seed + 999);
    this.meshes = {}; // blockId -> InstancedMesh
    this.group = new THREE.Group();
    this.materialCache = {};
    this.dirty = true;
  }

  idx(x, y, z) { return (y * this.sizeZ + z) * this.sizeX + x; }
  inBounds(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.sizeX && y < this.sizeY && z < this.sizeZ; }
  getBlock(x, y, z) {
    if (!this.inBounds(x, y, z)) return y < 0 ? BLOCKS.bedrock.id : AIR;
    return this.data[this.idx(x, y, z)];
  }
  setBlock(x, y, z, id) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.idx(x, y, z)] = id;
    this.dirty = true;
  }
  heightAt(x, z) {
    const n = this.noise.fractal(x, z, 4, 0.5, 0.045);
    const n2 = this.noise2.fractal(x, z, 2, 0.5, 0.09);
    const h = n * 14 + n2 * 4;
    return Math.floor(6 + h);
  }

  generate() {
    const { sizeX, sizeY, sizeZ, seaLevel } = this;
    const heightMap = [];
    for (let x = 0; x < sizeX; x++) {
      heightMap[x] = [];
      for (let z = 0; z < sizeZ; z++) heightMap[x][z] = this.heightAt(x, z);
    }
    for (let x = 0; x < sizeX; x++) {
      for (let z = 0; z < sizeZ; z++) {
        const h = heightMap[x][z];
        let topId;
        if (h <= seaLevel + 1) topId = BLOCKS.sand.id;
        else if (h >= 20) topId = BLOCKS.snow_grass.id;
        else topId = BLOCKS.grass.id;

        for (let y = 0; y < sizeY; y++) {
          let id;
          if (y === 0) id = BLOCKS.bedrock.id;
          else if (y < h - 4) id = BLOCKS.stone.id;
          else if (y < h - 1) id = BLOCKS.dirt.id;
          else if (y === h - 1) id = topId;
          else if (y <= seaLevel) id = BLOCKS.water.id;
          else id = AIR;
          this.setBlock(x, y, z, id);
        }
      }
    }

    // ore veins inside stone
    const rnd = mulberry32(this.noise.seed ^ 0xABCDEF);
    for (let x = 1; x < sizeX - 1; x++) {
      for (let z = 1; z < sizeZ - 1; z++) {
        for (let y = 1; y < sizeY - 1; y++) {
          if (this.getBlock(x, y, z) !== BLOCKS.stone.id) continue;
          const r = rnd();
          if (y < 6 && r < 0.012) this.setBlock(x, y, z, BLOCKS.diamond_ore.id);
          else if (y < 10 && r < 0.02) this.setBlock(x, y, z, BLOCKS.gold_ore.id);
          else if (y < 16 && r < 0.045) this.setBlock(x, y, z, BLOCKS.iron_ore.id);
          else if (r < 0.06) this.setBlock(x, y, z, BLOCKS.coal_ore.id);
        }
      }
    }

    // trees
    const treeRnd = mulberry32(this.noise.seed ^ 0x1234);
    for (let x = 3; x < sizeX - 3; x++) {
      for (let z = 3; z < sizeZ - 3; z++) {
        const h = heightMap[x][z];
        if (h <= seaLevel + 1 || h >= 20) continue;
        if (this.getBlock(x, h - 1, z) !== BLOCKS.grass.id) continue;
        if (treeRnd() < 0.02) this.placeTree(x, h, z, treeRnd);
      }
    }

    this.dirty = true;
  }

  placeTree(x, baseY, z, rnd) {
    const trunkH = 4 + Math.floor(rnd() * 2);
    for (let i = 0; i < trunkH; i++) this.setBlock(x, baseY + i, z, BLOCKS.log.id);
    const topY = baseY + trunkH;
    for (let dy = -2; dy <= 1; dy++) {
      const ry = topY + dy;
      const radius = dy === 1 ? 1 : 2;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.abs(dx) === radius && Math.abs(dz) === radius && radius === 2) continue;
          if (dx === 0 && dz === 0 && dy < 1) continue; // keep trunk visible
          const bx = x + dx, by = ry, bz = z + dz;
          if (this.getBlock(bx, by, bz) === AIR) this.setBlock(bx, by, bz, BLOCKS.leaves.id);
        }
      }
    }
  }

  isOpaque(id) {
    if (id === AIR) return false;
    const def = BLOCKS_BY_ID[id];
    return def && !def.transparent;
  }

  // Rebuild all instanced meshes from current block data.
  rebuildMeshes(scene) {
    const buckets = {}; // id -> array of [x,y,z]
    const { sizeX, sizeY, sizeZ } = this;
    for (let y = 0; y < sizeY; y++) {
      for (let z = 0; z < sizeZ; z++) {
        for (let x = 0; x < sizeX; x++) {
          const id = this.data[this.idx(x, y, z)];
          if (id === AIR) continue;
          const exposed =
            !this.isOpaque(this.getBlock(x + 1, y, z)) ||
            !this.isOpaque(this.getBlock(x - 1, y, z)) ||
            !this.isOpaque(this.getBlock(x, y + 1, z)) ||
            !this.isOpaque(this.getBlock(x, y - 1, z)) ||
            !this.isOpaque(this.getBlock(x, y, z + 1)) ||
            !this.isOpaque(this.getBlock(x, y, z - 1));
          if (!exposed) continue;
          (buckets[id] || (buckets[id] = [])).push(x, y, z);
        }
      }
    }

    // remove meshes for block types no longer present
    for (const idStr of Object.keys(this.meshes)) {
      if (!buckets[idStr]) {
        this.group.remove(this.meshes[idStr]);
        this.meshes[idStr].dispose && this.meshes[idStr].dispose();
        delete this.meshes[idStr];
      }
    }

    const dummy = new THREE.Object3D();
    for (const idStr of Object.keys(buckets)) {
      const id = Number(idStr);
      const def = BLOCKS_BY_ID[id];
      const coords = buckets[idStr];
      const count = coords.length / 3;
      let mesh = this.meshes[id];
      if (!mesh || mesh.userData.capacity < count) {
        if (mesh) { this.group.remove(mesh); }
        const materials = this.materialCache[id] || (this.materialCache[id] = makeBlockMaterials(def));
        mesh = new THREE.InstancedMesh(SHARED_BOX_GEO, materials, Math.max(count, 16));
        mesh.userData.capacity = Math.max(count, 16);
        mesh.userData.blockId = id;
        if (def.liquid) mesh.renderOrder = 1;
        this.group.add(mesh);
        this.meshes[id] = mesh;
      }
      const isTorch = def.key === 'torch';
      for (let i = 0; i < count; i++) {
        const bx = coords[i * 3], by = coords[i * 3 + 1], bz = coords[i * 3 + 2];
        if (isTorch) {
          dummy.scale.set(0.22, 0.55, 0.22);
          dummy.position.set(bx + 0.5, by + 0.32, bz + 0.5);
        } else {
          dummy.scale.set(1, 1, 1);
          dummy.position.set(bx + 0.5, by + 0.5, bz + 0.5);
        }
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }

    if (!this.group.parent) scene.add(this.group);
    this.dirty = false;
  }
}
