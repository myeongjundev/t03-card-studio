import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startDistServer } from './server.js';

/**
 * 조작 회귀 검사.
 *
 * 여기 있는 것은 전부 **실제로 배포된 적이 있는 결함**이다. 둘 다 렌더러는
 * 멀쩡했고 단위 테스트도 전부 통과했다. 픽셀이 아니라 "사람이 실제로 하는
 * 동작"에서만 드러나는 종류라, 진짜 브라우저에서 진짜 입력을 보내야 잡힌다.
 *
 * pixels.e2e.js 와 페이지를 공유하지 않는다. 저쪽 검사들이 시대·비율·이미지를
 * 바꿔 두기 때문에, 초기 상태에 의존하는 이 검사들이 실행 순서에 따라
 * 흔들리게 된다.
 */

const STOP_YEARS = ['2004', '2012', '2026'];

let server;
let browser;
let page;

before(async () => {
  server = await startDistServer();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.scanner-frame');
});

after(async () => {
  await browser?.close();
  await server?.close();
});

test('방향키를 눌렀다 떼도 Scanner 가 그 자리에 남는다', async () => {
  // 배포된 결함: onKeyUp 에도 스냅이 걸려 있어서, 화살표 한 번의 이동량
  // (0.025)보다 스냅의 흡인 범위가 훨씬 넓었다. 키를 누르고 있을 때만
  // 움직이고 떼는 순간 원래 정지점으로 되돌아갔다 — 즉 **화살표를 눌렀다
  // 떼면 아무 일도 일어나지 않았다.**
  //
  // press() 는 keydown 과 keyup 을 함께 보낸다. 사람이 키를 톡톡 누르는
  // 것과 같고, 바로 그 동작이 망가져 있었다. 예전 검사가 Home 만 눌러
  // 봤기 때문에 이 결함이 통과해 버렸다 — Home 의 목적지(2004)는 그
  // 자체가 정지점이라 스냅되어도 값이 같았다.
  const scanner = page.locator('.scanner-frame');
  await scanner.focus();

  const before = await scanner.getAttribute('aria-valuenow');
  assert.equal(before, '2026', '첫 상태가 2026 이 아니다');

  for (let i = 0; i < 4; i += 1) await scanner.press('ArrowLeft');
  await page.waitForTimeout(120);

  const after = await scanner.getAttribute('aria-valuenow');
  assert.notEqual(after, before, '방향키를 눌렀다 뗐는데 값이 그대로다');
  assert.ok(Number(after) < Number(before), `왼쪽 방향키인데 연도가 늘었다: ${before} → ${after}`);

  // 핵심은 "움직였다" 가 아니라 **"정지점 사이에 머물렀다"** 이다.
  // role="slider" 를 선언한 이상 키보드로도 중간 위치를 잡을 수 있어야 한다.
  assert.ok(
    !STOP_YEARS.includes(after),
    `키를 뗀 뒤 정지점으로 되돌아갔다(${after}). onKeyUp 스냅이 살아 있다.`
  );

  // 반대 방향도 같은 규칙을 따른다.
  await scanner.press('ArrowRight');
  await page.waitForTimeout(120);
  const back = await scanner.getAttribute('aria-valuenow');
  assert.ok(Number(back) > Number(after), `오른쪽 방향키인데 연도가 줄었다: ${after} → ${back}`);
});

test('Home 과 End 는 양 끝 시대로 간다', async () => {
  const scanner = page.locator('.scanner-frame');
  await scanner.focus();

  await scanner.press('Home');
  await page.waitForTimeout(120);
  assert.equal(await scanner.getAttribute('aria-valuenow'), '2004', 'Home 이 2004 로 가지 않았다');

  await scanner.press('End');
  await page.waitForTimeout(120);
  assert.equal(await scanner.getAttribute('aria-valuenow'), '2026', 'End 가 2026 으로 가지 않았다');
});

