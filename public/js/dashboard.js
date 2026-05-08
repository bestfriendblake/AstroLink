const RARITY_ICONS = {
  common:    '🪨',
  uncommon:  '🌿',
  rare:      '💎',
  epic:      '🔮',
  legendary: '⭐',
};

async function loadDashboard() {
  try {
    const res  = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) {
      window.location.href = '/index.html';
      return;
    }
    const { user } = await res.json();
    renderProfile(user);
  } catch (err) {
    window.location.href = '/index.html';
  }

  try {
    const res      = await fetch('/api/pets', { credentials: 'include' });
    const { pets } = await res.json();
    renderPets(pets);
  } catch (err) {
    document.getElementById('pet-preview').innerHTML =
      '<div class="empty-pets">Could not load pets.</div>';
  }
}

function renderProfile(user) {
  const initials = user.username.slice(0, 2).toUpperCase();
  document.getElementById('profile-avatar').textContent  = initials.slice(0, 1);
  document.getElementById('avatar-btn').textContent      = initials.slice(0, 1);
  document.getElementById('profile-name').textContent    = user.username;
  document.getElementById('stardust-balance').textContent =
    parseFloat(user.stardust).toLocaleString();

  const level  = user.global_level || 1;
  const xp     = user.global_xp   || 0;
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
    const icon     = RARITY_ICONS[pet.rarity] || '🐾';
    const rarityClass = `rarity-${pet.rarity}`;
    const name     = pet.nickname || pet.display_name;
    return `
      <div class="pet-chip">
        <div class="pet-chip-icon ${rarityClass}">${icon}</div>
        <div class="pet-chip-name">${name}</div>
        <div class="pet-chip-lvl">Lv. ${pet.pet_level}</div>
      </div>`;
  }).join('');

  const moreChip = `
    <div class="pet-chip" style="opacity:0.5; border-style:dashed; cursor:pointer;"
         onclick="goTo('pets.html')">
      <div class="pet-chip-icon rarity-common">＋</div>
      <div class="pet-chip-name">View all</div>
      <div class="pet-chip-lvl">${pets.length} total</div>
    </div>`;

  container.innerHTML = chips + moreChip;
}

document.querySelectorAll('[data-href]').forEach(el => {
  el.addEventListener('click', () => {
    window.location.href = el.dataset.href;
  });
});

document.addEventListener('DOMContentLoaded', loadDashboard);