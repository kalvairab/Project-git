const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const ui = {
  hp: document.getElementById('hp'),
  ammo: document.getElementById('ammo'),
  statusText: document.getElementById('statusText'),
  level: document.getElementById('level'),
  score: document.getElementById('score'),
  kills: document.getElementById('kills'),
  deaths: document.getElementById('deaths'),
  lootCount: document.getElementById('lootCount'),
  extractions: document.getElementById('extractions'),
  gameTime: document.getElementById('gameTime'),
  inventoryGrid: document.getElementById('inventoryGrid'),
  weaponsList: document.getElementById('weaponsList'),
  gameOverModal: document.getElementById('gameOverModal'),
  gameOverTitle: document.getElementById('gameOverTitle'),
  gameOverText: document.getElementById('gameOverText')
};

const WORLD = { width: 1200, height: 700 };
canvas.width = WORLD.width;
canvas.height = WORLD.height;

const keys = {};
const mouse = { x: WORLD.width / 2, y: WORLD.height / 2, down: false };

const weapons = [
  { id: 'ar', name: 'Ranger AR', damage: 18, fireRate: 0.12, spread: 0.06, ammoCap: 30, speed: 650, color: '#60a5fa' },
  { id: 'smg', name: 'SMG', damage: 12, fireRate: 0.08, spread: 0.14, ammoCap: 40, speed: 700, color: '#34d399' },
  { id: 'shotgun', name: 'Shotgun', damage: 24, fireRate: 0.5, spread: 0.25, ammoCap: 12, speed: 620, color: '#fbbf24' }
];

const player = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  radius: 18,
  speed: 240,
  hp: 100,
  maxHp: 100,
  ammo: 30,
  clipSize: 30,
  fireCooldown: 0,
  score: 0,
  kills: 0,
  deaths: 0,
  loot: 0,
  extractions: 0,
  level: 1,
  weaponIndex: 0,
  medkits: 1,
  inventory: ['Medkit', 'Ammo', 'Rifle Scope', 'Key Card', '', '', '', '', ''],
  time: 0,
  isDead: false,
  invuln: 0
};

