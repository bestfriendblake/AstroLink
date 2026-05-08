const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

const STATE = { START: 0, PLAYING: 1, WIN: 2, LOSE: 3 };
let state    = STATE.START;
let animId   = null;
let sessionToken = null;
let gameStartTime = null;

const COLS = {
  bg:        '#060612',
  stars:     'rgba(255,255,255,0.7)',
  player:    '#f0e6ff',
  helmet:    '#c4b5fd',
  thruster:  '#e879f9',
  rock:      '#475569',
  rockEdge:  '#64748b',
  pet:       '#fcd34d',
  petGlow:   'rgba(252,211,77,0.25)',
  ground:    '#1e1b4b',
  groundTop: '#4c1d95',
  danger:    '#e879f9',
  ui:        '#c4b5fd',
};

let W, H;
let player, rocks, pet, stars, score, holdingUp, fuel;

function resize() {
  const wrap = canvas.parentElement;
  W = canvas.width  = wrap.clientWidth;
  H = canvas.height = wrap.clientHeight;
}

function initGame() {
  resize();
  score     = 0;
  holdingUp = false;
  fuel      = 100;
  gameStartTime = Date.now();

  player = {
    x:  W * 0.15,
    y:  H * 0.6,
    vy: 0,
    w:  22,
    h:  28,
    trail: [],
  };

  pet = {
    x: W * 0.82,
    y: H * 0.12,
    w: 28,
    h: 28,
    bob: 0,
  };

  rocks = [];
  for (let i = 0; i < 6; i++) spawnRock(true);

  stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.4 + 0.3,
    a: Math.random() * 0.5 + 0.3,
  }));

  document.getElementById('score-display').textContent = '0';
}

function spawnRock(initial = false) {
  const fromRight = Math.random() > 0.5;
  const size = 18 + Math.random() * 28;
  rocks.push({
    x:   fromRight ? W + size : -size,
    y:   H * 0.08 + Math.random() * (H * 0.78),
    w:   size,
    h:   size * (0.7 + Math.random() * 0.5),
    vx:  fromRight
           ? -(1.4 + Math.random() * 2.2)
           : (1.4 + Math.random() * 2.2),
    vy:  (Math.random() - 0.5) * 0.8,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.04,
    sides: Math.floor(Math.random() * 3) + 5,
    initial,
  });
}

const GRAVITY  = 0.18;
const LIFT     = -0.32;
const MAX_VY   = 5.5;
const FLOOR    = 0.88;
const CEILING  = 0.04;

function update() {
  if (state !== STATE.PLAYING) return;

  player.vy += holdingUp ? LIFT : GRAVITY;
  player.vy  = Math.max(-MAX_VY, Math.min(MAX_VY, player.vy));
  player.y  += player.vy;

  player.trail.push({ x: player.x + player.w / 2, y: player.y + player.h / 2 });
  if (player.trail.length > 12) player.trail.shift();

  if (player.y + player.h >= H * FLOOR) {
    player.y  = H * FLOOR - player.h;
    player.vy = 0;
    endGame(false);
    return;
  }
  if (player.y <= H * CEILING) {
    player.y  = H * CEILING;
    player.vy = 0;
  }

  for (let i = rocks.length - 1; i >= 0; i--) {
    const r = rocks[i];
    r.x   += r.vx;
    r.y   += r.vy;
    r.rot += r.rotV;
    if (r.x < -80 || r.x > W + 80) {
      rocks.splice(i, 1);
      spawnRock();
      score += 10;
      document.getElementById('score-display').textContent = score;
      continue;
    }
    if (rectsOverlap(player, r)) {
      endGame(false);
      return;
    }
  }

  pet.bob += 0.05;
  const petY = pet.y + Math.sin(pet.bob) * 5;

  if (
    player.x < pet.x + pet.w &&
    player.x + player.w > pet.x &&
    player.y < petY + pet.h &&
    player.y + player.h > petY
  ) {
    score += 500;
    endGame(true);
  }
}