test('초점이 떠나면 가장 가까운 시대로 정리된다', async () => {
  // 스냅 자체를 없앤 것이 아니다. 조작이 끝나는 시점 — 초점이 떠날 때와
  // 포인터를 놓을 때 — 에는 여전히 정지점으로 모인다. 그래야 CTA 가
  // 무엇을 적용할지가 분명해진다.
  const scanner = page.locator('.scanner-frame');
  await scanner.focus();
  await scanner.press('Home');
  for (let i = 0; i < 3; i += 1) await scanner.press('ArrowRight');
  await page.waitForTimeout(120);

  const parked = await scanner.getAttribute('aria-valuenow');
  assert.ok(!STOP_YEARS.includes(parked), `중간에 머물러야 하는데 정지점이다: ${parked}`);

  await scanner.blur();
  await page.waitForTimeout(450);
  assert.ok(
    STOP_YEARS.includes(await scanner.getAttribute('aria-valuenow')),
    '초점이 떠났는데 정지점으로 정리되지 않았다'
  );
});

test('페이지 안에서 이동해도 공유 링크가 주소에 남는다', async () => {
  // 배포된 결함: 워드마크가 `<a href="#top">` 이라 클릭하면 주소의 해시를
  // #top 으로 덮어썼다. 방금 만든 #card= 가 소리 없이 사라진다.
  //
  // 하필 클립보드가 막힌 환경에서 앱이 안내하는 대안이 "주소창의 주소를
  // 직접 복사해 주세요" 다. 그 주소를 앱이 스스로 날리고 있었다.
  await page.locator('#text-input').fill('오늘도 무사히');
  await page.getByRole('button', { name: '링크 복사' }).click();
  await page.waitForTimeout(300);

  const shared = await page.evaluate(() => location.hash);
  assert.ok(shared.startsWith('#card='), `공유 링크가 주소에 실리지 않았다: ${shared}`);

  await page.getByRole('button', { name: 'Alter Ego 처음으로' }).click();
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(() => location.hash),
    shared,
    '워드마크를 눌렀더니 공유 상태가 사라졌다'
  );

  await page.getByRole('button', { name: /제작 도구로/ }).click();
  await page.waitForTimeout(400);
  assert.equal(
    await page.evaluate(() => location.hash),
    shared,
    '제작 도구로 이동했더니 공유 상태가 사라졌다'
  );

  // 구조적 방어. 페이지 안 이동을 해시 앵커로 되돌리면 같은 결함이 다시 난다.
  assert.equal(
    await page.locator('a[href^="#"]').count(),
    0,
    '페이지 안 이동에 해시 앵커가 다시 생겼다 — 공유 상태를 덮어쓴다'
  );

  // 실제로 열리는 링크인지까지 확인한다. 주소만 맞고 복원이 안 되면 소용없다.
  const reopened = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await reopened.goto(server.url + shared, { waitUntil: 'networkidle' });
    await reopened.waitForSelector('canvas');
    assert.equal(
      await reopened.locator('#text-input').inputValue(),
      '오늘도 무사히',
      '공유 링크를 열었는데 문구가 복원되지 않았다'
    );
  } finally {
    await reopened.close();
  }
});

/** 아직 흐린(드러나지 않은) 요소들. */
const stillHidden = (target) =>
  target.evaluate(() =>
    [...document.querySelectorAll('[data-reveal]')]
      .filter((el) => parseFloat(getComputedStyle(el).opacity) < 0.99)
      .map((el) => String(el.className).trim().slice(0, 24) || el.tagName)
  );

/*
 * 드러나 있어야 하는데 흐린 요소들.
 *
 * "화면에 조금이라도 걸쳤으면" 이 아니라 **"드러나기 기준선을 넘었으면"** 을
 * 본다. scrollReveal 은 요소가 화면 바닥에서 10% 올라온 뒤에 드러내므로,
 * 맨 아래 10% 띠는 아직 들어오는 중인 구간이다. 거기서 흐린 것은 결함이
 * 아니라 효과 자체다.
 *
 * 그 위쪽 — 실제로 읽는 영역 — 에서 흐린 것이 있으면 결함이다.
 */
