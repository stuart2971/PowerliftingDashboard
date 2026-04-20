import { logout, navigate } from '../app.js';

export function renderNavbar(user) {
  const mount = document.getElementById('navbar-mount');
  if (!user) {
    mount.innerHTML = '';
    return;
  }

  const links = user.role === 'coach'
    ? [
        { label: 'Athletes', hash: '#/coach' },
        { label: 'Programs', hash: '#/coach' }
      ]
    : [
        { label: 'Training', hash: '#/dashboard' },
        { label: 'Profile', hash: '#/profile' }
      ];

  const currentHash = window.location.hash;

  mount.innerHTML = `
    <nav class="navbar">
      <a class="navbar-brand" href="${user.role === 'coach' ? '#/coach' : '#/dashboard'}">
        <span class="brand-accent">STRENGTH</span>TRACK
      </a>
      <div class="navbar-links">
        ${links.map(l => `
          <a class="nav-link ${currentHash === l.hash ? 'active' : ''}" href="${l.hash}">${l.label}</a>
        `).join('')}
      </div>
      <div class="navbar-right">
        <span class="navbar-user">${user.email?.split('@')[0] ?? ''}</span>
        <button class="btn btn-ghost btn-sm" id="logout-btn">Sign Out</button>
        <button class="hamburger-btn" id="hamburger-btn" aria-label="Menu">☰</button>
      </div>
    </nav>
    <div class="mobile-menu" id="mobile-menu">
      ${links.map(l => `
        <a class="mobile-nav-link ${currentHash === l.hash ? 'active' : ''}" href="${l.hash}">${l.label}</a>
      `).join('')}
    </div>`;

  document.getElementById('logout-btn').addEventListener('click', logout);

  const hamburger = document.getElementById('hamburger-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  hamburger.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
  });
  mobileMenu.querySelectorAll('.mobile-nav-link').forEach(a => {
    a.addEventListener('click', () => mobileMenu.classList.remove('open'));
  });

  // Update active state on hash changes
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    mount.querySelectorAll('.nav-link, .mobile-nav-link').forEach(a => {
      a.classList.toggle('active', a.getAttribute('href') === hash);
    });
    mobileMenu.classList.remove('open');
  }, { once: false });
}