const game = {
  bullets: [],
  enemies: [],
  loot: [],
  particles: [],
  extractionZone: { x: 1060, y: 120, radius: 70, active: false },
  gameOver: false,
  paused: false,
  elapsed: 0,
  spawnTimer: 1.2,
  lootRequired: 4,
  lastWeaponSwitch: 0,
  introText: 'Search for loot and reach the extraction zone.'
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateHud() {
  ui.hp.textContent = Math.max(0, Math.ceil(player.hp));
  ui.ammo.textContent = player.ammo;

  if (game.gameOver) {
    ui.statusText.textContent = 'Mission concluded';
  } else if (game.paused) {
    ui.statusText.textContent = 'Game paused';
  } else if (game.extractionZone.active) {
    ui.statusText.textContent = 'Extraction zone active. Reach the gate.';
  } else if (player.loot >= game.lootRequired) {
    ui.statusText.textContent = 'Loot complete. Extract now.';
  } else {
    ui.statusText.textContent = game.introText;
  }

  ui.level.textContent = player.level;
  ui.score.textContent = player.score;
  ui.kills.textContent = player.kills;
  ui.deaths.textContent = player.deaths;
  ui.lootCount.textContent = `${player.loot}/${game.lootRequired}`;
  ui.extractions.textContent = player.extractions;
  ui.gameTime.textContent = formatTime(game.elapsed);
}

function renderInventory() {
  ui.inventoryGrid.innerHTML = '';
  player.inventory.forEach((item, index) => {
    const slot = document.createElement('div');
    slot.className = `inventory-slot ${item ? 'filled' : ''}`;
    slot.textContent = item || 'Empty';
    slot.title = item || `Empty slot ${index + 1}`;
    slot.addEventListener('click', () => {
      if (item) ui.statusText.textContent = `${item} stored in inventory slot ${index + 1}`;
    });
    ui.inventoryGrid.appendChild(slot);
  });
}

function renderWeapons() {
  ui.weaponsList.innerHTML = '';
  weapons.forEach((weapon, index) => {
    const item = document.createElement('div');
    item.className = `weapon-item ${index === player.weaponIndex ? 'active' : ''}`;
    item.textContent = `${weapon.name} ${index === player.weaponIndex ? '(Equipped)' : ''}`;
    item.addEventListener('click', () => {
      player.weaponIndex = index;
      const cur = weapons[player.weaponIndex];
      player.clipSize = cur.ammoCap;
      player.ammo = Math.min(player.ammo, cur.ammoCap);
      ui.statusText.textContent = `${cur.name} equipped`;
      renderWeapons();
    });
    ui.weaponsList.appendChild(item);
  });
}

function createParticles(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i++) {
    game.particles.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-120, 120),
      life: rand(0.2, 0.9),
      color,
      radius: rand(2, 6)
    });
  }
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0, y = 0;

  if (edge === 0) {
    x = rand(-30, WORLD.width + 30);
    y = -30;
  } else if (edge === 1) {
    x = WORLD.width + 30;
    y = rand(-30, WORLD.height + 30);
  } else if (edge === 2) {
    x = rand(-30, WORLD.width + 30);
    y = WORLD.height + 30;
  } else {
    x = -30;
    y = rand(-30, WORLD.height + 30);
  }

  const typeRoll = Math.random();
  let hp = 30;
  let speed = 100;
  let damage = 10;
  let color = '#ef4444';

  if (typeRoll > 0.75) {
    hp = 70;
    speed = 80;
    damage = 18;
    color = '#f97316';
  } else if (typeRoll > 0.4) {
    hp = 45;
    speed = 125;
    damage = 12;
    color = '#f43f5e';
  }

  game.enemies.push({ x, y, radius: 18, speed, hp, damage, color, hitCooldown: 0 });
}

function spawnLoot() {
  game.loot = [];
  for (let i = 0; i < 6; i++) {
    game.loot.push({
      x: rand(80, WORLD.width - 80),
      y: rand(80, WORLD.height - 80),
      radius: 10,
      type: ['Ammo', 'Medkit', 'Key Card', 'Rifle Scope', 'Cache', 'Scrap'][i % 6],
      pulse: rand(0, Math.PI * 2)
    });
  }
}

function resetGame() {
  player.x = WORLD.width / 2;
  player.y = WORLD.height / 2;
  player.hp = 100;
  player.maxHp = 100;
  player.ammo = weapons[0].ammoCap;
  player.clipSize = weapons[0].ammoCap;
  player.fireCooldown = 0;
  player.score = 0;
  player.kills = 0;
  player.deaths = 0;
  player.loot = 0;
  player.level = 1;
  player.extractions = 0;
  player.isDead = false;
  player.medkits = 1;
  player.inventory = ['Medkit', 'Ammo', 'Rifle Scope', 'Key Card', '', '', '', '', ''];
  game.bullets = [];
  game.enemies = [];
  game.particles = [];
  game.elapsed = 0;
  game.spawnTimer = 1.2;
  game.gameOver = false;
  game.paused = false;
  game.extractionZone.active = false;
  game.playerDamageFlash = 0;
  spawnLoot();
  renderInventory();
  renderWeapons();
  updateHud();
}

function switchWeapon(index) {
  if (index < 0 || index >= weapons.length) return;
  player.weaponIndex = index;
  const cur = weapons[player.weaponIndex];
  player.clipSize = cur.ammoCap;
  player.ammo = Math.min(player.ammo, cur.ammoCap);
  ui.statusText.textContent = `${cur.name} equipped`;
  renderWeapons();
}

