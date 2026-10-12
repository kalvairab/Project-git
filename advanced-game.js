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

const WORLD = {
  width: 1200,
  height: 700,
  mapPadding: 40
};

canvas.width = WORLD.width;
canvas.height = WORLD.height;

const keys = {};
const mouse = { x: 0, y: 0, down: false };

const weapons = [
  { name: 'Ranger AR', damage: 18, fireRate: 0.12, spread: 0.06, ammoCapacity: 30, reloadTime: 1.2, color: '#60a5fa' },
  { name: 'SMG', damage: 12, fireRate: 0.08, spread: 0.12, ammoCapacity: 40, reloadTime: 1.5, color: '#34d399' },
  { name: 'Shotgun', damage: 20, fireRate: 0.5, spread: 0.24, ammoCapacity: 12, reloadTime: 1.8, color: '#fbbf24' }
];

const player = {
  x: WORLD.width / 2,
  y: WORLD.height / 2,
  radius: 18,
  speed: 240,
  hp: 100,
  maxHp: 100,
  ammo: 30,
  ammoCapacity: 30,
  reloadTime: 0,
  fireCooldown: 0,
  score: 0,
  kills: 0,
  deaths: 0,
  loot: 0,
  extractions: 0,
  level: 1,
  weaponIndex: 0,
  inventory: ['Medkit', 'Ammo', 'Rifle Scope', 'Key Card', '', '', '', '', ''],
  time: 0,
  isDead: false,
  isPaused: false
};

const state = {
  bullets: [],
  enemies: [],
  loot: [],
  particles: [],
  extractionZone: { x: 1010, y: 110, radius: 70, active: false },
  gameOver: false,
  elapsed: 0,
  enemySpawnTimer: 1.2,
  lootRequired: 3
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function updateHud() {
  ui.hp.textContent = Math.max(0, Math.ceil(player.hp));
  ui.ammo.textContent = player.ammo;
  ui.statusText.textContent = player.isDead
    ? 'Mission failed'
    : state.extractionZone.active
      ? 'Extraction zone active. Reach the gate.'
      : player.loot >= state.lootRequired
        ? 'Loot complete. Go to extraction.'
        : 'Search for loot and survive.';

  ui.level.textContent = player.level;
  ui.score.textContent = player.score;
  ui.kills.textContent = player.kills;
  ui.deaths.textContent = player.deaths;
  ui.lootCount.textContent = `${player.loot}/${state.lootRequired}`;
  ui.extractions.textContent = player.extractions;
  ui.gameTime.textContent = formatTime(state.elapsed);
}

function renderInventory() {
  ui.inventoryGrid.innerHTML = '';
  player.inventory.forEach((item, index) => {
    const slot = document.createElement('div');
    slot.className = `inventory-slot ${item ? 'filled' : ''}`;
    slot.textContent = item || 'Empty';
    slot.title = item || 'Empty slot';
    slot.addEventListener('click', () => {
      if (item) {
        ui.statusText.textContent = `${item} equipped in slot ${index + 1}`;
      }
    });
    ui.inventoryGrid.appendChild(slot);
  });
}

function renderWeapons() {
  ui.weaponsList.innerHTML = '';
  weapons.forEach((weapon, idx) => {
    const item = document.createElement('div');
    item.className = `weapon-item ${idx === player.weaponIndex ? 'active' : ''}`;
    item.textContent = `${weapon.name} (${idx === player.weaponIndex ? 'Active' : 'Ready'})`;
    item.addEventListener('click', () => {
      player.weaponIndex = idx;
      const w = weapons[player.weaponIndex];
      player.ammoCapacity = w.ammoCapacity;
      player.ammo = Math.min(player.ammo, player.ammoCapacity);
      ui.statusText.textContent = `${w.name} equipped`;
      renderWeapons();
    });
    ui.weaponsList.appendChild(item);
  });
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = rand(-20, WORLD.width + 20);
    y = -50;
  } else if (edge === 1) {
    x = WORLD.width + 50;
    y = rand(-20, WORLD.height + 20);
  } else if (edge === 2) {
    x = rand(-20, WORLD.width + 20);
    y = WORLD.height + 50;
  } else {
    x = -50;
    y = rand(-20, WORLD.height + 20);
  }

  state.enemies.push({
    x,
    y,
    radius: 18,
    speed: rand(80, 150),
    hp: 40,
    damage: 12,
    hitCooldown: 0
  });
}

