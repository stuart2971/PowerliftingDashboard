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

  // Render navbar
  renderNavbar(user);

  app.innerHTML = '<div class="loading-screen"><div class="spinner"></div></div>';

  try {
    if (path === '/login' || path === '/register') {
      return renderLogin(app, path === '/register');
    }

    if (path === '/dashboard') {
      return renderAthleteDashboard(app);
    }

    if (path.startsWith('/my/exercise/') && parts[2]) {
      return renderAthleteExercise(app, null, parts[2]);
    }

    if (path.startsWith('/session/')) {
      const sessionId = parts[1];
      return renderSessionLog(app, sessionId);
    }

    if (path === '/profile') {
      return renderAthleteProfile(app);
    }

    if (path === '/coach') {
      return renderCoachDashboard(app);
    }

    if (path.startsWith('/coach/athlete/') && parts[3] === 'exercise' && parts[4]) {
      return renderAthleteExercise(app, parts[2], parts[4]);
    }

    if (path.startsWith('/coach/athlete/')) {
      const athleteId = parts[2];
      return renderAthleteDetail(app, athleteId);
    }

    if (path.startsWith('/coach/program/')) {
      const programId = parts[2];
      return renderProgramBuilder(app, programId);
    }

    if (path.startsWith('/training/week/')) {
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
