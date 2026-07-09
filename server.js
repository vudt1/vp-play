'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { env, withPublicPath, socketPath } = require('./src/config/env');
const { getDb } = require('./src/config/db');
const { syncFromRequest } = require('./src/auth/syncController');
const { listRanks } = require('./src/controllers/rankController');
const { listModules, getModule } = require('./src/modules/catalog');
const { attachSockets } = require('./src/sockets');

getDb();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.locals.appPrefix = env.appPrefix;
  res.locals.publicPath = withPublicPath;
  res.locals.keycloak = {
    url: env.keycloakUrl,
    realm: env.keycloakRealm,
    clientId: env.keycloakClientId,
    idClaim: env.keycloakIdClaim,
    displayNameClaim: env.keycloakDisplayNameClaim,
    authDevBypass: env.authDevBypass,
  };
  next();
});

app.get('/', (req, res) => {
  res.render('index', {
    title: 'Ứng dụng',
    modules: listModules(),
    navActive: 'apps',
  });
});

app.get('/apps/:id', (req, res) => {
  const mod = getModule(req.params.id);
  if (!mod) {
    return res.status(404).render('not-found', {
      title: 'Không tìm thấy',
      message: 'Module không tồn tại.',
      navActive: 'apps',
    });
  }
  return res.render('app', {
    title: mod.name,
    module: mod,
    navActive: 'apps',
  });
});

app.get('/ranking', (req, res) => {
  res.render('ranking', { title: 'Bảng xếp hạng', navActive: 'ranking' });
});

app.post('/api/auth/sync', syncFromRequest);
app.get('/api/ranks', listRanks);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

attachSockets(io);

server.listen(env.port, () => {
  const base = env.appPrefix || '';
  console.log(`VP Play (${env.vpEnv}) listening on http://localhost:${env.port}${base || ''}`);
  if (env.appPrefix) {
    console.log(`Public path APP_PREFIX=${env.appPrefix} (Socket.IO client path ${socketPath(env.appPrefix)})`);
  }
});