function spawnLoot() {
  const count = 5;
  state.loot = [];
  for (let i = 0; i < count; i++) {
    state.loot.push({
      x: rand(80, WORLD.width - 80),
      y: rand(80, WORLD.height - 80),
      radius: 10,
      type: ['Ammo', 'Medkit', 'Key Card', 'Rifle Scope'][i % 4],
      pulse: rand(0, Math.PI * 2)
    });
  }
}

function createParticles(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i++) {
    state.particles.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-120, 120),
      life: rand(0.3, 0.8),
      color,
      radius: rand(2, 5)
    });
  }
}

function fireWeapon() {
  const weapon = weapons[player.weaponIndex];
  if (player.ammo <= 0 || player.reloadTime > 0 || player.fireCooldown > 0) return;

  player.ammo -= 1;
  player.fireCooldown = weapon.fireRate;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const spread = (Math.random() - 0.5) * weapon.spread;
  const finalAngle = angle + spread;

  state.bullets.push({
    x: player.x + Math.cos(finalAngle) * 28,
    y: player.y + Math.sin(finalAngle) * 28,
    vx: Math.cos(finalAngle) * 650,
    vy: Math.sin(finalAngle) * 650,
    radius: 4,
    damage: weapon.damage,
    life: 1.2,
    color: weapon.color
  });
}

function reloadWeapon() {
  const weapon = weapons[player.weaponIndex];
  if (player.reloadTime > 0 || player.ammo === weapon.ammoCapacity) return;
  player.reloadTime = weapon.reloadTime;
  ui.statusText.textContent = `${weapon.name} reloading...`;
}

function handleReloadCompletion() {
  if (player.reloadTime > 0) {
    player.reloadTime -= 0.016;
    if (player.reloadTime <= 0) {
      const weapon = weapons[player.weaponIndex];
      player.ammo = weapon.ammoCapacity;
      ui.statusText.textContent = `${weapon.name} ready`;
    }
  }
}

function resetGame() {
  player.x = WORLD.width / 2;
  player.y = WORLD.height / 2;
  player.hp = 100;
  player.maxHp = 100;
  player.weaponIndex = 0;
  player.ammo = weapons[0].ammoCapacity;
  player.fireCooldown = 0;
  player.reloadTime = 0;
  player.loot = 0;
  player.score = 0;
  player.level = 1;
  state.bullets = [];
  state.enemies = [];
  state.particles = [];
  state.elapsed = 0;
  state.enemySpawnTimer = 1.2;
  state.gameOver = false;
  player.isDead = false;
  state.extractionZone.active = false;
  spawnLoot();
  renderInventory();
  renderWeapons();
  updateHud();
}

function railDamage() {
  const weapon = weapons[player.weaponIndex];
  if (player.reloadTime > 0) {
    return;
  }
  if (keyIsDown('r')) {
    reloadWeapon();
  }
}

function keyIsDown(key) {
  return !!keys[key.toLowerCase()];
}

