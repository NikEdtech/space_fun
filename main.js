diff --git a/main.js b/main.js
new file mode 100644
index 0000000000000000000000000000000000000000..10768fe0bb66fd40b9623077635f740beb27b5c1
--- /dev/null
+++ b/main.js
@@ -0,0 +1,653 @@
+const canvas = document.getElementById('gameCanvas');
+const ctx = canvas.getContext('2d');
+
+const scoreEl = document.getElementById('scoreValue');
+const communityEl = document.getElementById('communityValue');
+const energyEl = document.getElementById('energyValue');
+const bestScoreEl = document.getElementById('bestScoreValue');
+const bestCommunityEl = document.getElementById('bestCommunityValue');
+const messageEl = document.getElementById('message');
+const overlayEl = document.getElementById('overlay');
+
+const GROUND_H = 72;
+const STORAGE_KEYS = {
+  bestScore: 'space_runner_best_score',
+  bestCommunity: 'space_runner_best_community'
+};
+
+let width = 900;
+let height = 500;
+let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
+
+const game = {
+  scene: 'start',
+  score: 0,
+  community: 0,
+  energy: 3,
+  distanceSpeed: 300,
+  baseSpeed: 300,
+  spawnTick: 0,
+  collectibleTick: 0,
+  particleTick: 0,
+  bossMeter: 0,
+  flowActiveUntil: 0,
+  shieldActiveUntil: 0,
+  comboHumans: 0,
+  messageUntil: 0,
+  paused: false,
+  muted: false,
+  stars: [],
+  obstacles: [],
+  collectibles: [],
+  particles: [],
+  player: {
+    x: 120,
+    y: 0,
+    vy: 0,
+    radius: 20,
+    isGrounded: true,
+    flashUntil: 0,
+  },
+  boss: {
+    x: -180,
+    y: 0,
+  },
+  bestScore: Number(localStorage.getItem(STORAGE_KEYS.bestScore) || 0),
+  bestCommunity: Number(localStorage.getItem(STORAGE_KEYS.bestCommunity) || 0),
+  time: performance.now(),
+};
+
+bestScoreEl.textContent = String(game.bestScore);
+bestCommunityEl.textContent = String(game.bestCommunity);
+
+function resizeCanvas() {
+  const rect = canvas.getBoundingClientRect();
+  width = Math.floor(rect.width);
+  height = Math.floor(rect.height);
+  dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
+  canvas.width = Math.floor(width * dpr);
+  canvas.height = Math.floor(height * dpr);
+  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
+  initStars();
+  resetPlayerY();
+}
+
+function initStars() {
+  const count = Math.max(60, Math.floor((width * height) / 12000));
+  game.stars = Array.from({ length: count }, () => ({
+    x: Math.random() * width,
+    y: Math.random() * (height - GROUND_H - 20),
+    s: 0.6 + Math.random() * 1.8,
+    v: 12 + Math.random() * 40,
+  }));
+}
+
+function resetPlayerY() {
+  game.player.y = height - GROUND_H - game.player.radius;
+  game.boss.y = height - GROUND_H - 16;
+}
+
+function showMessage(text, ms = 2300) {
+  messageEl.textContent = text;
+  game.messageUntil = performance.now() + ms;
+}
+
+function randomRange(min, max) {
+  return min + Math.random() * (max - min);
+}
+
+function isFlowActive(now) {
+  return game.flowActiveUntil > now;
+}
+
+function isShieldActive(now) {
+  return game.shieldActiveUntil > now;
+}
+
+function beep(type = 'sine', frequency = 440, duration = 0.08, volume = 0.04) {
+  if (game.muted) return;
+  const AudioContext = window.AudioContext || window.webkitAudioContext;
+  if (!AudioContext) return;
+  if (!beep.ctx) {
+    beep.ctx = new AudioContext();
+  }
+  const ac = beep.ctx;
+  const osc = ac.createOscillator();
+  const gain = ac.createGain();
+  osc.type = type;
+  osc.frequency.value = frequency;
+  gain.gain.value = volume;
+  osc.connect(gain).connect(ac.destination);
+  osc.start();
+  gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
+  osc.stop(ac.currentTime + duration);
+}
+
+function spawnObstacle() {
+  const kind = Math.random();
+  const obstacle = {
+    x: width + 40,
+    w: 30,
+    h: 26,
+    y: height - GROUND_H - 26,
+    type: 'asteroid',
+    hit: false,
+  };
+  if (kind < 0.4) {
+    obstacle.type = 'asteroid';
+    obstacle.w = 32;
+    obstacle.h = 28;
+  } else if (kind < 0.73) {
+    obstacle.type = 'stamp';
+    obstacle.w = 34;
+    obstacle.h = 34;
+  } else {
+    obstacle.type = 'mine';
+    obstacle.w = 28;
+    obstacle.h = 22;
+  }
+  obstacle.y = height - GROUND_H - obstacle.h;
+  game.obstacles.push(obstacle);
+}
+
+function spawnCollectible() {
+  const r = Math.random();
+  const c = {
+    x: width + 40,
+    y: height - GROUND_H - randomRange(40, 170),
+    r: 11,
+    type: 'budget',
+    taken: false,
+  };
+  if (r < 0.47) {
+    c.type = 'budget';
+  } else if (r < 0.9) {
+    c.type = 'human';
+  } else {
+    c.type = 'pass';
+  }
+  game.collectibles.push(c);
+}
+
+function createDust(x, y, color = '#9de6ff') {
+  for (let i = 0; i < 8; i++) {
+    game.particles.push({
+      x,
+      y,
+      vx: randomRange(-90, 90),
+      vy: randomRange(-90, 40),
+      life: randomRange(0.2, 0.6),
+      t: 0,
+      color,
+    });
+  }
+}
+
+function activateFlow(now) {
+  game.flowActiveUntil = now + 5000;
+  game.comboHumans = 0;
+  showMessage('SPACE Flow! Скорость +, космос аплодирует 👏', 2400);
+  beep('triangle', 700, 0.1, 0.05);
+  beep('triangle', 930, 0.1, 0.04);
+}
+
+function collectItem(item, now) {
+  item.taken = true;
+  if (item.type === 'budget') {
+    game.score += 8;
+    beep('sine', 520, 0.06, 0.03);
+    createDust(item.x, item.y, '#ffdf88');
+  } else if (item.type === 'human') {
+    game.community += 1;
+    game.score += 3;
+    game.comboHumans += 1;
+    beep('square', 630, 0.06, 0.03);
+    createDust(item.x, item.y, '#99ffdb');
+    if (game.comboHumans >= 5) {
+      activateFlow(now);
+    }
+  } else if (item.type === 'pass') {
+    game.shieldActiveUntil = now + 6000;
+    game.score += 10;
+    showMessage('Щит активен: SPACE Pass 🛡️', 2500);
+    beep('sawtooth', 380, 0.12, 0.035);
+    createDust(item.x, item.y, '#85c3ff');
+  }
+}
+
+function hitObstacle(now, obstacle) {
+  obstacle.hit = true;
+  if (isShieldActive(now)) {
+    showMessage('Щит поглотил удар. SPACE Pass в деле!', 1800);
+    beep('triangle', 290, 0.08, 0.04);
+    createDust(obstacle.x, obstacle.y, '#8db8ff');
+    return;
+  }
+  game.energy -= 1;
+  game.comboHumans = 0;
+  game.player.flashUntil = now + 450;
+  showMessage(game.energy > 0 ? 'Осторожно! Бюрократия бьёт больно.' : 'Энергия на нуле. Миссия окончена.');
+  beep('square', 170, 0.12, 0.06);
+  createDust(obstacle.x, obstacle.y, '#ff8f8f');
+  if (game.energy <= 1) {
+    showMessage('Р. Пучинский приближается... держись!', 2000);
+  }
+  if (game.energy <= 0) {
+    endGame();
+  }
+}
+
+function setOverlayStart() {
+  overlayEl.classList.remove('hidden');
+  overlayEl.innerHTML = `
+    <article class="card">
+      <h2>🌌 SPACE Runner: Community Orbit</h2>
+      <p>Беги по орбитальной полосе, собирай 💰 бюджет и 👥 комьюнити, избегай астероидов, печатей и гравимин.</p>
+      <p><b>Управление:</b> ←/→ или A/D — движение, ↑/W/Space — прыжок/ускорение, на мобильном — tap для прыжка.</p>
+      <p><b>Клавиши:</b> P — пауза, R — рестарт, M — звук.</p>
+      <div class="btn-row">
+        <button id="startBtn">Start mission</button>
+      </div>
+    </article>
+  `;
+  document.getElementById('startBtn').onclick = () => startGame();
+}
+
+function setOverlayGameOver() {
+  overlayEl.classList.remove('hidden');
+  const tip = 'Комьюнити держит орбиту!';
+  overlayEl.innerHTML = `
+    <article class="card">
+      <h2>☄️ Game Over</h2>
+      <p>Итог: 💰 <b>${Math.floor(game.score)}</b> | 👥 <b>${game.community}</b></p>
+      <p>Рекорд: 💰 <b>${game.bestScore}</b> | 👥 <b>${game.bestCommunity}</b></p>
+      <div class="btn-row">
+        <button id="restartBtn">Restart</button>
+        <button id="shareBtn" class="secondary">Share tip</button>
+      </div>
+    </article>
+  `;
+  document.getElementById('restartBtn').onclick = () => {
+    startGame();
+  };
+  document.getElementById('shareBtn').onclick = async () => {
+    const text = `${tip} Мой результат в SPACE Runner: 💰${Math.floor(game.score)} 👥${game.community}`;
+    if (navigator.share) {
+      try {
+        await navigator.share({ text });
+      } catch (_e) {}
+    } else {
+      try {
+        await navigator.clipboard.writeText(text);
+        showMessage('Подсказка скопирована в буфер ✨', 1800);
+      } catch (_e) {
+        showMessage('Не удалось поделиться, но tip всё равно классный 😄', 1800);
+      }
+    }
+  };
+}
+
+function startGame() {
+  game.scene = 'gameplay';
+  game.score = 0;
+  game.community = 0;
+  game.energy = 3;
+  game.distanceSpeed = game.baseSpeed;
+  game.spawnTick = 0;
+  game.collectibleTick = 0;
+  game.obstacles.length = 0;
+  game.collectibles.length = 0;
+  game.particles.length = 0;
+  game.flowActiveUntil = 0;
+  game.shieldActiveUntil = 0;
+  game.comboHumans = 0;
+  game.paused = false;
+  game.bossMeter = 0;
+  resetPlayerY();
+  game.player.vy = 0;
+  overlayEl.classList.add('hidden');
+  showMessage('Комьюнити держит орбиту 🌍', 1800);
+}
+
+function endGame() {
+  game.scene = 'gameover';
+  game.bestScore = Math.max(game.bestScore, Math.floor(game.score));
+  game.bestCommunity = Math.max(game.bestCommunity, game.community);
+  localStorage.setItem(STORAGE_KEYS.bestScore, String(game.bestScore));
+  localStorage.setItem(STORAGE_KEYS.bestCommunity, String(game.bestCommunity));
+  bestScoreEl.textContent = String(game.bestScore);
+  bestCommunityEl.textContent = String(game.bestCommunity);
+  setOverlayGameOver();
+}
+
+function togglePause() {
+  if (game.scene !== 'gameplay') return;
+  game.paused = !game.paused;
+  showMessage(game.paused ? 'Пауза. Космос ждёт.' : 'Полетели дальше!');
+}
+
+const keys = new Set();
+
+function jumpOrBoost() {
+  if (game.scene !== 'gameplay' || game.paused) return;
+  if (game.player.isGrounded) {
+    game.player.vy = -600;
+    game.player.isGrounded = false;
+    beep('triangle', 490, 0.07, 0.035);
+  } else {
+    game.distanceSpeed += 30;
+    beep('sine', 760, 0.04, 0.02);
+  }
+}
+
+window.addEventListener('keydown', (e) => {
+  const key = e.key.toLowerCase();
+  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) {
+    e.preventDefault();
+  }
+  keys.add(key);
+  if (key === ' ' || key === 'w' || key === 'arrowup') jumpOrBoost();
+  if (key === 'p') togglePause();
+  if (key === 'r') startGame();
+  if (key === 'm') {
+    game.muted = !game.muted;
+    showMessage(game.muted ? 'Звук выключен 🔇' : 'Звук включен 🔊');
+  }
+});
+window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
+
+canvas.addEventListener('pointerdown', () => {
+  if (game.scene === 'start') {
+    startGame();
+    return;
+  }
+  if (game.scene === 'gameover') {
+    startGame();
+    return;
+  }
+  jumpOrBoost();
+});
+
+function circleRectCollision(cx, cy, cr, rx, ry, rw, rh) {
+  const nearestX = Math.max(rx, Math.min(cx, rx + rw));
+  const nearestY = Math.max(ry, Math.min(cy, ry + rh));
+  const dx = cx - nearestX;
+  const dy = cy - nearestY;
+  return dx * dx + dy * dy <= cr * cr;
+}
+
+function update(dt, now) {
+  if (game.scene !== 'gameplay' || game.paused) return;
+
+  const flow = isFlowActive(now);
+  const speedBonus = flow ? 120 : 0;
+  game.distanceSpeed += (game.baseSpeed + speedBonus - game.distanceSpeed) * Math.min(1, dt * 2.2);
+
+  const move = (keys.has('arrowright') || keys.has('d') ? 1 : 0) - (keys.has('arrowleft') || keys.has('a') ? 1 : 0);
+  game.player.x += move * 280 * dt;
+  game.player.x = Math.max(38, Math.min(width - 80, game.player.x));
+
+  game.player.vy += 1450 * dt;
+  game.player.y += game.player.vy * dt;
+  const groundY = height - GROUND_H - game.player.radius;
+  if (game.player.y >= groundY) {
+    game.player.y = groundY;
+    game.player.vy = 0;
+    game.player.isGrounded = true;
+  }
+
+  game.spawnTick -= dt;
+  game.collectibleTick -= dt;
+  if (game.spawnTick <= 0) {
+    spawnObstacle();
+    const base = flow ? 1.1 : 0.8;
+    game.spawnTick = base + Math.random() * (flow ? 0.8 : 0.6);
+  }
+  if (game.collectibleTick <= 0) {
+    spawnCollectible();
+    game.collectibleTick = 0.45 + Math.random() * 0.9;
+  }
+
+  for (const star of game.stars) {
+    star.x -= star.v * dt;
+    if (star.x < -4) {
+      star.x = width + 2;
+      star.y = Math.random() * (height - GROUND_H - 20);
+    }
+  }
+
+  for (const obstacle of game.obstacles) {
+    obstacle.x -= game.distanceSpeed * dt;
+    if (!obstacle.hit && circleRectCollision(game.player.x, game.player.y, game.player.radius - 2, obstacle.x, obstacle.y, obstacle.w, obstacle.h)) {
+      hitObstacle(now, obstacle);
+    }
+  }
+  game.obstacles = game.obstacles.filter((o) => o.x + o.w > -60 && !o.hit);
+
+  for (const item of game.collectibles) {
+    item.x -= game.distanceSpeed * dt;
+    if (!item.taken && circleRectCollision(game.player.x, game.player.y, game.player.radius, item.x - item.r, item.y - item.r, item.r * 2, item.r * 2)) {
+      collectItem(item, now);
+    }
+  }
+  game.collectibles = game.collectibles.filter((c) => c.x > -40 && !c.taken);
+
+  for (const p of game.particles) {
+    p.t += dt;
+    p.x += p.vx * dt;
+    p.y += p.vy * dt;
+    p.vy += 190 * dt;
+  }
+  game.particles = game.particles.filter((p) => p.t < p.life);
+
+  game.score += dt * (flow ? 24 : 18);
+  game.bossMeter += dt * (game.energy <= 1 ? 1.9 : 1.2);
+  if (game.bossMeter > 8 && game.energy > 0) {
+    showMessage('Р. Пучинский приближается 😅', 1500);
+    game.bossMeter = 0;
+  }
+
+  if (game.messageUntil < now && !game.paused) {
+    messageEl.textContent = flow ? 'SPACE Flow активен! 🚀' : 'Комьюнити держит орбиту';
+  }
+
+  scoreEl.textContent = String(Math.floor(game.score));
+  communityEl.textContent = String(game.community);
+  energyEl.textContent = String(game.energy);
+}
+
+function drawBackground(now) {
+  const grad = ctx.createLinearGradient(0, 0, 0, height);
+  grad.addColorStop(0, '#050a1d');
+  grad.addColorStop(0.55, '#0a1545');
+  grad.addColorStop(1, '#0d1438');
+  ctx.fillStyle = grad;
+  ctx.fillRect(0, 0, width, height);
+
+  for (const s of game.stars) {
+    ctx.fillStyle = `rgba(203,225,255,${0.4 + ((Math.sin(now * 0.001 + s.x) + 1) * 0.2)})`;
+    ctx.fillRect(s.x, s.y, s.s, s.s);
+  }
+
+  ctx.fillStyle = '#18245a';
+  ctx.fillRect(0, height - GROUND_H, width, GROUND_H);
+
+  const stripeOffset = (now * 0.3) % 42;
+  for (let x = -42; x < width + 42; x += 42) {
+    ctx.fillStyle = '#2d3f83';
+    ctx.fillRect(x - stripeOffset, height - 38, 22, 4);
+  }
+}
+
+function drawPlayer(now) {
+  const p = game.player;
+  const isHit = p.flashUntil > now;
+  ctx.save();
+  ctx.translate(p.x, p.y);
+
+  ctx.fillStyle = isHit ? '#ff8899' : '#f5fbff';
+  ctx.beginPath();
+  ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
+  ctx.fill();
+
+  ctx.fillStyle = '#5cc9ff';
+  ctx.fillRect(-11, 8, 22, 18);
+
+  ctx.fillStyle = '#091a3c';
+  ctx.beginPath();
+  ctx.arc(0, -4, 8, 0, Math.PI * 2);
+  ctx.fill();
+
+  if (isShieldActive(now)) {
+    ctx.strokeStyle = 'rgba(122,196,255,0.9)';
+    ctx.lineWidth = 3;
+    ctx.beginPath();
+    ctx.arc(0, 0, p.radius + 7 + Math.sin(now * 0.01) * 2, 0, Math.PI * 2);
+    ctx.stroke();
+  }
+  ctx.restore();
+}
+
+function drawBoss(now) {
+  const targetX = Math.max(20, game.player.x - (game.energy <= 1 ? 130 : 210));
+  game.boss.x += (targetX - game.boss.x) * 0.05;
+  const y = height - GROUND_H - 16;
+
+  ctx.save();
+  ctx.translate(game.boss.x, y);
+  ctx.fillStyle = '#201124';
+  ctx.fillRect(-16, 2, 32, 30);
+  ctx.fillStyle = '#f7d7d7';
+  ctx.beginPath();
+  ctx.arc(0, -10, 13, 0, Math.PI * 2);
+  ctx.fill();
+  ctx.fillStyle = '#3a102d';
+  ctx.fillRect(-12, -20, 24, 6);
+  ctx.fillRect(-8, -27, 16, 8);
+  ctx.fillStyle = '#5e0015';
+  ctx.beginPath();
+  ctx.moveTo(-8, -1);
+  ctx.lineTo(8, -1);
+  ctx.lineTo(0, 7);
+  ctx.closePath();
+  ctx.fill();
+  ctx.fillStyle = '#ffffff';
+  ctx.fillRect(-6, -8, 3, 4);
+  ctx.fillRect(3, -8, 3, 4);
+  ctx.restore();
+}
+
+function drawObstacle(o) {
+  ctx.save();
+  ctx.translate(o.x, o.y);
+  if (o.type === 'asteroid') {
+    ctx.fillStyle = '#8a92b3';
+    ctx.beginPath();
+    ctx.arc(o.w * 0.5, o.h * 0.5, o.h * 0.5, 0, Math.PI * 2);
+    ctx.fill();
+    ctx.fillStyle = '#646b88';
+    ctx.beginPath();
+    ctx.arc(o.w * 0.35, o.h * 0.4, 4, 0, Math.PI * 2);
+    ctx.fill();
+  } else if (o.type === 'stamp') {
+    ctx.fillStyle = '#d2556f';
+    ctx.fillRect(0, 0, o.w, o.h);
+    ctx.fillStyle = '#ffd4df';
+    ctx.fillRect(6, 8, o.w - 12, 8);
+    ctx.fillStyle = '#8a1b34';
+    ctx.font = 'bold 10px sans-serif';
+    ctx.fillText('БЮРО', 5, o.h - 6);
+  } else {
+    ctx.fillStyle = '#7759ff';
+    ctx.beginPath();
+    ctx.moveTo(0, o.h);
+    ctx.lineTo(o.w * 0.5, 0);
+    ctx.lineTo(o.w, o.h);
+    ctx.closePath();
+    ctx.fill();
+    ctx.fillStyle = '#c8b9ff';
+    ctx.fillRect(o.w * 0.5 - 2, 6, 4, 10);
+  }
+  ctx.restore();
+}
+
+function drawCollectible(c) {
+  ctx.save();
+  ctx.translate(c.x, c.y);
+  if (c.type === 'budget') {
+    ctx.fillStyle = '#f8d067';
+    ctx.beginPath();
+    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
+    ctx.fill();
+    ctx.fillStyle = '#5e4b00';
+    ctx.font = 'bold 10px sans-serif';
+    ctx.fillText('$', -3, 4);
+  } else if (c.type === 'human') {
+    ctx.fillStyle = '#74ffd0';
+    ctx.beginPath();
+    ctx.arc(0, -5, 6, 0, Math.PI * 2);
+    ctx.fill();
+    ctx.fillRect(-5, 1, 10, 12);
+  } else {
+    ctx.strokeStyle = '#8ac7ff';
+    ctx.lineWidth = 3;
+    ctx.beginPath();
+    ctx.arc(0, 0, c.r + 1, 0, Math.PI * 2);
+    ctx.stroke();
+    ctx.fillStyle = '#bedeff';
+    ctx.font = 'bold 9px sans-serif';
+    ctx.fillText('PASS', -10, 4);
+  }
+  ctx.restore();
+}
+
+function drawParticles() {
+  for (const p of game.particles) {
+    const a = 1 - p.t / p.life;
+    ctx.fillStyle = p.color.replace(')', `, ${a})`).replace('rgb', 'rgba');
+    if (!ctx.fillStyle.includes('rgba')) ctx.fillStyle = `rgba(157,230,255,${a})`;
+    ctx.fillRect(p.x, p.y, 3, 3);
+  }
+}
+
+function drawHud(now) {
+  const flow = Math.max(0, game.flowActiveUntil - now);
+  const shield = Math.max(0, game.shieldActiveUntil - now);
+  ctx.fillStyle = 'rgba(7,12,29,0.58)';
+  ctx.fillRect(12, 12, 210, 62);
+  ctx.fillStyle = '#dce8ff';
+  ctx.font = '12px sans-serif';
+  ctx.fillText(`Flow: ${flow > 0 ? (flow / 1000).toFixed(1) + 's' : 'off'}`, 20, 35);
+  ctx.fillText(`Shield: ${shield > 0 ? (shield / 1000).toFixed(1) + 's' : 'off'}`, 20, 55);
+
+  if (game.paused) {
+    ctx.fillStyle = 'rgba(0,0,0,0.45)';
+    ctx.fillRect(0, 0, width, height);
+    ctx.fillStyle = '#fff';
+    ctx.font = 'bold 36px sans-serif';
+    ctx.fillText('PAUSE', width * 0.5 - 70, height * 0.5);
+  }
+}
+
+function render(now) {
+  drawBackground(now);
+  drawBoss(now);
+  game.obstacles.forEach(drawObstacle);
+  game.collectibles.forEach(drawCollectible);
+  drawPlayer(now);
+  drawParticles();
+  drawHud(now);
+}
+
+function frame(now) {
+  const dt = Math.min(0.033, (now - game.time) / 1000 || 0.016);
+  game.time = now;
+  update(dt, now);
+  render(now);
+  requestAnimationFrame(frame);
+}
+
+window.addEventListener('resize', resizeCanvas);
+resizeCanvas();
+setOverlayStart();
+requestAnimationFrame(frame);
