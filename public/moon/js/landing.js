const RARITY_ICONS = {
  common:    '🪨',
  uncommon:  '🌿',
  rare:      '💎',
  epic:      '🔮',
  legendary: '⭐',
};

async function loadMoonLanding() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) { window.location.href = '/index.html'; return; }
    const { user } = await res.json();
    document.getElementById('stardust-balance').textContent =
      parseFloat(user.stardust).toLocaleString();
  } catch {
    window.location.href = '/index.html';
  }

  try {
    const res = await fetch('/api/planets/moon', { credentials: 'include' });
    if (!res.ok) { renderSpawnError(); return; }
    const { worldState } = await res.json();
    renderStats(worldState.planetProfile);
    renderSpawnPool(worldState.spawnPool);
    if (worldState.hiddenSpeciesCount > 0) {
      document.getElementById('hidden-hint').style.display = 'block';
      document.getElementById('hidden-count').textContent =
        worldState.hiddenSpeciesCount;
    }
  } catch {
    renderSpawnError();
  }
}

function renderStats(profile) {
  if (!profile) return;
  document.getElementById('stat-level').textContent    = profile.lunar_level || 1;
  document.getElementById('stat-landings').textContent = profile.total_landings || 0;
  document.getElementById('stat-best').textContent     =
    (profile.best_landing_score || 0).toLocaleString();
}

function renderSpawnPool(species) {
  const pool = document.getElementById('spawn-pool');
  if (!species || species.length === 0) {
    pool.innerHTML = '<div class="loading-msg">No creatures found.</div>';
    return;
  }
  pool.innerHTML = species.map(s => `
    <div class="pet-card">
      <div class="pet-icon rarity-${s.rarity}">${RARITY_ICONS[s.rarity] || '🐾'}</div>
      <div class="pet-info">
        <div class="pet-name">${s.display_name}</div>
        <div class="pet-rarity rarity-label-${s.rarity}">${s.rarity.toUpperCase()}</div>
      </div>
    </div>
  `).join('');
}

function renderSpawnError() {
  document.getElementById('spawn-pool').innerHTML =
    '<div class="loading-msg">Could not load spawn pool.</div>';
}

document.addEventListener('DOMContentLoaded', loadMoonLanding);