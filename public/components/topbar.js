const TopBar = {
    async init() {
        const el = document.getElementById('topbar');
        if (!el) return;

        el.innerHTML = `
      <div class="topbar-inner">
        <a href="/dashboard.html" class="topbar-logo">AstroLink</a>
        <div class="topbar-right">
          <div class="currency-pill moonstone-pill">
            <span class="moon-icon">🌙</span>
            <span id="tb-moonstone">—</span>
          </div>
          <div class="currency-pill">
            <div class="star-icon"></div>
            <span id="tb-stardust">—</span>
          </div>
          <button class="avatar-btn" id="tb-avatar" title="Settings"></button>
        </div>
      </div>
    `;

        document.getElementById('tb-avatar').addEventListener('click', () => {
            window.location.href = '/settings.html';
        });

        return await TopBar.refresh();
    },

    async refresh() {
        try {
            const res = await fetch('/api/auth/me', { credentials: 'include' });
            if (!res.ok) {
                window.location.href = '/index.html';
                return;
            }
            const { user } = await res.json();
            TopBar.render(user);
            return user;
        } catch {
            window.location.href = '/index.html';
        }
    },

    render(user) {
        const sd = document.getElementById('tb-stardust');
        const ms = document.getElementById('tb-moonstone');
        const av = document.getElementById('tb-avatar');
        if (sd) sd.textContent = parseFloat(user.stardust).toLocaleString();
        if (ms) ms.textContent = (user.moonstone || 0).toLocaleString();
        if (av) av.textContent = user.username.slice(0, 1).toUpperCase();
    },

    // Call this from any page after a transaction to re-sync balances
    async syncBalances() {
        return await TopBar.refresh();
    },
};

window.TopBar = TopBar;