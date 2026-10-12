const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  hp: document.getElementById("hp"),
  ammo: document.getElementById("ammo"),
  loot: document.getElementById("loot"),
  score: document.getElementById("score"),
  statusText: document.getElementById("statusText"),
  level: document.getElementById("level"),
  kills: document.getElementById("kills"),
  deaths: document.getElementById("deaths"),
  timer: document.getElementById("timer"),
  bossStatus: document.getElementById("bossStatus"),
  weaponList: document.getElementById("weaponList"),
  inventoryGrid: document.getElementById("inventoryGrid"),
  modal: document.getElementById("gameOverModal"),
  modalTitle: document.getElementById("modalTitle"),
  modalMessage: document.getElementById("modalMessage"),
  restartButton: document.getElementById("restartButton"),
};

const world = {
  width: canvas.width,
  height: canvas.height,
};

const keys = {};
const mouse = { x: world.width / 2, y: world.height / 2, down: false };

const weapons = [
  { name: "Ranger AR", damage: 18, fireRate: 0.12, ammoCap: 30, bulletSpeed: 650, spread: 0.05, color: "#60a5fa" },
  { name: "SMG", damage: 12, fireRate: 0.08, ammoCap: 40, bulletSpeed: 700, spread: 0.1, color: "#34d399" },
  { name: "Shotgun", damage: 24, fireRate: 0.5, ammoCap: 12, bulletSpeed: 630, spread: 0.25, color: "#fbbf24" },
];

const player = {
  x: world.width / 2,
  y: world.height / 2,
  radius: 18,
  speed: 240,
  hp: 100,
  maxHp: 100,
  ammo: 30,
  weaponIndex: 0,
  score: 0,
  kills: 0,
  deaths: 0,
  level: 1,
  loot: 0,
  requiredLoot: 4,
  medkits: 1,
  inventory: ["Medkit", "Ammo", "Rifle Scope", "Key Card", "", "", "", "", ""],
  fireCooldown: 0,
  invuln: 0,
};

const state = {
  bullets: [],
  enemies: [],
  loot: [],
  particles: [],
  boss: null,
  elapsed: 0,
  spawnTimer: 1.0,
  gameOver: false,
  paused: false,
  extractionZone: { x: 1060, y: 130, radius: 70, active: false },
  bossSpawned: false,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateHud() {
  ui.hp.textContent = Math.max(0, Math.ceil(player.hp));
  ui.ammo.textContent = player.ammo;
  ui.loot.textContent = `${player.loot}/${player.requiredLoot}`;
  ui.score.textContent = player.score;
  ui.level.textContent = player.level;
  ui.kills.textContent = player.kills;
  ui.deaths.textContent = player.deaths;
  ui.timer.textContent = formatTime(state.elapsed);

  if (state.gameOver) {
    ui.statusText.textContent = "Mission concluded";
  } else if (state.extractionZone.active) {
    ui.statusText.textContent = "Extraction zone active";
  } else if (player.loot >= player.requiredLoot) {
    ui.statusText.textContent = "Loot complete. Extract.";
  } else {
    ui.statusText.textContent = "Search for loot and survive";
  }

  if (state.boss) {
    ui.bossStatus.textContent = "Active";
  } else {
    ui.bossStatus.textContent = state.bossSpawned ? "Defeated" : "Dormant";
  }
}

function renderWeaponList() {
  ui.weaponList.innerHTML = "";
  weapons.forEach((weapon, index) => {
    const card = document.createElement("div");
    card.className = `weapon-card ${index === player.weaponIndex ? "active" : ""}`;
    card.textContent = `${weapon.name} ${index === player.weaponIndex ? "(Equipped)" : ""}`;
    card.addEventListener("click", () => {
      player.weaponIndex = index;
      player.ammo = Math.min(player.ammo, weapons[player.weaponIndex].ammoCap);
      ui.statusText.textContent = `${weapons[player.weaponIndex].name} equipped`;
      renderWeaponList();
    });
    ui.weaponList.appendChild(card);
  });
}

function renderInventory() {
  ui.inventoryGrid.innerHTML = "";
  player.inventory.forEach((item) => {
    const slot = document.createElement("div");
    slot.className = `inventory-slot ${item ? "filled" : ""}`;
    slot.textContent = item || "Empty";
    ui.inventoryGrid.appendChild(slot);
  });
}

function spawnLoot() {
  state.loot = [];
  for (let i = 0; i < 6; i++) {
    state.loot.push({
      x: rand(80, world.width - 80),
      y: rand(80, world.height - 80),
      radius: 11,
      type: ["Ammo", "Medkit", "Key Card", "Rifle Scope", "Scrap", "Cache"][i % 6],
      pulse: rand(0, Math.PI * 2),
    });
  }
}

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x = 0;
  let y = 0;

  if (edge === 0) {
    x = rand(-20, world.width + 20);
    y = -30;
  } else if (edge === 1) {
    x = world.width + 30;
    y = rand(-20, world.height + 20);
  } else if (edge === 2) {
    x = rand(-20, world.width + 20);
    y = world.height + 30;
  } else {
    x = -30;
    y = rand(-20, world.height + 20);
  }

  const roll = Math.random();
  let enemy = {
    x,
    y,
    radius: 18,
    hp: 30,
    speed: 100,
    color: "#ef4444",
    damage: 12,
    hitCooldown: 0,
  };

  if (roll > 0.75) {
    enemy = {
      ...enemy,
      hp: 70,
      speed: 85,
      color: "#f97316",
      damage: 18,
      radius: 20,
    };
  } else if (roll > 0.38) {
    enemy = {
      ...enemy,
      hp: 45,
      speed: 130,
      color: "#fb7185",
      damage: 14,
      radius: 18,
    };
  }

  state.enemies.push(enemy);
}

