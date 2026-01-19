"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const clueFill = document.getElementById("clueFill");
const clueText = document.getElementById("clueText");
const frontMeter = document.getElementById("frontMeter");
const frontIcons = frontMeter
  ? Array.from(frontMeter.querySelectorAll(".front-icon"))
  : [];
const heatText = document.getElementById("heatText");
const accuseFloat = document.getElementById("accuseFloat");
const roundBadge = document.getElementById("roundBadge");
const infoBtn = document.getElementById("infoBtn");
const infoModal = document.getElementById("infoModal");
const infoClose = document.getElementById("infoClose");
const startBtn = document.getElementById("startBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayBody = document.getElementById("overlayBody");

const openInfoModal = () => {
  infoModal.classList.add("show");
  infoModal.setAttribute("aria-hidden", "false");
  infoBtn.setAttribute("aria-expanded", "true");
  requestAnimationFrame(sizeCanvasToViewport);
};

const closeInfoModal = () => {
  infoModal.classList.remove("show");
  infoModal.setAttribute("aria-hidden", "true");
  infoBtn.setAttribute("aria-expanded", "false");
  requestAnimationFrame(sizeCanvasToViewport);
};

const TILE = 16;
const SCALE = 3;
const TILE_PX = TILE * SCALE;
const CLUE_TARGET = 8;
const CLUE_PIP_RATIO = 0.3;

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const BASE_MAP = [
  "#####################",
  "#...................#",
  "#.####.GGT.########.#",
  "#.####.GGG.########.#",
  "#......GGG..........#",
  "#.####.GGG.########.#",
  "#.####.GGG..#######.#",
  "#......GBG...######.#",
  "#.####.GGG.G..#####.#",
  "#.####.GGG.GG..####.#",
  "#......GGGEGGG..###.#",
  "#.####.GGG.GGGG..##.#",
  "#..........GGDGG..#.#",
  "#.########.GGGGGG...#",
  "#.########.GGGGGGGG.#",
  "#.########..........#",
  "#..........########.#",
  "#.########.########.#",
  "#.########..........#",
  "#.###K####.########.#",
  "#.########.########.#",
  "#.########..........#",
  "#..........########.#",
  "#.########.########.#",
  "#.########..........#",
  "#..........###########",
  "#####################",
];


const MAP_HEIGHT = BASE_MAP.length;
const MAP_WIDTH = BASE_MAP[0].length;

canvas.width = MAP_WIDTH * TILE_PX;
canvas.height = MAP_HEIGHT * TILE_PX;
const canvasShell = canvas.parentElement;
const gameWrap = document.querySelector(".game-wrap");
const hudPanel = document.querySelector(".hud-panel");

const sizeCanvasToViewport = () => {
  if (!canvasShell || !gameWrap) {
    return;
  }
  const wrapRect = gameWrap.getBoundingClientRect();
  if (!wrapRect.width || !wrapRect.height) {
    return;
  }
  const ratio = canvas.width / canvas.height;
  const hudRect = hudPanel ? hudPanel.getBoundingClientRect() : null;
  const availableHeight = wrapRect.height - (hudRect ? hudRect.height : 0);
  const safeHeight = Math.max(0, availableHeight);
  let width = wrapRect.width;
  let height = width / ratio;
  if (height > safeHeight) {
    height = safeHeight;
    width = height * ratio;
  }
  canvasShell.style.width = `${Math.floor(width)}px`;
  canvasShell.style.height = `${Math.floor(height)}px`;
  if (hudPanel) {
    hudPanel.style.width = `${Math.floor(width)}px`;
    hudPanel.style.marginLeft = "auto";
    hudPanel.style.marginRight = "auto";
  }
};

window.addEventListener("resize", sizeCanvasToViewport);
sizeCanvasToViewport();
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(sizeCanvasToViewport);
}
window.addEventListener("load", () => {
  requestAnimationFrame(sizeCanvasToViewport);
});

const STATE = {
  BOOT: "BOOT",
  ROUND_INTRO: "ROUND_INTRO",
  PLAYING: "PLAYING",
  ROUND_WIN: "ROUND_WIN",
  ROUND_LOSE: "ROUND_LOSE",
};

