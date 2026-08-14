// Shared JavaScript Utilities

let currentUser = null;

async function checkAuth(requiredRoles = null) {
  try {
    const res = await fetch('/api/auth/me');
    const data = await res.json();

    if (data.banned) {
      alert('Your account has been banned by an administrator.');
      window.location.href = '/login.html';
      return null;
    }

    currentUser = data.user;

    // Render navbar
    renderNavbar(currentUser);

    // Page access control
    if (requiredRoles) {
      if (!currentUser) {
        window.location.href = '/login.html';
        return null;
      }
      if (!requiredRoles.includes(currentUser.role)) {
        alert(`Access denied. Role "${currentUser.role}" cannot access this page.`);
        // Redirect to default home page for role
        if (currentUser.role === 'ADMIN') window.location.href = '/admin.html';
        else if (currentUser.role === 'CHEF') window.location.href = '/chef.html';
        else window.location.href = '/menu.html';
        return null;
      }
    }

    return currentUser;
  } catch (err) {
    console.error('Auth check error:', err);
    return null;
  }
}

function renderNavbar(user) {
  const navContainer = document.getElementById('navbar');
  if (!navContainer) return;

  const currentPath = window.location.pathname;

  let linksHtml = '';

  if (user) {
    if (user.role === 'USER') {
      linksHtml += `
        <li><a href="/menu.html" class="${currentPath.includes('menu') ? 'active' : ''}">🍔 Menu</a></li>
        <li><a href="/my-orders.html" class="${currentPath.includes('my-orders') ? 'active' : ''}">📋 My Orders</a></li>
      `;
    } else if (user.role === 'CHEF') {
      linksHtml += `
        <li><a href="/chef.html" class="${currentPath.includes('chef') ? 'active' : ''}">👨‍🍳 Chef Panel</a></li>
        <li><a href="/menu.html" class="${currentPath.includes('menu') ? 'active' : ''}">🍔 View Menu</a></li>
      `;
    } else if (user.role === 'ADMIN') {
      linksHtml += `
        <li><a href="/admin.html" class="${currentPath.includes('admin') ? 'active' : ''}">⚙️ Admin Panel</a></li>
        <li><a href="/chef.html" class="${currentPath.includes('chef') ? 'active' : ''}">👨‍🍳 Chef Panel</a></li>
        <li><a href="/menu.html" class="${currentPath.includes('menu') ? 'active' : ''}">🍔 View Menu</a></li>
      `;
    }

    linksHtml += `
      <li>
        <div class="user-badge">
          <span>👤 <strong>${escapeHtml(user.username)}</strong></span>
          <span class="role-tag">${user.role}</span>
          <button onclick="logout()" class="btn btn-secondary btn-sm">Logout</button>
        </div>
      </li>
    `;
  } else {
    linksHtml += `
      <li><a href="/menu.html" class="${currentPath.includes('menu') ? 'active' : ''}">🍔 Menu</a></li>
      <li><a href="/login.html" class="${currentPath.includes('login') ? 'active' : ''}">Log In</a></li>
      <li><a href="/signup.html" class="btn btn-primary btn-sm">Sign Up</a></li>
    `;
  }

  navContainer.innerHTML = `
    <a href="/menu.html" class="nav-brand">
      <span>🍕</span> Express Diner
    </a>
    <ul class="nav-links">
      ${linksHtml}
    </ul>
  `;
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch (err) {
    console.error('Logout error:', err);
  }
}

function formatPrice(amount) {
  return '$' + Number(amount).toFixed(2);
}

function getStatusBadge(status) {
  const statusLower = (status || '').toLowerCase();
  let badgeClass = 'badge-pending';
  if (statusLower === 'preparing') badgeClass = 'badge-preparing';
  else if (statusLower === 'ready') badgeClass = 'badge-ready';

  return `<span class="badge ${badgeClass}">${escapeHtml(status)}</span>`;
}

function getFoodEmoji(name) {
  const n = (name || '').toLowerCase();
  if (n.includes('burger')) return '🍔';
  if (n.includes('pizza')) return '🍕';
  if (n.includes('fries')) return '🍟';
  if (n.includes('pasta')) return '🍝';
  if (n.includes('cola') || n.includes('drink') || n.includes('soda')) return '🥤';
  return '🍽️';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
