const RARITY_ICONS = {
    common:    '🪨',
    uncommon:  '🌿',
    rare:      '💎',
    epic:      '🔮',
    legendary: '⭐',
};

const QUEST_LABELS = {
    play_games:    'Play mini-games',
    catch_pets:    'Catch pets',
    earn_stardust: 'Earn stardust',
};

async function loadDashboard() {
    // TopBar.init() fetches /api/auth/me, sets cookies, renders balances
    // It returns the user object — we use that directly, no second fetch needed
    console.log('loadDashboard started');
    try {
        const user = await TopBar.init();
        console.log('TopBar.init() returned:', user);
        if (!user) return;

        renderProfile(user);
        console.log('renderProfile done');
        loadPets();
        console.log('loadPets called');
        loadDailies();
        console.log('loadDailies called');
    } catch(err) {
        console.error('loadDashboard crashed:', err);
    }
}

function renderProfile(user) {
    const initial = user.username.slice(0, 1).toUpperCase();

    const avatar = document.getElementById('profile-avatar');
    const name   = document.getElementById('profile-name');
    const level  = document.getElementById('profile-level');
    const xpBar  = document.getElementById('xp-bar');

    if (avatar) avatar.textContent = initial;
    if (name)   name.textContent   = user.username;

    const lvl    = user.global_level || 1;
    const xp     = user.global_xp    || 0;
    const xpNext = lvl * 100;
    const pct    = Math.min(100, Math.round((xp / xpNext) * 100));

    if (level) level.textContent   = `Global Level ${lvl} · Moon Explorer`;
    if (xpBar) xpBar.style.width   = pct + '%';
}

async function loadPets() {
    try {
        const res      = await fetch('/api/pets', { credentials: 'include' });
        const { pets } = await res.json();
        renderPets(pets);
    } catch {
        document.getElementById('pet-preview').innerHTML =
            '<div class="loading-msg">Could not load pets.</div>';
    }
}

function renderPets(pets) {
    const container = document.getElementById('pet-preview');
    if (!pets || pets.length === 0) {
        container.innerHTML =
            '<div class="empty-pets">No pets yet — head to the Moon to catch some!</div>';
        return;
    }

    const chips = pets.slice(0, 6).map(pet => {
        const icon = RARITY_ICONS[pet.rarity] || '🐾';
        const name = pet.nickname || pet.display_name;
        return `
            <div class="pet-chip">
                <div class="pet-chip-icon rarity-${pet.rarity}">${icon}</div>
                <div class="pet-chip-name">${name}</div>
                <div class="pet-chip-lvl">Lv. ${pet.pet_level}</div>
            </div>`;
    }).join('');

    const more = `
        <div class="pet-chip view-all-chip" style="opacity:0.5;border-style:dashed;cursor:pointer;">
            <div class="pet-chip-icon rarity-common">＋</div>
            <div class="pet-chip-name">View all</div>
            <div class="pet-chip-lvl">${pets.length} total</div>
        </div>`;

    container.innerHTML = chips + more;

    container.querySelector('.view-all-chip')
        ?.addEventListener('click', () => { window.location.href = '/pets.html'; });
}

// ── Dailies ──────────────────────────────────────────────────

async function loadDailies() {
    try {
        const res  = await fetch('/api/dailies/status', { credentials: 'include' });
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        renderStreak(data.streak);
        renderSpin(data.spin);
        renderQuests(data.quests);
    } catch {
        document.getElementById('streak-sub').textContent = 'Could not load';
        document.getElementById('spin-sub').textContent   = 'Could not load';
        document.getElementById('quests-list').innerHTML  =
            '<div class="loading-msg">Could not load quests.</div>';
    }
}

function renderStreak(streak) {
    const sub = document.getElementById('streak-sub');
    const btn = document.getElementById('streak-btn');

    sub.textContent = streak.current > 0
        ? `Day ${streak.current} 🔥 — Next: ${streak.nextReward.stardust} SD${streak.nextReward.moonstone > 0 ? ` + ${streak.nextReward.moonstone}🌙` : ''}`
        : 'Start your streak today!';

    // Clone button to wipe any old listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    if (streak.canClaim) {
        newBtn.disabled    = false;
        newBtn.textContent = 'Claim';
        newBtn.addEventListener('click', claimStreak, { once: true });
    } else {
        newBtn.disabled    = true;
        newBtn.textContent = 'Done ✓';
    }
}

async function claimStreak() {
    const btn = document.getElementById('streak-btn');
    btn.disabled    = true;
    btn.textContent = 'Claiming...';

    try {
        const res  = await fetch('/api/dailies/streak/claim', {
            method: 'POST', credentials: 'include',
        });
        const data = await res.json();

        if (!res.ok) {
            alert(data.error);
            btn.disabled    = false;
            btn.textContent = 'Claim';
            return;
        }

        // Sync topbar balances from DB
        await TopBar.syncBalances();

        document.getElementById('streak-sub').textContent =
            `Day ${data.streak} 🔥 — Claimed! +${data.reward.stardust} SD${data.reward.moonstone > 0 ? ` +${data.reward.moonstone}🌙` : ''}`;
        btn.disabled    = true;
        btn.textContent = 'Done ✓';

    } catch {
        alert('Failed to claim streak. Try again.');
        btn.disabled    = false;
        btn.textContent = 'Claim';
    }
}

