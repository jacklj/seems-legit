"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const clueFill = document.getElementById("clueFill");
const clueText = document.getElementById("clueText");
const exposedText = document.getElementById("exposedText");
const heatText = document.getElementById("heatText");
const accuseBtn = document.getElementById("accuseBtn");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayBody = document.getElementById("overlayBody");

const TILE = 16;
const SCALE = 3;
const TILE_PX = TILE * SCALE;

const DIRS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const BASE_MAP = [
  "#####################",
  "#...................#",
  "#.####.GGG.S####S##.#",
  "#.##S#.GGG.########.#",
  "#......GGG..........#",
  "#.####.GGG.########.#",
  "#.####.GGG..#######.#",
  "#.E....GGG...######.#",
  "#.####.GGG.G..#####.#",
  "#.####.GGG.GG..####.#",
  "#......GGGEGGG..###.#",
  "#.###S.GGG.GGGG..##.#",
  "#..........GGGGG..#.#",
  "#.########.GGGGGG...#",
  "#.########.GGGGGGGG.#",
  "#.########..........#",
  "#..........#S######.#",
  "#.##S#S###.########.#",
  "#.#######S....E.....#",
  "#.########.########.#",
  "#.########.S#######.#",
  "#.########..........#",
  "#..........########.#",
  "#.########.####S###.#",
  "#.########..........#",
  "#....E.....###########",
  "#####################",
];


const MAP_HEIGHT = BASE_MAP.length;
const MAP_WIDTH = BASE_MAP[0].length;

canvas.width = MAP_WIDTH * TILE_PX;
canvas.height = MAP_HEIGHT * TILE_PX;

const STATE = {
  BOOT: "BOOT",
  ROUND_INTRO: "ROUND_INTRO",
  PLAYING: "PLAYING",
  ROUND_WIN: "ROUND_WIN",
};

const COLORS = {
  wall: "#2d2623",
  path: "#f0e4d4",
  park: "#7bbf78",
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
  loaded: false,
  readyCount: 0,
};

sprites.journo.src = "sprites/journo.png";
sprites.roadman.src = "sprites/roadman.png";
sprites.barber.src = "sprites/barber.png";

[sprites.journo, sprites.roadman, sprites.barber].forEach((img) => {
  img.addEventListener("load", () => {
    sprites.readyCount += 1;
    sprites.loaded = sprites.readyCount === 3;
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
let clues = new Set();
let enemies = [];

let clueMeter = 0;
let clueTarget = 0;
let exposedBadCount = 0;
let penaltyStacks = 0;
let freezeTimer = 0;
let hitCooldown = 0;

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
  shopSlots = [];
  enemySpawns = [];
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    const row = [];
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      const char = BASE_MAP[y][x];
      if (char === "#") {
        row.push(0);
      } else if (char === "G") {
        row.push(2);
      } else {
        row.push(1);
      }
      if (char === "S") {
        shopSlots.push({ x, y });
      }
      if (char === "P") {
        playerSpawn = { x, y };
      }
      if (char === "E") {
        enemySpawns.push({ x, y });
      }
    }
    tiles.push(row);
  }
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

function startRound() {
  clueMeter = 0;
  exposedBadCount = 0;
  penaltyStacks = 0;
  freezeTimer = 0;
  hitCooldown = 0;

  const numEnemies = clamp(2 + Math.floor((roundIndex - 1) / 2), 2, 5);
  const numShops = shopSlots.length;
  const badShopCount = 3;
  clueTarget = 20 + roundIndex * 5;

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

  clues.clear();
  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (tiles[y][x] !== 1) continue;
      const isShop = shops.some((shop) => shop.x === x && shop.y === y);
      if (isShop) continue;
      if (x === playerSpawn.x && y === playerSpawn.y) continue;
      if (enemySpawns.some((spawn) => spawn.x === x && spawn.y === y)) continue;
      clues.add(keyFor(x, y));
    }
  }

  const spawnCenter = tileCenter(playerSpawn);
  player.x = spawnCenter.x;
  player.y = spawnCenter.y;
  player.dir = "left";
  player.nextDir = "left";

  const enemyChoices = shuffle(enemySpawns);
  enemies = [];
  for (let i = 0; i < numEnemies; i += 1) {
    const spawn = enemyChoices[i % enemyChoices.length] || playerSpawn;
    const center = tileCenter(spawn);
    enemies.push({
      x: center.x,
      y: center.y,
      dir: "right",
      speed: 1.6 + roundIndex * 0.1,
    });
  }
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
  showOverlay(`Round ${roundIndex}`, "Follow the money. Expose 3 bad shops.");
  setTimeout(() => {
    hideOverlay();
    state = STATE.PLAYING;
  }, 1600);
}

function enterRoundWin() {
  state = STATE.ROUND_WIN;
  showOverlay("Fronts Exposed", "3 bad shops down. Next round incoming.");
  setTimeout(() => {
    hideOverlay();
    roundIndex += 1;
    startRound();
    enterRoundIntro();
  }, 1600);
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
    enemy.x += dir.x * enemy.speed * speedMult;
    enemy.y += dir.y * enemy.speed * speedMult;
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
    return Math.hypot(dx, dy) <= 1;
  });
}

function attemptAccuse() {
  if (state !== STATE.PLAYING) return;
  const nearShop = getNearbyShop();
  if (!nearShop) return;

  clueMeter = 0;
  if (nearShop.isBad) {
    nearShop.exposed = true;
    exposedBadCount += 1;
    freezeTimer = 60;
    if (exposedBadCount >= 3) {
      enterRoundWin();
    }
  } else {
    penaltyStacks += 1;
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
      clueMeter = Math.floor(clueMeter * 0.5);
      hitCooldown = 60;
    }
  });
}

function updateHUD() {
  const ratio = clueTarget === 0 ? 0 : clueMeter / clueTarget;
  clueFill.style.width = `${Math.floor(ratio * 100)}%`;
  clueText.textContent = `${clueMeter}/${clueTarget}`;
  exposedText.textContent = `Exposed: ${exposedBadCount}/3`;
  heatText.textContent = `Heat: x${(1 + penaltyStacks * 0.2).toFixed(1)}`;
  accuseBtn.disabled = !getNearbyShop() || state !== STATE.PLAYING;
}

function updateTimers() {
  if (freezeTimer > 0) freezeTimer -= 1;
}

function update() {
  if (state !== STATE.PLAYING) return;
  updatePlayer();
  updateClues();
  updateEnemies();
  updateHits();
  updateTimers();
  updateHUD();
}

function drawTile(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
}

function drawSpriteAt(image, centerX, centerY, size) {
  ctx.drawImage(image, centerX - size / 2, centerY - size / 2, size, size);
}

function draw() {
  ctx.fillStyle = COLORS.path;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < MAP_HEIGHT; y += 1) {
    for (let x = 0; x < MAP_WIDTH; x += 1) {
      if (tiles[y][x] === 0) {
        drawTile(x, y, COLORS.wall);
      } else if (tiles[y][x] === 2) {
        drawTile(x, y, COLORS.park);
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
      const size = TILE_PX * 0.85;
      drawSpriteAt(sprites.barber, center.x, center.y, size);
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
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;
  accumulator += delta;
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

  document.querySelectorAll(".pad").forEach((btn) => {
    btn.addEventListener("pointerdown", () => {
      setNextDir(btn.dataset.dir);
    });
  });

  accuseBtn.addEventListener("click", attemptAccuse);
}

parseBaseMap();
startRound();
enterRoundIntro();
bindControls();
updateHUD();
requestAnimationFrame(loop);
