import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { startDistServer } from './server.js';

/**
 * 페이지 UI 의 대비 회귀 검사.
 *
 * 이 검사가 없어서 결함이 배포됐다. 캔버스 **안쪽** 문구는 렌더 직후 실제
 * 픽셀을 읽어 대비를 재고(checkTextContrast) 사용자에게 경고까지 띄우는데,
 * 정작 그 경고를 보여 주는 **페이지 UI 자체**는 아무도 재고 있지 않았다.
 * 그래서 배경이 어두운 색에서 아이보리로 바뀔 때 강조색 토큰이 따라오지
 * 않았고, 알림 배너·게시 전 확인·선택된 시대 캡션·패널 번호가 전부 2.0~3.4:1
 * 로 떨어진 채 나갔다.
 *
 * 두 가지를 잰다.
 *   - 글자 대비 (WCAG 1.4.3) — 보통 4.5:1, 큰 글자는 3:1
 *   - 컨트롤 경계와 포커스 표시 (WCAG 1.4.11) — 3:1
 *
 * 초기 화면만 훑으면 의미가 없다. 알림 배너는 무언가를 눌러야 나오고,
 * 경고 상태는 그 상태를 만들어야 나온다. 그래서 앱을 여러 상태로 몰아넣고
 * 각각에서 훑는다.
 */

/** WCAG 상대휘도. 알파가 섞인 색은 뒷배경 위에 합성한 뒤에 넘긴다. */
const AUDIT = `(() => {
  const parse = (c) => {
    const m = (c || '').match(/[\\d.]+/g);
    if (!m) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
  };
  const over = (f, b) => ({
    r: f.r * f.a + b.r * (1 - f.a),
    g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a),
    a: 1,
  });
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (x, y) => {
    const a = lum(x), b = lum(y);
    return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
  };
  const PAGE = parse(getComputedStyle(document.body).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };

  // 반투명 배경이 겹쳐 있으면 실제로 눈에 보이는 색은 아래 것들과 합성된
  // 결과다. 첫 번째 배경만 보고 판정하면 3.5% 짜리 옅은 틴트를 불투명한
  // 원색으로 착각한다.
  const realBg = (el) => {
    const stack = [];
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0) { stack.push(c); if (c.a === 1) break; }
      node = node.parentElement;
    }
    stack.push(PAGE);
    let acc = stack[stack.length - 1];
    for (let i = stack.length - 2; i >= 0; i -= 1) acc = over(stack[i], acc);
    return acc;
  };

  const label = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0, 2).join('.') : '';
    const text = (el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 24);
    return el.tagName.toLowerCase() + (cls ? '.' + cls : '') + (text ? ' "' + text + '"' : '');
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.opacity !== '0';
  };

  const text = [];
  const nonText = [];

  document.querySelectorAll('body *').forEach((el) => {
    // Scanner 프레임 안쪽은 2004 미니홈피 / 2012 피드 / 2026 숏폼 화면을
    // 그 시절 색으로 재현한 것이다. aria-hidden 장식이고, 여기에 현재
    // 팔레트 기준을 들이대면 시대 표현 자체가 사라진다.
    if (el.closest('.scanner-frame')) return;
    if (!visible(el)) return;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return;
    // 비활성 컨트롤은 1.4.3 면제 대상이다.
    if (el.disabled || el.closest('[disabled]')) return;

    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) return;
    const bg = realBg(el);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight, 10) >= 700);
    const need = large ? 3 : 4.5;
    const got = ratio(over(fg, bg), bg);
    if (got < need) text.push({ what: label(el), size: cs.fontSize, got, need });
  });

  // 1.4.11 — 조작 가능한 것의 경계. 테두리는 '바깥' 면과 구분되어야 한다.
  document.querySelectorAll('input:not([type=range]):not([type=color]), textarea, select').forEach((el) => {
    if (!visible(el) || el.disabled) return;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.borderTopWidth) === 0 || cs.borderTopStyle === 'none') return;
    const border = parse(cs.borderTopColor);
    if (!border || border.a === 0) return;
    const outside = realBg(el.parentElement);
    const got = ratio(over(border, outside), outside);
    if (got < 3) nonText.push({ what: label(el) + ' (테두리)', got, need: 3 });
  });

  return { text, nonText };
})()`;

let server;
let browser;
let page;

/** 애니메이션 중간값을 재지 않도록 전환을 끈다. 판정이 실행마다 흔들리면 안 된다. */
const freeze = (target) =>
  target.addStyleTag({
    content: '*, *::before, *::after { transition: none !important; animation: none !important; }',
  });

async function audit(target, where) {
  const { text, nonText } = await target.evaluate(AUDIT);
  const lines = [
    ...text.map((f) => `  [글자 ${f.size}] ${f.what} — ${f.got}:1 (필요 ${f.need})`),
    ...nonText.map((f) => `  [경계] ${f.what} — ${f.got}:1 (필요 ${f.need})`),
  ];
  assert.equal(
    lines.length,
    0,
    `${where} 에서 대비 미달 ${lines.length}건:\n${lines.join('\n')}`
  );
}

