const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const healthText = document.getElementById('healthText');
const lootText = document.getElementById('lootText');
const statusText = document.getElementById('statusText');

const world = {
  width: canvas.width,
  height: canvas.height,
  lootGoal: 3,
  time: 0,
  nextEnemyAt: 1.2,
  gameOver: false,
  victory: false,
  extractionZone: {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 52,
    active: false,
  },
};

const keys = {};
const mouse = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  down: false,
};

const player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  radius: 16,
  speed: 260,
  health: 100,
  loot: 0,
  fireCooldown: 0,
  hitFlash: 0,
};

let bullets = [];
let enemies = [];
let lootItems = [];
let particles = [];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function spawnLoot(count = 6) {
  lootItems = [];
  for (let i = 0; i < count; i += 1) {
    const x = randomRange(60, world.width - 60);
    const y = randomRange(60, world.height - 60);
    lootItems.push({
      x,
      y,
      radius: 10,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = randomRange(-20, world.width + 20);
    y = -30;
  } else if (edge === 1) {
    x = world.width + 30;
    y = randomRange(-20, world.height + 20);
  } else if (edge === 2) {
    x = randomRange(-20, world.width + 20);
    y = world.height + 30;
  } else {
    x = -30;
    y = randomRange(-20, world.height + 20);
  }

  enemies.push({
    x,
    y,
    radius: 16,
    speed: randomRange(70, 120),
    health: 40,
    damage: 18,
    hitCooldown: 0,
  });
}

function createBurst(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i += 1) {
    particles.push({
      x,
      y,
      vx: randomRange(-120, 120),
      vy: randomRange(-120, 120),
      life: randomRange(0.3, 0.8),
      color,
      radius: randomRange(2, 5),
    });
  }
}

function shoot() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const muzzleX = player.x + Math.cos(angle) * (player.radius + 12);
  const muzzleY = player.y + Math.sin(angle) * (player.radius + 12);

  bullets.push({
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(angle) * 560,
    vy: Math.sin(angle) * 560,
    radius: 4,
    life: 1.2,
  });
}

function resetGame() {
  world.time = 0;
  world.nextEnemyAt = 1.2;
  world.gameOver = false;
  world.victory = false;
  world.extractionZone.active = false;

  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.health = 100;
  player.loot = 0;
  player.fireCooldown = 0;
  player.hitFlash = 0;

  bullets = [];
  enemies = [];
  particles = [];
  spawnLoot(6);
}

function updateHud() {
  healthText.textContent = Math.max(0, Math.ceil(player.health));
  lootText.textContent = `${player.loot}/${world.lootGoal}`;

  if (world.victory) {
    statusText.textContent = 'Extraction successful';
  } else if (world.gameOver) {
    statusText.textContent = 'You were eliminated';
  } else if (world.extractionZone.active) {
    statusText.textContent = 'Reach the extraction zone';
  } else {
    statusText.textContent = 'Search for loot';
  }
}

