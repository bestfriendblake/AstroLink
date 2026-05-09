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
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) { window.location.href = '/index.html'; return; }
    const { user } = await res.json();
    renderProfile(user);
  } catch {
    window.location.href = '/index.html';
  }

  try {
    const res      = await fetch('/api/pets', { credentials: 'include' });
    const { pets } = await res.json();
    renderPets(pets);
  } catch {
    document.getElementById('pet-preview').innerHTML =
      '<div class="loading-msg">Could not load pets.</div>';
  }

  loadDailies();
}

function renderProfile(user) {
  const initial = user.username.slice(0, 1).toUpperCase();
  document.getElementById('profile-avatar').textContent = initial;
  document.getElementById('avatar-btn').textContent     = initial;
  document.getElementById('profile-name').textContent   = user.username;
  document.getElementById('stardust-balance').textContent =
    parseFloat(user.stardust).toLocaleString();
  document.getElementById('moonstone-balance').textContent =
    (user.moonstone || 0).toLocaleString();

  const level  = user.global_level || 1;
  const xp     = user.global_xp    || 0;
  const xpNext = level * 100;
  const pct    = Math.min(100, Math.round((xp / xpNext) * 100));

  document.getElementById('profile-level').textContent =
    `Global Level ${level} · Moon Explorer`;
  document.getElementById('xp-bar').style.width = pct + '%';
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
    <div class="pet-chip" style="opacity:0.5;border-style:dashed;cursor:pointer;"
         data-href="/pets.html">
      <div class="pet-chip-icon rarity-common">＋</div>
      <div class="pet-chip-name">View all</div>
      <div class="pet-chip-lvl">${pets.length} total</div>
    </div>`;
  container.innerHTML = chips + more;
}

async function loadDailies() {
  try {
    const res  = await fetch('/api/dailies/status', { credentials: 'include' });
    const data = await res.json();
    renderStreak(data.streak);
    renderSpin(data.spin);
    renderQuests(data.quests);
  } catch {
    document.getElementById('streak-sub').textContent = 'Could not load';
    document.getElementById('spin-sub').textContent   = 'Could not load';
  }
}

function renderStreak(streak) {
  const sub = document.getElementById('streak-sub');
  const btn = document.getElementById('streak-btn');
  sub.textContent = streak.current > 0
    ? `Day ${streak.current} streak 🔥 — ${streak.nextReward.stardust} SD${streak.nextReward.moonstone > 0 ? ` + ${streak.nextReward.moonstone} 🌙` : ''}`
    : 'Start your streak today!';

  if (streak.canClaim) {
    btn.disabled    = false;
    btn.textContent = 'Claim';
    btn.addEventListener('click', claimStreak, { once: true });
  } else {
    btn.disabled    = true;
    btn.textContent = 'Done ✓';
  }
}

async function claimStreak() {
  try {
    const res  = await fetch('/api/dailies/streak/claim', {
      method: 'POST', credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error); return; }

    document.getElementById('stardust-balance').textContent =
      parseFloat(data.newStardust).toLocaleString();
    document.getElementById('moonstone-balance').textContent =
      data.newMoonstone.toLocaleString();

    const sub = document.getElementById('streak-sub');
    const btn = document.getElementById('streak-btn');
    sub.textContent  = `Day ${data.streak} streak 🔥 — claimed!`;
    btn.disabled     = true;
    btn.textContent  = 'Done ✓';
  } catch {
    alert('Failed to claim streak');
  }
}

function renderSpin(spin) {
  const sub = document.getElementById('spin-sub');
  const btn = document.getElementById('spin-btn');

  if (spin.canSpin) {
    sub.textContent = 'Free spin available!';
    btn.disabled    = false;
    btn.textContent = 'Spin';
    btn.addEventListener('click', openSlotModal, { once: true });
  } else {
    const result = spin.lastResult;
    sub.textContent = result && result.result_value > 0
      ? `Won ${result.result_value} ${result.result_type} today!`
      : 'Come back tomorrow!';
    btn.disabled    = true;
    btn.textContent = 'Done ✓';
  }
}

function openSlotModal() {
  document.getElementById('slot-modal').style.display = 'flex';
  document.getElementById('slot-result').textContent  = '';
  document.getElementById('slot-spin-btn').disabled   = false;
}

document.getElementById('slot-close-btn').addEventListener('click', () => {
  document.getElementById('slot-modal').style.display = 'none';
});

document.getElementById('slot-spin-btn').addEventListener('click', async () => {
  const spinBtn = document.getElementById('slot-spin-btn');
  spinBtn.disabled = true;

  const reelEls = [0, 1, 2].map(i => document.getElementById(`reel-${i}`));
  reelEls.forEach(r => r.classList.add('spinning'));

  try {
    const res  = await fetch('/api/dailies/spin', {
      method: 'POST', credentials: 'include',
    });
    const data = await res.json();

    if (!res.ok) {
      reelEls.forEach(r => r.classList.remove('spinning'));
      document.getElementById('slot-result').textContent = data.error;
      return;
    }

    setTimeout(() => {
      reelEls.forEach((r, i) => {
        r.classList.remove('spinning');
        r.textContent = data.reels[i];
      });

      const result = document.getElementById('slot-result');
      if (data.prize.value > 0) {
        result.textContent = `🎉 You won ${data.prize.value} ${data.prize.type}!`;
        if (data.prize.type === 'stardust') {
          document.getElementById('stardust-balance').textContent =
            (parseFloat(document.getElementById('stardust-balance').textContent.replace(/,/g, '')) + data.prize.value).toLocaleString();
        } else if (data.prize.type === 'moonstone') {
          document.getElementById('moonstone-balance').textContent =
            (parseInt(document.getElementById('moonstone-balance').textContent.replace(/,/g, '')) + data.prize.value).toLocaleString();
        }
      } else {
        result.textContent = 'No match — try again tomorrow!';
      }

      const spinCard = document.getElementById('spin-sub');
      spinCard.textContent = data.prize.value > 0
        ? `Won ${data.prize.value} ${data.prize.type} today!`
        : 'Come back tomorrow!';
      document.getElementById('spin-btn').textContent = 'Done ✓';

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
    const reward = `⭐ ${q.reward_stardust}${q.reward_moonstone > 0 ? ` <span class="moon">+ ${q.reward_moonstone}🌙</span>` : ''}`;
    const prog   = q.quest_type === 'earn_stardust'
      ? `${q.progress.toLocaleString()} / ${q.target.toLocaleString()}`
      : `${q.progress} / ${q.target}`;

    let actionHtml = '';
    if (q.claimed) {
      actionHtml = `<span class="quest-done">Claimed ✓</span>`;
    } else if (q.completed) {
      actionHtml = `<button class="quest-claim-btn" data-quest-id="${q.id}">Claim</button>`;
    } else {
      actionHtml = `<button class="quest-claim-btn" disabled>Claim</button>`;
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
      const questId = parseInt(btn.dataset.questId);
      try {
        const res  = await fetch('/api/dailies/quest/claim', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({ quest_id: questId }),
        });
        const data = await res.json();
        if (!res.ok) { alert(data.error); return; }
        document.getElementById('stardust-balance').textContent =
          parseFloat(data.newStardust).toLocaleString();
        document.getElementById('moonstone-balance').textContent =
          data.newMoonstone.toLocaleString();
        loadDailies();
      } catch {
        alert('Failed to claim quest');
      }
    });
  });
}

document.querySelectorAll('[data-href]').forEach(el => {
  el.addEventListener('click', () => {
    window.location.href = el.dataset.href;
  });
});

document.addEventListener('DOMContentLoaded', loadDashboard);