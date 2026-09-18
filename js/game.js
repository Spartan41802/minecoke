// ============================================================================
// Game: wires together World + Player with rendering, UI, and game rules.
// ============================================================================

(function () {
  const $ = (id) => document.getElementById(id);

  let scene, camera, renderer, world, player;
  let clock = new THREE.Clock();
  let uiState = 'title'; // title | playing | paused | creative_inv | craft_inv | howto
  let mode = 'creative';
  let selectedSlot = 0;
  let inventory = new Array(36).fill(null); // 0-8 = hotbar
  let health = 20, hunger = 20;
  let hungerTimer = 0, regenTimer = 0;
  let mining = null; // { x,y,z, progress, required }
  let highlightBox;
  let fpsSmooth = 60;
  let toastTimer = 0;

  const input = { forward: false, back: false, left: false, right: false, jump: false, down: false, sprint: false, mouseDown: false, rightDown: false };

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  window.addEventListener('load', () => {
    drawTitleBackground();
    $('loading-screen').classList.add('hidden');
    wireTitleScreen();
  });

  function drawTitleBackground() {
    const canvas = $('title-bg');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; paint(); };
    function paint() {
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      const tile = 72;
      const horizon = Math.floor(canvas.height * 0.42);
      ctx.fillStyle = '#7ec9f0';
      ctx.fillRect(0, 0, canvas.width, horizon);
      let row = 0;
      for (let y = horizon; y < canvas.height; y += tile) {
        const key = row === 0 ? 'grass_top' : 'stone';
        for (let x = 0; x < canvas.width; x += tile) ctx.drawImage(TEX[key], x, y, tile, tile);
        row++;
      }
    }
    window.addEventListener('resize', resize);
    resize();
  }

  function wireTitleScreen() {
    $('btn-creative').onclick = () => startGame('creative');
    $('btn-survival').onclick = () => startGame('survival');
    $('btn-howto').onclick = () => { $('howto-screen').classList.remove('hidden'); };
    $('btn-howto-close').onclick = () => { $('howto-screen').classList.add('hidden'); };
    $('btn-resume').onclick = () => resumeFromPause();
    $('btn-quit').onclick = () => quitToTitle();
    document.addEventListener('keydown', (e) => { if (e.code === 'Escape') { $('howto-screen').classList.add('hidden'); } });
  }

  // ------------------------------------------------------------------
  // Start / stop
  // ------------------------------------------------------------------
  function startGame(chosenMode) {
    mode = chosenMode;
    $('title-screen').classList.add('hidden');
    $('loading-screen').classList.remove('hidden');
    $('loading-text').textContent = 'Generating world…';

    setTimeout(() => {
      setupSceneIfNeeded();
      if (world) { scene.remove(world.group); }
      world = new World(40, 30, 40, Math.floor(Math.random() * 1e9));
      world.generate();
      world.rebuildMeshes(scene);
      player = new Player(world, camera);
      player.setMode(mode);

      inventory = new Array(36).fill(null);
      health = 20; hunger = 20; hungerTimer = 0; regenTimer = 0;
      selectedSlot = 0;
      mining = null;

      if (mode === 'survival') {
        // starter kit: nothing but bare hands, matching vanilla survival
        inventory[0] = { key: 'wooden_pickaxe', count: 1, durability: ITEMS.wooden_pickaxe.durability };
      }

      $('game-canvas').classList.remove('hidden');
      $('hud').classList.remove('hidden');
      $('mode-label').textContent = mode === 'creative' ? 'Creative Mode' : 'Survival Mode';
      document.getElementById('vitals').style.display = mode === 'survival' ? 'flex' : 'none';

      renderHotbar();
      renderVitals();
      $('loading-screen').classList.add('hidden');

      uiState = 'playing';
      requestPointerLock();
      clock.getDelta();
      requestAnimationFrame(loop);
    }, 30);
  }

  function quitToTitle() {
    uiState = 'title';
    document.exitPointerLock();
    $('game-canvas').classList.add('hidden');
    $('hud').classList.add('hidden');
    $('pause-screen').classList.add('hidden');
    $('creative-inv').classList.add('hidden');
    $('craft-inv').classList.add('hidden');
    $('title-screen').classList.remove('hidden');
  }

  let sceneReady = false;
  function setupSceneIfNeeded() {
    if (sceneReady) return;
    sceneReady = true;
    const canvas = $('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 28, 60);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xfff3d6, 0.85);
    sun.position.set(40, 70, 20);
    scene.add(sun);
    const fill = new THREE.HemisphereLight(0xbfe0ff, 0x3a2f1e, 0.35);
    scene.add(fill);

    const boxGeo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(boxGeo);
    highlightBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
    scene.add(highlightBox);

    window.addEventListener('resize', () => {
      if (!camera) return;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    wireGameInput();
  }

  // ------------------------------------------------------------------
  // Pointer lock & input
  // ------------------------------------------------------------------
  function requestPointerLock() { $('game-canvas').requestPointerLock(); }

  function wireGameInput() {
    const canvas = $('game-canvas');
    canvas.addEventListener('click', () => {
      if (uiState === 'playing') requestPointerLock();
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) {
        if (uiState === 'paused') { uiState = 'playing'; $('pause-screen').classList.add('hidden'); }
      } else {
        if (uiState === 'playing') { uiState = 'paused'; $('pause-screen').classList.remove('hidden'); }
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (uiState !== 'playing' || document.pointerLockElement !== canvas || !player) return;
      const sens = 0.0022;
      player.yaw -= e.movementX * sens;
      player.pitch -= e.movementY * sens;
      const lim = Math.PI / 2 - 0.02;
      player.pitch = Math.max(-lim, Math.min(lim, player.pitch));
    });

    canvas.addEventListener('mousedown', (e) => {
      if (uiState !== 'playing') return;
      if (e.button === 0) input.mouseDown = true;
      if (e.button === 2) { input.rightDown = true; handleRightClick(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) { input.mouseDown = false; mining = null; hideBreakingBar(); }
      if (e.button === 2) input.rightDown = false;
    });
    canvas.addEventListener('wheel', (e) => {
      if (uiState !== 'playing') return;
      selectedSlot = (selectedSlot + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      renderHotbar();
    });

    document.addEventListener('keydown', (e) => onKeyDown(e));
    document.addEventListener('keyup', (e) => onKeyUp(e));
  }

  function onKeyDown(e) {
    switch (e.code) {
      case 'KeyW': input.forward = true; break;
      case 'KeyS': input.back = true; break;
      case 'KeyA': input.left = true; break;
      case 'KeyD': input.right = true; break;
      case 'ShiftLeft': case 'ShiftRight': input.sprint = true; input.down = true; break;
      case 'Space':
        input.jump = true;
        if (uiState === 'playing' && player && player.mode === 'creative') {
          const now = performance.now();
          if (now - player.lastSpaceTime < 300) player.flying = !player.flying;
          player.lastSpaceTime = now;
        }
        break;
      case 'KeyE':
        if (uiState === 'playing') openInventory();
        else if (uiState === 'creative_inv' || uiState === 'craft_inv') closeInventory();
        break;
      case 'Escape':
        if (uiState === 'creative_inv' || uiState === 'craft_inv') closeInventory();
        break;
      case 'KeyF':
        if (uiState === 'playing') tryEatSelected();
        break;
      case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': case 'Digit5':
      case 'Digit6': case 'Digit7': case 'Digit8': case 'Digit9':
        if (uiState === 'playing') { selectedSlot = Number(e.code.slice(5)) - 1; renderHotbar(); }
        break;
    }
  }
  function onKeyUp(e) {
    switch (e.code) {
      case 'KeyW': input.forward = false; break;
      case 'KeyS': input.back = false; break;
      case 'KeyA': input.left = false; break;
      case 'KeyD': input.right = false; break;
      case 'ShiftLeft': case 'ShiftRight': input.sprint = false; input.down = false; break;
      case 'Space': input.jump = false; break;
    }
  }

  function resumeFromPause() { requestPointerLock(); }

  // ------------------------------------------------------------------
  // Inventory management (unified 36-slot array; slots 0-8 are the hotbar)
  // ------------------------------------------------------------------
  function stackSizeFor(key) {
    const def = getItemOrBlockDef(key);
    return def ? def.stackSize : 64;
  }
  function addItemToInventory(key, count) {
    let remaining = count;
    const maxStack = stackSizeFor(key);
    for (let i = 0; i < inventory.length && remaining > 0; i++) {
      const s = inventory[i];
      if (s && s.key === key && !s.durability && s.count < maxStack) {
        const add = Math.min(maxStack - s.count, remaining);
        s.count += add; remaining -= add;
      }
    }
    for (let i = 0; i < inventory.length && remaining > 0; i++) {
      if (!inventory[i]) {
        const add = Math.min(maxStack, remaining);
        inventory[i] = { key, count: add };
        remaining -= add;
      }
    }
    return count - remaining; // amount actually added
  }
  function addToolToInventory(key) {
    for (let i = 0; i < inventory.length; i++) {
      if (!inventory[i]) {
        inventory[i] = { key, count: 1, durability: ITEMS[key].durability };
        return true;
      }
    }
    return false; // inventory full
  }
  function countItem(key) {
    let total = 0;
    for (const s of inventory) if (s && s.key === key) total += s.count;
    return total;
  }
  function removeItemFromInventory(key, count) {
    let remaining = count;
    for (let i = 0; i < inventory.length && remaining > 0; i++) {
      const s = inventory[i];
      if (s && s.key === key) {
        const rem = Math.min(s.count, remaining);
        s.count -= rem; remaining -= rem;
        if (s.count <= 0) inventory[i] = null;
      }
    }
    return remaining === 0;
  }

  function showToast(text) {
    const el = $('pickup-toast');
    el.textContent = text;
    el.classList.remove('hidden');
    toastTimer = 1.2;
  }

  // ------------------------------------------------------------------
  // Hotbar / slot rendering
  // ------------------------------------------------------------------
  function makeSlotContent(slot) {
    const wrap = document.createElement('div');
    if (!slot) return wrap;
    const icon = getIcon(slot.key);
    const img = document.createElement('canvas');
    img.width = 16; img.height = 16;
    img.getContext('2d').drawImage(icon, 0, 0);
    wrap.appendChild(img);
    if (!slot.creative) {
      const count = document.createElement('div');
      count.className = 'count';
      if (slot.count > 1) count.textContent = slot.count;
      wrap.appendChild(count);
    }
    if (slot.durability !== undefined) {
      const bar = document.createElement('div'); bar.className = 'durability';
      const fill = document.createElement('div'); fill.className = 'durability-fill';
      const pct = Math.max(0, slot.durability / ITEMS[slot.key].maxDurability);
      fill.style.width = (pct * 100) + '%';
      fill.style.background = pct > 0.5 ? '#6bcf3f' : (pct > 0.2 ? '#e0d24a' : '#e05a4a');
      bar.appendChild(fill);
      wrap.appendChild(bar);
    }
    return wrap;
  }

  function renderHotbar() {
    const bar = $('hotbar');
    bar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'slot' + (i === selectedSlot ? ' selected' : '');
      slotEl.appendChild(makeSlotContent(inventory[i]));
      slotEl.onclick = () => { selectedSlot = i; renderHotbar(); };
      bar.appendChild(slotEl);
    }
    renderHotbarPreview('creative-hotbar-row');
    renderHotbarPreview('craft-hotbar-row');
  }
  function renderHotbarPreview(containerId) {
    const el = $(containerId);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const slotEl = document.createElement('div');
      slotEl.className = 'slot' + (i === selectedSlot ? ' selected' : '');
      slotEl.appendChild(makeSlotContent(inventory[i]));
      slotEl.onclick = () => { selectedSlot = i; renderHotbar(); };
      el.appendChild(slotEl);
    }
  }

  function renderVitals() {
    if (mode !== 'survival') return;
    const heartsEl = $('hearts'), hungerEl = $('hunger');
    heartsEl.innerHTML = ''; hungerEl.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const val = health - i * 2;
      const pip = document.createElement('div');
      pip.className = 'pip ' + (val >= 2 ? 'heart-full' : val === 1 ? 'heart-half' : 'heart-empty');
      heartsEl.appendChild(pip);
    }
    for (let i = 0; i < 10; i++) {
      const val = hunger - i * 2;
      const pip = document.createElement('div');
      pip.className = 'pip ' + (val >= 2 ? 'hunger-full' : val === 1 ? 'hunger-half' : 'hunger-empty');
      hungerEl.appendChild(pip);
    }
  }

  // ------------------------------------------------------------------
  // Creative picker / Survival crafting menu
  // ------------------------------------------------------------------
  function openInventory() {
    document.exitPointerLock();
    if (mode === 'creative') {
      uiState = 'creative_inv';
      renderCreativeGrid();
      $('creative-inv').classList.remove('hidden');
    } else {
      uiState = 'craft_inv';
      renderCraftScreen();
      $('craft-inv').classList.remove('hidden');
    }
  }
  function closeInventory() {
    $('creative-inv').classList.add('hidden');
    $('craft-inv').classList.add('hidden');
    uiState = 'playing';
    requestPointerLock();
  }

  function renderCreativeGrid() {
    const grid = $('creative-grid');
    grid.innerHTML = '';
    for (const key of CREATIVE_BLOCK_ORDER) {
      const cell = document.createElement('div');
      cell.className = 'item-cell';
      cell.title = key.replace(/_/g, ' ');
      const icon = getIcon(key);
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.getContext('2d').drawImage(icon, 0, 0);
      cell.appendChild(c);
      cell.onclick = () => {
        inventory[selectedSlot] = { key, count: 1, creative: true };
        renderHotbar();
      };
      grid.appendChild(cell);
    }
  }

  function renderCraftScreen() {
    // storage grid: show all inventory slots (36) so player can move items to hotbar
    const grid = $('inv-storage-grid');
    grid.innerHTML = '';
    for (let i = 0; i < inventory.length; i++) {
      const cell = document.createElement('div');
      cell.className = 'item-cell';
      const slot = inventory[i];
      if (slot) {
        const icon = getIcon(slot.key);
        const c = document.createElement('canvas'); c.width = 16; c.height = 16;
        c.getContext('2d').drawImage(icon, 0, 0);
        cell.appendChild(c);
        if (slot.count > 1) { const cnt = document.createElement('div'); cnt.className = 'count'; cnt.textContent = slot.count; cell.appendChild(cnt); }
        cell.title = slot.key.replace(/_/g, ' ') + ' x' + slot.count;
        cell.onclick = () => {
          // swap this slot into the currently selected hotbar slot
          const tmp = inventory[selectedSlot];
          inventory[selectedSlot] = slot;
          inventory[i] = tmp;
          renderHotbar(); renderCraftScreen();
        };
      }
      grid.appendChild(cell);
    }

    renderRecipeList('craft-recipe-list', CRAFT_RECIPES);
    renderRecipeList('smelt-recipe-list', SMELT_RECIPES);
  }

  function canAfford(recipe) {
    for (const k in recipe.needs) if (countItem(k) < recipe.needs[k]) return false;
    return true;
  }
  function renderRecipeList(containerId, recipes) {
    const el = $(containerId);
    el.innerHTML = '';
    for (const recipe of recipes) {
      const afford = canAfford(recipe);
      const row = document.createElement('div');
      row.className = 'recipe-row' + (afford ? '' : ' disabled');
      const icon = getIcon(recipe.result);
      const c = document.createElement('canvas'); c.width = 16; c.height = 16;
      c.getContext('2d').drawImage(icon, 0, 0);
      row.appendChild(c);
      const text = document.createElement('div'); text.className = 'recipe-text';
      const needsStr = Object.entries(recipe.needs).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ');
      text.innerHTML = `<div>${recipe.count}x ${recipe.result.replace(/_/g, ' ')}</div><div class="recipe-cost">needs ${needsStr}</div>`;
      row.appendChild(text);
      row.onclick = () => {
        if (!canAfford(recipe)) return;
        for (const k in recipe.needs) removeItemFromInventory(k, recipe.needs[k]);
        const isTool = ITEMS[recipe.result] && ITEMS[recipe.result].durability !== undefined;
        if (isTool) {
          for (let i = 0; i < recipe.count; i++) addToolToInventory(recipe.result);
        } else {
          addItemToInventory(recipe.result, recipe.count);
        }
        renderHotbar(); renderCraftScreen();
      };
      el.appendChild(row);
    }
  }

  function tryEatSelected() {
    const slot = inventory[selectedSlot];
    if (!slot) return;
    const def = ITEMS[slot.key];
    if (!def || !def.food) return;
    hunger = Math.min(20, hunger + def.food * 2);
    slot.count--;
    if (slot.count <= 0) inventory[selectedSlot] = null;
    renderHotbar(); renderVitals();
    showToast('Ate ' + slot.key.replace(/_/g, ' '));
  }

  // ------------------------------------------------------------------
  // Mining / placing
  // ------------------------------------------------------------------
  function hideBreakingBar() { $('breaking-bar-wrap').classList.add('hidden'); }

  function requiredBreakTime(def, toolSlot) {
    if (mode === 'creative') return 0;
    const baseHand = def.hardness * 3.2;
    if (!def.toolType) return def.hardness * 1.4; // no tool needed, quick either way
    const tool = toolSlot ? ITEMS[toolSlot.key] : null;
    const toolMatches = tool && tool.toolType === def.toolType;
    if (toolMatches && tool.tier >= def.minTier) {
      return def.hardness * (3.2 / tool.speedMult);
    }
    // wrong or missing tool: much slower, and (handled elsewhere) no drop if tier too low
    return baseHand * (def.minTier > 0 ? 5 : 1.6);
  }

  function canHarvest(def, toolSlot) {
    if (def.minTier === 0) return true;
    const tool = toolSlot ? ITEMS[toolSlot.key] : null;
    return !!(tool && tool.toolType === def.toolType && tool.tier >= def.minTier);
  }

  function handleMining(dt, hit) {
    if (!input.mouseDown || !hit) { mining = null; hideBreakingBar(); return; }
    const id = world.getBlock(hit.x, hit.y, hit.z);
    if (id === AIR || id === BLOCKS.bedrock.id) { mining = null; hideBreakingBar(); return; }
    const def = BLOCKS_BY_ID[id];
    const toolSlot = inventory[selectedSlot];

    if (!mining || mining.x !== hit.x || mining.y !== hit.y || mining.z !== hit.z) {
      mining = { x: hit.x, y: hit.y, z: hit.z, progress: 0, required: requiredBreakTime(def, toolSlot) };
    }
    mining.progress += dt;

    if (mode === 'creative' || mining.progress >= mining.required) {
      breakBlock(hit.x, hit.y, hit.z, def, toolSlot);
      mining = null;
      hideBreakingBar();
    } else {
      $('breaking-bar-wrap').classList.remove('hidden');
      $('breaking-bar-fill').style.width = Math.min(100, (mining.progress / mining.required) * 100) + '%';
    }
  }

  function breakBlock(x, y, z, def, toolSlot) {
    world.setBlock(x, y, z, AIR);
    world.rebuildMeshes(scene);

    if (mode === 'survival') {
      if (def.drop && canHarvest(def, toolSlot)) {
        const n = def.dropMin === def.dropMax ? def.dropMin : (def.dropMin + Math.floor(Math.random() * (def.dropMax - def.dropMin + 1)));
        addItemToInventory(def.drop, n);
        showToast('+' + n + ' ' + def.drop.replace(/_/g, ' '));
      }
      if (def.key === 'leaves' && Math.random() < 0.06) { addItemToInventory('apple', 1); showToast('+1 apple'); }
      // tool durability
      if (toolSlot && ITEMS[toolSlot.key] && ITEMS[toolSlot.key].toolType === def.toolType) {
        toolSlot.durability--;
        if (toolSlot.durability <= 0) inventory[selectedSlot] = null;
      }
      renderHotbar();
    }
  }

  function playerAabbBlocked(x, y, z) {
    if (!player) return false;
    const w = player.width / 2;
    const px0 = player.pos.x - w, px1 = player.pos.x + w;
    const pz0 = player.pos.z - w, pz1 = player.pos.z + w;
    const py0 = player.pos.y, py1 = player.pos.y + player.height;
    return x + 1 > px0 && x < px1 && z + 1 > pz0 && z < pz1 && y + 1 > py0 && y < py1;
  }

  function handleRightClick() {
    if (!player || !world) return;
    const hit = player.raycast(6);
    if (!hit) return;
    const slot = inventory[selectedSlot];
    if (!slot) return;
    const blockDef = BLOCKS[slot.key];
    if (!blockDef || blockDef.placeable === false) return;

    const px = hit.x + (hit.face ? hit.face.x : 0);
    const py = hit.y + (hit.face ? hit.face.y : 0);
    const pz = hit.z + (hit.face ? hit.face.z : 0);
    if (world.getBlock(px, py, pz) !== AIR) return;
    if (playerAabbBlocked(px, py, pz)) return;

    world.setBlock(px, py, pz, blockDef.id);
    world.rebuildMeshes(scene);

    if (!slot.creative) {
      slot.count--;
      if (slot.count <= 0) inventory[selectedSlot] = null;
      renderHotbar();
    }
  }

  // ------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------
  function loop() {
    if (uiState === 'title') return; // stop loop until next startGame()
    requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.08);
    fpsSmooth = fpsSmooth * 0.9 + (1 / Math.max(dt, 0.0001)) * 0.1;

    if (uiState === 'playing' && player) {
      const { fallDamage } = player.update(dt, input);
      if (mode === 'survival' && fallDamage > 0) {
        health = Math.max(0, health - fallDamage);
        renderVitals();
        handleDeathCheck();
      }

      const hit = player.raycast(6);
      if (hit) {
        highlightBox.visible = true;
        highlightBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
      } else {
        highlightBox.visible = false;
      }
      handleMining(dt, hit);

      if (mode === 'survival') updateSurvivalStats(dt);
    } else {
      highlightBox.visible = false;
    }

    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) $('pickup-toast').classList.add('hidden');
    }

    $('fps-label').textContent = Math.round(fpsSmooth) + ' fps';
    renderer.render(scene, camera);
  }

  function updateSurvivalStats(dt) {
    hungerTimer += dt;
    if (hungerTimer > 6) {
      hungerTimer = 0;
      if (hunger > 0) { hunger--; renderVitals(); }
      else { health = Math.max(0, health - 1); renderVitals(); handleDeathCheck(); }
    }
    regenTimer += dt;
    if (regenTimer > 4) {
      regenTimer = 0;
      if (hunger >= 17 && health < 20) { health = Math.min(20, health + 1); renderVitals(); }
    }
  }

  function handleDeathCheck() {
    if (health <= 0) {
      showToast('You died... respawning');
      health = 20; hunger = 20;
      player.pos.set(world.sizeX / 2, world.sizeY, world.sizeZ / 2);
      player.vel.set(0, 0, 0);
      for (let y = world.sizeY - 1; y > 0; y--) {
        if (world.getBlock(Math.floor(player.pos.x), y, Math.floor(player.pos.z)) !== AIR) { player.pos.y = y + 1.05; break; }
      }
      renderVitals();
    }
  }
})();