function spawnBoss() {
  state.boss = {
    x: 600,
    y: 130,
    radius: 28,
    hp: 180,
    maxHp: 180,
    speed: 70,
    color: "#f59e0b",
    damage: 25,
    hitCooldown: 0,
  };
  state.bossSpawned = true;
}

function createParticles(x, y, color, amount = 10) {
  for (let i = 0; i < amount; i++) {
    state.particles.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-120, 120),
      life: rand(0.3, 0.9),
      radius: rand(2, 6),
      color,
    });
  }
}

function fireWeapon() {
  const weapon = weapons[player.weaponIndex];
  if (player.ammo <= 0 || player.fireCooldown > 0 || state.gameOver) return;

  player.ammo -= 1;
  player.fireCooldown = weapon.fireRate;

  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  const spread = (Math.random() - 0.5) * weapon.spread;
  const finalAngle = angle + spread;

  state.bullets.push({
    x: player.x + Math.cos(finalAngle) * 18,
    y: player.y + Math.sin(finalAngle) * 18,
    vx: Math.cos(finalAngle) * weapon.bulletSpeed,
    vy: Math.sin(finalAngle) * weapon.bulletSpeed,
    radius: 4,
    damage: weapon.damage,
    color: weapon.color,
    life: 1.2,
  });
}

function reloadWeapon() {
  const weapon = weapons[player.weaponIndex];
  if (player.ammo >= weapon.ammoCap) return;
  player.ammo = weapon.ammoCap;
  ui.statusText.textContent = `${weapon.name} reloaded`;
}

function useMedkit() {
  if (player.medkits <= 0 || player.hp >= player.maxHp) return;
  player.medkits -= 1;
  player.hp = Math.min(player.maxHp, player.hp + 35);
  ui.statusText.textContent = "Medkit used";
  renderInventory();
}

function triggerGameOver(title, message) {
  state.gameOver = true;
  ui.modalTitle.textContent = title;
  ui.modalMessage.textContent = message;
  ui.modal.classList.remove("hidden");
}

function resetGame() {
  player.x = world.width / 2;
  player.y = world.height / 2;
  player.hp = 100;
  player.ammo = weapons[0].ammoCap;
  player.weaponIndex = 0;
  player.score = 0;
  player.kills = 0;
  player.deaths = 0;
  player.level = 1;
  player.loot = 0;
  player.medkits = 1;
  player.inventory = ["Medkit", "Ammo", "Rifle Scope", "Key Card", "", "", "", "", ""];
  player.fireCooldown = 0;
  state.gameOver = false;
  state.elapsed = 0;
  state.spawnTimer = 1.0;
  state.enemies = [];
  state.bullets = [];
  state.particles = [];
  state.boss = null;
  state.bossSpawned = false;
  state.extractionZone.active = false;
  state.paused = false;
  ui.modal.classList.add("hidden");
  spawnLoot();
  renderWeaponList();
  renderInventory();
  updateHud();
}

