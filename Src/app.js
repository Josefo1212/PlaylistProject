import { showWait } from './Components/wait-component.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const showDashboard = () => {
  showWait('Preparando tu música...');
  setTimeout(() => { window.location.href = 'dashboard.html'; }, 600);
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

window.$ = $;
window.sleep = sleep;
window.showDashboard = showDashboard;
window.setLoading = setLoading;
window.showError = showError;
window.clearErrors = clearErrors;
window.shakeCard = shakeCard;

// ── Check session ──────────────────────────────────
if (sessionStorage.getItem('currentUser')) {
  showDashboard();
} else {
  $('#auth-container').style.display = 'none';

  const loginView = $('#login-view');
  const registerView = $('#register-view');

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

  const goToAuth = (target) => {
    $('#landing').classList.add('landing--hidden');
    $('#auth-container').style.display = '';
    if (target === 'register') switchView('register');
    else switchView('login');
  };

  window.switchView = switchView;

  $('#hero-login').addEventListener('click', () => goToAuth('login'));
  $('#hero-register').addEventListener('click', () => goToAuth('register'));
  $('#go-to-register').addEventListener('click', () => switchView('register'));
  $('#go-to-login').addEventListener('click', () => switchView('login'));

  // Password toggles
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

  // ── Remember me: auto-fill if saved ──────────
  const saved = JSON.parse(localStorage.getItem('playlistapp_remember') || 'null');
  if (saved?.username) {
    $('#login-username').value = saved.username;
    if ($('#remember-me')) $('#remember-me').checked = true;
  }
}