const COLORS = {
  wall: "#2d2623",
  path: "#f0e4d4",
  park: "#7bbf78",
  tube: "#d9332b",
  clue: "#f3c16c",
  shop: "#6fbfa7",
  shopBad: "#c84d3a",
  shopExposed: "#1c1512",
  player: "#1c1512",
  enemy: "#e36f4e",
};

const sprites = {
  journo: new Image(),
  roadman: new Image(),
  barber: new Image(),
  tube: new Image(),
  laundry: new Image(),
  shank: new Image(),
  bball: new Image(),
  kebab: new Image(),
  loaded: false,
  readyCount: 0,
};

sprites.journo.src = "sprites/journo.png";
sprites.roadman.src = "sprites/roadman.png";
sprites.barber.src = "sprites/barber.png";
sprites.tube.src = "sprites/tube.png";
sprites.laundry.src = "sprites/laundry.png";
sprites.shank.src = "sprites/shank.png";
sprites.bball.src = "sprites/bball.png";
sprites.kebab.src = "sprites/kebab.png";

[
  sprites.journo,
  sprites.roadman,
  sprites.barber,
  sprites.tube,
  sprites.laundry,
  sprites.shank,
  sprites.bball,
  sprites.kebab,
].forEach((img) => {
  img.addEventListener("load", () => {
    sprites.readyCount += 1;
    sprites.loaded = sprites.readyCount === 8;
  });
  img.addEventListener("error", () => {
    sprites.loaded = false;
  });
});

let state = STATE.BOOT;
let roundIndex = 1;
let tiles = [];
let shopSlots = [];
let playerSpawn = { x: 1, y: 1 };
let enemySpawns = [];
let shops = [];
let shopBlocks = new Set();
let roadTiles = [];
let clues = new Set();
let enemies = [];

let clueMeter = 0;
let clueTarget = 0;
let exposedBadCount = 0;
let penaltyStacks = 0;
let freezeTimer = 0;
let hitCooldown = 0;
let messageTimer = 0;
let messageText = "";
let messageColor = "#d9332b";
const SUCCESS_MESSAGES = [
  "Nice one! I thought there were too many barber shops here...",
  "Case closed. That shop was washing more than towels.",
  "Exposed! The receipts were doing the moonwalk.",
  "Front busted. That 'cash only' sign was doing a lot.",
  "You clocked it. That shop was squeaky clean for a reason.",
  "Good spot. That till was too busy for a quiet street.",
];
let tapDir = null;
let tapTimer = 0;
let tapPos = { x: 0, y: 0 };
let enterPressCount = 0;
let timeScale = 1;
let timeSeconds = 0;

const player = {
  x: 0,
  y: 0,
  dir: "left",
  nextDir: "left",
  speed: 2.0,
};

let lastTime = 0;
let accumulator = 0;
const STEP = 1000 / 60;

function parseBaseMap() {
  tiles = [];
  enemySpawns = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    const row = [];
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const char = BASE_MAP[y][x];
      if (char === "#") {
        row.push(0);
      } else if (char === "G") {
        row.push(2);
      } else if (char === "T") {
        row.push(3);
      } else if (char === "D") {
        row.push(4);
      } else if (char === "B") {
        row.push(5);
      } else if (char === "K") {
        row.push(6);
      } else {
        row.push(1);
      }
      if (char === "P") {
        playerSpawn = { x, y };
      }
    }
    tiles.push(row);
  }
}