function update(dt) {
  if (state.gameOver) return;

  state.elapsed += dt;
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  player.invuln = Math.max(0, player.invuln - dt);

  const moveX = (keys["d"] ? 1 : 0) - (keys["a"] ? 1 : 0);
  const moveY = (keys["s"] ? 1 : 0) - (keys["w"] ? 1 : 0);

  if (moveX || moveY) {
    const len = Math.hypot(moveX, moveY) || 1;
    player.x += (moveX / len) * player.speed * dt;
    player.y += (moveY / len) * player.speed * dt;
  }

  player.x = clamp(player.x, player.radius, world.width - player.radius);
  player.y = clamp(player.y, player.radius, world.height - player.radius);

  if (mouse.down) fireWeapon();
  if (keys["r"]) reloadWeapon();
  if (keys["e"]) {
    useMedkit();
    keys["e"] = false;
  }

  if (state.elapsed > 30 && !state.bossSpawned) {
    spawnBoss();
  }

  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const bullet = state.bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    if (
      bullet.life <= 0 ||
      bullet.x < -20 ||
      bullet.x > world.width + 20 ||
      bullet.y < -20 ||
      bullet.y > world.height + 20
    ) {
      state.bullets.splice(i, 1);
      continue;
    }

    const targetList = state.boss ? [...state.enemies, state.boss] : [...state.enemies];
    for (let j = targetList.length - 1; j >= 0; j--) {
      const target = targetList[j];
      const dist = Math.hypot(bullet.x - target.x, bullet.y - target.y);
      if (dist < bullet.radius + target.radius) {
        target.hp -= bullet.damage;
        createParticles(bullet.x, bullet.y, bullet.color, 6);

        state.bullets.splice(i, 1);

        if (target === state.boss) {
          if (target.hp <= 0) {
            state.boss = null;
            player.score += 250;
            createParticles(target.x, target.y, "#facc15", 25);
          }
        } else {
          const enemyIndex = state.enemies.indexOf(target);
          if (enemyIndex !== -1 && target.hp <= 0) {
            state.enemies.splice(enemyIndex, 1);
            player.score += 25;
            player.kills += 1;
            createParticles(target.x, target.y, "#fbbf24", 18);
          }
        }
        break;
      }
    }
  }

  state.spawnTimer -= dt;
  if (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer = Math.max(0.7, 2.2 - player.level * 0.12);
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    enemy.x += Math.cos(angle) * enemy.speed * dt;
    enemy.y += Math.sin(angle) * enemy.speed * dt;

    const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    if (dist < player.radius + enemy.radius + 2 && enemy.hitCooldown <= 0) {
      player.hp -= enemy.damage;
      player.invuln = 0.25;
      enemy.hitCooldown = 0.8;
      createParticles(player.x, player.y, "#ef4444", 12);

      if (player.hp <= 0) {
        player.hp = 0;
        player.deaths += 1;
        triggerGameOver(
          "Mission Failed",
          `You were eliminated after ${formatTime(state.elapsed)}. Final score: ${player.score}`
        );
      }
    }

    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
  }

  if (state.boss) {
    const angle = Math.atan2(player.y - state.boss.y, player.x - state.boss.x);
    state.boss.x += Math.cos(angle) * state.boss.speed * dt;
    state.boss.y += Math.sin(angle) * state.boss.speed * dt;

    const dist = Math.hypot(player.x - state.boss.x, player.y - state.boss.y);
    if (dist < player.radius + state.boss.radius + 4 && state.boss.hitCooldown <= 0) {
      player.hp -= state.boss.damage;
      state.boss.hitCooldown = 1.1;
      createParticles(player.x, player.y, "#f59e0b", 18);

      if (player.hp <= 0) {
        player.hp = 0;
        player.deaths += 1;
        triggerGameOver(
          "Mission Failed",
          `The boss defeated you after ${formatTime(state.elapsed)}. Final score: ${player.score}`
        );
      }
    }

    state.boss.hitCooldown = Math.max(0, state.boss.hitCooldown - dt);
  }

  for (let i = state.loot.length - 1; i >= 0; i--) {
    const item = state.loot[i];
    const dist = Math.hypot(player.x - item.x, player.y - item.y);
    if (dist < player.radius + item.radius + 8) {
      player.loot += 1;
      player.score += 30;
      createParticles(item.x, item.y, "#4ade80", 18);
      state.loot.splice(i, 1);

      const emptyIndex = player.inventory.findIndex((slot) => slot === "");
      if (emptyIndex !== -1) {
        player.inventory[emptyIndex] = item.type;
      }

      renderInventory();
    }
  }

  if (player.loot >= player.requiredLoot) {
    state.extractionZone.active = true;
  }

  if (state.extractionZone.active) {
    const dist = Math.hypot(player.x - state.extractionZone.x, player.y - state.extractionZone.y);
    if (dist <= state.extractionZone.radius + player.radius) {
      player.score += 300;
      player.level += 1;
      triggerGameOver(
        "Extraction Successful",
        `You escaped alive with ${player.loot} loot. Final score: ${player.score}`
      );
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const part = state.particles[i];
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.life -= dt;

    if (part.life <= 0) {
      state.particles.splice(i, 1);
    }
  }

  updateHud();
}

