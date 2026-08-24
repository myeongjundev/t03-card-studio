import test from 'node:test';
import assert from 'node:assert/strict';

const STORAGE_KEY = 't03-card-studio/templates';

function localStorageMock(initial = {}, shouldFail = () => false) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    api: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (shouldFail(key)) throw new DOMException('full', 'QuotaExceededError');
        values.set(key, String(value));
      },
      removeItem: (key) => values.delete(key),
    },
  };
}

const valid = (patch = {}) => ({
  id: 'id-1',
  name: '정상',
  ratio: '1:1',
  text: '문구',
  textX: 0.5,
  textY: 0.5,
  fontSize: 100,
  color: '#ffffff',
  ...patch,
});

async function freshStorage() {
  return import(`../src/templates/storage.js?test=${Date.now()}-${Math.random()}`);
}

test('일부 항목이 손상되면 원본 전체를 격리하고 정상 항목만 복구한다', async () => {
  const raw = JSON.stringify({
    schemaVersion: 1,
    templates: [valid(), valid({ id: 'id-2', fontSize: 'bad' })],
  });
  const mock = localStorageMock({ [STORAGE_KEY]: raw });
  globalThis.window = { localStorage: mock.api };
  const { loadTemplates } = await freshStorage();

  const result = loadTemplates();
  assert.equal(result.templates.length, 1);
  assert.equal(mock.values.has(STORAGE_KEY), false);
  assert.equal(
    [...mock.values.entries()].some(
      ([key, value]) => key.startsWith(`${STORAGE_KEY}.corrupt-`) && value === raw
    ),
    true
  );
});

test('중복 ID도 손상으로 격리한다', async () => {
  const raw = JSON.stringify({ templates: [valid(), valid({ name: '중복' })] });
  const mock = localStorageMock({ [STORAGE_KEY]: raw });
  globalThis.window = { localStorage: mock.api };
  const { loadTemplates } = await freshStorage();

  const result = loadTemplates();
  assert.equal(result.templates.length, 1);
  assert.match(result.warning, /중복 ID/);
  assert.equal(mock.values.has(STORAGE_KEY), false);
});

test('손상 원본 격리에 실패하면 후속 저장으로 원본을 덮어쓰지 않는다', async () => {
  const raw = '{broken';
  const mock = localStorageMock(
    { [STORAGE_KEY]: raw },
    (key) => key.startsWith(`${STORAGE_KEY}.corrupt-`)
  );
  globalThis.window = { localStorage: mock.api };
  const { loadTemplates, saveTemplates } = await freshStorage();

  loadTemplates();
  const saved = saveTemplates([]);
  assert.equal(saved.ok, false);
  assert.equal(mock.values.get(STORAGE_KEY), raw);
});