function buildShopSlots() {
  const slots = [];
  for (let y = 1; y < MAP_HEIGHT - 1; y += 1) {
    for (let x = 1; x < MAP_WIDTH - 1; x += 1) {
      if (tiles[y][x] !== 0) continue;
      const hasRoadNeighbor =
        tiles[y - 1][x] === 1 ||
        tiles[y + 1][x] === 1 ||
        tiles[y][x - 1] === 1 ||
        tiles[y][x + 1] === 1;
      if (hasRoadNeighbor) {
        slots.push({ x, y });
      }
    }
  }
  shopSlots = slots;
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function tileCenter(pos) {
  return {
    x: (pos.x + 0.5) * TILE_PX,
    y: (pos.y + 0.5) * TILE_PX,
  };
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function toRoman(num) {
  const map = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let value = Math.max(1, Math.floor(num));
  let out = "";
  map.forEach(([amount, numeral]) => {
    while (value >= amount) {
      out += numeral;
      value -= amount;
    }
  });
  return out;
}

function startRound() {
  clueMeter = 0;
  exposedBadCount = 0;
  penaltyStacks = 0;
  freezeTimer = 0;
  hitCooldown = 0;
  updateFrontMeter();

  const numEnemies = clamp(1 + roundIndex, 2, 5);
  buildShopSlots();
  const numShops = Math.min(shopSlots.length, 4 + (roundIndex - 1));
  const badShopCount = 3;
  clueTarget = CLUE_TARGET;

  const chosenShops = shuffle(shopSlots).slice(0, numShops);
  shops = chosenShops.map((slot) => ({
    x: slot.x,
    y: slot.y,
    isBad: false,
    exposed: false,
  }));
  shopBlocks = new Set(shops.map((shop) => keyFor(shop.x, shop.y)));
  shuffle(shops)
    .slice(0, badShopCount)
    .forEach((shop) => {
      shop.isBad = true;
    });

  roadTiles = [];
  clues.clear();
  const eligibleClues = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (tiles[y][x] !== 1) continue;
      roadTiles.push({ x, y });
      const isShop = shops.some((shop) => shop.x === x && shop.y === y);
      if (isShop) continue;
      if (x === playerSpawn.x && y === playerSpawn.y) continue;
      if (enemySpawns.some((spawn) => spawn.x === x && spawn.y === y)) continue;
      eligibleClues.push({ x, y });
    }
  }
  const clueCount = Math.round(eligibleClues.length * CLUE_PIP_RATIO);
  console.log("Number of clues:", clueCount);
  console.log("Min clues required: ", CLUE_TARGET * (3 - exposedBadCount));
  shuffle(eligibleClues)
    .slice(0, clueCount)
    .forEach((tile) => {
      clues.add(keyFor(tile.x, tile.y));
    });

  const spawnCenter = tileCenter(playerSpawn);
  player.x = spawnCenter.x;
  player.y = spawnCenter.y;
  player.dir = "left";
  player.nextDir = "left";

  const enemyCandidates = shuffle(
    roadTiles.filter(
      (tile) =>
        !(tile.x === playerSpawn.x && tile.y === playerSpawn.y) &&
        !shopBlocks.has(keyFor(tile.x, tile.y))
    )
  );
  enemies = [];
  for (let i = 0; i < numEnemies; i += 1) {
    const spawn = enemyCandidates[i % enemyCandidates.length] || playerSpawn;
    const center = tileCenter(spawn);
    enemies.push({
      x: center.x,
      y: center.y,
      dir: "right",
      speed: 1.6 + roundIndex * 0.1,
    });
  }
}

function updateFrontMeter() {
  frontIcons.forEach((icon, index) => {
    icon.classList.toggle("exposed", index < exposedBadCount);
  });
}

function showOverlay(title, body) {
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  overlay.classList.add("show");
}

function hideOverlay() {
  overlay.classList.remove("show");
}

function enterRoundIntro() {
  state = STATE.ROUND_INTRO;
  showOverlay(
    `Round ${toRoman(roundIndex)}`,
    "Follow the clues. Expose 3 money laundering fronts."
  );
  startBtn.textContent = "Start";
  startBtn.hidden = false;
}

function enterRoundWin() {
  state = STATE.ROUND_WIN;
  showOverlay("Fronts Exposed", "3 money laundering fronts down. Next round incoming.");
  startBtn.hidden = true;
  setTimeout(() => {
    hideOverlay();
    roundIndex += 1;
    startRound();
    enterRoundIntro();
  }, 1600);
}

function enterRoundLose() {
  state = STATE.ROUND_LOSE;
  showOverlay("The trail's gone cold", "You've run out of clues.");
  startBtn.textContent = "Play again";
  startBtn.hidden = false;
}

function isWall(tileX, tileY) {
  if (tileX < 0 || tileY < 0 || tileX >= MAP_WIDTH || tileY >= MAP_HEIGHT) {
    return true;
  }
  if (tiles[tileY][tileX] !== 1) return true;
  return shopBlocks.has(keyFor(tileX, tileY));
}

