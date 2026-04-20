// =========================================================
// Nav behavior: mobile drawer, scrolled state, cart badge,
// active link highlight, Lucide icon hydration.
// =========================================================
import { bindNavAccount } from './auth.js';

export function initNav() {
  // Scrolled state
  const nav = document.getElementById('nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile drawer
  const toggle = document.getElementById('menu-toggle');
  const drawer = document.getElementById('mobile-drawer');
  if (toggle && drawer) {
    toggle.addEventListener('click', () => {
      const open = drawer.classList.toggle('open');
      toggle.innerHTML = open
        ? '<i data-lucide="x"></i>'
        : '<i data-lucide="menu"></i>';
      if (window.lucide) window.lucide.createIcons();
    });
    drawer.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', () => {
        drawer.classList.remove('open');
        toggle.innerHTML = '<i data-lucide="menu"></i>';
        if (window.lucide) window.lucide.createIcons();
      }),
    );
  }

  // Active link
  const path = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  document.querySelectorAll('[data-nav-link]').forEach((a) => {
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // Cart badge from localStorage
  updateCartBadge();
  window.addEventListener('storage', updateCartBadge);

  // Account slot bind
  bindNavAccount(document.getElementById('account-slot'));

  // Hydrate icons
  if (window.lucide) window.lucide.createIcons();
}

export function getCart() {
  try { return JSON.parse(localStorage.getItem('g2b_cart') || '[]'); }
  catch { return []; }
}
export function setCart(items) {
  localStorage.setItem('g2b_cart', JSON.stringify(items));
  updateCartBadge();
}
export function updateCartBadge() {
  const count = getCart().reduce((n, i) => n + (i.qty || 1), 0);
  document.querySelectorAll('[data-cart-badge]').forEach((el) => {
    el.textContent = count;
    el.style.display = count > 0 ? 'inline-flex' : 'none';
  });
}

// Reveal on scroll
export function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add('in')),
    { threshold: 0.12 },
  );
  els.forEach((el) => io.observe(el));
}

// Toast
export function toast(msg, kind = 'ok') {
  let host = document.querySelector('.toast-container');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-container';
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `toast toast--${kind}`;
  t.innerHTML = `<i data-lucide="${kind === 'ok' ? 'check-circle-2' : 'alert-circle'}"></i><span>${msg}</span>`;
  host.appendChild(t);
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; }, 3200);
  setTimeout(() => t.remove(), 3700);
}
