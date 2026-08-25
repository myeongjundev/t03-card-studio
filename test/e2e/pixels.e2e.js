import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startDistServer } from './server.js';

/**
 * 진짜 브라우저에서 진짜 픽셀을 검사한다.
 *
 * **골든 이미지를 쓰지 않는다.** PNG 바이트는 OS·폰트·그래픽 스택에 따라
 * 달라져서, 개발자 기기에서 만든 기준 이미지는 CI 리눅스에서 절대 맞지
 * 않는다. 그런 테스트는 회귀를 잡는 대신 매번 실패해서 결국 꺼진다.
 *
 * 대신 **같은 실행 안에서 반드시 성립해야 하는 관계**를 검사한다.
 * 두 결과를 그 자리에서 만들어 비교하므로 환경이 달라도 흔들리지 않는다.
 *
 * 단위 테스트(그리기 호출 기록)와 역할이 다르다.
 * 호출 기록은 "무엇을 그리라고 시켰는가" 를 고정하고,
 * 여기서는 "실제로 어떤 픽셀이 나왔는가" 를 본다.
 */

let server;
let browser;
let page;

before(async () => {
  server = await startDistServer();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.errors = errors;

  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas');
});

after(async () => {
  await browser?.close();
  await server?.close();
});

/**
 * 불투명한(알파 255) 픽셀의 비율.
 *
 * 픽셀 배열을 브라우저 밖으로 넘기지 않는다. 1080×1920 이면 800만 개가
 * 넘어서 직렬화에만 수십 초가 걸린다. 세는 일은 브라우저 안에서 하고
 * 숫자 하나만 받는다.
 */
const opaqueRatio = () =>
  page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const data = canvas
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] === 255) opaque += 1;
    return opaque / (data.length / 4);
  });

/** 다운로드가 만드는 것과 같은 PNG. 해시와 크기만 돌려받는다. */
const exportedPng = () =>
  page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return {
      size: bytes.length,
      hash: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join(''),
    };
  });

/**
 * 미리보기 캔버스와 내보낸 PNG 를 픽셀 단위로 비교한다.
 *
 * 비교도 브라우저 안에서 끝내고 결과 숫자만 받는다. 위와 같은 이유다.
 */
const comparePreviewToExport = () =>
  page.evaluate(async () => {
    const canvas = document.querySelector('canvas');
    const live = canvas
      .getContext('2d', { willReadFrequently: true })
      .getImageData(0, 0, canvas.width, canvas.height).data;

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const bitmap = await createImageBitmap(blob);
    const off = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = off.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    const saved = ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;

    let differing = 0;
    for (let i = 0; i < live.length; i += 1) if (live[i] !== saved[i]) differing += 1;

    return {
      previewSize: `${canvas.width}x${canvas.height}`,
      exportSize: `${bitmap.width}x${bitmap.height}`,
      differing,
      totalBytes: live.length,
    };
  });

const clickText = async (selector, text) => {
  await page.locator(selector).filter({ hasText: text }).first().click();
  await page.waitForTimeout(80);
};

const setRatio = (ratio) => page.locator('.ratio-group button', { hasText: ratio }).first().click();
const setPersona = (name) => clickText('.preset-grid button', name);
const setEra = (era) => clickText('.era-timeline button', era);

test('미리보기 캔버스와 내보낸 PNG 가 같은 픽셀이다', async () => {
  // 제품의 핵심 약속. 화면용/저장용 렌더러가 갈라지면 여기서 깨진다.
  for (const [persona, era, ratio] of [
    ['기본', '2004', '1:1'],
    ['소셜', '2012', '4:5'],
    ['친한 친구', '2026', '9:16'],
  ]) {
    await setRatio(ratio);
    await setPersona(persona);
    await setEra(era);
    await page.waitForTimeout(120);

    const result = await comparePreviewToExport();
    const where = `${persona}+${era}+${ratio}`;

    assert.equal(result.exportSize, result.previewSize, `${where}: 크기가 다르다`);
    assert.ok(result.totalBytes > 0, `${where}: 읽은 픽셀이 없다`);
    assert.equal(result.differing, 0, `${where}: 다른 바이트 ${result.differing}개`);
  }
});

