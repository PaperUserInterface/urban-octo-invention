document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth(['ADMIN']);
  if (!user) return;

  await loadUsers();
  await loadAllOrders();
});

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) {
      tbody.innerHTML = '<tr><td colspan="6" class="alert alert-danger">Failed to load users.</td></tr>';
      return;
    }

    const users = await res.json();

    if (!Array.isArray(users) || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No registered users.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isSelf = currentUser && currentUser.id === u.id;
      const isBanned = Boolean(u.banned);

      return `
        <tr>
          <td>#${u.id}</td>
          <td><strong>${escapeHtml(u.username)}</strong> ${isSelf ? '<span style="color: var(--primary); font-size: 0.8rem;">(You)</span>' : ''}</td>
          <td>${escapeHtml(u.email)}</td>
          <td><span class="role-tag">${escapeHtml(u.role)}</span></td>
          <td>
            ${isBanned 
              ? '<span class="badge badge-pending" style="background: #fef2f2; color: #991b1b;">🚫 Banned</span>' 
              : '<span class="badge badge-ready">✅ Active</span>'
            }
          </td>
          <td style="text-align: right;">
            ${isSelf 
              ? '<span style="color: var(--text-muted); font-size: 0.85rem;">N/A</span>' 
              : `
                <button 
                  onclick="toggleBanUser(${u.id}, ${!isBanned})" 
                  class="btn btn-sm ${isBanned ? 'btn-success' : 'btn-danger'}"
                >
                  ${isBanned ? 'Unban User' : 'Ban User'}
                </button>
              `
            }
          </td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error loading users:', err);
    tbody.innerHTML = '<tr><td colspan="6" class="alert alert-danger">Server connection error loading users.</td></tr>';
  }
}

async function toggleBanUser(userId, setBanned) {
  const alertBox = document.getElementById('alertBox');
  alertBox.innerHTML = '';

  const actionText = setBanned ? 'ban' : 'unban';
  if (!confirm(`Are you sure you want to ${actionText} user #${userId}?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${userId}/ban`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ banned: setBanned })
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.innerHTML = `<div class="alert alert-danger">${escapeHtml(data.error || 'Failed to update ban status.')}</div>`;
      return;
    }

    alertBox.innerHTML = `<div class="alert alert-success">${escapeHtml(data.message)}</div>`;
    setTimeout(() => { alertBox.innerHTML = ''; }, 3000);

    await loadUsers();
  } catch (err) {
    console.error('Error banning/unbanning user:', err);
    alertBox.innerHTML = '<div class="alert alert-danger">Server connection error.</div>';
  }
}

async function loadAllOrders() {
  const container = document.getElementById('adminOrdersContainer');
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) {
      container.innerHTML = '<div class="alert alert-danger">Failed to load orders.</div>';
      return;
    }

    const orders = await res.json();

    if (!Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem 1rem; background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border-color);">
          <p style="color: var(--text-muted); margin: 0;">No customer orders placed yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => {
      const orderDate = new Date(order.created_at).toLocaleString();

      const itemsSummary = (order.items || []).map(i => `${escapeHtml(i.name)} (x${i.quantity})`).join(', ');

      return `
        <div class="order-card" style="padding: 1rem 1.25rem;">
          <div class="order-header" style="margin-bottom: 0.5rem; padding-bottom: 0.5rem;">
            <div>
              <span class="order-id">Order #${order.id}</span>
              <span style="margin-left: 0.75rem; color: var(--text-muted); font-size: 0.9rem;">
                By: 👤 <strong>${escapeHtml(order.username)}</strong> (${escapeHtml(order.email)})
              </span>
              <div class="order-date">${orderDate}</div>
            </div>
            <div>
              ${getStatusBadge(order.status)}
            </div>
          </div>

          <div style="margin: 0.5rem 0; font-size: 0.95rem;">
            <strong>Items:</strong> ${itemsSummary}
          </div>

          <div style="text-align: right; font-weight: 700; color: var(--primary);">
            Total: ${formatPrice(order.total)}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching admin orders:', err);
    container.innerHTML = '<div class="alert alert-danger">Server connection error.</div>';
  }
}
