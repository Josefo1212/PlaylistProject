import { addUser, getUserByUsername } from './db/indexedDB.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const hashPassword = (str) => {
    const hash = [...str].reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
    return `h_${Math.abs(hash).toString(36)}`;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const showApp = () => {
    $('#auth-container').style.display = 'none';
    $('#app-container').style.display = '';
};

const setLoading = (btn, loading) => {
    btn.disabled = loading;
    btn.querySelector('.btn__text').style.display = loading ? 'none' : '';
    btn.querySelector('.btn__loader').style.display = loading ? '' : 'none';
};

const showError = (el, msg, color) => {
    el.textContent = msg;
    if (color) el.style.color = color;
    el.classList.add('form-error--visible');
};

const clearErrors = () => {
    $$('.form-error').forEach((el) => {
        el.classList.remove('form-error--visible');
        el.style.color = '';
    });
};

const shakeCard = () => {
    const card = $('.auth-card__front:not(.auth-card__front--hidden)');
    card.classList.add('auth-card__front--shake');
    card.addEventListener('animationend', () => card.classList.remove('auth-card__front--shake'), { once: true });
};

// ── Check session ──────────────────────────────────
if (sessionStorage.getItem('currentUser')) showApp();

// ── DOM refs ───────────────────────────────────────
const loginView = $('#login-view');
const registerView = $('#register-view');
const loginForm = $('#login-form');
const registerForm = $('#register-form');
const loginError = $('#login-error');
const registerError = $('#register-error');

// ── View switching ─────────────────────────────────
const switchView = async (target) => {
    const from = target === 'register' ? loginView : registerView;
    const to = target === 'register' ? registerView : loginView;

    from.classList.add('auth-card__front--slide-out');
    await sleep(280);

    from.classList.add('auth-card__front--hidden');
    from.classList.remove('auth-card__front--slide-out');

    to.classList.remove('auth-card__front--hidden');
    to.classList.add('auth-card__front--slide-in');
    to.addEventListener('animationend', () => to.classList.remove('auth-card__front--slide-in'), { once: true });

    clearErrors();
};

$('#go-to-register').addEventListener('click', () => switchView('register'));
$('#go-to-login').addEventListener('click', () => switchView('login'));

// ── Password toggles ───────────────────────────────
const setupPasswordToggle = (btn, inputId) => {
    btn.addEventListener('click', () => {
        const input = $(`#${inputId}`);
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.querySelector('.eye-open').style.display = isPassword ? 'none' : 'block';
        btn.querySelector('.eye-closed').style.display = isPassword ? 'block' : 'none';
    });
};

setupPasswordToggle($('#login-toggle-pw'), 'login-password');
setupPasswordToggle($('#reg-toggle-pw'), 'reg-password');

// ── Login ──────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const username = $('#login-username').value.trim();
    const password = $('#login-password').value;

    if (!username || !password) {
        showError(loginError, 'Completá todos los campos');
        return;
    }

    const btn = loginForm.querySelector('.btn');
    setLoading(btn, true);

    try {
        const user = await getUserByUsername(username);

        if (!user || user.password !== hashPassword(password)) {
            showError(loginError, 'Usuario o contraseña incorrectos');
            shakeCard();
            setLoading(btn, false);
            return;
        }

        sessionStorage.setItem('currentUser', JSON.stringify({
            id: user.id,
            username: user.username,
            name: user.name,
            lastname: user.lastname,
        }));

        Object.assign(loginView.style, {
            transition: 'all 500ms cubic-bezier(0.22, 1, 0.36, 1)',
            opacity: '0',
            transform: 'scale(0.95) translateY(-20px)',
        });

        await sleep(450);
        showApp();
    } catch {
        showError(loginError, 'Error al conectar con la base de datos');
        setLoading(btn, false);
    }
});

// ── Register ───────────────────────────────────────
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const name = $('#reg-name').value.trim();
    const lastname = $('#reg-lastname').value.trim();
    const username = $('#reg-username').value.trim();
    const password = $('#reg-password').value;

    if (!name || !lastname || !username || !password) {
        showError(registerError, 'Completá todos los campos');
        return;
    }

    if (username.length < 3) {
        showError(registerError, 'El usuario debe tener al menos 3 caracteres');
        return;
    }

    if (password.length < 4) {
        showError(registerError, 'La contraseña debe tener al menos 4 caracteres');
        return;
    }

    const btn = registerForm.querySelector('.btn');
    setLoading(btn, true);

    try {
        const existing = await getUserByUsername(username);
        if (existing) {
            showError(registerError, 'Ese usuario ya está registrado');
            shakeCard();
            setLoading(btn, false);
            return;
        }

        await addUser({ name, lastname, username, password: hashPassword(password), createdAt: new Date().toISOString() });

        Object.assign(registerView.style, {
            transition: 'all 500ms cubic-bezier(0.22, 1, 0.36, 1)',
            opacity: '0',
            transform: 'scale(0.95) translateY(-20px)',
        });

        await sleep(400);
        await switchView('login');

        Object.assign(loginView.style, { opacity: '0', transform: 'translateX(60px) scale(0.96)' });
        loginView.classList.remove('auth-card__front--hidden');
        loginView.classList.add('auth-card__front--slide-in');
        loginView.addEventListener('animationend', () => loginView.classList.remove('auth-card__front--slide-in'), { once: true });

        Object.assign(loginView.style, { opacity: '', transform: '' });

        await sleep(100);
        showError(loginError, '¡Cuenta creada! Iniciá sesión', 'var(--blue-200)');
    } catch {
        showError(registerError, 'Error al crear la cuenta');
        setLoading(btn, false);
    }
});
