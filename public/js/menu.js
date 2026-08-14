let foodItems = [];
let cart = {}; // food_id -> quantity

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth(); // Optional check (unauthenticated users can view menu, but must log in to order)
  await loadMenu();
});

async function loadMenu() {
  const grid = document.getElementById('foodGrid');
  try {
    const res = await fetch('/api/food');
    foodItems = await res.json();

    if (!Array.isArray(foodItems) || foodItems.length === 0) {
      grid.innerHTML = '<p style="color: var(--text-muted);">No food items available.</p>';
      return;
    }

    grid.innerHTML = foodItems.map(item => `
      <div class="food-card">
        <div>
          <div class="food-emoji">${getFoodEmoji(item.name)}</div>
          <div class="food-name">${escapeHtml(item.name)}</div>
          <div class="food-price">${formatPrice(item.price)}</div>
        </div>
        <div class="qty-control">
          <button type="button" class="qty-btn" onclick="updateQty(${item.id}, -1)">-</button>
          <input type="number" id="qty-${item.id}" class="qty-input" value="${cart[item.id] || 0}" min="0" readonly>
          <button type="button" class="qty-btn" onclick="updateQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `).join('');

    renderCart();
  } catch (err) {
    console.error('Error loading menu:', err);
    grid.innerHTML = '<div class="alert alert-danger">Failed to load menu items.</div>';
  }
}

function updateQty(foodId, delta) {
  const currentQty = cart[foodId] || 0;
  const newQty = Math.max(0, currentQty + delta);

  if (newQty === 0) {
    delete cart[foodId];
  } else {
    cart[foodId] = newQty;
  }

  const qtyInput = document.getElementById(`qty-${foodId}`);
  if (qtyInput) {
    qtyInput.value = newQty;
  }

  renderCart();
}

function renderCart() {
  const cartList = document.getElementById('cartItems');
  const cartTotalEl = document.getElementById('cartTotal');
  const placeOrderBtn = document.getElementById('placeOrderBtn');

  const selectedIds = Object.keys(cart);

  if (selectedIds.length === 0) {
    cartList.innerHTML = `
      <li class="cart-item" style="color: var(--text-muted); text-align: center; justify-content: center; display: block; padding: 1.5rem 0;">
        No items selected yet. Choose items from the menu.
      </li>
    `;
    cartTotalEl.textContent = '$0.00';
    placeOrderBtn.disabled = true;
    return;
  }

  let total = 0;
  let html = '';

  selectedIds.forEach(id => {
    const qty = cart[id];
    const item = foodItems.find(f => f.id === parseInt(id, 10));
    if (item && qty > 0) {
      const itemTotal = Number(item.price) * qty;
      total += itemTotal;
      html += `
        <li class="cart-item">
          <span>${getFoodEmoji(item.name)} ${escapeHtml(item.name)} x${qty}</span>
          <strong>${formatPrice(itemTotal)}</strong>
        </li>
      `;
    }
  });

  cartList.innerHTML = html;
  cartTotalEl.textContent = formatPrice(total);
  placeOrderBtn.disabled = false;
}

async function placeOrder() {
  const alertBox = document.getElementById('alertBox');
  alertBox.innerHTML = '';

  if (!currentUser) {
    alertBox.innerHTML = `
      <div class="alert alert-danger">
        You must be logged in to place an order. <a href="/login.html" style="font-weight: 700; underline: true;">Log In Here</a>
      </div>
    `;
    return;
  }

  const items = Object.keys(cart).map(id => ({
    food_id: parseInt(id, 10),
    quantity: cart[id]
  })).filter(i => i.quantity > 0);

  if (items.length === 0) {
    alertBox.innerHTML = '<div class="alert alert-danger">Please select at least one item.</div>';
    return;
  }

  const placeOrderBtn = document.getElementById('placeOrderBtn');
  placeOrderBtn.disabled = true;
  placeOrderBtn.textContent = 'Placing Order...';

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    const data = await res.json();

    if (!res.ok) {
      alertBox.innerHTML = `<div class="alert alert-danger">${escapeHtml(data.error || 'Failed to place order.')}</div>`;
      placeOrderBtn.disabled = false;
      placeOrderBtn.textContent = 'Place Order';
      return;
    }

    // Reset cart
    cart = {};
    foodItems.forEach(item => {
      const input = document.getElementById(`qty-${item.id}`);
      if (input) input.value = 0;
    });
    renderCart();

    alertBox.innerHTML = `
      <div class="alert alert-success">
        🎉 Order #${data.orderId} placed successfully! Status: <strong>Pending</strong>.
        <a href="/my-orders.html" style="font-weight: 700; margin-left: 0.5rem; color: #166534;">View My Orders →</a>
      </div>
    `;

  } catch (err) {
    console.error('Order submission error:', err);
    alertBox.innerHTML = '<div class="alert alert-danger">Server connection error. Please try again.</div>';
    placeOrderBtn.disabled = false;
    placeOrderBtn.textContent = 'Place Order';
  }
}
