import test from 'node:test';
import assert from 'node:assert/strict';
import { buildShareUrl, readShareUrl, SHARE_PREFIX } from '../src/io/shareLink.js';
import { createInitialState } from '../src/state/editorState.js';

const BASE = 'https://example.test/app/';
const SHARED_FIELDS = [
  'ratio', 'fit', 'bgColor', 'transparentBg', 'text',
  'textX', 'textY', 'fontSize', 'color', 'lineHeight', 'align',
];

const cardState = (patch = {}) => ({ ...createInitialState(), ...patch });

test('링크를 만들고 다시 읽으면 모든 공유 필드가 그대로 복원된다', () => {
  const original = cardState({
    ratio: '9:16',
    fit: 'contain',
    bgColor: '#3d1220',
    transparentBg: true,
    text: '공유 😀 테스트\n둘째 줄',
    textX: 0.3,
    textY: 0.7,
    fontSize: 96,
    color: '#ffd166',
    lineHeight: 1.4,
    align: 'right',
  });

  const built = buildShareUrl(original, BASE);
  assert.equal(built.ok, true);

  const restored = readShareUrl(createInitialState(), built.url.slice(built.url.indexOf('#')));
  assert.equal(restored.ok, true);
  for (const field of SHARED_FIELDS) {
    assert.deepEqual(restored.state[field], original[field], `${field} 불일치`);
  }
});

test('이모지와 한글이 링크를 거쳐도 깨지지 않는다', () => {
  const original = cardState({ text: '한글 English 😀🔥 👨‍👩‍👧‍👦 ①②③' });
  const built = buildShareUrl(original, BASE);
  const restored = readShareUrl(createInitialState(), built.url.slice(built.url.indexOf('#')));
  assert.equal(restored.state.text, original.text);
});

test('기존 해시는 덮어쓰고 두 개가 겹치지 않는다', () => {
  const built = buildShareUrl(cardState(), `${BASE}${SHARE_PREFIX}oldvalue`);
  assert.equal(built.url.startsWith(`${BASE}${SHARE_PREFIX}`), true);
  assert.equal(built.url.split('#').length, 2);
});

test('공유 링크가 아니면 null 을 돌려주고 아무 판단도 하지 않는다', () => {
  assert.equal(readShareUrl(createInitialState(), ''), null);
  assert.equal(readShareUrl(createInitialState(), '#hello'), null);
  assert.equal(readShareUrl(createInitialState(), '#card'), null);
});

test('손상된 링크는 이유를 알리고 거부한다', () => {
  const result = readShareUrl(createInitialState(), `${SHARE_PREFIX}!!!깨진값!!!`);
  assert.equal(result.ok, false);
  assert.match(result.message, /손상/);
});

test('링크가 열리더라도 값이 규칙에 맞지 않으면 거부한다', () => {
  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const badRatio = encode({
    ratio: '3:2', text: 'x', textX: 0.5, textY: 0.5, fontSize: 100, color: '#ffffff',
  });
  const result = readShareUrl(createInitialState(), SHARE_PREFIX + badRatio);
  assert.equal(result.ok, false);
  assert.match(result.message, /3:2/);
  // 템플릿 목록 기준의 표현이 링크 안내에 새어 나오지 않아야 한다
  assert.equal(/번째 템플릿/.test(result.message), false);
});

test('주소 길이 한계를 넘으면 링크를 만들지 않고 이유를 알린다', () => {
  const built = buildShareUrl(cardState({ text: '가'.repeat(1500) }), BASE);
  assert.equal(built.ok, false);
  assert.match(built.message, /너무 깁니다/);
});

test('배경 이미지는 링크에 담기지 않는다', () => {
  const built = buildShareUrl(cardState({ imageName: 'secret-photo.png' }), BASE);
  const decoded = Buffer.from(
    built.url.slice(built.url.indexOf(SHARE_PREFIX) + SHARE_PREFIX.length)
      .replace(/-/g, '+').replace(/_/g, '/'),
    'base64'
  ).toString('utf8');
  assert.equal(decoded.includes('secret-photo'), false);
  assert.equal(decoded.includes('image'), false);
});
