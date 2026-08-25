import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

/** 접혀 있는 묶음을 펼친다. 이미 펼쳐져 있으면 그대로 둔다. */
const openGroup = async (title) => {
  const group = page.locator('details.group', { has: page.locator('.group-title', { hasText: title }) }).first();
  if (!(await group.evaluate((el) => el.open))) {
    await group.locator('summary').click();
    await page.waitForTimeout(120);
  }
  return group;
};

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
  await openGroup('색과 테두리');
  const transparent = page.locator('#transparent-bg');
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

test('2004 는 사진을 그 시절 화질로 바꾼다', async () => {
  // 사진을 올려야 의미가 있는 검사다. 배경색만으로는 화질 처리가 드러나지 않는다.
  await page.locator('input[type="file"]').first().setInputFiles('public/sample/landscape-1600x600.png');
  await page.waitForTimeout(700);
  await setRatio('1:1');
  await setPersona('친한 친구');

  /**
   * 캔버스 한가운데를 재서 그 시절 화질의 두 가지 특징을 숫자로 만든다.
   *
   * 가운데만 보는 이유는 2004 는 사진첩 칸 안에, 2026 은 화면 전체에
   * 사진이 들어가서 그렇다. 가운데는 두 경우 모두 사진이다.
   *
   * 색 가짓수로는 잴 수 없다. 화소를 각지게 만드는 방식이 아니라 부드럽게
   * 뭉개는 방식이라, 보간이 만들어 내는 중간색 때문에 오히려 늘어난다.
   */
  const photoStats = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const x = Math.round(canvas.width * 0.35);
      const y = Math.round(canvas.height * 0.35);
      const w = Math.round(canvas.width * 0.3);
      const h = Math.round(canvas.height * 0.2);
      const data = canvas
        .getContext('2d', { willReadFrequently: true })
        .getImageData(x, y, w, h).data;

      let sum = 0;
      let sumSquares = 0;
      let sumGreen = 0;
      let sumBlue = 0;
      const count = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const luma = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        sum += luma;
        sumSquares += luma * luma;
        sumGreen += data[i + 1];
        sumBlue += data[i + 2];
      }
      const mean = sum / count;
      return {
        // 밝기가 얼마나 퍼져 있는가. 대비를 낮추면 줄어든다.
        contrast: Math.sqrt(Math.max(0, sumSquares / count - mean * mean)),
        // 파랑이 초록보다 얼마나 강한가. 보라로 기울수록 커진다.
        purple: (sumBlue - sumGreen) / count,
      };
    });

  await setEra('2026');
  await page.waitForTimeout(150);
  const clean = await photoStats();
  const cleanPng = await exportedPng();

  await setEra('2004');
  await page.waitForTimeout(150);
  const aged = await photoStats();
  const agedPng = await exportedPng();

  assert.notEqual(agedPng.hash, cleanPng.hash, '2004 가 사진을 그대로 두었다');
  assert.ok(
    aged.contrast < clean.contrast * 0.85,
    `대비가 충분히 낮아지지 않았다: 2026 ${clean.contrast.toFixed(1)} → 2004 ${aged.contrast.toFixed(1)}`
  );
  assert.ok(
    aged.purple > clean.purple + 6,
    `보라 기울기가 충분하지 않다: 2026 ${clean.purple.toFixed(1)} → 2004 ${aged.purple.toFixed(1)}`
  );

  // 같은 설정으로 다시 그려도 같아야 한다. 노이즈에 고정 씨앗을 쓰기 때문이다.
  await setEra('2026');
  await page.waitForTimeout(150);
  await setEra('2004');
  await page.waitForTimeout(150);
  const again = await exportedPng();
  assert.equal(again.hash, agedPng.hash, '같은 설정인데 다시 그린 결과가 다르다');
});

test('이미지를 끌어다 놓으면 실제로 불러온다', async () => {
  // 끌어다 놓기는 보기에만 반응하고 실제로는 안 되는 경우가 흔하다.
  // 테두리 색이 아니라 캔버스가 바뀌는지로 확인한다.
  await setRatio('1:1');
  await setEra('2026');
  await page.locator('button', { hasText: '이미지 제거' }).first().click().catch(() => {});
  await page.waitForTimeout(200);

  const before = await exportedPng();

  const png = fs.readFileSync('public/sample/landscape-1600x600.png').toString('base64');
  await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const file = new File([bytes], 'dropped.png', { type: 'image/png' });
    const transfer = new DataTransfer();
    transfer.items.add(file);

    const zone = document.querySelector('.dropzone');
    zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
    zone.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
    zone.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
  }, png);
  await page.waitForTimeout(700);

  const after = await exportedPng();
  assert.notEqual(after.hash, before.hash, '끌어다 놓았는데 캔버스가 그대로다');

  // 파일 이름이 화면에 보여야 무엇이 올라갔는지 알 수 있다.
  const shown = await page.locator('.file-current').first().textContent();
  assert.match(shown, /dropped\.png/, `올린 파일 이름이 보이지 않는다: ${shown}`);

  // 끌던 표시는 놓은 뒤 사라져야 한다.
  assert.equal(await page.locator('.dropzone.is-dragging').count(), 0, '끌기 표시가 남아 있다');
});

