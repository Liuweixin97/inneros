import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFlomoFingerprint,
  normalizeFlomoContent,
} from './flomo-dedup';

test('normalizes harmless content formatting differences', () => {
  assert.equal(
    normalizeFlomoContent('第一行  \r\n\r\n\r\n第二行\u00a0'),
    '第一行\n\n第二行',
  );
});

test('creates the same fingerprint for equivalent timestamps and content', () => {
  const first = createFlomoFingerprint(
    '记录内容\r\n',
    '2026-06-14T08:00:00.000Z',
  );
  const second = createFlomoFingerprint(
    '记录内容',
    '2026-06-14T16:00:00+08:00',
  );

  assert.equal(first, second);
});

test('keeps identical content created at different times distinct', () => {
  const first = createFlomoFingerprint('重复但有效的记录', '2026-06-14T08:00:00.000Z');
  const second = createFlomoFingerprint('重复但有效的记录', '2026-06-14T08:01:00.000Z');

  assert.notEqual(first, second);
});
