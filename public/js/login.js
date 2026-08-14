document.addEventListener('DOMContentLoaded', async () => {
  // If already logged in, redirect to appropriate page
  const user = await checkAuth();
  if (user) {
    if (user.role === 'ADMIN') window.location.href = '/admin.html';
    else if (user.role === 'CHEF') window.location.href = '/chef.html';
    else window.location.href = '/menu.html';
    return;
  }

  const form = document.getElementById('loginForm');
  form.addEventListener('submit', handleLogin);
});

async function handleLogin(e) {
  e.preventDefault();
  const usernameOrEmail = document.getElementById('usernameOrEmail').value.trim();
  const password = document.getElementById('password').value;

  await performLogin(usernameOrEmail, password);
}

async function quickLogin(username, password) {
  document.getElementById('usernameOrEmail').value = username;
  document.getElementById('password').value = password;
  await performLogin(username, password);
}

async function performLogin(usernameOrEmail, password) {
  const alertBox = document.getElementById('alertBox');
  alertBox.innerHTML = '';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEmail, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.innerHTML = `<div class="alert alert-danger">${escapeHtml(data.error || 'Login failed.')}</div>`;
      return;
    }

    alertBox.innerHTML = `<div class="alert alert-success">Login successful! Redirecting...</div>`;

    setTimeout(() => {
      if (data.user.role === 'ADMIN') window.location.href = '/admin.html';
      else if (data.user.role === 'CHEF') window.location.href = '/chef.html';
      else window.location.href = '/menu.html';
    }, 500);

  } catch (err) {
    console.error('Login error:', err);
    alertBox.innerHTML = `<div class="alert alert-danger">Server connection error. Please try again.</div>`;
  }
}
