// =========================================================
// Order page: status timeline (mock pending real backend)
// + cart rendering / qty / remove / checkout.
// =========================================================
import { initNav, initReveal, getCart, setCart, toast } from './nav.js';

function $(s, r = document) { return r.querySelector(s); }

function renderTimeline(stage) {
  // stage: 0..3 (Submitted, Designing, Shipped, Delivered)
  const steps = [
    { label: 'Order received', sub: 'We have your order', icon: 'receipt' },
    { label: 'In production',  sub: 'Bricks are being assembled', icon: 'cpu' },
    { label: 'Shipped',        sub: 'On the way to you', icon: 'truck' },
    { label: 'Delivered',      sub: 'Enjoy your build!', icon: 'package-check' },
  ];
  return steps.map((s, i) => `
    <div class="tl-item ${i < stage ? 'done' : ''} ${i === stage ? 'active' : ''}">
      <span class="tl-dot"><i data-lucide="${s.icon}"></i></span>
      <div class="tl-body"><h4>${s.label}</h4><p>${s.sub}</p></div>
    </div>
  `).join('');
}

function lookupOrder() {
  const id = $('#order-id').value.trim();
  const out = $('#order-result');
  if (!id) {
    out.innerHTML = `<div class="alert alert--error"><i data-lucide="alert-circle"></i> Please enter an order ID.</div>`;
    if (window.lucide) window.lucide.createIcons();
    return;
  }
  // Deterministic mock stage from id hash until backend exposes /api/order
  const hash = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const stage = hash % 4;
  out.innerHTML = `
    <div class="card" style="margin-top:18px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <div>
          <div class="dim" style="font-size:.78rem;letter-spacing:.12em;text-transform:uppercase">Order</div>
          <div style="font-family:var(--font-display);font-weight:800;font-size:1.1rem">#${id}</div>
        </div>
        <span class="chip"><i data-lucide="activity"></i> Live status</span>
      </div>
      <div class="timeline">${renderTimeline(stage)}</div>
    </div>`;
  if (window.lucide) window.lucide.createIcons();
}

function renderCart() {
  const cart = getCart();
  const list = $('#cart-list');
  const summary = $('#cart-summary');

  if (cart.length === 0) {
    list.innerHTML = `
      <div class="cart-empty">
        <i data-lucide="shopping-bag" style="width:42px;height:42px;color:var(--fg-dim)"></i>
        <h3 style="margin-top:10px">Your cart is empty</h3>
        <p>Build a BrickHeadz to add it here.</p>
        <a href="create.html" class="btn btn--primary" style="margin-top:14px"><i data-lucide="sparkles"></i> Create yours</a>
      </div>`;
    summary.innerHTML = '';
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  list.innerHTML = cart.map((it, idx) => `
    <div class="cart-item" data-idx="${idx}">
      <div class="cart-item__thumb"><i data-lucide="box"></i></div>
      <div>
        <div class="cart-item__title">${it.title || 'Custom BrickHeadz'}</div>
        <div class="cart-item__sub">${it.sub || ''}</div>
      </div>
      <div class="qty">
        <button data-act="dec">−</button>
        <span>${it.qty}</span>
        <button data-act="inc">+</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <strong>$${(it.price * it.qty).toFixed(2)}</strong>
        <button class="cart-item__remove" data-act="rm" aria-label="Remove"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
  `).join('');

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = subtotal > 100 ? 0 : 8;
  const total    = subtotal + shipping;
  summary.innerHTML = `
    <div class="cart-summary">
      <div class="cart-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
      <div class="cart-row"><span>Shipping</span><span>${shipping === 0 ? 'Free' : '$' + shipping.toFixed(2)}</span></div>
      <div class="cart-row total"><span>Total</span><span>$${total.toFixed(2)}</span></div>
      <button class="btn btn--primary btn--block" style="margin-top:14px" id="checkout-btn">
        <i data-lucide="credit-card"></i> Checkout
      </button>
    </div>`;

  list.querySelectorAll('.cart-item').forEach((row) => {
    const idx = +row.dataset.idx;
    row.querySelector('[data-act="inc"]').onclick = () => { const c = getCart(); c[idx].qty += 1; setCart(c); renderCart(); };
    row.querySelector('[data-act="dec"]').onclick = () => { const c = getCart(); c[idx].qty = Math.max(1, c[idx].qty - 1); setCart(c); renderCart(); };
    row.querySelector('[data-act="rm"]').onclick  = () => { const c = getCart(); c.splice(idx, 1); setCart(c); renderCart(); };
  });
  $('#checkout-btn')?.addEventListener('click', () => toast('Checkout coming soon', 'ok'));

  if (window.lucide) window.lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  initNav();
  initReveal();
  $('#order-lookup').addEventListener('click', lookupOrder);
  $('#order-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') lookupOrder(); });
  renderCart();
});
