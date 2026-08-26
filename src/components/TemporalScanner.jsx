import { useMemo, useRef, useState } from 'react';
import timelinePortrait from '../../배너이미지/짤스튜디오.avif';

const STOPS = [
  {
    progress: 0,
    year: 2004,
    ratio: '1:1',
    label: 'MEMORY',
    title: '오늘도 나답게\n행복하기 ✦',
    meta: ['TIME INDEX 001', 'VISITOR 0217', 'ONLINE'],
  },
  {
    progress: 0.5,
    year: 2012,
    ratio: '4:5',
    label: 'FEED',
    title: '#daily #mood\njust the way i am',
    meta: ['POST 002', 'FILTER / SOFT', '12:04 PM · SEOUL'],
  },
  {
    progress: 1,
    year: 2026,
    ratio: '9:16',
    label: 'SIGNAL',
    title: 'UNFILTERED\nVERSION OF ME',
    meta: ['ERA / 2026', 'IDENTITY / LIVE', 'FORMAT / VERTICAL'],
  },
];

const clamp = (value) => Math.min(1, Math.max(0, value));
const nearestStop = (progress) =>
  STOPS.reduce((nearest, stop) =>
    Math.abs(stop.progress - progress) < Math.abs(nearest.progress - progress)
      ? stop
      : nearest
  );

function continuousYear(progress) {
  if (progress <= 0.5) return 2004 + (progress / 0.5) * 8;
  return 2012 + ((progress - 0.5) / 0.5) * 14;
}

function frameRatio(progress) {
  if (progress <= 0.5) return 1 - (progress / 0.5) * 0.2;
  return 0.8 - ((progress - 0.5) / 0.5) * 0.2375;
}

export default function TemporalScanner({ onEnterEra }) {
  const [progress, setProgress] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [locked, setLocked] = useState(true);
  const scannerRef = useRef(null);
  const selected = nearestStop(progress);
  const year = continuousYear(progress);
  const phase = progress <= 0.5 ? 0 : 1;
  const localProgress = phase === 0 ? progress * 2 : (progress - 0.5) * 2;
  const fromStop = STOPS[phase];
  const toStop = STOPS[phase + 1];
  const transitionDuration = { 2004: '480ms', 2012: '360ms', 2026: '240ms' }[selected.year];
  const style = useMemo(
    () => ({
      '--time-progress': progress,
      '--time-position': `${localProgress * 100}%`,
      '--reveal-right': `${(1 - localProgress) * 100}%`,
      '--scanner-transition': transitionDuration,
      aspectRatio: frameRatio(progress),
    }),
    [localProgress, progress, transitionDuration]
  );

  const moveToPointer = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    setProgress(clamp((event.clientX - rect.left) / rect.width));
    setLocked(false);
  };

  const snap = () => {
    const stop = nearestStop(progress);
    setProgress(stop.progress);
    setDragging(false);
    setLocked(true);
  };

  const handlePointerDown = (event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    moveToPointer(event);
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    moveToPointer(event);
  };

  const handleKeyDown = (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setLocked(false);
    setProgress((current) => {
      if (event.key === 'Home') return 0;
      if (event.key === 'End') return 1;
      return clamp(current + (event.key === 'ArrowRight' ? 0.025 : -0.025));
    });
  };

  return (
    <section className={`temporal-scanner${dragging ? ' is-dragging' : ''}`} aria-label="Temporal Scanner">
      <div className="scanner-readout" aria-live="polite">
        <span>TIME INDEX</span>
        <strong>{year.toFixed(2)}</strong>
        <small>
          {locked
            ? 'TIME LOCKED · YOU ARE HERE'
            : `SCANNING ${fromStop.year} → ${toStop.year}`}
        </small>
      </div>

      <div
        ref={scannerRef}
        className="scanner-frame"
        style={style}
        role="slider"
        tabIndex="0"
        aria-label="시대 탐색"
        aria-valuemin="2004"
        aria-valuemax="2026"
        aria-valuenow={Math.round(year)}
        aria-valuetext={`${year.toFixed(2)}년, 가장 가까운 시대 ${selected.year}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={snap}
        onPointerCancel={snap}
        onKeyDown={handleKeyDown}
        onKeyUp={snap}
        onBlur={snap}
      >
        <div className={`scanner-era scanner-era-2004 ${phase === 0 ? 'is-base' : 'is-hidden'}`} aria-hidden="true">
          <div className="scanner-window-chrome"><i /><i /><i /><span>my room.jpg</span></div>
          <div className="scanner-person has-banner-image" style={{ backgroundImage: `url(${timelinePortrait})` }}><i /></div>
          <p>오늘도 나답게<br />행복하기 ✦</p>
          <small>mini room / online</small>
        </div>
        <div className={`scanner-era scanner-era-2012 ${phase === 0 ? 'is-reveal' : 'is-base'}`} aria-hidden="true">
          <div className="scanner-person has-banner-image" style={{ backgroundImage: `url(${timelinePortrait})` }}><i /></div>
          <p>#daily #mood<br />just the way i am</p>
          <small>12:04 PM · SEOUL</small>
        </div>
        <div className={`scanner-era scanner-era-2026 ${phase === 1 ? 'is-reveal' : 'is-hidden'}`} aria-hidden="true">
          <span className="live-tag">● LIVE</span>
          <div className="scanner-person has-banner-image" style={{ backgroundImage: `url(${timelinePortrait})` }}><i /></div>
          <p>UNFILTERED<br />VERSION OF ME</p>
          <small>ALTER / EGO 03</small>
        </div>

        <div
          className="time-cut"
          data-edge={localProgress < 0.15 ? 'start' : localProgress > 0.85 ? 'end' : 'middle'}
          aria-hidden="true"
        >
          <span>TIME CUT</span>
        </div>
        <span className="drag-cue" aria-hidden="true">◀ DRAG TIME ▶</span>
      </div>

      <div className="scanner-controls">
        <div className="scanner-timeline" aria-label="대표 시대 선택">
          {STOPS.map((stop) => (
            <button
              key={stop.year}
              type="button"
              className={selected.year === stop.year && locked ? 'is-current' : ''}
              aria-pressed={selected.year === stop.year && locked}
              onClick={() => {
                setProgress(stop.progress);
                setLocked(true);
              }}
            >
              <strong>{stop.year}</strong>
              <span>{stop.label}</span>
            </button>
          ))}
        </div>
        <div className="scanner-selection">
          <p>{selected.title.split('\n').map((line) => <span key={line}>{line}</span>)}</p>
          <small>{selected.ratio} FORMAT · {selected.meta.join(' · ')}</small>
        </div>
        <button type="button" className="scanner-enter" onClick={() => onEnterEra(selected.year.toString())}>
          {selected.year}로 짤 만들기 <span>↗</span>
        </button>
      </div>
    </section>
  );
}

export { STOPS as TEMPORAL_STOPS, continuousYear, frameRatio, nearestStop };