function fireWeapon() {
  const weapon = weapons[player.weaponIndex];
  if (player.ammo <= 0 || player.fireCooldown > 0 || game.paused || game.gameOver) return;

  player.ammo -= 1;
  player.fireCooldown = weapon.fireRate;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const spread = (Math.random() - 0.5) * weapon.spread;
  const finalAngle = angle + spread;

  game.bullets.push({
    x: player.x + Math.cos(finalAngle) * 22,
    y: player.y + Math.sin(finalAngle) * 22,
    vx: Math.cos(finalAngle) * weapon.speed,
    vy: Math.sin(finalAngle) * weapon.speed,
    radius: 4,
    life: 1.2,
    damage: weapon.damage,
    color: weapon.color
  });
}

function reloadWeapon() {
  const weapon = weapons[player.weaponIndex];
  if (player.ammo >= weapon.ammoCap || game.paused || game.gameOver) return;
  player.ammo = weapon.ammoCap;
  ui.statusText.textContent = `${weapon.name} reloaded`;
}

function useMedkit() {
  if (player.medkits <= 0 || player.hp >= player.maxHp || game.gameOver || game.paused) return;
  player.medkits -= 1;
  player.hp = Math.min(player.maxHp, player.hp + 35);
  ui.statusText.textContent = 'Medkit used';
  renderInventory();
}

function togglePause() {
  if (game.gameOver) return;
  game.paused = !game.paused;
  ui.statusText.textContent = game.paused ? 'Game paused' : 'Back in action';
}

function triggerGameOver(message) {
  game.gameOver = true;
  ui.gameOverTitle.textContent = message.includes('success') ? 'Extraction Successful' : 'Mission Failed';
  ui.gameOverText.textContent = message;
  ui.gameOverModal.classList.add('active');
}

function update(dt) {
  if (game.paused || game.gameOver) return;

  game.elapsed += dt;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  const moveX = (keys['d'] ? 1 : 0) - (keys['a'] ? 1 : 0);
  const moveY = (keys['s'] ? 1 : 0) - (keys['w'] ? 1 : 0);

  if (moveX || moveY) {
    const len = Math.hypot(moveX, moveY) || 1;
    player.x += (moveX / len) * player.speed * dt;
    player.y += (moveY / len) * player.speed * dt;
  }

  player.x = clamp(player.x, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y, player.radius, WORLD.height - player.radius);

  if (keys['1']) switchWeapon(0);
  if (keys['2']) switchWeapon(1);
  if (keys['3']) switchWeapon(2);

  if (mouse.down && !game.gameOver && !game.paused) {
    fireWeapon();
  }

  if (keys['r']) {
    reloadWeapon();
  }

  if (keys['e']) {
    useMedkit();
    keys['e'] = false;
  }

  if (keys['p']) {
    togglePause();
    keys['p'] = false;
  }

  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const bullet = game.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.life <= 0 || bullet.x < -20 || bullet.x > WORLD.width + 20 || bullet.y < -20 || bullet.y > WORLD.height + 20) {
      game.bullets.splice(i, 1);
      continue;
    }

    for (let j = game.enemies.length - 1; j >= 0; j--) {
      const enemy = game.enemies[j];
      const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
      if (dist < bullet.radius + enemy.radius) {
        enemy.hp -= bullet.damage;
        createParticles(bullet.x, bullet.y, bullet.color, 6);
        game.bullets.splice(i, 1);

        if (enemy.hp <= 0) {
          game.enemies.splice(j, 1);
          player.score += 25;
          player.kills += 1;
          createParticles(enemy.x, enemy.y, '#fbbf24', 18);
        }
        break;
      }
    }
  }

  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnEnemy();
    game.spawnTimer = Math.max(0.8, 2.2 - player.level * 0.12);
  }

  for (let i = game.enemies.length - 1; i >= 0; i--) {
    const enemy = game.enemies[i];
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;

    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < player.radius + enemy.radius + 4 && enemy.hitCooldown <= 0) {
      player.hp -= enemy.damage;
      player.invuln = 0.25;
      enemy.hitCooldown = 0.8;
      createParticles(player.x, player.y, '#ef4444', 12);
      if (player.hp <= 0) {
        player.hp = 0;
        player.deaths += 1;
        player.isDead = true;
        triggerGameOver(`You were eliminated after ${formatTime(game.elapsed)}. Final score: ${player.score}`);
      }
    }
    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
  }

  for (let i = game.loot.length - 1; i >= 0; i--) {
    const item = game.loot[i];
    const dist = Math.hypot(player.x - item.x, player.y - item.y);
    if (dist < player.radius + item.radius + 8) {
      player.loot += 1;
      player.score += 30;
      createParticles(item.x, item.y, '#4ade80', 18);
      game.loot.splice(i, 1);

      const emptyIndex = player.inventory.findIndex(slot => slot === '');
      if (emptyIndex !== -1) {
        player.inventory[emptyIndex] = item.type;
      }

      renderInventory();
    }
  }

  if (player.loot >= game.lootRequired) {
    game.extractionZone.active = true;
  }

  if (game.extractionZone.active) {
    const dist = Math.hypot(player.x - game.extractionZone.x, player.y - game.extractionZone.y);
    if (dist <= game.extractionZone.radius + player.radius) {
      player.extractions += 1;
      player.score += 200;
      player.level += 1;
      triggerGameOver(`Extraction successful! You escaped with ${player.loot} loot. Final score: ${player.score}`);
    }
  }

  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }

  updateHud();
}