before(async () => {
  server = await startDistServer();
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(server.url, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas');
  await freeze(page);
});

after(async () => {
  await browser?.close();
  await server?.close();
});

test('첫 화면의 모든 글자가 읽힌다', async () => {
  await audit(page, '첫 화면');
});

test('알림 배너와 선택 상태가 읽힌다', async () => {
  // 알림은 이 앱의 유일한 피드백 통로인데 무언가를 눌러야만 나온다.
  // 가만히 있는 화면만 훑으면 영영 검사되지 않는다.
  await page.getByRole('button', { name: /2026로 짤 만들기/ }).click();
  await page.waitForSelector('.notice');
  await audit(page, '시대 진입 알림');

  await page.locator('.era-timeline button', { hasText: '2004' }).click();
  await page.waitForTimeout(150);
  await audit(page, '2004 선택 + 알림');

  await page.locator('.preset-grid .preset-button').nth(1).click();
  await page.waitForTimeout(150);
  await audit(page, '소셜 모습 선택');
});

test('펼친 편집 컨트롤과 대비 안내가 읽힌다', async () => {
  // 접혀 있는 묶음 안에 색·테두리 조작과 가독성 안내가 들어 있다.
  await page.locator('details.group').evaluateAll((groups) => groups.forEach((g) => { g.open = true; }));
  await page.waitForTimeout(200);
  await audit(page, '편집 컨트롤 펼침');
});

test('경고 상태가 읽힌다', async () => {
  // 통과 표시만 검사하면 경고 색은 한 번도 재지 않는다.
  // 아주 긴 문구를 넣어 자동 축소 경고를 띄운다.
  await page.locator('#text-input').fill('가나다라마바사아자차카타파하'.repeat(12));
  await page.locator('.ratio-group button', { hasText: '9:16' }).click();
  await page.waitForTimeout(300);
  assert.ok(
    (await page.locator('.ready-check li.warn').count()) > 0,
    '경고 상태를 만들지 못해 경고 색을 검사하지 못했다'
  );
  await audit(page, '9:16 + 경고 상태');

  await page.getByRole('button', { name: /안전 영역 가이드 보기/ }).click();
  await page.waitForTimeout(150);
  await audit(page, '안전 영역 가이드');
});

test('좁은 화면에서도 모든 글자가 읽힌다', async () => {
  // 좁은 화면에서만 나타나는 조작이 있다(플로팅 미리보기 전환 등).
  const narrow = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await narrow.goto(server.url, { waitUntil: 'networkidle' });
    await narrow.waitForSelector('canvas');
    await freeze(narrow);
    await audit(narrow, '390px 첫 화면');

    await narrow.getByRole('button', { name: '편집하며 보기' }).click();
    await narrow.waitForTimeout(200);
    await audit(narrow, '390px 플로팅 미리보기');
  } finally {
    await narrow.close();
  }
});

test('포커스 표시가 어디에서나 보인다', async () => {
  // 포커스 링은 1.4.11 대상이라 뒷면과 3:1 이상이어야 한다.
  // 예전 값(#67bce5)은 아이보리 위에서 1.87:1 이었다 — 사실상 안 보였다.
  //
  // 규칙을 읽지 않고 실제로 Tab 을 눌러 확인한다. :focus-visible 은 입력
  // 방식에 따라 켜지고, outline 단축 속성 안에 var() 가 있으면 CSSOM 이
  // outlineColor 를 분해해 주지도 않는다. 눌러 보는 쪽이 정확하다.
  const weak = [];
  const seen = new Set();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.wordmark').focus();

  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press('Tab');
    const probe = await page.evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      if (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) === 0) {
        return { skip: true, tag: el.tagName };
      }
      const parse = (c) => { const m = (c||'').match(/[\\d.]+/g); return m ? { r:+m[0], g:+m[1], b:+m[2], a: m.length>3?+m[3]:1 } : null; };
      const over = (f,b) => ({ r:f.r*f.a+b.r*(1-f.a), g:f.g*f.a+b.g*(1-f.a), b:f.b*f.a+b.b*(1-f.a), a:1 });
      const lum = (c) => { const f=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);}; return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b); };
      const ratio = (x,y) => { const a=lum(x), b=lum(y); return Math.round(((Math.max(a,b)+0.05)/(Math.min(a,b)+0.05))*100)/100; };
      const PAGE = parse(getComputedStyle(document.body).backgroundColor);
      // 링은 요소 '바깥' 에 그려지므로 뒷면은 부모 쪽 면이다.
      const bgOf = (start) => {
        const st=[]; let n=start;
        while (n && n !== document.documentElement) { const c=parse(getComputedStyle(n).backgroundColor); if (c&&c.a>0){st.push(c); if(c.a===1)break;} n=n.parentElement; }
        st.push(PAGE);
        let acc=st[st.length-1];
        for (let i=st.length-2;i>=0;i-=1) acc=over(st[i],acc);
        return acc;
      };
      const bg = bgOf(el.parentElement || document.body);
      const ring = parse(cs.outlineColor);
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\\s+/).slice(0,2).join('.') : '';
      return {
        what: el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' "' + (el.innerText||el.value||'').trim().replace(/\\s+/g,' ').slice(0,20) + '"',
        got: ratio(over(ring, bg), bg),
      };
    })()`);

    if (!probe || probe.skip) continue;
    if (seen.has(probe.what)) continue;
    seen.add(probe.what);
    if (probe.got < 3) weak.push(probe);
  }

  assert.ok(seen.size > 5, `Tab 으로 도달한 컨트롤이 ${seen.size}개뿐이다 — 검사가 성립하지 않는다`);
  assert.equal(
    weak.length,
    0,
    `포커스 표시가 보이지 않는 컨트롤 ${weak.length}개:\n${weak.map((r) => `  ${r.what} — ${r.got}:1 (필요 3)`).join('\n')}`
  );
});
