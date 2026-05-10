const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GSTATE = { START: 0, CHARGING: 1, FLYING: 2, DONE: 3 };
let gstate = GSTATE.START;
let animId = null;

let W, H;
let astronaut, asteroids, particles, bgStars, camera;
let power, powerDir, boostsLeft, distance, runStardust;
let totalStardust = 0;

const GRAVITY = 0.09;
const WING_DRAG = 0.018;
const BOUNCE_DAMP = 0.72;

const UPGRADES = [
    { id: 'launch', icon: '🚀', name: 'Launch Power', desc: 'More initial velocity', maxLevel: 5, costs: [80, 160, 280, 450, 700] },
    { id: 'fuel', icon: '⛽', name: 'Fuel Tank', desc: 'Extra mid-air boosts', maxLevel: 4, costs: [100, 220, 400, 650] },
    { id: 'gravity', icon: '🧲', name: 'Gravity Suit', desc: 'Survive asteroid grazes', maxLevel: 3, costs: [150, 350, 600] },
    { id: 'bounce', icon: '👟', name: 'Bounce Boots', desc: 'Upgrade your natural bounce', maxLevel: 4, costs: [120, 250, 420, 650] },
    { id: 'wings', icon: '🌌', name: 'Solar Wings', desc: 'Slower passive descent', maxLevel: 4, costs: [90, 200, 360, 560] },
    { id: 'magnet', icon: '💰', name: 'Star Magnet', desc: 'Earn more stardust', maxLevel: 5, costs: [60, 130, 240, 400, 600] },
];

let upgradeLevels = { launch: 0, fuel: 0, gravity: 0, bounce: 0, wings: 0, magnet: 0 };

function getUpgradeVal(id) {
    const lvl = upgradeLevels[id];
    switch (id) {
        case 'launch': return 1 + lvl * 0.28;
        case 'fuel': return 1 + lvl;
        case 'gravity': return lvl;
        case 'bounce': return 0.72 + lvl * 0.07;
        case 'wings': return lvl * 0.012;
        case 'magnet': return 1 + lvl * 0.35;
    }
    return 1;
}

function resize() {
    const wrap = canvas.parentElement;
    W = canvas.width = wrap.clientWidth;
    H = canvas.height = wrap.clientHeight;
}

function makeAsteroid(initial = false) {
    const x = initial
        ? W * 0.3 + Math.random() * W * 6
        : camera.x + W + 80 + Math.random() * W * 0.8;

    const roll = Math.random();
    let type;
    if (roll > 0.88) type = 'boost';
    else if (roll > 0.76) type = 'comet';
    else if (roll > 0.58) type = 'spike';
    else type = 'rock';

    const r = type === 'spike' ? 10 : 14 + Math.random() * 30;
    const h = type === 'spike' ? 55 + Math.random() * 35 : r;

    return {
        x,
        y: type === 'spike'
            ? H * 0.82 - h
            : H * 0.05 + Math.random() * H * 0.72,
        r, h,
        sides: type === 'spike' ? 3 : Math.floor(Math.random() * 3) + 5,
        rot: Math.random() * Math.PI * 2,
        rotV: type === 'comet' ? 0.08 : (Math.random() - 0.5) * 0.015,
        vx: type === 'comet' ? -(6 + Math.random() * 4) : 0,
        vy: type === 'comet' ? (Math.random() - 0.5) * 2 : 0,
        type,
    };
}

function initRun() {
    resize();
    power = 0;
    powerDir = 1;
    distance = 0;
    runStardust = 0;
    boostsLeft = getUpgradeVal('fuel');
    camera = { x: 0, y: 0 };

    astronaut = {
        x: W * 0.18, y: H * 0.72,
        vx: 0, vy: 0,
        w: 20, h: 26,
        grounded: true,
        alive: true,
        trail: [],
        boosting: false,
    };

    asteroids = Array.from({ length: 18 }, () => makeAsteroid(true));
    particles = [];

    bgStars = Array.from({ length: 100 }, () => ({
        x: Math.random() * W * 8,
        y: Math.random() * H,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.6 + 0.2,
        speed: Math.random() * 0.3 + 0.1,
    }));
}

