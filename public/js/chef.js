let chefRefreshInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth(['CHEF', 'ADMIN']);
  if (!user) return;

  await loadChefOrders();

  // Auto-refresh every 5 seconds for new orders
  chefRefreshInterval = setInterval(loadChefOrders, 5000);
});

window.addEventListener('beforeunload', () => {
  if (chefRefreshInterval) clearInterval(chefRefreshInterval);
});

async function loadChefOrders() {
  const container = document.getElementById('chefOrdersContainer');
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) {
      container.innerHTML = '<div class="alert alert-danger">Failed to load orders.</div>';
      return;
    }

    const orders = await res.json();

    if (!Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border-color);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">👨‍🍳</div>
          <h3>Kitchen Queue is Clear!</h3>
          <p style="color: var(--text-muted);">There are currently no active food orders from customers.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => {
      const orderDate = new Date(order.created_at).toLocaleString();

      const itemsRows = (order.items || []).map(item => `
        <tr>
          <td>${getFoodEmoji(item.name)} <strong>${escapeHtml(item.name)}</strong></td>
          <td><span style="background: #f1f5f9; padding: 0.2rem 0.6rem; border-radius: 6px; font-weight: 700;">x${item.quantity}</span></td>
          <td style="text-align: right; color: var(--text-muted);">${formatPrice(item.price)} each</td>
        </tr>
      `).join('');

      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <span class="order-id">Order #${order.id}</span>
              <span style="margin-left: 0.75rem; color: var(--text-muted); font-size: 0.9rem;">
                Customer: 👤 <strong>${escapeHtml(order.username)}</strong>
              </span>
              <div class="order-date">${orderDate}</div>
            </div>
            <div>
              ${getStatusBadge(order.status)}
            </div>
          </div>

          <table class="order-items-table">
            <thead>
              <tr>
                <th>Food Item</th>
                <th>Quantity</th>
                <th style="text-align: right;">Unit Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 1rem; border-top: 1px solid var(--border-color);">
            <div>
              <span style="font-size: 0.9rem; color: var(--text-muted);">Change Order Status:</span>
            </div>
            <div style="display: flex; gap: 0.5rem;">
              <button 
                onclick="updateOrderStatus(${order.id}, 'Pending')" 
                class="btn btn-sm ${order.status === 'Pending' ? 'btn-primary' : 'btn-secondary'}"
                ${order.status === 'Pending' ? 'disabled' : ''}
              >
                ⏳ Pending
              </button>

              <button 
                onclick="updateOrderStatus(${order.id}, 'Preparing')" 
                class="btn btn-sm ${order.status === 'Preparing' ? 'btn-primary' : 'btn-secondary'}"
                ${order.status === 'Preparing' ? 'disabled' : ''}
              >
                🍳 Preparing
              </button>

              <button 
                onclick="updateOrderStatus(${order.id}, 'Ready')" 
                class="btn btn-sm ${order.status === 'Ready' ? 'btn-success' : 'btn-secondary'}"
                ${order.status === 'Ready' ? 'disabled' : ''}
              >
                ✅ Ready
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching chef orders:', err);
    container.innerHTML = '<div class="alert alert-danger">Server connection error.</div>';
  }
}

async function updateOrderStatus(orderId, newStatus) {
  const alertBox = document.getElementById('alertBox');
  alertBox.innerHTML = '';

  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.innerHTML = `<div class="alert alert-danger">${escapeHtml(data.error || 'Failed to update order status.')}</div>`;
      return;
    }

    alertBox.innerHTML = `<div class="alert alert-success">Order #${orderId} status changed to <strong>${newStatus}</strong>!</div>`;

    setTimeout(() => {
      alertBox.innerHTML = '';
    }, 3000);

    await loadChefOrders();
  } catch (err) {
    console.error('Error updating status:', err);
    alertBox.innerHTML = '<div class="alert alert-danger">Server error updating status.</div>';
  }
}
