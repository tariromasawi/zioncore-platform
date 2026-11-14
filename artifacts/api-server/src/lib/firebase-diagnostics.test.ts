import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyCleanupQueryError,
  classifyExpiryIndexConfig,
} from './firebase-diagnostics';

test('cleanup query errors are reduced to safe status categories', () => {
  assert.equal(classifyCleanupQueryError({ code: 7 }), 'permission_denied');
  assert.equal(classifyCleanupQueryError({ code: 'permission-denied' }), 'permission_denied');
  assert.equal(classifyCleanupQueryError({ code: 9 }), 'index_not_ready');
  assert.equal(classifyCleanupQueryError(new Error('network unavailable')), 'unavailable');
});

test('expiry index status matches the collection-group ascending field index only', () => {
  assert.equal(classifyExpiryIndexConfig({
    indexConfig: {
      indexes: [{
        queryScope: 'COLLECTION_GROUP',
        state: 'READY',
        fields: [{ fieldPath: 'expiresAt', order: 'ASCENDING' }],
      }],
    },
  }), 'ready');

  assert.equal(classifyExpiryIndexConfig({
    indexConfig: {
      indexes: [{
        queryScope: 'COLLECTION_GROUP',
        state: 'CREATING',
        fields: [{ fieldPath: 'expiresAt', order: 'ASCENDING' }],
      }],
    },
  }), 'building');

  assert.equal(classifyExpiryIndexConfig({
    indexConfig: {
      indexes: [{
        queryScope: 'COLLECTION',
        state: 'READY',
        fields: [{ fieldPath: 'expiresAt', order: 'ASCENDING' }],
      }],
    },
  }), 'missing');
  assert.equal(classifyExpiryIndexConfig({ indexConfig: { indexes: [] } }), 'missing');
});