function drawBackground() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  for (let x = 0; x < WORLD.width; x += 40) {
    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.height);
    ctx.stroke();
  }

  for (let y = 0; y < WORLD.height; y += 40) {
    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.width, y);
    ctx.stroke();
  }
}

function drawExtractionZone() {
  if (!game.extractionZone.active) return;
  ctx.beginPath();
  ctx.arc(game.extractionZone.x, game.extractionZone.y, game.extractionZone.radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = 'rgba(74, 222, 128, 0.12)';
  ctx.arc(game.extractionZone.x, game.extractionZone.y, game.extractionZone.radius - 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawLoot() {
  game.loot.forEach((item) => {
    const pulse = 0.7 + Math.sin(game.elapsed * 4 + item.pulse) * 0.3;
    ctx.beginPath();
    ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
    ctx.arc(item.x, item.y, item.radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#facc15';
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBullets() {
  game.bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.fillStyle = bullet.color;
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEnemies() {
  game.enemies.forEach((enemy) => {
    ctx.beginPath();
    ctx.fillStyle = enemy.color;
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(enemy.x - 18, enemy.y - 28, 36, 5);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(enemy.x - 18, enemy.y - 28, (enemy.hp / 70) * 36, 5);
  });
}

function drawPlayer() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);

  ctx.fillStyle = player.invuln > 0 ? '#fca5a5' : '#60a5fa';
  ctx.fillRect(-14, -5, 30, 10);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(10, -2, 14, 4);
  ctx.restore();

  ctx.beginPath();
  ctx.fillStyle = '#38bdf8';
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  game.particles.forEach((p) => {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 1.5);
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

function render() {
  drawBackground();
  drawExtractionZone();
  drawLoot();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
}

let lastTime = 0;
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0.016, 0.033);
  lastTime = timestamp;
  update(dt);
  render();
  requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;
  if (key === 'r') reloadWeapon();
  if (key === 'p') togglePause();
  if (key === 'e') useMedkit();

  if (key === '1') switchWeapon(0);
  if (key === '2') switchWeapon(1);
  if (key === '3') switchWeapon(2);

  if (key === ' ') {
    event.preventDefault();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * WORLD.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * WORLD.height;
});

canvas.addEventListener('mousedown', () => {
  mouse.down = true;
});

window.addEventListener('mouseup', () => {
  mouse.down = false;
});

resetGame();
renderInventory();
renderWeapons();
updateHud();
requestAnimationFrame(gameLoop);
