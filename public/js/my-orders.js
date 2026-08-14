let refreshInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await checkAuth(['USER', 'CHEF', 'ADMIN']);
  if (!user) return;

  await loadMyOrders();

  // Auto-refresh orders every 5 seconds for status updates
  refreshInterval = setInterval(loadMyOrders, 5000);
});

// Clear interval on page navigate away
window.addEventListener('beforeunload', () => {
  if (refreshInterval) clearInterval(refreshInterval);
});

async function loadMyOrders() {
  const container = document.getElementById('ordersContainer');
  try {
    const res = await fetch('/api/orders/my');
    if (!res.ok) {
      container.innerHTML = '<div class="alert alert-danger">Failed to load orders.</div>';
      return;
    }

    const orders = await res.json();

    if (!Array.isArray(orders) || orders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1rem; background: var(--card-bg); border-radius: var(--radius); border: 1px solid var(--border-color);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🍽️</div>
          <h3>You haven't placed any orders yet.</h3>
          <p style="color: var(--text-muted); margin: 0.5rem 0 1.5rem 0;">Browse our delicious menu and place your first order!</p>
          <a href="/menu.html" class="btn btn-primary">Browse Menu</a>
        </div>
      `;
      return;
    }

    container.innerHTML = orders.map(order => {
      const orderDate = new Date(order.created_at).toLocaleString();

      const itemsRows = (order.items || []).map(item => `
        <tr>
          <td>${getFoodEmoji(item.name)} ${escapeHtml(item.name)}</td>
          <td>${formatPrice(item.price)}</td>
          <td>x${item.quantity}</td>
          <td style="text-align: right;"><strong>${formatPrice(Number(item.price) * item.quantity)}</strong></td>
        </tr>
      `).join('');

      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <span class="order-id">Order #${order.id}</span>
              <div class="order-date">${orderDate}</div>
            </div>
            <div>
              ${getStatusBadge(order.status)}
            </div>
          </div>

          <table class="order-items-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Price</th>
                <th>Qty</th>
                <th style="text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="order-footer">
            <span>Total Amount:</span>
            <span style="font-size: 1.25rem; color: var(--primary);">${formatPrice(order.total)}</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching my orders:', err);
    container.innerHTML = '<div class="alert alert-danger">Server connection error.</div>';
  }
}
