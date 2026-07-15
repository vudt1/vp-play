'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAppPrefix,
  publicPath,
  socketPath,
} = require('../../src/config/env');

describe('normalizeAppPrefix', () => {
  it('empty and slash', () => {
    assert.equal(normalizeAppPrefix(''), '');
    assert.equal(normalizeAppPrefix(undefined), '');
    assert.equal(normalizeAppPrefix('/'), '');
    assert.equal(normalizeAppPrefix('   '), '');
  });

  it('adds leading slash and strips trailing', () => {
    assert.equal(normalizeAppPrefix('play'), '/play');
    assert.equal(normalizeAppPrefix('/play'), '/play');
    assert.equal(normalizeAppPrefix('/play/'), '/play');
    assert.equal(normalizeAppPrefix('/play/app/'), '/play/app');
  });
});

describe('publicPath', () => {
  it('root without prefix', () => {
    assert.equal(publicPath('', '/css/style.css'), '/css/style.css');
    assert.equal(publicPath('', 'js/app.js'), '/js/app.js');
  });

  it('with prefix', () => {
    assert.equal(publicPath('/play', '/css/style.css'), '/play/css/style.css');
    assert.equal(publicPath('/play', '/'), '/play/');
    assert.equal(publicPath('/play', '/api/ranks'), '/play/api/ranks');
  });
});

describe('socketPath', () => {
  it('default and prefixed', () => {
    assert.equal(socketPath(''), '/socket.io');
    assert.equal(socketPath('/play'), '/play/socket.io');
  });
});