function update() {
    if (gstate === GSTATE.CHARGING) {
        power += powerDir * 1.8;
        if (power >= 100) powerDir = -1;
        if (power <= 0) powerDir = 1;
        updatePowerBar();
        return;
    }

    if (gstate !== GSTATE.FLYING) return;

    const wingDrag = getUpgradeVal('wings');
    astronaut.vy += GRAVITY - wingDrag;
    astronaut.x += astronaut.vx;
    astronaut.y += astronaut.vy;

    astronaut.trail.push({ x: astronaut.x, y: astronaut.y });
    if (astronaut.trail.length > 16) astronaut.trail.shift();

    camera.x = astronaut.x - W * 0.25;
    if (camera.x < 0) camera.x = 0;

    distance = Math.max(distance, Math.round(astronaut.x * 0.4));

    const groundY = H * 0.82;
    if (astronaut.y + astronaut.h >= groundY) {
        astronaut.y = groundY - astronaut.h;
        const bounceVal = getUpgradeVal('bounce');
        astronaut.vy = -Math.abs(astronaut.vy) * bounceVal;
        astronaut.vx *= 0.96;
        spawnParticles(astronaut.x, groundY, '#c4b5fd', 6);
        if (Math.abs(astronaut.vy) < 0.5 && astronaut.vx < 0.5) {
            endRun();
            return;
        }
    }

    if (astronaut.y < 0) {
        astronaut.y = 0;
        astronaut.vy = Math.abs(astronaut.vy) * 0.5;
    }

    if (astronaut.vx < 0.3) {
        endRun();
        return;
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        a.rot += a.rotV;
        if (a.type === 'comet') { a.x += a.vx; a.y += a.vy; }

        if (a.type === 'spike') {
            const inX = astronaut.x + astronaut.w > a.x - a.r &&
                astronaut.x < a.x + a.r;
            const inY = astronaut.y + astronaut.h > a.y;
            if (inX && inY) {
                astronaut.vx *= 0.08;
                astronaut.vy = -1.5;
                spawnParticles(a.x, a.y, '#f87171', 14);
            }
        } else {
            const dx = (astronaut.x + astronaut.w / 2) - a.x;
            const dy = (astronaut.y + astronaut.h / 2) - a.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < a.r + 10) {
                if (a.type === 'boost') {
                    astronaut.vx += 4.5;
                    astronaut.vy -= 3.2;
                    spawnParticles(a.x, a.y, '#fcd34d', 12);
                    asteroids.splice(i, 1);
                    asteroids.push(makeAsteroid());
                    continue;
                } else if (a.type === 'comet') {
                    astronaut.vx += 7;
                    astronaut.vy -= 4;
                    spawnParticles(a.x, a.y, '#7dd3fc', 16);
                    asteroids.splice(i, 1);
                    continue;
                } else {
                    const gravSuit = getUpgradeVal('gravity');
                    if (gravSuit > 0) {
                        astronaut.vx *= 0.75;
                        astronaut.vy *= 0.75;
                        spawnParticles(a.x, a.y, '#e879f9', 8);
                        asteroids.splice(i, 1);
                        asteroids.push(makeAsteroid());
                    } else {
                        astronaut.vx *= 0.55;
                        astronaut.vy *= 0.55;
                        spawnParticles(a.x, a.y, '#94a3b8', 6);
                    }
                }
            }
        }

        if (a.x < camera.x - 150 || a.y > H + 50) {
            asteroids.splice(i, 1);
            asteroids.push(makeAsteroid());
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.life -= 0.03;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            r: 2 + Math.random() * 3,
            color,
            life: 1,
        });
    }
}