function canMoveFromCenter(px, py, dir) {
  const tileX = Math.floor(px / TILE_PX);
  const tileY = Math.floor(py / TILE_PX);
  return !isWall(tileX + dir.x, tileY + dir.y);
}

function nearCenter(px, py) {
  const cx = (Math.floor(px / TILE_PX) + 0.5) * TILE_PX;
  const cy = (Math.floor(py / TILE_PX) + 0.5) * TILE_PX;
  return Math.abs(px - cx) < 0.5 && Math.abs(py - cy) < 0.5;
}

function snapToCenter(entity) {
  entity.x = (Math.floor(entity.x / TILE_PX) + 0.5) * TILE_PX;
  entity.y = (Math.floor(entity.y / TILE_PX) + 0.5) * TILE_PX;
}

function updatePlayer() {
  const dir = DIRS[player.dir];
  const next = DIRS[player.nextDir];

  if (nearCenter(player.x, player.y)) {
    snapToCenter(player);
    if (canMoveFromCenter(player.x, player.y, next)) {
      player.dir = player.nextDir;
    } else if (!canMoveFromCenter(player.x, player.y, dir)) {
      return;
    }
  }

  const move = DIRS[player.dir];
  player.x += move.x * player.speed;
  player.y += move.y * player.speed;
}

function possibleDirs(entity) {
  return Object.entries(DIRS).filter(([, dir]) =>
    canMoveFromCenter(entity.x, entity.y, dir)
  );
}

function reverseDir(dir) {
  if (dir === "up") return "down";
  if (dir === "down") return "up";
  if (dir === "left") return "right";
  return "left";
}

function chooseEnemyDir(enemy) {
  const allOptions = possibleDirs(enemy);
  if (!allOptions.length) return reverseDir(enemy.dir);
  const reverse = reverseDir(enemy.dir);
  const options = allOptions.filter(([name]) => name !== reverse);
  const picks = options.length ? options : allOptions;
  if (picks.length === 1) return picks[0][0];

  if (Math.random() < 0.5) {
    const playerTile = {
      x: Math.floor(player.x / TILE_PX),
      y: Math.floor(player.y / TILE_PX),
    };
    let best = picks[0];
    let bestDist = Infinity;
    picks.forEach(([name, dir]) => {
      const tx = Math.floor((enemy.x + dir.x * TILE_PX) / TILE_PX);
      const ty = Math.floor((enemy.y + dir.y * TILE_PX) / TILE_PX);
      const dist = Math.abs(playerTile.x - tx) + Math.abs(playerTile.y - ty);
      if (dist < bestDist) {
        bestDist = dist;
        best = [name, dir];
      }
    });
    return best[0];
  }

  const randomPick = picks[Math.floor(Math.random() * picks.length)];
  return randomPick[0];
}

function updateEnemies() {
  const speedMult = 1 + penaltyStacks * 0.2;
  enemies.forEach((enemy) => {
    if (freezeTimer > 0) return;
    if (nearCenter(enemy.x, enemy.y)) {
      snapToCenter(enemy);
      enemy.dir = chooseEnemyDir(enemy);
      if (!canMoveFromCenter(enemy.x, enemy.y, DIRS[enemy.dir])) return;
    }
    const dir = DIRS[enemy.dir];
    const nextX = enemy.x + dir.x * enemy.speed * speedMult;
    const nextY = enemy.y + dir.y * enemy.speed * speedMult;
    const nextTileX = Math.floor(nextX / TILE_PX);
    const nextTileY = Math.floor(nextY / TILE_PX);
    if (isWall(nextTileX, nextTileY)) {
      snapToCenter(enemy);
      return;
    }
    enemy.x = nextX;
    enemy.y = nextY;
  });
}

function updateClues() {
  const tileX = Math.floor(player.x / TILE_PX);
  const tileY = Math.floor(player.y / TILE_PX);
  const key = keyFor(tileX, tileY);
  if (clues.has(key)) {
    clues.delete(key);
    clueMeter = clamp(clueMeter + 1, 0, clueTarget);
  }
}

function getNearbyShop() {
  const playerTile = {
    x: Math.floor(player.x / TILE_PX),
    y: Math.floor(player.y / TILE_PX),
  };
  return shops.find((shop) => {
    if (shop.exposed) return false;
    const dx = shop.x - playerTile.x;
    const dy = shop.y - playerTile.y;
    return Math.hypot(dx, dy) <= 2;
  });
}