test('9:16 안전 영역 가이드는 PNG 에 들어가지 않는다', async () => {
  await setRatio('9:16');

  const toggle = page.locator('button', { hasText: '안전 영역 가이드' }).first();
  if ((await toggle.getAttribute('aria-pressed')) === 'true') await toggle.click();
  await page.waitForTimeout(80);

  const off = await exportedPng();

  await toggle.click();
  await page.waitForTimeout(80);
  // 가이드가 화면에 정말 떠 있어야 이 검사가 의미가 있다.
  assert.equal(await page.locator('.safe-area-guide').count(), 1, '가이드가 화면에 나타나지 않았다');
  const on = await exportedPng();

  await toggle.click();

  assert.equal(on.size, off.size, 'PNG 크기가 달라졌다');
  assert.equal(on.hash, off.hash, '가이드가 PNG 픽셀에 들어갔다');
});

test('세 시대가 실제 픽셀로 서로 다르다', async () => {
  // 그리기 호출이 달라도 결과 픽셀은 같을 수 있다. 결과물로 확인한다.
  const seen = new Map();
  for (const ratio of ['1:1', '9:16']) {
    await setRatio(ratio);
    for (const persona of ['기본', '소셜', '친한 친구']) {
      await setPersona(persona);
      for (const era of ['2004', '2012', '2026']) {
        await setEra(era);
        await page.waitForTimeout(100);
        const { hash } = await exportedPng();
        const key = `${ratio} ${persona} ${era}`;
        const clash = seen.get(hash);
        assert.equal(clash, undefined, `${key} 와 ${clash} 의 결과 픽셀이 같다`);
        seen.set(hash, key);
      }
    }
  }
  assert.equal(seen.size, 18, '18개 조합이 모두 달라야 한다');
});

test('투명 배경을 켜면 알파가 실제로 보존된다', async () => {
  // 단위 테스트는 "장식을 그리지 않았다" 까지만 안다.
  // 알파 채널이 실제로 살아 있는지는 픽셀을 봐야 알 수 있다.
  await setRatio('1:1');
  const transparent = page.locator('input[type="checkbox"]').first();
  await transparent.check();
  await page.waitForTimeout(100);

  for (const era of ['2004', '2012', '2026']) {
    await setEra(era);
    await page.waitForTimeout(100);
    // 글자와 외곽선만 남아야 한다. 장식이 배경을 덮으면 이 값이 크게 뛴다.
    const ratio = await opaqueRatio();
    assert.ok(ratio < 0.15, `${era}: 불투명 픽셀이 ${(ratio * 100).toFixed(1)}% 다`);
  }

  await transparent.uncheck();
});

test('페이지에서 오류가 나지 않았다', async () => {
  assert.deepEqual(page.errors, [], `콘솔/페이지 오류: ${page.errors.join(' | ')}`);
});

test('같은 설정으로 다시 그리면 필름 입자까지 똑같다', async () => {
  // 필름 입자는 난수로 만든다. Math.random 을 쓰면 같은 설정인데도 매번
  // 다른 그림이 나와서, 저장한 템플릿을 다시 불러왔을 때 다른 카드가 된다.
  // 씨앗을 고정했다는 것을 실제 픽셀로 확인한다.
  await setRatio('1:1');
  await setPersona('소셜');
  await setEra('2012');
  await page.waitForTimeout(150);
  const first = await exportedPng();

  // 다른 시대로 갔다가 돌아온다. 캔버스를 완전히 다시 그리게 만드는 것이다.
  await setEra('2026');
  await page.waitForTimeout(150);
  await setEra('2012');
  await page.waitForTimeout(150);
  const second = await exportedPng();

  assert.equal(second.hash, first.hash, '같은 설정인데 다시 그린 결과가 다르다');

  // 비교가 의미 있으려면 필름 시대가 실제로 무언가를 그려야 한다.
  await setEra('2026');
  await page.waitForTimeout(150);
  const other = await exportedPng();
  assert.notEqual(other.hash, first.hash, '필름 시대가 아무 차이도 만들지 않았다');
});