function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#060612';
    ctx.fillRect(0, 0, W, H);

    bgStars.forEach(s => {
        const sx = (s.x - camera.x * s.speed) % (W * 8);
        ctx.globalAlpha = s.a;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx < 0 ? sx + W * 8 : sx, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    const groundY = H * 0.82;
    ctx.fillStyle = '#0f0a2e';
    ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#2d1b69';
    ctx.fillRect(0, groundY, W, 3);

    ctx.save();
    ctx.translate(-camera.x, 0);

    asteroids.forEach(a => {
        ctx.save();
        ctx.translate(a.x, a.y);

        if (a.type === 'spike') {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-a.r, a.h);
            ctx.lineTo(a.r, a.h);
            ctx.closePath();
            ctx.fillStyle = '#dc2626';
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
            return;
        }

        if (a.type === 'comet') {
            ctx.rotate(a.rot);
            ctx.beginPath();
            ctx.arc(0, 0, a.r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(125,211,252,0.2)';
            ctx.strokeStyle = '#7dd3fc';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#7dd3fc';
            ctx.font = `${Math.round(a.r * 0.9)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('☄️', 0, 0);
            ctx.restore();
            return;
        }

        ctx.rotate(a.rot);
        ctx.beginPath();
        for (let i = 0; i < a.sides; i++) {
            const angle = (i / a.sides) * Math.PI * 2 - Math.PI / 2;
            const rx = Math.cos(angle) * a.r;
            const ry = Math.sin(angle) * a.r;
            i === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
        }
        ctx.closePath();
        if (a.type === 'boost') {
            ctx.fillStyle = 'rgba(252,211,77,0.15)';
            ctx.strokeStyle = '#fcd34d';
        } else {
            ctx.fillStyle = '#1e1b4b';
            ctx.strokeStyle = '#4c1d95';
        }
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        if (a.type === 'boost') {
            ctx.fillStyle = '#fcd34d';
            ctx.font = `${Math.round(a.r * 0.8)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⭐', 0, 0);
        }
        ctx.restore();
    });

    if (astronaut.trail.length > 1) {
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        astronaut.trail.forEach((p, i) => {
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    const ax = astronaut.x, ay = astronaut.y;
    const aw = astronaut.w, ah = astronaut.h;

    ctx.fillStyle = '#1e1b4b';
    ctx.beginPath();
    ctx.ellipse(ax + aw / 2, ay + ah + 2, aw * 0.4, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(ax + 3, ay + ah * 0.38, aw - 6, ah * 0.55);

    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.arc(ax + aw / 2, ay + ah * 0.28, aw * 0.44, Math.PI, 0);
    ctx.lineTo(ax + aw - 3, ay + ah * 0.42);
    ctx.lineTo(ax + 3, ay + ah * 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(ax + aw * 0.38, ay + ah * 0.2, aw * 0.13, 0, Math.PI * 2);
    ctx.fill();

    if (astronaut.boosting || gstate === GSTATE.FLYING) {
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#fcd34d';
        ctx.beginPath();
        ctx.moveTo(ax + aw * 0.3, ay + ah);
        ctx.lineTo(ax + aw * 0.5, ay + ah + 8 + Math.random() * 5);
        ctx.lineTo(ax + aw * 0.7, ay + ah);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.restore();

    ctx.fillStyle = '#c4b5fd';
    ctx.font = 'bold 13px Nunito';
    ctx.textAlign = 'left';
    ctx.fillText(`${distance}m`, 16, 32);

    ctx.fillStyle = '#fcd34d';
    ctx.textAlign = 'right';
    ctx.fillText(`${boostsLeft} boost${boostsLeft !== 1 ? 's' : ''} left`, W - 16, 32);
}

function updatePowerBar() {
    const fill = document.getElementById('power-fill');
    if (!fill) return;
    fill.style.width = power + '%';
    const hue = Math.round(power * 1.2);
    fill.style.background = `hsl(${hue}, 90%, 60%)`;
}

function launch() {
    const launchMult = getUpgradeVal('launch');
    const speed = (power / 100) * 14 * launchMult;
    astronaut.vx = speed * 0.85;
    astronaut.vy = -speed * 0.55;
    astronaut.grounded = false;
    gstate = GSTATE.FLYING;
    removePowerBar();
    document.getElementById('hint-text').textContent =
        `Tap to boost! (${boostsLeft} left)`;
}

function boost() {
    if (boostsLeft <= 0) return;
    boostsLeft--;
    astronaut.vx += 2.8;
    astronaut.vy -= 2.2;
    astronaut.boosting = true;
    setTimeout(() => { astronaut.boosting = false; }, 200);
    spawnParticles(
        astronaut.x + astronaut.w / 2,
        astronaut.y + astronaut.h,
        '#fcd34d', 8
    );
    document.getElementById('hint-text').textContent =
        boostsLeft > 0
            ? `Tap to boost! (${boostsLeft} left)`
            : 'No boosts left — ride it out!';
}

function showPowerBar() {
    if (document.getElementById('power-bar-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'power-bar-wrap';
    wrap.id = 'power-bar-wrap';
    wrap.innerHTML = `
    <div class="power-bar-bg">
      <div class="power-bar-fill" id="power-fill"></div>
    </div>
    <div class="power-label">Launch Power</div>`;
    document.querySelector('.game-wrap').appendChild(wrap);
}

function removePowerBar() {
    const el = document.getElementById('power-bar-wrap');
    if (el) el.remove();
}

async function endRun() {
    gstate = GSTATE.DONE;
    cancelAnimationFrame(animId);

    try {
        const res = await fetch('/api/games/lunar-fling/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                session_token: window._flingToken || 'offline',
                distance: distance,
            }),
        });
        const data = await res.json();
        runStardust = data.stardustAwarded || 0;
    } catch (e) {
        console.warn('Score submit failed', e);
        runStardust = 0;
    }

    // Pull real balance back from DB
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const { user } = await res.json();
        totalStardust = parseFloat(user.stardust);
        document.getElementById('stardust-display').textContent =
            totalStardust.toLocaleString();
    } catch (e) {
        console.warn('Could not fetch balance', e);
    }

    // Sync topbar
    if (window.TopBar) await TopBar.syncBalances();

    renderUpgradeScreen();
}

function renderUpgradeScreen() {
    document.getElementById('run-distance-text').textContent =
        `Distance: ${distance.toLocaleString()}m`;
    document.getElementById('run-stardust-text').textContent =
        runStardust > 0 ? `+${runStardust} stardust earned!` : 'No stardust this run';

    const grid = document.getElementById('upgrade-grid');
    grid.innerHTML = UPGRADES.map(u => {
        const lvl = upgradeLevels[u.id];
        const isMaxed = lvl >= u.maxLevel;
        const cost = isMaxed ? 0 : u.costs[lvl];
        const canBuy = !isMaxed && totalStardust >= cost;
        let cls = 'upgrade-btn';
        if (isMaxed) cls += ' maxed';
        else if (!canBuy) cls += ' cant-afford';
        return `
      <div class="${cls}" data-upg="${u.id}" data-cost="${cost}">
        <div class="upg-icon">${u.icon}</div>
        <div class="upg-name">${u.name}</div>
        <div class="upg-level">Lv ${lvl} / ${u.maxLevel}</div>
        <div class="upg-cost ${isMaxed ? 'maxed-label' : ''}">
          ${isMaxed ? 'MAXED' : `⭐ ${cost}`}
        </div>
      </div>`;
    }).join('');

    grid.querySelectorAll('.upgrade-btn:not(.maxed):not(.cant-afford)').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.dataset.upg;
            const cost = parseInt(btn.dataset.cost);
            if (totalStardust >= cost) {
                // Deduct locally for instant UI feedback
                totalStardust -= cost;
                upgradeLevels[id]++;
                document.getElementById('stardust-display').textContent =
                    totalStardust.toLocaleString();

                // TODO: wire to a real /api/upgrades/purchase endpoint
                // For now upgrades are session-only and reset on page leave
                renderUpgradeScreen();
            }
        });
    });

    document.getElementById('overlay-upgrade').style.display = 'flex';
}

async function startRun() {
    document.getElementById('overlay-start').style.display = 'none';
    document.getElementById('overlay-upgrade').style.display = 'none';

    // Load real stardust balance from DB
    try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const { user } = await res.json();
        totalStardust = parseFloat(user.stardust);
        document.getElementById('stardust-display').textContent =
            totalStardust.toLocaleString();
    } catch (e) {
        console.warn('Could not load balance');
    }

    try {
        const res = await fetch('/api/games/lunar-descent/start', {
            method: 'POST', credentials: 'include',
        });
        const data = await res.json();
        window._flingToken = data.session_token;
    } catch (e) {
        window._flingToken = 'offline';
    }

    initRun();
    gstate = GSTATE.CHARGING;
    power = 0;
    powerDir = 1;
    showPowerBar();
    document.getElementById('hint-text').textContent = 'Tap to set launch power';
    animId = requestAnimationFrame(loop);
}

function handleInput() {
    if (gstate === GSTATE.CHARGING) { launch(); return; }
    if (gstate === GSTATE.FLYING) { boost(); return; }
}

function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('topbar').classList.add('dark');
    await TopBar.init();
});

document.getElementById('btn-start').addEventListener('click', startRun);
document.getElementById('btn-launch-again').addEventListener('click', startRun);

window.addEventListener('click', handleInput);
window.addEventListener('touchstart', e => { e.preventDefault(); handleInput(); }, { passive: false });
window.addEventListener('keydown', e => { if (e.code === 'Space') handleInput(); });
window.addEventListener('resize', () => { if (gstate !== GSTATE.FLYING) resize(); });