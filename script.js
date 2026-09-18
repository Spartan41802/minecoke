// ---------- Renderer / Scene setup ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 40, 110);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
document.body.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Lighting
const ambient = new THREE.AmbientLight(0xffffff, 0.65);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.7);
sun.position.set(50, 80, 30);
scene.add(sun);

// ---------- World ----------
const world = new World();

const geometryBox = new THREE.BoxGeometry(1, 1, 1);
let blockGroup = new THREE.Group();
scene.add(blockGroup);

function faceExposed(x, y, z) {
  return !world.isSolid(x + 1, y, z) || !world.isSolid(x - 1, y, z) ||
         !world.isSolid(x, y + 1, z) || !world.isSolid(x, y - 1, z) ||
         !world.isSolid(x, y, z + 1) || !world.isSolid(x, y, z - 1);
}

function rebuildWorldMesh() {
  scene.remove(blockGroup);
  blockGroup = new THREE.Group();

  // group instances by type
  const counts = {};
  for (const key of world.blocks.keys()) {
    const [x, y, z] = key.split(',').map(Number);
    if (!faceExposed(x, y, z)) continue;
    const type = world.blocks.get(key);
    counts[type] = (counts[type] || 0) + 1;
  }

  const instancedByType = {};
  const indexByType = {};
  for (const type in counts) {
    const mat = new THREE.MeshLambertMaterial({ color: BLOCK_COLOR[type] });
    const inst = new THREE.InstancedMesh(geometryBox, mat, counts[type]);
    inst.userData.type = type;
    instancedByType[type] = inst;
    indexByType[type] = 0;
    blockGroup.add(inst);
  }

  const dummy = new THREE.Object3D();
  for (const key of world.blocks.keys()) {
    const [x, y, z] = key.split(',').map(Number);
    if (!faceExposed(x, y, z)) continue;
    const type = world.blocks.get(key);
    dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
    dummy.updateMatrix();
    const inst = instancedByType[type];
    inst.setMatrixAt(indexByType[type]++, dummy.matrix);
  }
  for (const type in instancedByType) instancedByType[type].instanceMatrix.needsUpdate = true;

  scene.add(blockGroup);
}
rebuildWorldMesh();

// ---------- Player ----------
const player = {
  pos: new THREE.Vector3(0, world.heightAt(0, 0) + 3, 0),
  vel: new THREE.Vector3(0, 0, 0),
  yaw: 0,
  pitch: 0,
  onGround: false,
  width: 0.6,
  height: 1.8,
};
camera.position.copy(player.pos);

const keys = {};
document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup', e => { keys[e.code] = false; });

// Pointer lock look controls
const canvas = renderer.domElement;
document.getElementById('playBtn').addEventListener('click', () => {
  canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
  document.getElementById('menu').style.display = (document.pointerLockElement === canvas) ? 'none' : 'flex';
});
document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  const sensitivity = 0.0022;
  player.yaw -= e.movementX * sensitivity;
  player.pitch -= e.movementY * sensitivity;
  player.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, player.pitch));
});

// ---------- Collision helpers ----------
function collidesAt(pos) {
  const minX = Math.floor(pos.x - player.width / 2);
  const maxX = Math.floor(pos.x + player.width / 2);
  const minY = Math.floor(pos.y);
  const maxY = Math.floor(pos.y + player.height);
  const minZ = Math.floor(pos.z - player.width / 2);
  const maxZ = Math.floor(pos.z + player.width / 2);
  for (let x = minX; x <= maxX; x++)
    for (let y = minY; y <= maxY; y++)
      for (let z = minZ; z <= maxZ; z++)
        if (world.isSolid(x, y, z)) return true;
  return false;
}

function tryMove(axis, delta) {
  const next = player.pos.clone();
  next[axis] += delta;
  if (!collidesAt(next)) {
    player.pos[axis] = next[axis];
  } else {
    if (axis === 'y') player.vel.y = 0;
  }
}

// ---------- Raycasting for break/place (voxel DDA) ----------
function raycastVoxel(origin, dir, maxDist) {
  let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
  const stepX = dir.x > 0 ? 1 : -1;
  const stepY = dir.y > 0 ? 1 : -1;
  const stepZ = dir.z > 0 ? 1 : -1;

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  function initialT(o, d, s) {
    if (d === 0) return Infinity;
    const boundary = s > 0 ? Math.floor(o) + 1 : Math.ceil(o) - 1;
    return (boundary - o) / d;
  }

  let tMaxX = initialT(origin.x, dir.x, stepX);
  let tMaxY = initialT(origin.y, dir.y, stepY);
  let tMaxZ = initialT(origin.z, dir.z, stepZ);

  let dist = 0;
  let lastNormal = null;
  while (dist < maxDist) {
    if (world.isSolid(x, y, z)) {
      return { x, y, z, normal: lastNormal };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; dist = tMaxX; tMaxX += tDeltaX; lastNormal = { x: -stepX, y: 0, z: 0 };
    } else if (tMaxY < tMaxZ) {
      y += stepY; dist = tMaxY; tMaxY += tDeltaY; lastNormal = { x: 0, y: -stepY, z: 0 };
    } else {
      z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; lastNormal = { x: 0, y: 0, z: -stepZ };
    }
  }
  return null;
}

