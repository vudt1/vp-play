(function () {
  const cfg = window.VP_KEYCLOAK || {};
  const base = window.VP_BASE || '';

  function apiUrl(p) {
    return base + p;
  }

  function socketIoPath() {
    return base ? base + '/socket.io' : '/socket.io';
  }

  window.vpAuth = {
    profile: null,
    token: null,
    keycloak: null,
    ready: Promise.resolve(),
    socketPath: socketIoPath,
    apiUrl,
  };

  if (cfg.authDevBypass) {
    window.vpAuth.devMode = true;
    return;
  }

  if (!cfg.url || !window.Keycloak) {
    window.vpAuth.devMode = true;
    return;
  }

  const keycloak = new Keycloak({
    url: cfg.url,
    realm: cfg.realm,
    clientId: cfg.clientId,
  });
  window.vpAuth.keycloak = keycloak;

  window.vpAuth.ready = keycloak
    .init({ onLoad: 'check-sso', pkceMethod: 'S256', checkLoginIframe: false })
    .then(async (authenticated) => {
      if (!authenticated) return;
      await refreshProfile();
    })
    .catch(() => {
      window.vpAuth.devMode = true;
    });

  async function refreshProfile() {
    window.vpAuth.token = keycloak.token;
    const claim = cfg.idClaim || 'pccuid';
    const displayClaim = cfg.displayNameClaim || 'preferred_username';
    const parsed = keycloak.tokenParsed || {};
    const pccuid = parsed[claim] || parsed.sub;
    window.vpAuth.profile = {
      pccuid,
      displayName:
        parsed[displayClaim] ||
        parsed.name ||
        parsed.preferred_username ||
        pccuid,
    };
    if (keycloak.token) {
      await fetch(apiUrl('/api/auth/sync'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keycloak.token}`,
        },
        body: JSON.stringify({ displayName: window.vpAuth.profile.displayName }),
      });
    }
  }

  window.vpAuth.login = () => keycloak.login();
  window.vpAuth.logout = () =>
    keycloak.logout({ redirectUri: window.location.origin + (base || '') + '/' });
  window.vpAuth.refreshProfile = refreshProfile;

  setInterval(() => {
    if (keycloak.authenticated) {
      keycloak.updateToken(30).then((refreshed) => {
        if (refreshed) window.vpAuth.token = keycloak.token;
      }).catch(() => {});
    }
  }, 20000);
})();
