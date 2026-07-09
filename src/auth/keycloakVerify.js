'use strict';

const { createRemoteJWKSet, jwtVerify } = require('jose');
const { env } = require('../config/env');

let jwks;

function getJwks() {
  if (!jwks) {
    const url = new URL(
      `/realms/${env.keycloakRealm}/protocol/openid-connect/certs`,
      env.keycloakUrl
    );
    jwks = createRemoteJWKSet(url);
  }
  return jwks;
}

function displayNameFrom(payload, idClaim, pccuid) {
  const displayClaim = env.keycloakDisplayNameClaim;
  return (
    (displayClaim && payload[displayClaim]) ||
    payload.name ||
    payload.preferred_username ||
    payload[idClaim] ||
    String(pccuid)
  );
}

function extractPlayer(payload) {
  const claim = env.keycloakIdClaim;
  const pccuid = payload[claim] || payload.sub;
  if (!pccuid) return null;
  return {
    pccuid: String(pccuid),
    displayName: String(displayNameFrom(payload, claim, pccuid)),
  };
}

async function verifyAccessToken(token) {
  if (!token) {
    return { ok: false, code: 'NO_TOKEN', message: 'Missing token' };
  }

  if (env.authDevBypass) {
    let pccuid = String(token);
    let displayName = pccuid;
    try {
      const parts = String(token).split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        pccuid = String(payload[env.keycloakIdClaim] || payload.sub || pccuid);
        displayName = String(displayNameFrom(payload, env.keycloakIdClaim, pccuid));
      }
    } catch (_) {
      /* plain pccuid string */
    }
    return {
      ok: true,
      player: { pccuid, displayName },
    };
  }

  if (!env.keycloakUrl || !env.keycloakRealm) {
    return { ok: false, code: 'AUTH_MISCONFIG', message: 'Keycloak not configured' };
  }

  try {
    const issuer = `${env.keycloakUrl.replace(/\/$/, '')}/realms/${env.keycloakRealm}`;
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer,
    });
    const player = extractPlayer(payload);
    if (!player) {
      return { ok: false, code: 'NO_CLAIM', message: 'No player id claim in token' };
    }
    return { ok: true, player, payload };
  } catch (e) {
    return { ok: false, code: 'INVALID_TOKEN', message: 'Token verification failed' };
  }
}

module.exports = { verifyAccessToken, extractPlayer };