function nearestShopDistance() {
  const playerTile = {
    x: Math.floor(player.x / TILE_PX),
    y: Math.floor(player.y / TILE_PX),
  };
  let best = Infinity;
  shops.forEach((shop) => {
    if (shop.exposed) return;
    const dx = shop.x - playerTile.x;
    const dy = shop.y - playerTile.y;
    const dist = Math.hypot(dx, dy);
    if (dist < best) best = dist;
  });
  return best;
}

function attemptAccuse() {
  if (state !== STATE.PLAYING) return;
  const nearShop = getNearbyShop();
  if (!nearShop) return;
  if (clueMeter < clueTarget) {
    messageText = "you dont have enough clues to accuse a shop";
    messageColor = "#d9332b";
    messageTimer = 120;
    return;
  }

  clueMeter = 0;
  if (nearShop.isBad) {
    nearShop.exposed = true;
    exposedBadCount += 1;
    penaltyStacks = Math.max(0, penaltyStacks - 1);
    updateFrontMeter();
    freezeTimer = 60;
    messageText =
      SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
    messageColor = "#2f8f5b";
    messageTimer = 120;
    if (exposedBadCount >= 3) {
      enterRoundWin();
    }
  } else {
    penaltyStacks += 1;
    messageText = "Wrong - that shop is legit! Back to the drawing board...";
    messageColor = "#d9332b";
    messageTimer = 120;
  }
}

function updateHits() {
  if (hitCooldown > 0) {
    hitCooldown -= 1;
    return;
  }
  enemies.forEach((enemy) => {
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < TILE_PX * 0.45) {
      const center = tileCenter(playerSpawn);
      player.x = center.x;
      player.y = center.y;
      clueMeter = 0;
      messageText = "The mandem won this one...";
      messageColor = "#d9332b";
      messageTimer = 120;
      hitCooldown = 60;
    }
  });
}

function updateHUD() {
  const ratio = clueTarget === 0 ? 0 : clueMeter / clueTarget;
  clueFill.style.width = `${Math.floor(ratio * 100)}%`;
  clueText.textContent = `CLUES: ${clueMeter}/${clueTarget}`;
  updateFrontMeter();
  heatText.textContent = `x${(1 + penaltyStacks * 0.2).toFixed(1)}`;
  roundBadge.textContent = `Round ${toRoman(roundIndex)}`;
  const nearShop = getNearbyShop();
  const dist = nearestShopDistance();
  const baseOpacity = 0.2;
  let opacity = baseOpacity;
  if (state === STATE.PLAYING && dist <= 3) {
    const factor = clamp((3 - dist) / 1, 0, 1);
    opacity = baseOpacity + factor * (1 - baseOpacity);
  }
  accuseFloat.style.display = "block";
  accuseFloat.style.opacity = opacity.toFixed(2);
  accuseFloat.disabled = !nearShop || clueMeter < clueTarget;
}

function updateTimers() {
  if (freezeTimer > 0) freezeTimer -= 1;
  if (messageTimer > 0) messageTimer -= 1;
  if (tapTimer > 0) tapTimer -= 1;
}

function checkLossCondition() {
  const remainingBad = 3 - exposedBadCount;
  if (remainingBad <= 0) return;
  if (clueMeter + clues.size < CLUE_TARGET * remainingBad) {
    enterRoundLose();
  }
}

function update() {
  if (state !== STATE.PLAYING) return;
  timeSeconds += STEP / 1000;
  updatePlayer();
  updateClues();
  updateEnemies();
  updateHits();
  updateTimers();
  updateHUD();
  checkLossCondition();
}

function drawTile(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
}

function drawSpriteAt(image, centerX, centerY, size) {
  ctx.drawImage(image, centerX - size / 2, centerY - size / 2, size, size);
}

function drawRotatedSprite(image, centerX, centerY, size, angle) {
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  ctx.drawImage(image, -size / 2, -size / 2, size, size);
  ctx.restore();
}