function update(dt) {
  if (world.gameOver || world.victory) {
    updateHud();
    return;
  }

  world.time += dt;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.hitFlash = Math.max(0, player.hitFlash - dt);

  const moveX = (keys['d'] || keys['arrowright'] ? 1 : 0) - (keys['a'] || keys['arrowleft'] ? 1 : 0);
  const moveY = (keys['s'] || keys['arrowdown'] ? 1 : 0) - (keys['w'] || keys['arrowup'] ? 1 : 0);

  if (moveX || moveY) {
    const length = Math.hypot(moveX, moveY) || 1;
    player.x += (moveX / length) * player.speed * dt;
    player.y += (moveY / length) * player.speed * dt;
  }

  player.x = clamp(player.x, player.radius + 8, world.width - player.radius - 8);
  player.y = clamp(player.y, player.radius + 8, world.height - player.radius - 8);

  if (mouse.down && player.fireCooldown <= 0) {
    shoot();
    player.fireCooldown = 0.14;
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < -20 ||
      bullet.y < -20 ||
      bullet.x > world.width + 20 ||
      bullet.y > world.height + 20
    ) {
      bullets.splice(i, 1);
      continue;
    }

    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const enemy = enemies[j];
      const distance = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
      if (distance < bullet.radius + enemy.radius) {
        enemy.health -= 20;
        createBurst(bullet.x, bullet.y, '#fca5a5', 6);
        bullets.splice(i, 1);
        if (enemy.health <= 0) {
          enemies.splice(j, 1);
          createBurst(enemy.x, enemy.y, '#fbbf24', 12);
        }
        break;
      }
    }
  }

  if (world.time > world.nextEnemyAt) {
    spawnEnemy();
    world.nextEnemyAt = world.time + Math.max(0.8, 2.5 - player.loot * 0.15);
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;

    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < player.radius + enemy.radius + 2) {
      if (enemy.hitCooldown <= 0) {
        player.health -= enemy.damage;
        player.hitFlash = 0.25;
        enemy.hitCooldown = 0.6;
        createBurst(player.x, player.y, '#ef4444', 9);
      }
    }

    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
  }

  for (let i = lootItems.length - 1; i >= 0; i -= 1) {
    const item = lootItems[i];
    const dist = Math.hypot(player.x - item.x, player.y - item.y);
    if (dist < player.radius + item.radius + 5) {
      player.loot += 1;
      lootItems.splice(i, 1);
      createBurst(item.x, item.y, '#4ade80', 14);
    }
  }

  if (player.loot >= world.lootGoal) {
    world.extractionZone.active = true;
  }

  if (world.extractionZone.active) {
    const dist = Math.hypot(player.x - world.extractionZone.x, player.y - world.extractionZone.y);
    if (dist <= world.extractionZone.radius + player.radius) {
      world.victory = true;
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  if (player.health <= 0) {
    world.gameOver = true;
    createBurst(player.x, player.y, '#f87171', 24);
  }

  updateHud();
}

function drawBackground() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, world.width, world.height);

  for (let x = 0; x < world.width; x += 32) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }

  for (let y = 0; y < world.height; y += 32) {
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }
}

function drawExtractionZone() {
  if (!world.extractionZone.active) return;

  ctx.beginPath();
  ctx.arc(world.extractionZone.x, world.extractionZone.y, world.extractionZone.radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(34, 197, 94, 0.9)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(world.extractionZone.x, world.extractionZone.y, world.extractionZone.radius - 18, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(134, 239, 172, 0.6)';
  ctx.stroke();
}

function drawLoot() {
  for (const item of lootItems) {
    const glow = 0.5 + Math.sin(world.time * 4 + item.pulse) * 0.3;
    ctx.beginPath();
    ctx.fillStyle = `rgba(250, 204, 21, ${0.5 + glow})`;
    ctx.arc(item.x, item.y, item.radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = '#facc15';
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBullets() {
  for (const bullet of bullets) {
    ctx.beginPath();
    ctx.fillStyle = '#f8fafc';
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of enemies) {
    ctx.beginPath();
    ctx.fillStyle = enemy.hitCooldown > 0 ? '#fca5a5' : '#ef4444';
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPlayer() {
  ctx.save();
  if (player.hitFlash > 0) {
    ctx.shadowColor = '#f87171';
    ctx.shadowBlur = 18;
  }

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);

  ctx.fillStyle = '#60a5fa';
  ctx.fillRect(-12, -5, 24, 10);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(8, -2, 12, 4);

  ctx.restore();

  ctx.beginPath();
  ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
  ctx.arc(player.x, player.y, player.radius + 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.fillStyle = '#38bdf8';
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  for (const p of particles) {
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 1.5);
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawStatusOverlay() {
  if (!world.gameOver && !world.victory) return;

  ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
  ctx.fillRect(0, 0, world.width, world.height);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 42px Arial';
  ctx.fillText(world.victory ? 'EXTRACTION SUCCESS' : 'MISSION FAILED', world.width / 2, world.height / 2 - 10);

  ctx.font = '20px Arial';
  ctx.fillText('Press R to restart', world.width / 2, world.height / 2 + 30);
}

function render() {
  drawBackground();
  drawExtractionZone();
  drawLoot();
  drawBullets();
  drawEnemies();
  drawPlayer();
  drawParticles();
  drawStatusOverlay();
}

let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000 || 0, 0.033);
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;

  if (event.key.toLowerCase() === 'r') {
    resetGame();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

canvas.addEventListener('mousemove', (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
});

canvas.addEventListener('mousedown', () => {
  mouse.down = true;
});

window.addEventListener('mouseup', () => {
  mouse.down = false;
});

resetGame();
updateHud();
requestAnimationFrame(loop);