function update(dt) {
  if (state.gameOver) return;

  state.elapsed += dt;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  if (player.reloadTime > 0) {
    player.reloadTime -= dt;
    if (player.reloadTime <= 0) {
      const weapon = weapons[player.weaponIndex];
      player.ammo = weapon.ammoCapacity;
      ui.statusText.textContent = `${weapon.name} ready`;
    }
  }

  const moveX = (keyIsDown('d') ? 1 : 0) - (keyIsDown('a') ? 1 : 0);
  const moveY = (keyIsDown('s') ? 1 : 0) - (keyIsDown('w') ? 1 : 0);

  if (moveX || moveY) {
    const len = Math.hypot(moveX, moveY) || 1;
    player.x += (moveX / len) * player.speed * dt;
    player.y += (moveY / len) * player.speed * dt;
  }

  player.x = clamp(player.x, player.radius, WORLD.width - player.radius);
  player.y = clamp(player.y, player.radius, WORLD.height - player.radius);

  if (keyIsDown('r') && player.reloadTime <= 0 && player.ammo < weapons[player.weaponIndex].ammoCapacity) {
    reloadWeapon();
  }

  if (mouse.down && player.fireCooldown <= 0 && player.reloadTime <= 0) {
    fireWeapon();
  }

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (bullet.x < 0 || bullet.x > WORLD.width || bullet.y < 0 || bullet.y > WORLD.height || bullet.life <= 0) {
      state.bullets.splice(i, 1);
      continue;
    }

    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const enemy = state.enemies[j];
      const dist = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
      if (dist < bullet.radius + enemy.radius) {
        enemy.hp -= bullet.damage;
        createParticles(bullet.x, bullet.y, bullet.color, 6);
        state.bullets.splice(i, 1);
        if (enemy.hp <= 0) {
          state.enemies.splice(j, 1);
          player.score += 25;
          player.kills += 1;
          createParticles(enemy.x, enemy.y, '#fbbf24', 18);
        }
        break;
      }
    }
  }

  state.enemySpawnTimer -= dt;
  if (state.enemySpawnTimer <= 0) {
    spawnEnemy();
    state.enemySpawnTimer = Math.max(0.5, 2.2 - player.level * 0.15);
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;

    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < player.radius + enemy.radius + 5 && enemy.hitCooldown <= 0) {
      player.hp -= enemy.damage;
      enemy.hitCooldown = 0.8;
      createParticles(player.x, player.y, '#ef4444', 12);
      if (player.hp <= 0) {
        player.hp = 0;
        player.deaths += 1;
        player.isDead = true;
        state.gameOver = true;
        ui.gameOverTitle.textContent = 'Mission Failed';
        ui.gameOverText.textContent = `You were eliminated after ${formatTime(state.elapsed)}. Score: ${player.score}`;
        ui.gameOverModal.classList.add('active');
      }
    }
    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
  }

  for (let i = state.loot.length - 1; i >= 0; i--) {
    const item = state.loot[i];
    const dist = Math.hypot(player.x - item.x, player.y - item.y);
    if (dist < player.radius + item.radius + 8) {
      player.loot += 1;
      player.score += 30;
      createParticles(item.x, item.y, '#4ade80', 20);
      state.loot.splice(i, 1);
      player.inventory[player.inventory.findIndex(slot => !slot)] = item.type;
      renderInventory();
    }
  }

  if (player.loot >= state.lootRequired) {
    state.extractionZone.active = true;
  }

  if (state.extractionZone.active) {
    const dist = Math.hypot(player.x - state.extractionZone.x, player.y - state.extractionZone.y);
    if (dist <= state.extractionZone.radius + player.radius) {
      player.extractions += 1;
      player.score += 200;
      player.level += 1;
      state.gameOver = true;
      ui.gameOverTitle.textContent = 'Extraction Successful';
      ui.gameOverText.textContent = `You escaped alive with ${player.loot} loot. Final score: ${player.score}`;
      ui.gameOverModal.classList.add('active');
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) state.particles.splice(i, 1);
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
  if (!state.extractionZone.active) return;
  ctx.beginPath();
  ctx.arc(state.extractionZone.x, state.extractionZone.y, state.extractionZone.radius, 0, Math.PI * 2);
  ctx.strokeStyle = '#4ade80';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawLoot() {
  state.loot.forEach((item) => {
    const pulse = 0.7 + Math.sin(state.elapsed * 4 + item.pulse) * 0.3;
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
  state.bullets.forEach((bullet) => {
    ctx.beginPath();
    ctx.fillStyle = bullet.color;
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawEnemies() {
  state.enemies.forEach((enemy) => {
    ctx.beginPath();
    ctx.fillStyle = enemy.hitCooldown > 0 ? '#fca5a5' : '#ef4444';
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);

  ctx.fillStyle = '#60a5fa';
  ctx.fillRect(-14, -5, 28, 10);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(10, -2, 12, 4);

  ctx.restore();

  ctx.beginPath();
  ctx.fillStyle = '#38bdf8';
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  state.particles.forEach((p) => {
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

let lastFrame = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastFrame) / 1000 || 0, 0.033);
  lastFrame = timestamp;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'q') {
    const index = player.inventory.findIndex(slot => slot === 'Key Card');
    if (index !== -1) {
      player.inventory[index] = '';
      renderInventory();
    }
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - rect.left) / rect.width) * WORLD.width;
  mouse.y = ((e.clientY - rect.top) / rect.height) * WORLD.height;
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
requestAnimationFrame(loop);