let needsRebuild = false;

canvas.addEventListener('mousedown', e => {
  if (document.pointerLockElement !== canvas) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const hit = raycastVoxel(camera.position, dir, 6);
  if (!hit) return;

  if (e.button === 0) {
    // break
    world.set(hit.x, hit.y, hit.z, BLOCK.AIR);
    needsRebuild = true;
  } else if (e.button === 2) {
    // place adjacent to hit face
    const nx = hit.x + hit.normal.x;
    const ny = hit.y + hit.normal.y;
    const nz = hit.z + hit.normal.z;
    const placePos = new THREE.Vector3(nx + 0.5, ny + 0.5, nz + 0.5);
    // avoid placing inside player
    const dx = Math.abs(placePos.x - player.pos.x);
    const dy = Math.abs(placePos.y - (player.pos.y + player.height / 2));
    const dz = Math.abs(placePos.z - player.pos.z);
    if (!(dx < 0.8 && dy < 1.4 && dz < 0.8)) {
      world.set(nx, ny, nz, selectedBlock);
      needsRebuild = true;
    }
  }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());

// ---------- Hotbar ----------
const hotbarTypes = [BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.WOOD, BLOCK.LEAVES, BLOCK.SAND];
let selectedBlock = hotbarTypes[0];
const hotbarEl = document.getElementById('hotbar');
hotbarTypes.forEach((type, i) => {
  const slot = document.createElement('div');
  slot.className = 'slot' + (i === 0 ? ' selected' : '');
  slot.style.background = '#' + BLOCK_COLOR[type].toString(16).padStart(6, '0');
  slot.innerHTML = `<span class="num">${i + 1}</span>`;
  slot.title = BLOCK_NAME[type];
  slot.dataset.type = type;
  hotbarEl.appendChild(slot);
});
document.addEventListener('keydown', e => {
  const num = parseInt(e.key);
  if (num >= 1 && num <= hotbarTypes.length) {
    selectedBlock = hotbarTypes[num - 1];
    document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('selected', i === num - 1));
  }
});

// ---------- Main loop ----------
const GRAVITY = -22;
const JUMP_SPEED = 8;
const MOVE_SPEED = 5.2;

let lastTime = performance.now();
let fpsAcc = 0, fpsCount = 0, fpsTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  let dt = (now - lastTime) / 1000;
  dt = Math.min(dt, 0.05);
  lastTime = now;

  // FPS counter
  fpsCount++; fpsTimer += dt;
  if (fpsTimer >= 0.5) {
    document.getElementById('fps').textContent = 'FPS: ' + Math.round(fpsCount / fpsTimer);
    fpsCount = 0; fpsTimer = 0;
  }

  if (document.pointerLockElement === canvas) {
    // Movement input relative to yaw
    const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.sin(player.yaw + Math.PI / 2), 0, Math.cos(player.yaw + Math.PI / 2));
    let moveX = 0, moveZ = 0;
    if (keys['KeyW']) { moveX += forward.x; moveZ += forward.z; }
    if (keys['KeyS']) { moveX -= forward.x; moveZ -= forward.z; }
    if (keys['KeyA']) { moveX -= right.x; moveZ -= right.z; }
    if (keys['KeyD']) { moveX += right.x; moveZ += right.z; }
    const len = Math.hypot(moveX, moveZ);
    if (len > 0) { moveX /= len; moveZ /= len; }

    player.vel.x = moveX * MOVE_SPEED;
    player.vel.z = moveZ * MOVE_SPEED;

    if (keys['Space'] && player.onGround) {
      player.vel.y = JUMP_SPEED;
      player.onGround = false;
    }
  } else {
    player.vel.x = 0;
    player.vel.z = 0;
  }

  // gravity
  player.vel.y += GRAVITY * dt;

  // apply movement axis by axis with collision
  tryMove('x', player.vel.x * dt);
  tryMove('z', player.vel.z * dt);

  const beforeY = player.pos.y;
  tryMove('y', player.vel.y * dt);
  player.onGround = (player.vel.y <= 0 && player.pos.y === beforeY + player.vel.y * dt) ? player.onGround : player.onGround;
  // simpler ground check: raycast down small amount
  player.onGround = collidesAt(new THREE.Vector3(player.pos.x, player.pos.y - 0.05, player.pos.z));

  // camera
  camera.position.set(player.pos.x, player.pos.y + player.height * 0.9, player.pos.z);
  camera.rotation.order = 'YXZ';
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  if (needsRebuild) {
    rebuildWorldMesh();
    needsRebuild = false;
  }

  renderer.render(scene, camera);
}
animate();
