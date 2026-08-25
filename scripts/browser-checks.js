/**
 * 브라우저에서만 확인할 수 있는 두 가지를 잰다.
 *
 * node 에는 진짜 Canvas 가 없다. 네이티브 canvas 나 헤드리스 브라우저를
 * 의존성으로 더하면 설치가 무거워지고 배포 CI 도 느려지므로, 단위 테스트는
 * 그리기 호출 기록까지만 검사한다 (`test/eraRender.test.js`). 진짜 픽셀은
 * 여기서 잰다.
 *
 * 쓰는 법 — 공개 주소나 개발 서버를 열고 브라우저 콘솔에 붙여 넣는다.
 *
 *   await cardStudioChecks()
 *
 * 두 가지를 확인한다.
 *
 * 1. safeArea — 9:16 안전 영역 가이드를 켠 PNG 와 끈 PNG 가 같은 바이트인가.
 *    가이드는 <canvas> 밖의 DOM 오버레이라서 같아야 한다.
 * 2. eraPixels — 시대별로 실제 픽셀이 정말 다른가. 그리기 호출이 달라도
 *    결과 픽셀은 같을 수 있으므로, 결과물로 직접 확인한다.
 */

window.cardStudioChecks = async function cardStudioChecks() {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const buttons = () => [...document.querySelectorAll('button')];
  const canvas = () => document.querySelector('canvas');

  const click = async (predicate, label) => {
    const button = buttons().find(predicate);
    if (!button) throw new Error(`버튼을 찾지 못했다: ${label}`);
    button.click();
    await wait(80);
  };

  /** 다운로드가 만드는 것과 같은 PNG 바이트. */
  const pngBytes = async () => {
    const blob = await new Promise((resolve) => canvas().toBlob(resolve, 'image/png'));
    return new Uint8Array(await blob.arrayBuffer());
  };

  const sha256 = async (bytes) => {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const setRatio = (ratio) =>
    click((b) => b.closest('.ratio-group') && b.textContent === ratio, `비율 ${ratio}`);
  const setPersona = (name) =>
    click((b) => b.className.includes('preset-button') && b.textContent.startsWith(name), name);
  const setEra = (era) =>
    click((b) => b.closest('.era-timeline') && b.textContent.startsWith(era), `시대 ${era}`);

  // ── 1. 안전 영역 가이드가 PNG 에 들어가는가 ────────────────────
  await setRatio('9:16');
  const guideButton = () => buttons().find((b) => /안전 영역 가이드/.test(b.textContent));
  if (guideButton().getAttribute('aria-pressed') === 'true') {
    await click((b) => /안전 영역 가이드/.test(b.textContent), '가이드 끄기');
  }

  const withoutGuide = await pngBytes();
  await click((b) => /안전 영역 가이드/.test(b.textContent), '가이드 켜기');
  const guideVisible = !!document.querySelector('.safe-area-guide');
  const withGuide = await pngBytes();
  await click((b) => /안전 영역 가이드/.test(b.textContent), '가이드 끄기');

  const [hashOff, hashOn] = await Promise.all([sha256(withoutGuide), sha256(withGuide)]);
  const safeArea = {
    가이드가_화면에_보였는가: guideVisible,
    PNG크기: `${withoutGuide.length} / ${withGuide.length}`,
    같은바이트: withoutGuide.length === withGuide.length && hashOff === hashOn,
    해시: hashOff.slice(0, 16),
  };

  // ── 2. 시대별 픽셀이 실제로 다른가 ──────────────────────────────
  const eraPixels = {};
  for (const persona of ['기본', '소셜', '친한 친구']) {
    await setPersona(persona);
    const hashes = {};
    for (const era of ['2004', '2012', '2026']) {
      await setEra(era);
      hashes[era] = (await sha256(await pngBytes())).slice(0, 16);
    }
    const unique = new Set(Object.values(hashes)).size;
    eraPixels[persona] = { ...hashes, 서로다른시대: `${unique}/3` };
  }

  return { safeArea, eraPixels };
};

console.log('cardStudioChecks() 준비됨. await cardStudioChecks() 로 실행하세요.');
