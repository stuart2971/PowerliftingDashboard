import { setAuth, navigate, toast } from '../app.js';
import { authAPI } from '../api.js';

export function renderLogin(app, showRegister = false) {
  app.innerHTML = `
    <div class="login-page" style="padding-top:0">
      <div class="login-card">
        <div class="login-header">
          <div class="login-logo">StrengthTrack</div>
        </div>
        <div class="login-body">
          <div class="login-tabs">
            <div class="login-tab ${!showRegister ? 'active' : ''}" id="tab-login">Login</div>
            <div class="login-tab ${showRegister ? 'active' : ''}" id="tab-register">Register</div>
          </div>

          <!-- Login Form -->
          <form id="login-form" class="${showRegister ? 'hidden' : ''}">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" id="login-email" placeholder="your@email.com" autocomplete="email" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-control" id="login-password" placeholder="••••••••" autocomplete="current-password" required>
            </div>
            <div id="login-error" class="form-error hidden"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">Sign In</button>
          </form>

          <!-- Register Form -->
          <form id="register-form" class="${!showRegister ? 'hidden' : ''}">
            <div class="form-group">
              <label class="form-label">Full Name</label>
              <input type="text" class="form-control" id="reg-name" placeholder="Stuart Fong" required>
            </div>
            <div class="form-group">
              <label class="form-label">Email</label>
              <input type="email" class="form-control" id="reg-email" placeholder="your@email.com" required>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-control" id="reg-password" placeholder="••••••••" required>
            </div>
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-select" id="reg-role">
                <option value="athlete">Athlete</option>
                <option value="coach">Coach</option>
              </select>
            </div>
            <div id="register-error" class="form-error hidden"></div>
            <button type="submit" class="btn btn-primary" style="width:100%;margin-top:8px">Create Account</button>
          </form>
        </div>
      </div>
    </div>`;

  // Tab switching
  document.getElementById('tab-login').addEventListener('click', () => {
    document.getElementById('tab-login').classList.add('active');
    document.getElementById('tab-register').classList.remove('active');
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
  });

  document.getElementById('tab-register').addEventListener('click', () => {
    document.getElementById('tab-register').classList.add('active');
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('login-form').classList.add('hidden');
  });

  // Login
  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const { token, user } = await authAPI.login({
        email: document.getElementById('login-email').value,
        password: document.getElementById('login-password').value
      });
      setAuth(token, user);
      toast('Welcome back!', 'success');
      navigate(user.role === 'coach' ? '/coach' : '/dashboard');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });

  // Register
  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('register-error');
    errEl.classList.add('hidden');
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const { token, user } = await authAPI.register({
        email: document.getElementById('reg-email').value,
        password: document.getElementById('reg-password').value,
        role: document.getElementById('reg-role').value,
        name: document.getElementById('reg-name').value
      });
      setAuth(token, user);
      toast('Account created!', 'success');
      navigate(user.role === 'coach' ? '/coach' : '/dashboard');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}