test('좁은 화면에서 가로 스크롤이 생기지 않는다', async () => {
  // 화면 밖으로 숨긴 요소는 폭을 잃기 쉽다. 실제로 파일 입력을 감출 때
  // `input[type='file'] { width: 100% }` 가 이겨서 375px 로 삐져나갔고,
  // 모바일에 가로 스크롤이 생겼다.
  const narrow = await browser.newPage({ viewport: { width: 375, height: 812 } });
  try {
    await narrow.goto(server.url, { waitUntil: 'networkidle' });
    await narrow.waitForSelector('canvas');
    await narrow.waitForTimeout(300);

    const result = await narrow.evaluate(() => {
      const docWidth = document.documentElement.clientWidth;
      const overflowing = [];
      document.querySelectorAll('*').forEach((el) => {
        if (el.getBoundingClientRect().right > docWidth + 1) {
          const name = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
          overflowing.push(`${el.tagName.toLowerCase()}.${name}`);
        }
      });
      return {
        scrolls: document.documentElement.scrollWidth > docWidth,
        overflowing: [...new Set(overflowing)],
      };
    });

    assert.deepEqual(result.overflowing, [], '화면 밖으로 나간 요소가 있다');
    assert.equal(result.scrolls, false, '가로 스크롤이 생겼다');
  } finally {
    await narrow.close();
  }
});

test('접이식 묶음이 열리고 닫히며 요약이 현재 값을 보여 준다', async () => {
  // 편집 패널이 2,000px 가까이 길어서 자주 안 쓰는 항목을 접어 두었다.
  // 접힌 상태에서도 지금 값이 무엇인지는 요약으로 알 수 있어야 한다.
  const group = page
    .locator('details.group', { has: page.locator('.group-title', { hasText: '문구 배치' }) })
    .first();

  // 접혀 있으면 안쪽 조작은 보이지 않아야 한다.
  await group.evaluate((el) => { el.open = false; });
  await page.waitForTimeout(120);
  assert.equal(await page.locator('#font-size').isVisible(), false, '접혔는데 안쪽이 보인다');

  const before = await group.locator('.group-summary').textContent();
  assert.match(before, /px/, `요약에 현재 값이 없다: ${before}`);

  await group.locator('summary').click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#font-size').isVisible(), true, '펼쳤는데 안쪽이 안 보인다');

  // 값을 바꾸면 요약도 따라와야 한다. 접었을 때 옛 값이 남으면 오해를 준다.
  await page.locator('#font-size').fill('200');
  await page.waitForTimeout(200);
  const after = await group.locator('.group-summary').textContent();
  assert.notEqual(after, before, '값을 바꿨는데 요약이 그대로다');
  assert.match(after, /200px/, `요약이 새 값을 보여주지 않는다: ${after}`);
});

test('사진을 올린 뒤에도 모습을 바꾸면 눈에 띄게 달라진다', async () => {
  // 모습은 그동안 주로 배경색을 바꿨는데, 사진을 올리면 배경색이 보이지
  // 않는다. 사진 위에 문구를 얹는 것이 기본 사용법이라 정작 그때 모습이
  // 하는 일이 거의 없었다 — 세 모습의 픽셀 차이가 2~9% 였다.
  await page.locator('input[type="file"]').first().setInputFiles('public/sample/landscape-1600x600.png');
  await page.waitForTimeout(700);
  await setRatio('1:1');

  /** 캔버스를 성기게 훑어 온다. 전부 넘기면 느리다. */
  const sample = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const data = canvas
        .getContext('2d', { willReadFrequently: true })
        .getImageData(0, 0, canvas.width, canvas.height).data;
      const out = [];
      for (let i = 0; i < data.length; i += 32) out.push(data[i], data[i + 1], data[i + 2]);
      return out;
    });

  const difference = (a, b) => {
    let differing = 0;
    for (let i = 0; i < a.length; i += 1) if (Math.abs(a[i] - b[i]) > 12) differing += 1;
    return (100 * differing) / a.length;
  };

  for (const era of ['2004', '2012', '2026']) {
    const shots = {};
    for (const persona of ['기본', '소셜', '친한 친구']) {
      await setPersona(persona);
      await setEra(era);
      await page.waitForTimeout(200);
      shots[persona] = await sample();
    }

    const pairs = [
      ['기본', '소셜'],
      ['기본', '친한 친구'],
      ['소셜', '친한 친구'],
    ];
    for (const [a, b] of pairs) {
      const changed = difference(shots[a], shots[b]);
      assert.ok(
        changed > 3,
        `${era} 에서 ${a} 와 ${b} 가 거의 같다: ${changed.toFixed(1)}% 만 달라졌다`
      );
    }
  }
});

test('아홉 조합 모두 앱이 정한 가독성 기준을 넘는다', async () => {
  // 두 번 놓쳤다. 시대 재설계 때 기본+2012 가 1.1:1 이 됐고, 모습 받침을
  // 넣을 때 소셜/친한친구+2004 가 1.5~1.9:1 이 됐다. 둘 다 화면을 눈으로
  // 봐서 알았지 테스트가 잡아 주지 않았다.
  //
  // 앱에는 이미 실제 픽셀을 읽는 가독성 검사가 있다. 그 결과를 읽는다.
  await setRatio('1:1');

  const failures = [];
  for (const persona of ['기본', '소셜', '친한 친구']) {
    await setPersona(persona);
    for (const era of ['2004', '2012', '2026']) {
      await setEra(era);
      await page.waitForTimeout(200);

      const verdict = await page.evaluate(() => {
        const node = [...document.querySelectorAll('*')].find(
          (el) => el.children.length === 0 && /대비\s*[\d.]+:1/.test(el.textContent)
        );
        return node ? node.textContent.trim() : null;
      });

      assert.ok(verdict, `${persona}+${era}: 가독성 표시를 찾지 못했다`);
      if (/못 미칩니다/.test(verdict)) failures.push(`${persona}+${era} → ${verdict}`);
    }
  }

  assert.deepEqual(failures, [], `기준에 못 미치는 조합이 있다:\n  ${failures.join('\n  ')}`);
});