function renderSpin(spin) {
    const sub = document.getElementById('spin-sub');
    const btn = document.getElementById('spin-btn');

    // Clone to wipe old listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    if (spin.canSpin) {
        sub.textContent    = 'Free spin available!';
        newBtn.disabled    = false;
        newBtn.textContent = 'Spin';
        newBtn.addEventListener('click', openSlotModal, { once: true });
    } else {
        const r = spin.lastResult;
        sub.textContent    = r && r.result_value > 0
            ? `Won ${r.result_value} ${r.result_type} today!`
            : 'Come back tomorrow!';
        newBtn.disabled    = true;
        newBtn.textContent = 'Done ✓';
    }
}

function openSlotModal() {
    document.getElementById('slot-modal').style.display  = 'flex';
    document.getElementById('slot-result').textContent   = '';
    document.getElementById('slot-spin-btn').disabled    = false;

    // Reset reels
    [0,1,2].forEach(i => {
        document.getElementById(`reel-${i}`).textContent = '⭐';
        document.getElementById(`reel-${i}`).classList.remove('spinning');
    });
}

document.getElementById('slot-close-btn').addEventListener('click', () => {
    document.getElementById('slot-modal').style.display = 'none';
});

document.getElementById('slot-spin-btn').addEventListener('click', async () => {
    const spinBtn = document.getElementById('slot-spin-btn');
    spinBtn.disabled = true;

    const reelEls = [0,1,2].map(i => document.getElementById(`reel-${i}`));
    reelEls.forEach(r => r.classList.add('spinning'));

    try {
        const res  = await fetch('/api/dailies/spin', {
            method: 'POST', credentials: 'include',
        });
        const data = await res.json();

        if (!res.ok) {
            reelEls.forEach(r => r.classList.remove('spinning'));
            document.getElementById('slot-result').textContent = data.error || 'Already spun today!';
            return;
        }

        // Let reels spin visually for 1.5s then reveal
        setTimeout(async () => {
            reelEls.forEach((r, i) => {
                r.classList.remove('spinning');
                r.textContent = data.reels[i];
            });

            const resultEl = document.getElementById('slot-result');
            if (data.prize.value > 0) {
                resultEl.textContent = `🎉 You won ${data.prize.value} ${data.prize.type}!`;
            } else {
                resultEl.textContent = 'No match — try again tomorrow!';
            }

            // Sync real balances from DB into topbar
            await TopBar.syncBalances();

            // Update spin card
            document.getElementById('spin-sub').textContent = data.prize.value > 0
                ? `Won ${data.prize.value} ${data.prize.type} today!`
                : 'Come back tomorrow!';

            // Disable spin button on dashboard
            const dashSpinBtn = document.getElementById('spin-btn');
            if (dashSpinBtn) {
                dashSpinBtn.disabled    = true;
                dashSpinBtn.textContent = 'Done ✓';
            }

        }, 1500);

    } catch {
        reelEls.forEach(r => r.classList.remove('spinning'));
        document.getElementById('slot-result').textContent = 'Spin failed — try again';
        spinBtn.disabled = false;
    }
});

function renderQuests(quests) {
    const list = document.getElementById('quests-list');

    if (!quests || quests.length === 0) {
        list.innerHTML = '<div class="loading-msg">No quests today.</div>';
        return;
    }

    list.innerHTML = quests.map(q => {
        const pct    = Math.min(100, Math.round((q.progress / q.target) * 100));
        const label  = QUEST_LABELS[q.quest_type] || q.quest_type;
        const reward = `⭐ ${q.reward_stardust}${q.reward_moonstone > 0
            ? ` <span class="moon">+ ${q.reward_moonstone}🌙</span>`
            : ''}`;
        const prog   = q.quest_type === 'earn_stardust'
            ? `${Number(q.progress).toLocaleString()} / ${Number(q.target).toLocaleString()}`
            : `${q.progress} / ${q.target}`;

        let actionHtml = '';
        if (q.claimed) {
            actionHtml = `<span class="quest-done">Claimed ✓</span>`;
        } else if (q.completed) {
            actionHtml = `<button class="quest-claim-btn" data-quest-id="${q.id}">Claim</button>`;
        } else {
            actionHtml = `<button class="quest-claim-btn" disabled>In Progress</button>`;
        }

        return `
            <div class="quest-card">
                <div class="quest-top">
                    <div class="quest-name">${label}</div>
                    <div class="quest-reward">${reward}</div>
                </div>
                <div class="quest-progress-bg">
                    <div class="quest-progress-fill" style="width:${pct}%"></div>
                </div>
                <div class="quest-bottom">
                    <div class="quest-progress-text">${prog}</div>
                    ${actionHtml}
                </div>
            </div>`;
    }).join('');

    list.querySelectorAll('.quest-claim-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', async () => {
            btn.disabled    = true;
            btn.textContent = 'Claiming...';

            try {
                const res  = await fetch('/api/dailies/quest/claim', {
                    method:      'POST',
                    headers:     { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body:        JSON.stringify({ quest_id: parseInt(btn.dataset.questId) }),
                });
                const data = await res.json();

                if (!res.ok) {
                    alert(data.error);
                    btn.disabled    = false;
                    btn.textContent = 'Claim';
                    return;
                }

                // Sync topbar from DB
                await TopBar.syncBalances();

                // Reload quests to show updated state
                loadDailies();

            } catch {
                alert('Failed to claim quest');
                btn.disabled    = false;
                btn.textContent = 'Claim';
            }
        });
    });
}

// Nav card clicks
document.querySelectorAll('[data-href]').forEach(el => {
    el.addEventListener('click', () => {
        window.location.href = el.dataset.href;
    });
});

document.addEventListener('DOMContentLoaded', loadDashboard);