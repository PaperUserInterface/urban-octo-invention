document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth();
  if (user) {
    if (user.role === 'ADMIN') window.location.href = '/admin.html';
    else if (user.role === 'CHEF') window.location.href = '/chef.html';
    else window.location.href = '/menu.html';
    return;
  }

  const form = document.getElementById('signupForm');
  form.addEventListener('submit', handleSignup);
});

async function handleSignup(e) {
  e.preventDefault();
  const alertBox = document.getElementById('alertBox');
  alertBox.innerHTML = '';

  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.innerHTML = `<div class="alert alert-danger">${escapeHtml(data.error || 'Registration failed.')}</div>`;
      return;
    }

    alertBox.innerHTML = `<div class="alert alert-success">Account created! Redirecting to menu...</div>`;

    setTimeout(() => {
      window.location.href = '/menu.html';
    }, 600);

  } catch (err) {
    console.error('Signup error:', err);
    alertBox.innerHTML = `<div class="alert alert-danger">Server connection error. Please try again.</div>`;
  }
}
