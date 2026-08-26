/**
 * 스크롤을 내리는 동안 서사 요소를 하나씩 드러낸다.
 *
 * 이런 효과는 잘못 만들면 **글이 영영 보이지 않는** 사고가 난다. 세 가지를
 * 지킨다.
 *
 * 1. JS 가 돌지 않으면 아무것도 숨기지 않는다.
 *    CSS 에 곧바로 opacity: 0 을 적어 두면, 스크립트가 실패하거나 아직
 *    오지 않은 순간에 본문이 빈 화면이 된다. 그래서 숨기는 규칙은 이 함수가
 *    직접 붙이는 표시(data-reveal-ready) 아래에서만 적용되게 했다. 표시를
 *    붙이는 주체가 곧 표시를 풀 수 있는 주체다.
 *
 * 2. 동작 줄이기를 켠 사용자에게는 아예 켜지 않는다.
 *    표시를 붙이지 않고 그대로 돌아가므로 숨기는 규칙 자체가 적용되지
 *    않는다. 흐려졌다 나타나는 대신 처음부터 전부 보인다.
 *
 * 3. 화면에 보이는 동안에는 절대 숨기지 않는다.
 *    오르내릴 때마다 다시 나타나게 하려면 되돌릴 수 있어야 하는데, 나타나는
 *    기준과 사라지는 기준이 같으면 그 경계에서 **보고 있는 글이 눈앞에서
 *    흐려진다.** 화면 아래쪽에 걸친 문단이 지워지는 셈이다.
 *
 *    그래서 기준을 둘로 나눈다. 나타나는 쪽은 요소가 화면 바닥에서 10%쯤
 *    올라온 뒤에 시작하고, 사라지는 쪽은 요소가 화면 밖으로 **완전히**
 *    벗어났을 때만 되돌린다. 두 기준 사이에는 겹치는 구간이 있어서, 보이는
 *    동안에는 어떤 경우에도 흐려지지 않는다.
 *
 * @param {ParentNode} root 관찰 대상을 찾을 범위
 * @returns {() => void} 정리 함수
 */
export function startScrollReveal(root = document) {
  const noop = () => {};

  // 지원하지 않는 환경(구형 브라우저, 테스트 등)에서는 그냥 다 보이게 둔다.
  if (typeof IntersectionObserver === 'undefined') return noop;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return noop;

  const targets = root.querySelectorAll('[data-reveal]');
  if (targets.length === 0) return noop;

  /*
   * threshold 는 둘 다 0 이다. 비율로 잡으면 뷰포트보다 큰 요소에서 기준을
   * 영영 넘지 못할 수 있다 — 화면을 꽉 채워도 제 높이에 대한 비율은 작기
   * 때문이다.
   */

  // 나타나기: 화면 바닥에서 10% 올라온 뒤에 시작한다.
  const reveal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) entry.target.classList.add('is-revealed');
      }
    },
    { threshold: 0, rootMargin: '0px 0px -10% 0px' }
  );

  // 되돌리기: 화면 밖으로 완전히 벗어났을 때만. 여백을 두지 않는 것이 핵심이다.
  const conceal = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) entry.target.classList.remove('is-revealed');
      }
    },
    { threshold: 0, rootMargin: '0px' }
  );

  // 표시는 관찰을 실제로 시작하는 이 시점에만 붙인다. 위에서 하나라도
  // 걸러졌다면 여기까지 오지 않으므로 숨겨진 채 남는 요소가 없다.
  document.documentElement.setAttribute('data-reveal-ready', '');
  targets.forEach((target) => {
    reveal.observe(target);
    conceal.observe(target);
  });

  return () => {
    reveal.disconnect();
    conceal.disconnect();
    document.documentElement.removeAttribute('data-reveal-ready');
  };
}