const fadedAfterCue = (target) =>
  target.evaluate(() =>
    [...document.querySelectorAll('[data-reveal]')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const pastCue = r.bottom > 0 && r.top < window.innerHeight * 0.9;
        return pastCue && parseFloat(getComputedStyle(el).opacity) < 0.99;
      })
      .map((el) => String(el.className).trim().slice(0, 24) || el.tagName)
  );

/*
 * 전환이 끝나기를 기다리는 시간.
 * opacity/transform 이 560ms, 묶음 안에서 최대 3단계 × 80ms 만큼 늦춰진다.
 * 진행 중인 값을 재면 당연히 중간이라 판정이 흔들린다.
 */
const SETTLE_MS = 900;

test('스크롤을 내리는 동안 모든 서사 요소가 한 번씩 드러난다', async () => {
  // 오르내릴 때마다 다시 나타나는 방식이라, 특정 시점에 무엇이 숨어 있는지는
  // 의미가 없다 — 맨 아래에서 위쪽 문단이 되돌아가 있는 것은 의도한 동작이다.
  // 대신 훑고 지나가는 동안 **모든 요소가 적어도 한 번은 드러났는지** 본다.
  // 하나라도 끝내 드러나지 않으면 그 문단은 영영 읽을 수 없다.
  const total = await page.evaluate(() => document.querySelectorAll('[data-reveal]').length);
  assert.ok(total > 0, '드러낼 대상이 하나도 없다 — 표시가 빠졌다');

  const everRevealed = new Array(total).fill(false);
  const height = await page.evaluate(() => document.body.scrollHeight);

  for (let y = 0; y < height; y += 400) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(180);
    const now = await page.evaluate(() =>
      [...document.querySelectorAll('[data-reveal]')].map((el) => el.classList.contains('is-revealed'))
    );
    now.forEach((on, i) => { if (on) everRevealed[i] = true; });
  }

  const never = everRevealed
    .map((seen, i) => (seen ? null : i))
    .filter((i) => i !== null);
  assert.deepEqual(never, [], `끝까지 훑었는데 한 번도 드러나지 않은 요소가 있다: ${never.join(', ')}번째`);
});

test('스크롤하는 내내 읽는 영역의 글이 흐려지지 않는다', async () => {
  // 나타나는 기준과 사라지는 기준이 같으면 그 경계에서 보고 있는 글이
  // 눈앞에서 흐려진다. 아래로 훑고 위로 훑으며 매 지점에서 확인한다.
  // 이 검사가 두 기준을 분리해 둔 이유 자체를 지킨다.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(SETTLE_MS);

  const height = await page.evaluate(() => document.body.scrollHeight);
  const stops = [];
  for (let y = 0; y < height; y += 700) stops.push(y);

  const problems = [];
  for (const dir of ['down', 'up']) {
    for (const y of dir === 'down' ? stops : [...stops].reverse()) {
      await page.evaluate((to) => window.scrollTo(0, to), y);
      await page.waitForTimeout(SETTLE_MS);
      const faded = await fadedAfterCue(page);
      if (faded.length) problems.push(`${dir} @${y}px — ${faded.join(', ')}`);
    }
  }
  assert.deepEqual(problems, [], `드러났어야 하는데 흐린 지점:\n  ${problems.join('\n  ')}`);
});

test('동작 줄이기에서는 처음부터 다 보인다', async () => {
  // 표시(data-reveal-ready)를 붙이지 않으므로 숨기는 규칙 자체가 걸리지
  // 않아야 한다. 여기서 흐린 것이 있으면 그 사용자는 본문을 못 본다.
  const calm = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  try {
    await calm.goto(server.url, { waitUntil: 'networkidle' });
    await calm.waitForSelector('canvas');
    await calm.waitForTimeout(400);
    assert.equal(
      await calm.evaluate(() => document.documentElement.hasAttribute('data-reveal-ready')),
      false,
      '동작 줄이기인데 드러내기가 켜졌다'
    );
    const left = await stillHidden(calm);
    assert.deepEqual(left, [], `동작 줄이기에서 흐린 채 남은 것이 있다: ${left.join(', ')}`);
  } finally {
    await calm.close();
  }
});

