// script.js
let mode = 'login';

// Initialize event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');
    const submitBtn = document.getElementById('submit-btn');
    const altTextContainer = document.getElementById('alt-text');

    // Tab switching
    tabLogin.addEventListener('click', () => switchTab('login'));
    tabReg.addEventListener('click', () => switchTab('register'));

    // Form submission
    submitBtn.addEventListener('click', handleSubmit);

    // Delegate click for the "Create an account / Sign in" link
    altTextContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'SPAN') {
            const newMode = mode === 'login' ? 'register' : 'login';
            switchTab(newMode);
        }
    });
});

function switchTab(m) {
    mode = m;
    const msgEl = document.getElementById('msg');
    const regFields = document.getElementById('reg-fields');
    const submitBtn = document.getElementById('submit-btn');
    const altText = document.getElementById('alt-text');
    const tabLogin = document.getElementById('tab-login');
    const tabReg = document.getElementById('tab-register');

    msgEl.className = 'msg';
    msgEl.textContent = '';

    if (m === 'login') {
        regFields.classList.remove('show');
        submitBtn.textContent = 'Begin Journey ✦';
        altText.innerHTML = 'New here? <span>Create an account</span>';
        tabLogin.classList.add('active');
        tabReg.classList.remove('active');
        document.getElementById('email').value = '';
    } else {
        regFields.classList.add('show');
        submitBtn.textContent = 'Join AstroLink ✦';
        altText.innerHTML = 'Already exploring? <span>Sign in</span>';
        tabLogin.classList.remove('active');
        tabReg.classList.add('active');
    }
}

async function handleSubmit() {
    const msgEl = document.getElementById('msg');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const email = document.getElementById('email').value.trim();

    msgEl.className = 'msg';
    msgEl.textContent = '';

    if (!username || !password) {
        msgEl.className = 'msg error';
        msgEl.textContent = 'Please fill in all fields!';
        return;
    }
    if (mode === 'register' && !email) {
        msgEl.className = 'msg error';
        msgEl.textContent = 'Email is required to register!';
        return;
    }

    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const body = mode === 'login' ? { username, password } : { username, email, password };

    try {
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body),
        });
        const data = await res.json();

        if (!res.ok) {
            msgEl.className = 'msg error';
            msgEl.textContent = data.error || 'Something went wrong!';
            return;
        }

        msgEl.className = 'msg success';
        msgEl.textContent = mode === 'login'
            ? `Welcome back, ${data.user.username}! ✦`
            : `Welcome to AstroLink, ${data.user.username}! ✦`;

        setTimeout(() => {
            window.location.href = '/dashboard.html';
        }, 1000);

    } catch (err) {
        msgEl.className = 'msg error';
        msgEl.textContent = 'Could not reach the server. Is it running?';
    }
}