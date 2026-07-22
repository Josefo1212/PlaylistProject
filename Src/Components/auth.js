import { addUser, getUserByUsername } from '../db/indexedDB.js';
import { showWait } from './wait-component.js';

const hashPassword = (str) => {
  const hash = [...str].reduce((acc, ch) => ((acc << 5) - acc + ch.charCodeAt(0)) | 0, 0);
  return `h_${Math.abs(hash).toString(36)}`;
};

// ── Login ──────────────────────────────────────
$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const username = $('#login-username').value.trim();
  const password = $('#login-password').value;
  const remember = $('#remember-me')?.checked;

  if (!username || !password) {
    showError($('#login-error'), 'Completá todos los campos');
    return;
  }

  const btn = e.currentTarget.querySelector('.btn');
  setLoading(btn, true);

  try {
    const user = await getUserByUsername(username);

    if (!user || user.password !== hashPassword(password)) {
      showError($('#login-error'), 'Usuario o contraseña incorrectos');
      shakeCard();
      setLoading(btn, false);
      return;
    }

    const userData = {
      id: user.id,
      username: user.username,
      name: user.name,
      lastname: user.lastname,
    };

    sessionStorage.setItem('currentUser', JSON.stringify(userData));

    if (remember) {
      localStorage.setItem('playlistapp_remember', JSON.stringify(userData));
    } else {
      localStorage.removeItem('playlistapp_remember');
    }

    const loginView = $('#login-view');
    Object.assign(loginView.style, {
      transition: 'all 500ms cubic-bezier(0.22, 1, 0.36, 1)',
      opacity: '0',
      transform: 'scale(0.95) translateY(-20px)',
    });

    await sleep(450);
    showDashboard();
  } catch {
    showError($('#login-error'), 'Error al conectar con la base de datos');
    setLoading(btn, false);
  }
});

// ── Register ───────────────────────────────────
$('#register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const name = $('#reg-name').value.trim();
  const lastname = $('#reg-lastname').value.trim();
  const username = $('#reg-username').value.trim();
  const password = $('#reg-password').value;

  if (!name || !lastname || !username || !password) {
    showError($('#register-error'), 'Completá todos los campos');
    return;
  }

  if (username.length < 3) {
    showError($('#register-error'), 'El usuario debe tener al menos 3 caracteres');
    return;
  }

  if (password.length < 4) {
    showError($('#register-error'), 'La contraseña debe tener al menos 4 caracteres');
    return;
  }

  const btn = e.currentTarget.querySelector('.btn');
  setLoading(btn, true);

  try {
    const existing = await getUserByUsername(username);
    if (existing) {
      showError($('#register-error'), 'Ese usuario ya está registrado');
      shakeCard();
      setLoading(btn, false);
      return;
    }

    await addUser({
      name, lastname, username,
      password: hashPassword(password),
      createdAt: new Date().toISOString()
    });

    await switchView('login');
    $('#register-form').reset();
    showError($('#login-error'), '¡Cuenta creada! Iniciá sesión', 'var(--accent-purple)');
  } catch {
    showError($('#register-error'), 'Error al crear la cuenta');
    setLoading(btn, false);
  }
});