function draw() {
  ctx.fillStyle = COLORS.path;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (tiles[y][x] === 0) {
        drawTile(x, y, COLORS.wall);
      } else if (
        tiles[y][x] === 2 ||
        tiles[y][x] === 4 ||
        tiles[y][x] === 5 ||
        tiles[y][x] === 6
      ) {
        drawTile(x, y, COLORS.park);
      }
    }
  }

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (tiles[y][x] !== 3) continue;
      if (sprites.loaded) {
        const center = tileCenter({ x, y });
        drawSpriteAt(sprites.tube, center.x, center.y, TILE_PX * 1.3);
      } else {
        drawTile(x, y, COLORS.tube);
      }
    }
  }

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (tiles[y][x] !== 4) continue;
      const center = tileCenter({ x, y });
      if (sprites.loaded) {
        const dx = player.x - center.x;
        const dy = player.y - center.y;
        const angle = Math.atan2(dy, dx) + Math.PI / 2;
        drawRotatedSprite(sprites.shank, center.x, center.y, TILE_PX * 2.2, angle);
      } else {
        ctx.fillStyle = COLORS.wall;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y - TILE_PX * 0.35);
        ctx.lineTo(center.x - TILE_PX * 0.18, center.y + TILE_PX * 0.3);
        ctx.lineTo(center.x + TILE_PX * 0.18, center.y + TILE_PX * 0.3);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (tiles[y][x] !== 5) continue;
      const center = tileCenter({ x, y });
      if (sprites.loaded) {
        const t = (timeSeconds * 1) % 1;
        const arc = Math.sin(Math.PI * t);
        const bounce = Math.pow(arc, 1.6) * (TILE_PX * 0.32);
        drawSpriteAt(
          sprites.bball,
          center.x,
          center.y - bounce,
          TILE_PX * 2.6
        );
      } else {
        ctx.fillStyle = COLORS.enemy;
        ctx.beginPath();
        ctx.arc(center.x, center.y, TILE_PX * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (tiles[y][x] !== 6) continue;
      const center = tileCenter({ x, y });
      if (sprites.loaded) {
        drawTile(x, y, COLORS.wall);
        drawSpriteAt(sprites.kebab, center.x, center.y, TILE_PX * 2.6);
      } else {
        drawTile(x, y, COLORS.wall);
        ctx.fillStyle = COLORS.shopBad;
        ctx.fillRect(
          center.x - TILE_PX * 0.18,
          center.y - TILE_PX * 0.3,
          TILE_PX * 0.36,
          TILE_PX * 0.6
        );
      }
    }
  }

  clues.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    ctx.fillStyle = COLORS.clue;
    ctx.beginPath();
    ctx.arc(
      x * TILE_PX + TILE_PX / 2,
      y * TILE_PX + TILE_PX / 2,
      TILE_PX * 0.15,
      0,
      Math.PI * 2
    );
    ctx.fill();
  });

  shops.forEach((shop) => {
    const center = tileCenter(shop);
    if (sprites.loaded) {
      const size = TILE_PX * 1.3;
      const shopSprite = shop.exposed ? sprites.laundry : sprites.barber;
      drawSpriteAt(shopSprite, center.x, center.y, size);
      if (shop.exposed) {
        ctx.strokeStyle = COLORS.shopExposed;
        ctx.lineWidth = 3;
        ctx.strokeRect(
          shop.x * TILE_PX + TILE_PX * 0.15,
          shop.y * TILE_PX + TILE_PX * 0.15,
          TILE_PX * 0.7,
          TILE_PX * 0.7
        );
      }
    } else {
      let color = COLORS.shop;
      if (shop.exposed) color = COLORS.shopExposed;
      ctx.fillStyle = color;
      ctx.fillRect(
        shop.x * TILE_PX + TILE_PX * 0.2,
        shop.y * TILE_PX + TILE_PX * 0.2,
        TILE_PX * 0.6,
        TILE_PX * 0.6
      );
    }
  });

  if (sprites.loaded) {
    drawSpriteAt(sprites.journo, player.x, player.y, TILE_PX * 0.82);
  } else {
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(player.x, player.y, TILE_PX * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  enemies.forEach((enemy) => {
    if (sprites.loaded) {
      drawSpriteAt(sprites.roadman, enemy.x, enemy.y, TILE_PX * 0.78);
    } else {
      ctx.fillStyle = COLORS.enemy;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, TILE_PX * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  if (messageTimer > 0) {
    const total = 120;
    const elapsed = total - messageTimer;
    const phase = elapsed / total;
    const fadeIn = Math.min(1, elapsed / 12);
    const fadeOut = Math.min(1, (total - elapsed) / 12);
    const alpha = Math.min(fadeIn, fadeOut);
    const rise = Math.sin(phase * Math.PI) * 10;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(28, 21, 18, 0.7)";
    ctx.fillRect(0, canvas.height / 2 - 34 + rise, canvas.width, 68);
    ctx.fillStyle = messageColor;
    ctx.font = "bold 24px 'Gill Sans', 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(messageText, canvas.width / 2, canvas.height / 2 + rise);
    ctx.restore();
  }

  if (tapTimer > 0 && tapDir) {
    const alpha = Math.min(1, tapTimer / 12);
    const centerX = tapPos.x;
    const centerY = tapPos.y;
    const size = TILE_PX * 4.4;
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = "#1c1512";
    ctx.translate(centerX, centerY);
    if (tapDir === "up") ctx.rotate(-Math.PI / 2);
    if (tapDir === "down") ctx.rotate(Math.PI / 2);
    if (tapDir === "left") ctx.rotate(Math.PI);
    ctx.beginPath();
    ctx.moveTo(size * 0.5, 0);
    ctx.lineTo(-size * 0.3, -size * 0.35);
    ctx.lineTo(-size * 0.3, size * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  accumulator += delta * timeScale;
  while (accumulator >= STEP) {
    update();
    accumulator -= STEP;
  }
  draw();
  requestAnimationFrame(loop);
}

function setNextDir(dir) {
  if (!DIRS[dir]) return;
  player.nextDir = dir;
}

function bindControls() {
  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (key === "escape" && infoModal.classList.contains("show")) {
      closeInfoModal();
      return;
    }
    if (key === "enter") {
      enterPressCount += 1;
      if (enterPressCount >= 5) {
        timeScale = 3;
      }
    }
    if (
      key === " " ||
      key === "arrowup" ||
      key === "arrowdown" ||
      key === "arrowleft" ||
      key === "arrowright"
    ) {
      event.preventDefault();
    }
    if (key === "arrowup" || key === "w") setNextDir("up");
    if (key === "arrowdown" || key === "s") setNextDir("down");
    if (key === "arrowleft" || key === "a") setNextDir("left");
    if (key === "arrowright" || key === "d") setNextDir("right");
    if (key === " ") attemptAccuse();
  });

  accuseFloat.addEventListener("click", attemptAccuse);

  canvas.addEventListener("pointerdown", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    event.preventDefault();

    let chosen = null;
    if (y < h * 0.35) {
      chosen = "up";
    } else if (y > h * 0.65) {
      chosen = "down";
    } else if (x < w * 0.35) {
      chosen = "left";
    } else if (x > w * 0.65) {
      chosen = "right";
    }
    if (chosen) {
      setNextDir(chosen);
      tapDir = chosen;
      tapTimer = 22;
      const pad = TILE_PX * 0.9;
      if (chosen === "up") {
        tapPos = { x: (w / 2) * scaleX, y: pad * scaleY };
      } else if (chosen === "down") {
        tapPos = { x: (w / 2) * scaleX, y: (h - pad) * scaleY };
      } else if (chosen === "left") {
        tapPos = { x: pad * scaleX, y: (h / 2) * scaleY };
      } else if (chosen === "right") {
        tapPos = { x: (w - pad) * scaleX, y: (h / 2) * scaleY };
      }
    }
  });

  infoBtn.addEventListener("click", () => {
    openInfoModal();
  });

  infoClose.addEventListener("click", () => {
    closeInfoModal();
  });

  infoModal.addEventListener("click", (event) => {
    if (event.target === infoModal) {
      closeInfoModal();
    }
  });

  startBtn.addEventListener("click", () => {
    if (state === STATE.ROUND_INTRO) {
      hideOverlay();
      state = STATE.PLAYING;
      return;
    }
    if (state === STATE.ROUND_LOSE) {
      hideOverlay();
      roundIndex = 1;
      startRound();
      state = STATE.PLAYING;
    }
  });
}

parseBaseMap();
startRound();
enterRoundIntro();
bindControls();
openInfoModal();
updateHUD();
requestAnimationFrame(loop);