function drawBackground() {
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, world.width, world.height);

  for (let x = 0; x < world.width; x += 40) {
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, world.height);
    ctx.stroke();
  }

  for (let y = 0; y < world.height; y += 40) {
    ctx.strokeStyle = "rgba(148,163,184,0.08)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(world.width, y);
    ctx.stroke();
  }
}

function drawLoot() {
  state.loot.forEach((item) => {
    const pulse = 0.7 + Math.sin(state.elapsed * 4 + item.pulse) * 0.3;
    ctx.beginPath();
    ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
    ctx.arc(item.x, item.y, item.radius + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.fillStyle = "#facc15";
    ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawExtractionZone() {
  if (!state.extractionZone.active) return;

  ctx.beginPath();
  ctx.arc(state.extractionZone.x, state.extractionZone.y, state.extractionZone.radius, 0, Math.PI * 2);
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = "rgba(74, 222, 128, 0.12)";
  ctx.arc(state.extractionZone.x, state.extractionZone.y, state.extractionZone.radius - 10, 0, Math.PI * 2);
  ctx.fill();
}

function drawBullets() {
  for (const bullet of state.bullets) {
    ctx.beginPath();
    ctx.fillStyle = bullet.color;
    ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    ctx.beginPath();
    ctx.fillStyle = enemy.color;
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(enemy.x - 18, enemy.y - 28, 36, 5);
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(enemy.x - 18, enemy.y - 28, (enemy.hp / 70) * 36, 5);
  }

  if (state.boss) {
    const boss = state.boss;
    ctx.beginPath();
    ctx.fillStyle = boss.color;
    ctx.arc(boss.x, boss.y, boss.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fef3c7";
    ctx.fillRect(boss.x - 26, boss.y - 40, 52, 6);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(boss.x - 26, boss.y - 40, (boss.hp / boss.maxHp) * 52, 6);
  }
}

function drawPlayer() {
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(angle);

  ctx.fillStyle = player.invuln > 0 ? "#fca5a5" : "#60a5fa";
  ctx.fillRect(-14, -5, 30, 10);

  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(10, -2, 14, 4);
  ctx.restore();

  ctx.beginPath();
  ctx.fillStyle = "#38bdf8";
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles() {
  for (const part of state.particles) {
    ctx.beginPath();
    ctx.fillStyle = part.color;
    ctx.globalAlpha = Math.max(0, part.life * 1.5);
    ctx.arc(part.x, part.y, part.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
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

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (key === "1") player.weaponIndex = 0;
  if (key === "2") player.weaponIndex = 1;
  if (key === "3") player.weaponIndex = 2;
  if (key === "r") reloadWeapon();
  if (key === "e") useMedkit();
  if (key === "p") {
    state.paused = !state.paused;
    ui.statusText.textContent = state.paused ? "Paused" : "Back in action";
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * world.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * world.height;
});

canvas.addEventListener("mousedown", () => {
  mouse.down = true;
});

window.addEventListener("mouseup", () => {
  mouse.down = false;
});

ui.restartButton.addEventListener("click", resetGame);

resetGame();
renderWeaponList();
renderInventory();
updateHud();
requestAnimationFrame(gameLoop);