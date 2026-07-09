(function () {
  const cfg = window.VP_KEYCLOAK || {};
  const base = window.VP_BASE || '';
  const STORAGE_KEY = 'vp_access_token';

  function apiUrl(p) {
    return base + p;
  }

  function socketIoPath() {
    return base ? base + '/socket.io' : '/socket.io';
  }

  function clearStoredToken() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
  }

  function storeAccessToken(token) {
    if (!token) {
      clearStoredToken();
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, token);
    } catch (_) {
      /* ignore */
    }
  }

  function clearSession() {
    window.vpAuth.token = null;
    window.vpAuth.profile = null;
    clearStoredToken();
  }

  function notifyAuthChanged() {
    window.dispatchEvent(new CustomEvent('vp-auth-changed'));
  }

  function setError(message) {
    window.vpAuth.error = message || 'Auth error';
    clearSession();
    renderAuthSlot();
    notifyAuthChanged();
  }

  function clearError() {
    window.vpAuth.error = null;
  }

  function renderAuthSlot() {
    const slot = document.getElementById('auth-slot');
    if (!slot) return;
    slot.replaceChildren();

    if (window.vpAuth.profile) {
      const name = document.createElement('span');
      name.className = 'auth-name';
      name.textContent = window.vpAuth.profile.displayName || window.vpAuth.profile.pccuid;
      name.title = window.vpAuth.profile.pccuid || '';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ghost auth-logout';
      btn.textContent = 'Đăng xuất';
      btn.addEventListener('click', () => window.vpAuth.logout());

      slot.append(name, btn);
      return;
    }

    if (window.vpAuth.error && !window.vpAuth.devMode) {
      const msg = document.createElement('span');
      msg.className = 'auth-error muted';
      msg.textContent = window.vpAuth.error;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn ghost';
      btn.textContent = 'Thử lại';
      btn.addEventListener('click', () => window.vpAuth.retrySync());

      slot.append(msg, btn);
    }
  }

  window.vpAuth = {
    profile: null,
    token: null,
    keycloak: null,
    ready: Promise.resolve(),
    devMode: false,
    error: null,
    socketPath: socketIoPath,
    apiUrl,
    renderAuthSlot,
    login: () => {},
    beforeLogout: null,
    logout: () => {
      const run = () => {
        clearSession();
        renderAuthSlot();
        notifyAuthChanged();
      };
      const hook = window.vpAuth.beforeLogout;
      if (typeof hook === 'function') {
        Promise.resolve(hook())
          .catch(() => {})
          .then(run);
        return;
      }
      run();
    },
    refreshProfile: async () => {},
    retrySync: async () => {},
  };

  if (cfg.authDevBypass) {
    window.vpAuth.devMode = true;
    window.vpAuth.logout = () => {
      const run = () => {
        clearSession();
        notifyAuthChanged();
        window.location.reload();
      };
      const hook = window.vpAuth.beforeLogout;
      if (typeof hook === 'function') {
        Promise.resolve(hook())
          .catch(() => {})
          .then(run);
        return;
      }
      run();
    };
    renderAuthSlot();
    return;
  }

  if (!cfg.url || !window.Keycloak) {
    setError('Keycloak không khả dụng');
    window.vpAuth.ready = Promise.resolve();
    return;
  }

  const keycloak = new Keycloak({
    url: cfg.url,
    realm: cfg.realm,
    clientId: cfg.clientId,
  });
  window.vpAuth.keycloak = keycloak;

  async function refreshProfile() {
    clearError();
    const claim = cfg.idClaim || 'pccuid';
    const displayClaim = cfg.displayNameClaim || 'preferred_username';
    const parsed = keycloak.tokenParsed || {};
    const pccuid = parsed[claim] || parsed.sub;
    const displayName =
      parsed[displayClaim] ||
      parsed.name ||
      parsed.preferred_username ||
      pccuid;

    if (!keycloak.token || !pccuid) {
      setError('Token hoặc pccuid không hợp lệ');
      return false;
    }

    let res;
    try {
      res = await fetch(apiUrl('/api/auth/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keycloak.token}`,
        },
        body: JSON.stringify({ displayName }),
      });
    } catch (_) {
      setError('Không đồng bộ được tài khoản');
      return false;
    }

    if (!res.ok) {
      let message = 'Đồng bộ tài khoản thất bại';
      try {
        const body = await res.json();
        if (body?.message) message = body.message;
      } catch (_) {
        /* ignore */
      }
      setError(message);
      return false;
    }

    let data = {};
    try {
      data = await res.json();
    } catch (_) {
      /* ignore */
    }

    window.vpAuth.token = keycloak.token;
    window.vpAuth.profile = {
      pccuid: data.pccuid || pccuid,
      displayName: data.displayName || displayName,
    };
    storeAccessToken(keycloak.token);
    clearError();
    renderAuthSlot();
    notifyAuthChanged();
    return true;
  }

  window.vpAuth.refreshProfile = refreshProfile;

  window.vpAuth.login = () => keycloak.login();

  window.vpAuth.logout = () => {
    const run = () => {
      clearSession();
      renderAuthSlot();
      notifyAuthChanged();
      keycloak.logout({
        redirectUri: window.location.origin + (base || '') + '/',
      });
    };
    const hook = window.vpAuth.beforeLogout;
    if (typeof hook === 'function') {
      Promise.resolve(hook())
        .catch(() => {})
        .then(run);
      return;
    }
    run();
  };

  window.vpAuth.retrySync = async () => {
    clearError();
    renderAuthSlot();
    if (!keycloak.authenticated) {
      keycloak.login();
      return;
    }
    try {
      await keycloak.updateToken(30);
    } catch (_) {
      keycloak.login();
      return;
    }
    await refreshProfile();
  };

  window.vpAuth.ready = keycloak
    .init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false })
    .then(async (authenticated) => {
      if (!authenticated) {
        setError('Chưa đăng nhập Keycloak');
        return;
      }
      await refreshProfile();
    })
    .catch(() => {
      setError('Keycloak không khả dụng');
    });

  setInterval(() => {
    if (!keycloak.authenticated || !window.vpAuth.profile) return;
    keycloak
      .updateToken(30)
      .then((refreshed) => {
        if (refreshed && keycloak.token && window.vpAuth.profile) {
          window.vpAuth.token = keycloak.token;
          storeAccessToken(keycloak.token);
          notifyAuthChanged();
        }
      })
      .catch(() => {});
  }, 20000);
})();
