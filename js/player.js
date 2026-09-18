// ============================================================================
// Player: physics, collision, look controls, and block targeting raycast.
// ============================================================================

class Player {
  constructor(world, camera) {
    this.world = world;
    this.camera = camera;
    this.pos = new THREE.Vector3(world.sizeX / 2, world.sizeY, world.sizeZ / 2);
    this.vel = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.width = 0.6;   // horizontal collision box size
    this.height = 1.8;  // total standing height
    this.eyeHeight = 1.62;
    this.onGround = false;
    this.flying = false;
    this.mode = 'creative'; // 'creative' | 'survival'
    this.lastSpaceTime = -999;
    this.sprinting = false;
    this.inWater = false;
    this.fallStartY = null;

    // drop player onto terrain at spawn
    for (let y = world.sizeY - 1; y > 0; y--) {
      if (world.getBlock(Math.floor(this.pos.x), y, Math.floor(this.pos.z)) !== AIR) {
        this.pos.y = y + 1.05;
        break;
      }
    }
  }

  setMode(mode) {
    this.mode = mode;
    this.flying = mode === 'creative';
  }

  isSolidBlock(x, y, z) {
    const id = this.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    if (id === AIR) return false;
    const def = BLOCKS_BY_ID[id];
    return def && def.solid;
  }

  // Axis-aligned collision sweep: move by delta on one axis at a time.
  moveAxis(axis, amount) {
    if (amount === 0) return;
    const w = this.width / 2;
    this.pos[axis] += amount;

    const minX = this.pos.x - w, maxX = this.pos.x + w;
    const minY = this.pos.y, maxY = this.pos.y + this.height;
    const minZ = this.pos.z - w, maxZ = this.pos.z + w;

    const x0 = Math.floor(minX), x1 = Math.floor(maxX - 1e-6);
    const y0 = Math.floor(minY), y1 = Math.floor(maxY - 1e-6);
    const z0 = Math.floor(minZ), z1 = Math.floor(maxZ - 1e-6);

    for (let bx = x0; bx <= x1; bx++) {
      for (let by = y0; by <= y1; by++) {
        for (let bz = z0; bz <= z1; bz++) {
          if (!this.isSolidBlock(bx, by, bz)) continue;
          // collision! push back along this axis only
          if (axis === 'x') {
            if (amount > 0) this.pos.x = bx - w;
            else this.pos.x = bx + 1 + w;
          } else if (axis === 'y') {
            if (amount > 0) this.pos.y = by - this.height;
            else { this.pos.y = by + 1; this.onGround = true; }
            this.vel.y = 0;
          } else if (axis === 'z') {
            if (amount > 0) this.pos.z = bz - w;
            else this.pos.z = bz + 1 + w;
          }
          return this.moveAxis(axis, 0); // re-check after clamping (amount 0 = no-op, just returns)
        }
      }
    }
  }

  update(dt, input) {
    dt = Math.min(dt, 0.05);
    const world = this.world;
    const feetBlock = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y), Math.floor(this.pos.z));
    this.inWater = feetBlock === BLOCKS.water.id;

    // --- look direction from yaw/pitch already applied to camera externally ---
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.sin(this.yaw + Math.PI / 2), 0, Math.cos(this.yaw + Math.PI / 2));

    let speed = this.mode === 'creative' ? 6.2 : 4.3;
    this.sprinting = input.sprint && input.forward;
    if (this.sprinting) speed *= 1.5;
    if (this.inWater) speed *= 0.6;
    if (this.flying) speed *= 1.4;

    let mx = 0, mz = 0;
    if (input.forward) { mx += forward.x; mz += forward.z; }
    if (input.back) { mx -= forward.x; mz -= forward.z; }
    if (input.left) { mx -= right.x; mz -= right.z; }
    if (input.right) { mx += right.x; mz += right.z; }
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    if (this.flying) {
      this.vel.x = mx * speed;
      this.vel.z = mz * speed;
      let vy = 0;
      if (input.jump) vy += speed;
      if (input.sprint && !input.forward && !input.back && !input.left && !input.right) {} // no-op guard
      if (input.down) vy -= speed;
      this.vel.y = vy;
    } else {
      const accel = this.onGround ? 40 : 18;
      const targetX = mx * speed, targetZ = mz * speed;
      this.vel.x += (targetX - this.vel.x) * Math.min(1, accel * dt);
      this.vel.z += (targetZ - this.vel.z) * Math.min(1, accel * dt);

      if (this.inWater) {
        this.vel.y -= 9 * dt; // reduced gravity in water
        this.vel.y = Math.max(this.vel.y, -3);
        if (input.jump) this.vel.y = 3.2;
      } else {
        this.vel.y -= 26 * dt; // gravity
        if (input.jump && this.onGround) {
          this.vel.y = 8.2;
          this.onGround = false;
        }
      }
    }

    // track fall distance for fall damage
    if (!this.onGround && !this.flying && !this.inWater) {
      if (this.fallStartY === null) this.fallStartY = this.pos.y;
    }

    this.onGround = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);

    let fallDamage = 0;
    if (this.onGround && this.fallStartY !== null) {
      const dist = this.fallStartY - this.pos.y;
      if (dist > 3.2) fallDamage = Math.floor(dist - 3);
      this.fallStartY = null;
    }

    // world bounds clamp (soft walls)
    this.pos.x = Math.max(0.5, Math.min(world.sizeX - 0.5, this.pos.x));
    this.pos.z = Math.max(0.5, Math.min(world.sizeZ - 0.5, this.pos.z));
    if (this.pos.y < -10) { this.pos.y = world.sizeY; this.vel.set(0, 0, 0); }

    this.camera.position.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    return { fallDamage };
  }

  // Amanatides & Woo voxel traversal for block picking.
  raycast(maxDist = 6) {
    const world = this.world;
    const origin = this.camera.position.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);

    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dir.x > 0 ? 1 : -1, stepY = dir.y > 0 ? 1 : -1, stepZ = dir.z > 0 ? 1 : -1;

    const tDelta = (v) => v === 0 ? Infinity : Math.abs(1 / v);
    const tDeltaX = tDelta(dir.x), tDeltaY = tDelta(dir.y), tDeltaZ = tDelta(dir.z);

    const frac = (p, s) => s > 0 ? (1 - (p - Math.floor(p))) : (p - Math.floor(p));
    let tMaxX = dir.x === 0 ? Infinity : frac(origin.x, stepX) * tDeltaX;
    let tMaxY = dir.y === 0 ? Infinity : frac(origin.y, stepY) * tDeltaY;
    let tMaxZ = dir.z === 0 ? Infinity : frac(origin.z, stepZ) * tDeltaZ;

    let lastFace = null;
    let t = 0;
    while (t < maxDist) {
      const id = world.getBlock(x, y, z);
      if (id !== AIR && id !== BLOCKS.water.id) {
        return { x, y, z, face: lastFace, distance: t };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX; lastFace = { x: -stepX, y: 0, z: 0 };
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY; lastFace = { x: 0, y: -stepY, z: 0 };
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; lastFace = { x: 0, y: 0, z: -stepZ };
      }
    }
    return null;
  }
}
