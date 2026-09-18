// ============================================================================
// Block & item definitions + procedurally painted 16x16 pixel-art textures.
// No external image files needed — everything is drawn on <canvas> at runtime.
// ============================================================================

const TEX_SIZE = 16;

function newCanvas() {
  const c = document.createElement('canvas');
  c.width = TEX_SIZE; c.height = TEX_SIZE;
  return c;
}

// deterministic-ish speckle noise for a bit of texture grit
function speckle(ctx, colors, density, seed) {
  let s = seed || 1;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let y = 0; y < TEX_SIZE; y++) {
    for (let x = 0; x < TEX_SIZE; x++) {
      if (rnd() < density) {
        ctx.fillStyle = colors[Math.floor(rnd() * colors.length)];
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function fillBase(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
}

function drawGrid(ctx, color, cell) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  for (let i = 0; i <= TEX_SIZE; i += cell) {
    ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, TEX_SIZE); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(TEX_SIZE, i + 0.5); ctx.stroke();
  }
}

const TEX = {}; // name -> canvas

function T(name, drawFn) {
  const c = newCanvas();
  const ctx = c.getContext('2d');
  drawFn(ctx);
  TEX[name] = c;
  return c;
}

T('grass_top', (ctx) => { fillBase(ctx, '#5da130'); speckle(ctx, ['#6cb63a', '#4f8f28', '#79c246'], 0.35, 11); });
T('grass_side', (ctx) => {
  fillBase(ctx, '#8a5a34');
  speckle(ctx, ['#7c4f2c', '#96633a'], 0.25, 22);
  ctx.fillStyle = '#5da130'; ctx.fillRect(0, 0, 16, 5);
  speckle2(ctx, ['#6cb63a', '#4f8f28'], 0, 0, 16, 5, 0.4, 33);
  ctx.fillStyle = '#4f8f28'; ctx.fillRect(0, 4, 16, 2);
});
function speckle2(ctx, colors, x0, y0, w, h, density, seed) {
  let s = seed || 1;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    if (rnd() < density) { ctx.fillStyle = colors[Math.floor(rnd() * colors.length)]; ctx.fillRect(x, y, 1, 1); }
  }
}
T('dirt', (ctx) => { fillBase(ctx, '#8a5a34'); speckle(ctx, ['#7c4f2c', '#96633a', '#6d451f'], 0.35, 44); });
T('stone', (ctx) => { fillBase(ctx, '#8c8c8c'); speckle(ctx, ['#7d7d7d', '#999999', '#6f6f6f'], 0.3, 55); });
T('cobblestone', (ctx) => {
  fillBase(ctx, '#8c8c8c'); speckle(ctx, ['#7d7d7d', '#999999', '#5f5f5f'], 0.45, 66);
  drawGrid(ctx, '#5c5c5c', 4);
});
T('bedrock', (ctx) => { fillBase(ctx, '#3a3a3a'); speckle(ctx, ['#2c2c2c', '#4c4c4c', '#1c1c1c'], 0.5, 77); });
T('sand', (ctx) => { fillBase(ctx, '#dccb85'); speckle(ctx, ['#e6d79a', '#cbb96f'], 0.3, 88); });
T('sandstone', (ctx) => { fillBase(ctx, '#d9c98f'); speckle(ctx, ['#cbb96f', '#e6d79a'], 0.2, 99); drawGrid(ctx, '#c2b070', 4); });
T('water', (ctx) => { fillBase(ctx, '#3a6fd8'); speckle(ctx, ['#4a80e6', '#2f5cb8'], 0.35, 111); });
T('log_top', (ctx) => {
  fillBase(ctx, '#a9834f'); ctx.strokeStyle = '#8a6a3d'; ctx.lineWidth = 1;
  for (let r = 7; r > 0; r -= 2) { ctx.beginPath(); ctx.arc(8, 8, r, 0, 7); ctx.stroke(); }
});
T('log_side', (ctx) => {
  fillBase(ctx, '#7a5a34');
  for (let x = 0; x < 16; x += 3) { ctx.fillStyle = x % 6 === 0 ? '#6b4d2c' : '#87683d'; ctx.fillRect(x, 0, 2, 16); }
});
T('leaves', (ctx) => { fillBase(ctx, '#3e7a26'); speckle(ctx, ['#4c8f2f', '#2f611c', '#59a13a'], 0.5, 122); });
T('planks', (ctx) => {
  fillBase(ctx, '#bd9159');
  for (let y = 0; y < 16; y += 4) { ctx.fillStyle = '#a97e49'; ctx.fillRect(0, y, 16, 1); }
  speckle(ctx, ['#c99c62', '#ad8450'], 0.15, 133);
});
T('glass', (ctx) => {
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = 'rgba(180,220,230,0.35)'; ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.strokeRect(0.5, 0.5, 15, 15);
});
T('brick', (ctx) => {
  fillBase(ctx, '#9c4a34');
  ctx.strokeStyle = '#5c2a1c'; ctx.lineWidth = 1;
  for (let y = 0; y < 16; y += 4) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(16, y + 0.5); ctx.stroke(); }
  for (let y = 0; y < 16; y += 8) for (let x = 0; x < 16; x += 8) { ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + 4); ctx.stroke(); }
  for (let y = 4; y < 16; y += 8) for (let x = 4; x < 16; x += 8) { ctx.beginPath(); ctx.moveTo(x + 0.5, y); ctx.lineTo(x + 0.5, y + 4); ctx.stroke(); }
});
T('snow', (ctx) => { fillBase(ctx, '#f2f8fb'); speckle(ctx, ['#e3edf2', '#ffffff'], 0.25, 144); });
function oreTex(name, dotColors) {
  T(name, (ctx) => {
    fillBase(ctx, '#8c8c8c'); speckle(ctx, ['#7d7d7d', '#999999'], 0.25, 155);
    const s = { s: name.length * 13 + 7 };
    const rnd = () => { s.s = (s.s * 9301 + 49297) % 233280; return s.s / 233280; };
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(rnd() * 13) + 1, y = Math.floor(rnd() * 13) + 1;
      ctx.fillStyle = dotColors[Math.floor(rnd() * dotColors.length)];
      ctx.fillRect(x, y, 2, 2);
    }
  });
}
oreTex('coal_ore', ['#1c1c1c', '#0a0a0a']);
oreTex('iron_ore', ['#d8c3a5', '#b89c78']);
oreTex('gold_ore', ['#f7dd5b', '#e0b93a']);
oreTex('diamond_ore', ['#7ff0e8', '#3fd0c9']);
T('crafting_top', (ctx) => {
  fillBase(ctx, '#a9784a');
  ctx.strokeStyle = '#5c3a1e'; ctx.lineWidth = 1;
  ctx.strokeRect(1.5, 1.5, 13, 13);
  ctx.beginPath(); ctx.moveTo(1.5, 8); ctx.lineTo(14.5, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, 1.5); ctx.lineTo(8, 14.5); ctx.stroke();
});
T('crafting_side', (ctx) => {
  fillBase(ctx, '#bd9159');
  for (let y = 0; y < 16; y += 4) { ctx.fillStyle = '#a97e49'; ctx.fillRect(0, y, 16, 1); }
});
T('furnace_front', (ctx) => {
  fillBase(ctx, '#767676'); speckle(ctx, ['#6a6a6a', '#828282'], 0.25, 166);
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(4, 8, 8, 6);
  ctx.fillStyle = '#3a3a3a'; ctx.fillRect(5, 9, 6, 4);
});
T('furnace_side', (ctx) => { fillBase(ctx, '#767676'); speckle(ctx, ['#6a6a6a', '#828282'], 0.3, 177); });
T('torch_item', (ctx) => {
  ctx.clearRect(0, 0, 16, 16);
  ctx.fillStyle = '#7a5a34'; ctx.fillRect(7, 6, 2, 9);
  ctx.fillStyle = '#ffcf4a'; ctx.fillRect(6, 2, 4, 4);
  ctx.fillStyle = '#ff8a2a'; ctx.fillRect(7, 3, 2, 2);
});