function rectsOverlap(a, b) {
  const pad = 5;
  return (
    a.x + pad < b.x + b.w - pad &&
    a.x + a.w - pad > b.x + pad &&
    a.y + pad < b.y + b.h - pad &&
    a.y + a.h - pad > b.y + pad
  );
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = COLS.bg;
  ctx.fillRect(0, 0, W, H);

  stars.forEach(s => {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = COLS.stars;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLS.ground;
  ctx.fillRect(0, H * FLOOR, W, H * (1 - FLOOR));
  ctx.fillStyle = COLS.groundTop;
  ctx.fillRect(0, H * FLOOR, W, 3);

  const petDrawY = pet.y + Math.sin(pet.bob) * 5;
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = COLS.petGlow;
  ctx.beginPath();
  ctx.arc(pet.x + pet.w / 2, petDrawY + pet.h / 2, pet.w * 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.font = `${pet.w}px serif`;
  ctx.textAlign = 'center';
  ctx.fillText('🦋', pet.x + pet.w / 2, petDrawY + pet.h);

  rocks.forEach(r => {
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(r.rot);
    ctx.beginPath();
    for (let i = 0; i < r.sides; i++) {
      const angle = (i / r.sides) * Math.PI * 2 - Math.PI / 2;
      const rx = Math.cos(angle) * r.w / 2;
      const ry = Math.sin(angle) * r.h / 2;
      i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
    }
    ctx.closePath();
    ctx.fillStyle   = COLS.rock;
    ctx.strokeStyle = COLS.rockEdge;
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  if (player.trail.length > 1) {
    ctx.strokeStyle = COLS.thruster;
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    player.trail.forEach((p, i) => {
      i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  const px = player.x, py = player.y, pw = player.w, ph = player.h;
  ctx.fillStyle = '#e879f9';
  ctx.beginPath();
  ctx.ellipse(px + pw / 2, py + ph * 0.9, pw * 0.35, ph * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLS.player;
  ctx.beginPath();
  ctx.roundRect(px + 2, py + ph * 0.35, pw - 4, ph * 0.55, 5);
  ctx.fill();

  ctx.fillStyle = COLS.helmet;
  ctx.beginPath();
  ctx.arc(px + pw / 2, py + ph * 0.28, pw * 0.44, Math.PI, 0);
  ctx.lineTo(px + pw - 2, py + ph * 0.42);
  ctx.lineTo(px + 2, py + ph * 0.42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(px + pw * 0.38, py + ph * 0.22, pw * 0.14, 0, Math.PI * 2);
  ctx.fill();

  if (holdingUp) {
    ctx.fillStyle = '#fcd34d';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(px + pw * 0.3, py + ph);
    ctx.lineTo(px + pw * 0.5, py + ph + 10 + Math.random() * 6);
    ctx.lineTo(px + pw * 0.7, py + ph);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle   = COLS.ui;
  ctx.font        = 'bold 12px Nunito';
  ctx.textAlign   = 'left';
  ctx.fillText('PET', pet.x - 2, pet.y - 8);
  ctx.fillStyle   = '#334155';
  ctx.font        = 'bold 11px Nunito';
  ctx.textAlign   = 'center';
  ctx.fillText('▲ hold to rise', W / 2, H - 12);
}

function loop() {
  update();
  draw();
  animId = requestAnimationFrame(loop);
}

async function endGame(won) {
  state = won ? STATE.WIN : STATE.LOSE;
  cancelAnimationFrame(animId);
  draw();

  if (won) {
    const duration = Date.now() - gameStartTime;
    let stardustAwarded = 0;

    try {
      const submitRes = await fetch('/api/games/lunar-descent/submit', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          session_token:      sessionToken,
          fuel_used:          Math.min(100, Math.round(100 - fuel)),
          final_velocity:     Math.abs(parseFloat(player.vy.toFixed(4))),
          touchdown_x:        parseFloat(player.x.toFixed(4)),
          touchdown_y:        parseFloat(player.y.toFixed(4)),
          flight_duration_ms: duration,
        }),
      });
      const data = await submitRes.json();
      stardustAwarded = data.stardustAwarded || 0;
    } catch (e) {
      console.warn('Could not submit score:', e);
    }

    document.getElementById('win-score-text').textContent   = `Score: ${score.toLocaleString()}`;
    document.getElementById('win-stardust-text').textContent =
      stardustAwarded > 0 ? `+${stardustAwarded} stardust earned!` : '';
    document.getElementById('overlay-win').style.display = 'flex';
  } else {
    document.getElementById('lose-score-text').textContent = `Score: ${score.toLocaleString()}`;
    document.getElementById('overlay-lose').style.display  = 'flex';
  }
}

async function startGame() {
  document.getElementById('overlay-start').style.display = 'none';
  document.getElementById('overlay-win').style.display   = 'none';
  document.getElementById('overlay-lose').style.display  = 'none';

  try {
    const res  = await fetch('/api/games/lunar-descent/start', {
      method: 'POST', credentials: 'include',
    });
    const data = await res.json();
    sessionToken = data.session_token;
  } catch (e) {
    console.warn('Could not get session token:', e);
    sessionToken = 'offline';
  }

  initGame();
  state  = STATE.PLAYING;
  animId = requestAnimationFrame(loop);
}

document.getElementById('btn-start').addEventListener('click', startGame);
document.getElementById('btn-play-again').addEventListener('click', startGame);
document.getElementById('btn-retry').addEventListener('click', startGame);

window.addEventListener('mousedown',  () => { holdingUp = true; });
window.addEventListener('mouseup',    () => { holdingUp = false; });
window.addEventListener('touchstart', e => { e.preventDefault(); holdingUp = true;  }, { passive: false });
window.addEventListener('touchend',   e => { e.preventDefault(); holdingUp = false; }, { passive: false });
window.addEventListener('keydown',    e => { if (e.code === 'Space' || e.code === 'ArrowUp') holdingUp = true; });
window.addEventListener('keyup',      e => { if (e.code === 'Space' || e.code === 'ArrowUp') holdingUp = false; });
window.addEventListener('resize', () => { if (state !== STATE.PLAYING) resize(); });