'use strict';

const path = require('path');
const fs = require('fs');

function resolveVpEnv() {
  if (process.env.VP_ENV === 'production' || process.env.VP_ENV === 'development') {
    return process.env.VP_ENV;
  }
  if (process.env.NODE_ENV === 'production') return 'production';
  return 'development';
}

function loadEnvFiles(vpEnv) {
  const dotenv = require('dotenv');
  const cwd = process.cwd();

  if (process.env.DOTENV_CONFIG_PATH) {
    dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
  } else {
    const primary =
      vpEnv === 'production'
        ? path.join(cwd, '.env.production')
        : path.join(cwd, '.env.development');
    if (fs.existsSync(primary)) {
      dotenv.config({ path: primary });
    }
  }

  const fallback = path.join(cwd, '.env');
  if (fs.existsSync(fallback)) {
    dotenv.config({ path: fallback, override: false });
  }
}

function normalizeAppPrefix(raw) {
  if (raw == null || String(raw).trim() === '') return '';
  let p = String(raw).trim();
  if (!p.startsWith('/')) p = `/${p}`;
  p = p.replace(/\/+$/, '');
  if (p === '/') return '';
  return p;
}

function publicPath(appPrefix, resourcePath) {
  const prefix = normalizeAppPrefix(appPrefix);
  const res = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;
  if (!prefix) return res;
  return `${prefix}${res}`;
}

function socketPath(appPrefix) {
  const prefix = normalizeAppPrefix(appPrefix);
  return prefix ? `${prefix}/socket.io` : '/socket.io';
}

const vpEnv = resolveVpEnv();
loadEnvFiles(vpEnv);

const appPrefix = normalizeAppPrefix(process.env.APP_PREFIX);
const authDevBypass = process.env.AUTH_DEV_BYPASS === '1';

if (vpEnv === 'production' && authDevBypass) {
  throw new Error(
    '[vp-play] AUTH_DEV_BYPASS=1 is forbidden in production. Unset it in .env.production / process env.'
  );
}

const env = {
  vpEnv,
  isProd: vpEnv === 'production',
  port: Number(process.env.PORT || 3000),
  databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), 'database', 'play.db'),
  keycloakUrl: process.env.KEYCLOAK_URL || '',
  keycloakRealm: process.env.KEYCLOAK_REALM || '',
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID || 'vp-play',
  keycloakIdClaim: process.env.KEYCLOAK_ID_CLAIM || 'pccuid',
  keycloakDisplayNameClaim: process.env.KEYCLOAK_DISPLAY_NAME_CLAIM || 'preferred_username',
  turnTimeoutMs: Number(process.env.TURN_TIMEOUT_MS || 30_000),
  dealGraceMs: Number(process.env.DEAL_GRACE_MS || 8_000),
  reconnectMs: Number(process.env.RECONNECT_MS || 60_000),
  drawMs: Number(process.env.DRAW_MS || 10_000),
  kinhCooldownMs: Number(process.env.KINH_COOLDOWN_MS || 30_000),
  authDevBypass,
  appPrefix,
};

function withPublicPath(resourcePath) {
  return publicPath(env.appPrefix, resourcePath);
}

module.exports = {
  env,
  normalizeAppPrefix,
  publicPath,
  socketPath,
  withPublicPath,
};