// ---- item-only icons (tools, ingredients) ----
function itemIcon(name, drawFn) { T(name, drawFn); }
itemIcon('stick', (ctx) => { ctx.clearRect(0, 0, 16, 16); ctx.fillStyle = '#8a6a3d'; ctx.save(); ctx.translate(8, 8); ctx.rotate(0.6); ctx.fillRect(-1, -7, 2, 14); ctx.restore(); });
itemIcon('coal', (ctx) => { ctx.clearRect(0, 0, 16, 16); ctx.fillStyle = '#1c1c1c'; ctx.beginPath(); ctx.arc(8, 8, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#3a3a3a'; ctx.fillRect(6, 6, 2, 2); });
itemIcon('iron_ingot', (ctx) => { ctx.clearRect(0, 0, 16, 16); ctx.fillStyle = '#e3dccb'; ctx.fillRect(3, 6, 10, 5); ctx.fillStyle = '#c9c0a8'; ctx.fillRect(3, 10, 10, 1); });
itemIcon('gold_ingot', (ctx) => { ctx.clearRect(0, 0, 16, 16); ctx.fillStyle = '#f7e04a'; ctx.fillRect(3, 6, 10, 5); ctx.fillStyle = '#d9b92a'; ctx.fillRect(3, 10, 10, 1); });
itemIcon('diamond', (ctx) => { ctx.clearRect(0, 0, 16, 16); ctx.fillStyle = '#5be6da'; ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(14, 7); ctx.lineTo(8, 14); ctx.lineTo(2, 7); ctx.closePath(); ctx.fill(); });
itemIcon('apple', (ctx) => { ctx.clearRect(0, 0, 16, 16); ctx.fillStyle = '#c93a3a'; ctx.beginPath(); ctx.arc(8, 9, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#5a3a1c'; ctx.fillRect(7, 2, 2, 3); ctx.fillStyle = '#3e7a26'; ctx.fillRect(9, 2, 3, 2); });

function toolIcon(name, headColor, kind) {
  itemIcon(name, (ctx) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.save(); ctx.translate(8, 8); ctx.rotate(0.7);
    ctx.fillStyle = '#8a6a3d'; ctx.fillRect(-1, -2, 2, 11);
    ctx.fillStyle = headColor;
    if (kind === 'pickaxe') { ctx.fillRect(-6, -8, 12, 3); ctx.fillRect(-6, -8, 3, 6); ctx.fillRect(3, -8, 3, 6); }
    else if (kind === 'axe') { ctx.fillRect(-6, -8, 8, 7); }
    else if (kind === 'shovel') { ctx.fillRect(-3, -9, 6, 6); }
    else if (kind === 'sword') { ctx.fillRect(-2, -9, 4, 10); ctx.fillStyle = '#8a6a3d'; ctx.fillRect(-4, 0, 8, 2); }
    ctx.restore();
  });
}
toolIcon('wooden_pickaxe', '#bd9159', 'pickaxe');
toolIcon('stone_pickaxe', '#9c9c9c', 'pickaxe');
toolIcon('iron_pickaxe', '#e3dccb', 'pickaxe');
toolIcon('diamond_pickaxe', '#5be6da', 'pickaxe');
toolIcon('wooden_axe', '#bd9159', 'axe');
toolIcon('stone_axe', '#9c9c9c', 'axe');
toolIcon('iron_axe', '#e3dccb', 'axe');
toolIcon('wooden_shovel', '#bd9159', 'shovel');
toolIcon('stone_shovel', '#9c9c9c', 'shovel');
toolIcon('iron_shovel', '#e3dccb', 'shovel');
toolIcon('wooden_sword', '#bd9159', 'sword');
toolIcon('stone_sword', '#9c9c9c', 'sword');
toolIcon('iron_sword', '#e3dccb', 'sword');
toolIcon('diamond_sword', '#5be6da', 'sword');

// ============================================================================
// BLOCK REGISTRY
// id 0 is always air.
// faces: [top, bottom, side] texture names (or single 'all')
// ============================================================================
const BLOCKS = {};
let _nextId = 1;
function defBlock(key, opts) {
  const id = _nextId++;
  BLOCKS[key] = Object.assign({
    id, key,
    solid: true,
    transparent: false,
    liquid: false,
    toolType: null,       // 'pickaxe' | 'axe' | 'shovel' | null (any tool / hand)
    minTier: 0,           // 0 hand, 1 wood, 2 stone, 3 iron, 4 diamond
    hardness: 1,          // base seconds to break by hand
    drop: key,            // item key granted, or null for nothing
    dropMin: 1, dropMax: 1,
    placeable: true,
    creative: true,       // shows in creative picker
  }, opts);
  BLOCKS_BY_ID[id] = BLOCKS[key];
  return BLOCKS[key];
}
const BLOCKS_BY_ID = {};

defBlock('grass', { top: 'grass_top', side: 'grass_side', bottom: 'dirt', toolType: 'shovel', hardness: 0.6, drop: 'dirt' });
defBlock('dirt', { all: 'dirt', toolType: 'shovel', hardness: 0.5 });
defBlock('stone', { all: 'stone', toolType: 'pickaxe', minTier: 1, hardness: 1.5, drop: 'cobblestone' });
defBlock('cobblestone', { all: 'cobblestone', toolType: 'pickaxe', minTier: 1, hardness: 2 });
defBlock('bedrock', { all: 'bedrock', hardness: Infinity, drop: null, creative: false });
defBlock('sand', { all: 'sand', toolType: 'shovel', hardness: 0.5 });
defBlock('sandstone', { all: 'sandstone', toolType: 'pickaxe', minTier: 1, hardness: 1.6 });
defBlock('water', { all: 'water', solid: false, transparent: true, liquid: true, placeable: true, drop: null, hardness: 0, creative: true });
defBlock('log', { top: 'log_top', side: 'log_side', bottom: 'log_top', toolType: 'axe', hardness: 1.2 });
defBlock('leaves', { all: 'leaves', transparent: true, hardness: 0.3, drop: null });
defBlock('planks', { all: 'planks', toolType: 'axe', hardness: 1 });
defBlock('glass', { all: 'glass', transparent: true, hardness: 0.5, drop: null });
defBlock('brick', { all: 'brick', toolType: 'pickaxe', minTier: 1, hardness: 2.2 });
defBlock('snow_grass', { top: 'snow', side: 'grass_side', bottom: 'dirt', toolType: 'shovel', hardness: 0.6, drop: 'dirt' });
defBlock('coal_ore', { all: 'coal_ore', toolType: 'pickaxe', minTier: 1, hardness: 2, drop: 'coal', dropMax: 2 });
defBlock('iron_ore', { all: 'iron_ore', toolType: 'pickaxe', minTier: 2, hardness: 2.6, drop: 'iron_ore' });
defBlock('gold_ore', { all: 'gold_ore', toolType: 'pickaxe', minTier: 3, hardness: 2.6, drop: 'gold_ore' });
defBlock('diamond_ore', { all: 'diamond_ore', toolType: 'pickaxe', minTier: 3, hardness: 3, drop: 'diamond' });
defBlock('crafting_table', { top: 'crafting_top', side: 'crafting_side', bottom: 'planks', toolType: 'axe', hardness: 1.4 });
defBlock('furnace', { top: 'cobblestone', side: 'furnace_side', bottom: 'cobblestone', front: 'furnace_front', toolType: 'pickaxe', minTier: 1, hardness: 2.2 });
defBlock('torch', { all: 'torch_item', solid: false, transparent: true, hardness: 0.1, creative: true });

const AIR = 0;

// ============================================================================
// ITEM REGISTRY (tools + raw materials; blocks double as items automatically)
// ============================================================================
const ITEMS = {};
function defItem(key, opts) {
  ITEMS[key] = Object.assign({ key, icon: key, stackSize: 64 }, opts);
}
defItem('dirt', { icon: 'dirt' });
defItem('cobblestone', { icon: 'cobblestone' });
defItem('stick', { icon: 'stick' });
defItem('coal', { icon: 'coal' });
defItem('iron_ore', { icon: 'iron_ore' });
defItem('gold_ore', { icon: 'gold_ore' });
defItem('iron_ingot', { icon: 'iron_ingot' });
defItem('gold_ingot', { icon: 'gold_ingot' });
defItem('diamond', { icon: 'diamond' });
defItem('apple', { icon: 'apple', food: 3 });
defItem('sand', { icon: 'sand' });
defItem('planks', { icon: 'planks' });
defItem('log', { icon: 'log_side' });

function toolDef(key, toolType, tier, durability, speed, damage) {
  defItem(key, { icon: key, stackSize: 1, toolType, tier, durability, maxDurability: durability, speedMult: speed, damage });
}
toolDef('wooden_pickaxe', 'pickaxe', 1, 60, 4, 2);
toolDef('stone_pickaxe', 'pickaxe', 2, 132, 6, 3);
toolDef('iron_pickaxe', 'pickaxe', 3, 251, 8, 4);
toolDef('diamond_pickaxe', 'pickaxe', 4, 1562, 10, 5);
toolDef('wooden_axe', 'axe', 1, 60, 5, 3);
toolDef('stone_axe', 'axe', 2, 132, 7, 4);
toolDef('iron_axe', 'axe', 3, 251, 9, 5);
toolDef('wooden_shovel', 'shovel', 1, 60, 4, 1.5);
toolDef('stone_shovel', 'shovel', 2, 132, 6, 2);
toolDef('iron_shovel', 'shovel', 3, 251, 8, 2.5);
toolDef('wooden_sword', 'sword', 1, 60, 1, 4);
toolDef('stone_sword', 'sword', 2, 132, 1, 5);
toolDef('iron_sword', 'sword', 3, 251, 1, 6);
toolDef('diamond_sword', 'sword', 4, 1562, 1, 7);
defItem('crafting_table', { icon: 'crafting_top' });
defItem('furnace', { icon: 'furnace_front' });
defItem('torch', { icon: 'torch_item' });

// Return the item definition for a key that could be a block OR an item.
function getItemOrBlockDef(key) {
  if (ITEMS[key]) return ITEMS[key];
  if (BLOCKS[key]) return { key, icon: BLOCKS[key].top || BLOCKS[key].all || 'stone', stackSize: 64, isBlock: true };
  return null;
}
function getIcon(key) {
  const def = getItemOrBlockDef(key);
  if (!def) return TEX.stone;
  return TEX[def.icon] || TEX.stone;
}

// list of block keys available in the creative picker, in a friendly order
const CREATIVE_BLOCK_ORDER = [
  'grass', 'dirt', 'stone', 'cobblestone', 'sand', 'sandstone', 'log', 'leaves',
  'planks', 'glass', 'brick', 'snow_grass', 'coal_ore', 'iron_ore', 'gold_ore',
  'diamond_ore', 'crafting_table', 'furnace', 'torch', 'water',
];

// crafting recipes: { key, result, count, needs: {item:count}, category }
const CRAFT_RECIPES = [
  { key: 'planks', result: 'planks', count: 4, needs: { log: 1 } },
  { key: 'stick', result: 'stick', count: 4, needs: { planks: 2 } },
  { key: 'crafting_table', result: 'crafting_table', count: 1, needs: { planks: 4 } },
  { key: 'furnace', result: 'furnace', count: 1, needs: { cobblestone: 8 } },
  { key: 'torch', result: 'torch', count: 4, needs: { coal: 1, stick: 1 } },
  { key: 'wooden_pickaxe', result: 'wooden_pickaxe', count: 1, needs: { planks: 3, stick: 2 } },
  { key: 'wooden_axe', result: 'wooden_axe', count: 1, needs: { planks: 3, stick: 2 } },
  { key: 'wooden_shovel', result: 'wooden_shovel', count: 1, needs: { planks: 1, stick: 2 } },
  { key: 'wooden_sword', result: 'wooden_sword', count: 1, needs: { planks: 2, stick: 1 } },
  { key: 'stone_pickaxe', result: 'stone_pickaxe', count: 1, needs: { cobblestone: 3, stick: 2 } },
  { key: 'stone_axe', result: 'stone_axe', count: 1, needs: { cobblestone: 3, stick: 2 } },
  { key: 'stone_shovel', result: 'stone_shovel', count: 1, needs: { cobblestone: 1, stick: 2 } },
  { key: 'stone_sword', result: 'stone_sword', count: 1, needs: { cobblestone: 2, stick: 1 } },
  { key: 'iron_pickaxe', result: 'iron_pickaxe', count: 1, needs: { iron_ingot: 3, stick: 2 } },
  { key: 'iron_axe', result: 'iron_axe', count: 1, needs: { iron_ingot: 3, stick: 2 } },
  { key: 'iron_shovel', result: 'iron_shovel', count: 1, needs: { iron_ingot: 1, stick: 2 } },
  { key: 'iron_sword', result: 'iron_sword', count: 1, needs: { iron_ingot: 2, stick: 1 } },
  { key: 'diamond_pickaxe', result: 'diamond_pickaxe', count: 1, needs: { diamond: 3, stick: 2 } },
  { key: 'diamond_sword', result: 'diamond_sword', count: 1, needs: { diamond: 2, stick: 1 } },
];

const SMELT_RECIPES = [
  { key: 'iron_ingot', result: 'iron_ingot', count: 1, needs: { iron_ore: 1, coal: 1 } },
  { key: 'gold_ingot', result: 'gold_ingot', count: 1, needs: { gold_ore: 1, coal: 1 } },
  { key: 'glass', result: 'glass', count: 1, needs: { sand: 1, coal: 1 } },
];
