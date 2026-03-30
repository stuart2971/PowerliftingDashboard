import { renderNavbar } from './components/navbar.js';
import { renderLogin } from './views/login.js';
import { renderAthleteDashboard } from './views/athleteDashboard.js';
import { renderSessionLog } from './views/sessionLog.js';
import { renderAthleteProfile } from './views/athleteProfile.js';
import { renderCoachDashboard } from './views/coachDashboard.js';
import { renderProgramBuilder } from './views/programBuilder.js';
import { renderAthleteDetail } from './views/athleteDetail.js';
import { renderWeekDetail } from './views/weekDetail.js';
import { renderAthleteExercise } from './views/athleteExercise.js';

// ── Auth State ────────────────────────────────────────────────────
export function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

export function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  navigate('/login');
}

// ── Toast ─────────────────────────────────────────────────────────
export function toast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

// ── Router ────────────────────────────────────────────────────────
export function navigate(path) {
  window.location.hash = `#${path}`;
}

function getRoute() {
  const hash = window.location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  return { path: '/' + parts.join('/'), parts };
}

// ── Skeleton screens ──────────────────────────────────────────────
const SKEL = {
  page: `<div class="page skel-page">
    <div class="page-header">
      <div><div class="skel skel-h"></div></div>
      <div class="skel skel-btn"></div>
    </div>
    <div class="skel skel-card"></div>
    <div class="skel skel-card"></div>
    <div class="skel skel-card"></div>
  </div>`,
  program: `<div class="page skel-page">
    <div class="page-header">
      <div><div class="skel skel-h"></div></div>
      <div class="skel skel-btn"></div>
    </div>
    <div class="skel skel-card skel-tall"></div>
    <div class="skel skel-card skel-tall"></div>
  </div>`,
  session: `<div class="page skel-page">
    <div class="page-header">
      <div><div class="skel skel-h"></div></div>
    </div>
    <div class="skel skel-card"></div>
    <div class="skel skel-card skel-tall"></div>
    <div class="skel skel-card skel-tall"></div>
  </div>`,
};

async function router() {
  const user = getUser();
  const { path, parts } = getRoute();
  const app = document.getElementById('app');

  // Redirect unauthenticated users
  if (!user && path !== '/login' && path !== '/register') {
    navigate('/login');
    return;
  }

  // Redirect authenticated users away from login
  if (user && (path === '/login' || path === '/register' || path === '/')) {
    navigate(user.role === 'coach' ? '/coach' : '/dashboard');
    return;
  }

  // Role-based route guards
  if (user && user.role !== 'coach' && path.startsWith('/coach')) {
    navigate('/dashboard');
    return;
  }
  if (user && user.role === 'coach' && path === '/dashboard') {
    navigate('/coach');
    return;
  }

  // Render navbar
  renderNavbar(user);

  try {
    if (path === '/login' || path === '/register') {
      app.innerHTML = '';
      return renderLogin(app, path === '/register');
    }

    if (path === '/dashboard') {
      app.innerHTML = SKEL.page;
      return renderAthleteDashboard(app);
    }

    if (path.startsWith('/my/exercise/') && parts[2]) {
      app.innerHTML = SKEL.page;
      return renderAthleteExercise(app, null, parts[2]);
    }

    if (path.startsWith('/session/')) {
      app.innerHTML = SKEL.session;
      const sessionId = parts[1];
      return renderSessionLog(app, sessionId);
    }

    if (path === '/profile') {
      app.innerHTML = SKEL.page;
      return renderAthleteProfile(app);
    }

    if (path === '/coach') {
      app.innerHTML = SKEL.page;
      return renderCoachDashboard(app);
    }

    if (path.startsWith('/coach/athlete/') && parts[3] === 'exercise' && parts[4]) {
      app.innerHTML = SKEL.page;
      return renderAthleteExercise(app, parts[2], parts[4]);
    }

    if (path.startsWith('/coach/athlete/')) {
      app.innerHTML = SKEL.page;
      const athleteId = parts[2];
      return renderAthleteDetail(app, athleteId);
    }

    if (path.startsWith('/coach/program/')) {
      app.innerHTML = SKEL.program;
      const programId = parts[2];
      return renderProgramBuilder(app, programId);
    }

    if (path.startsWith('/training/week/')) {
      app.innerHTML = SKEL.page;
      const weekId = parts[2];
      return renderWeekDetail(app, weekId);
    }

    // 404
    app.innerHTML = `
      <div class="page">
        <div class="empty-state">
          <div class="empty-state-icon">🏋️</div>
          <div class="empty-state-title">Page Not Found</div>
          <div class="empty-state-text">The page you're looking for doesn't exist.</div>
          <button class="btn btn-primary mt-16" onclick="history.back()">Go Back</button>
        </div>
      </div>`;
  } catch (err) {
    console.error('Route error:', err);
    app.innerHTML = `
      <div class="page">
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Something went wrong</div>
          <div class="empty-state-text">${err.message}</div>
        </div>
      </div>`;
  }
}

// Listen for hash changes
window.addEventListener('hashchange', router);
window.addEventListener('load', router);

// Initial render
router();

// Keep Vercel serverless function warm — ping every 4 min to prevent cold starts
setInterval(() => {
  if (getUser()) fetch('/api/auth/me').catch(() => {});
}, 4 * 60 * 1000);
