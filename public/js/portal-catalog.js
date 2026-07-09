function catalogPage() {
  const base = window.VP_BASE || '';

  function apiUrl(p) {
    return (window.vpAuth?.apiUrl || ((x) => base + x))(p);
  }

  return {
    profile: null,
    authError: null,
    authReady: false,
    devMode: false,
    devId: 'player1',

    async init() {
      await (window.vpAuth?.ready || Promise.resolve());
      this.authReady = true;
      this.devMode = !!window.vpAuth?.devMode || !!window.VP_KEYCLOAK?.authDevBypass;
      this.applyAuthState();
      window.vpAuth?.renderAuthSlot?.();
      window.addEventListener('vp-auth-changed', () => this.applyAuthState());
    },

    applyAuthState() {
      this.authError = window.vpAuth?.error || null;
      this.profile = window.vpAuth?.profile || null;
    },

    async retryAuth() {
      this.authError = null;
      await window.vpAuth?.retrySync?.();
      this.applyAuthState();
    },

    async devLogin() {
      const id = (this.devId || 'player1').trim();
      if (!id) {
        this.authError = 'pccuid bắt buộc';
        return;
      }
      this.authError = null;
      let res;
      try {
        res = await fetch(apiUrl('/api/auth/sync'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${id}`,
          },
          body: JSON.stringify({ displayName: id }),
        });
      } catch (_) {
        this.authError = 'Không đồng bộ được tài khoản';
        return;
      }
      if (!res.ok) {
        let message = 'Đồng bộ tài khoản thất bại';
        try {
          const body = await res.json();
          if (body?.message) message = body.message;
        } catch (_) {
          /* ignore */
        }
        this.authError = message;
        if (window.vpAuth) {
          window.vpAuth.token = null;
          window.vpAuth.profile = null;
          window.vpAuth.error = message;
          window.vpAuth.renderAuthSlot?.();
          window.dispatchEvent(new CustomEvent('vp-auth-changed'));
        }
        return;
      }
      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        /* ignore */
      }
      const profile = {
        pccuid: data.pccuid || id,
        displayName: data.displayName || id,
      };
      if (window.vpAuth) {
        window.vpAuth.token = id;
        window.vpAuth.profile = profile;
        window.vpAuth.error = null;
        window.vpAuth.renderAuthSlot?.();
        window.dispatchEvent(new CustomEvent('vp-auth-changed'));
      }
      this.profile = profile;
    },
  };
}