test('첫 화면에서 스크롤 없이 사진과 문구를 바꿀 수 있다', async () => {
  // 과제 통과 기준 T03-C03 — 이미지 편집 도구와 문구 편집 도구가 첫 화면에
  // 보여야 한다. 첫 화면을 랜딩으로 만들면서 한때 편집 도구가 3,500px
  // 아래로 밀려 이 기준이 깨져 있었다. 화면 폭에 따라 다시 밀릴 수 있으므로
  // 좁은 화면까지 함께 본다.
  //
  // '보인다' 로 끝내지 않는다. 바로가기 링크를 놓아도 보이기는 하므로,
  // 여기서 바꾼 것이 실제 편집 상태에 반영되는지까지 확인해야 진짜 도구다.
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const fresh = await browser.newPage({ viewport });
    try {
      await fresh.goto(server.url, { waitUntil: 'networkidle' });
      await fresh.waitForSelector('canvas');
      await fresh.waitForTimeout(400);

      const hidden = await fresh.evaluate(() =>
        [
          ['이미지 편집 도구', '.hero-quick .dropzone'],
          ['문구 편집 도구', '.hero-quick textarea'],
        ]
          .filter(([, sel]) => {
            const el = document.querySelector(sel);
            if (!el) return true;
            const b = el.getBoundingClientRect();
            return !(b.top < window.innerHeight && b.bottom > 0 && b.width > 0);
          })
          .map(([label]) => label)
      );
      assert.deepEqual(
        hidden,
        [],
        `${viewport.width}px 첫 화면에서 스크롤해야 보이는 도구: ${hidden.join(', ')}`
      );

      // 같은 상태를 쓰는 진짜 도구인지.
      await fresh.locator('.hero-quick textarea').fill('첫 화면 편집');
      await fresh.waitForTimeout(400);
      assert.equal(
        await fresh.locator('#text-input').inputValue(),
        '첫 화면 편집',
        `${viewport.width}px 첫 화면 입력이 편집 상태에 반영되지 않았다`
      );
      assert.match(
        await fresh.locator('.canvas-frame canvas').getAttribute('aria-label'),
        /첫 화면 편집/,
        `${viewport.width}px 첫 화면 입력이 미리보기에 그려지지 않았다`
      );
    } finally {
      await fresh.close();
    }
  }
});

test('첫 화면의 주 행동은 하나다', async () => {
  // 예전에는 Hero 버튼과 Scanner CTA 가 둘 다 '바로 짤 만들기' 라고 적혀
  // 있고 색까지 같아서, 무엇이 다른지 화면에서 알 수 없었다.
  // 채워진 버튼은 시대를 고르는 쪽 하나여야 한다.
  //
  // 재기 전에 마우스를 치운다. hover 한 버튼은 강조색으로 채워지는 것이
  // 정상인데, 앞선 검사가 눌러 둔 자리에 커서가 남아 있으면 그것까지
  // '채워진 버튼' 으로 세어 이 검사가 실행 순서에 따라 흔들린다.
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  const filled = await page.locator('.masthead button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const parts = getComputedStyle(button).backgroundColor.match(/[\d.]+/g).map(Number);
        const opaque = parts.length < 4 || parts[3] > 0.9;
        const pale = parts[0] > 235 && parts[1] > 235 && parts[2] > 235;
        return opaque && !pale;
      })
      .map((button) => button.innerText.replace(/\s+/g, ' ').trim())
  );

  assert.equal(filled.length, 1, `첫 화면에 채워진 버튼이 ${filled.length}개다: ${filled.join(' / ')}`);
  assert.match(filled[0], /짤 만들기/, `주 행동이 시대 진입 CTA 가 아니다: ${filled[0]}`);
});
