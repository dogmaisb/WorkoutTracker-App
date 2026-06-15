import { useBackground } from '../useBackground';
import React, { useState, useEffect, useRef } from 'react';

// - Audio Engine -
// Uses Web Speech API for voice + Web Audio API for beeps
// All audio is created on demand so no files needed

function getAudioContext() {
  if (!window._audioCtx) {
    window._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return window._audioCtx;
}

function playBeep(freq = 880, duration = 0.12, delay = 0) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'sine';
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.4, start + 0.01);
    gain.gain.linearRampToValueAtTime(0, start + duration);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  } catch(e) {}
}

function playDoubleBeep() {
  // Two short high beeps — 5 second warning
  playBeep(1100, 0.10, 0);
  playBeep(1100, 0.10, 0.18);
}

function speak(text, onEnd) {
  try {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    // Find a mature English (British) voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = [
      'Google UK English Male',
      'Microsoft George - English (United Kingdom)',
      'Daniel',
      'Arthur',
      'Google UK English Female',
    ];
    let voice = null;
    for (const name of preferred) {
      voice = voices.find(v => v.name === name);
      if (voice) break;
    }
    if (!voice) {
      // fallback: any en-GB voice
      voice = voices.find(v => v.lang === 'en-GB');
    }
    if (!voice) {
      // fallback: any English voice
      voice = voices.find(v => v.lang && v.lang.startsWith('en'));
    }
    if (voice) utt.voice = voice;
    utt.lang = 'en-GB';
    utt.rate = 0.88;
    utt.pitch = 0.9;
    utt.volume = 1.0;
    if (onEnd) utt.onend = onEnd;
    window.speechSynthesis.speak(utt);
  } catch(e) {}
}

function playCountdownThenCue() {
  playBeep(660, 0.15, 0);    // 3
  playBeep(660, 0.15, 1.0);  // 2
  playBeep(660, 0.15, 2.0);  // 1
  playBeep(1100, 0.25, 3.0); // Go / Rest cue
}

// - helpers -
// Prevents screen from auto-locking while a timer is active
function useWakeLock(active) {
  const lockRef = useRef(null);
  useEffect(() => {
    if (!navigator.wakeLock) return;
    if (active) {
      navigator.wakeLock.request('screen')
        .then(lock => { lockRef.current = lock; })
        .catch(() => {});
    } else {
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    }
    return () => { lockRef.current?.release().catch(() => {}); lockRef.current = null; };
  }, [active]);
}

function fmtCountdown(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
function fmtMs(ms) {
  const s  = Math.floor(ms / 1000);
  const m  = Math.floor(s / 60);
  const ds = Math.floor((ms % 1000) / 100);
  return `${m}:${(s % 60).toString().padStart(2,'0')}.${ds}`;
}

// ── Push Notifications ────────────────────────────────────────────────────────
function notifSupported() { return typeof Notification !== 'undefined'; }

async function ensureNotifPermission() {
  if (!notifSupported()) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

function sendNotif(title, body) {
  if (!notifSupported() || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body,
      icon: '/WorkoutTracker-App/logo192.png',
      badge: '/WorkoutTracker-App/logo192.png',
      vibrate: [200, 100, 200],
    });
  } catch(e) {}
}

const REST_PRESETS = [30, 60, 90, 120, 180, 300];
const INT_PRESETS = [
  { name:'Tabata',    work:20, rest:10, rounds:8,  warmup:10 },
  { name:'EMOM 1min', work:45, rest:15, rounds:10, warmup:10 },
  { name:'30/30',     work:30, rest:30, rounds:10, warmup:10 },
  { name:'40/20',     work:40, rest:20, rounds:8,  warmup:10 },
  { name:'20/10 x6',  work:20, rest:10, rounds:6,  warmup:10 },
  { name:'1min/1min', work:60, rest:60, rounds:8,  warmup:15 },
];

// - Drum Picker -
const ITEM_H = 54;
const activeDial = { current: null }; // mutex: only one dial drags at a time

function DrumPicker({ value, max, label, onChange, disabled }) {
  const items        = Array.from({ length: max + 1 }, (_, i) => i);
  const containerRef = useRef(null);
  const offsetRef    = useRef(value * ITEM_H);
  const [offset, setOffset] = useState(value * ITEM_H);
  const dragRef   = useRef({ active:false, lastY:0, lastTime:0, velocity:0 });
  const animRef   = useRef(null);
  const wheelTimer = useRef(null);
  const extRef    = useRef(false);

  // Sync external value prop changes
  useEffect(() => {
    const target = value * ITEM_H;
    if (Math.abs(offsetRef.current - target) > 2) {
      extRef.current = true;
      animateTo(target, () => { extRef.current = false; });
    }
  }, [value]); // animateTo is stable (refs only)

  // Passive-false touchmove + document mousemove/mouseup
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchMove = (e) => {
      if (activeDial.current !== dragRef || disabled) return;
      e.preventDefault();
      applyMove(e.touches[0].clientY);
    };
    const onMouseMove = (e) => {
      if (activeDial.current !== dragRef || disabled) return;
      applyMove(e.clientY);
    };
    const onMouseUp = () => {
      if (activeDial.current !== dragRef) return;
      activeDial.current = null;
      dragRef.current.active = false;
      releaseInertia();
    };

    el.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [disabled]);

  function clampOff(v) { return Math.max(0, Math.min(max * ITEM_H, v)); }

  function applyMove(clientY) {
    const now = performance.now();
    const dt  = Math.max(1, now - dragRef.current.lastTime);
    const dy  = dragRef.current.lastY - clientY;
    dragRef.current.velocity = dy / dt;
    dragRef.current.lastY    = clientY;
    dragRef.current.lastTime = now;
    offsetRef.current = clampOff(offsetRef.current + dy);
    setOffset(offsetRef.current);
  }

  function releaseInertia() {
    let vel = dragRef.current.velocity * 18;
    const friction = 0.87;
    function inertia() {
      vel *= friction;
      if (Math.abs(vel) < 0.5) { snapToNearest(); return; }
      const next = clampOff(offsetRef.current + vel);
      if (next === offsetRef.current) { snapToNearest(); return; }
      offsetRef.current = next;
      setOffset(next);
      animRef.current = requestAnimationFrame(inertia);
    }
    requestAnimationFrame(inertia);
  }

  function animateTo(target, onDone) {
    cancelAnimationFrame(animRef.current);
    const from = offsetRef.current;
    const dist = target - from;
    if (Math.abs(dist) < 0.5) { offsetRef.current = target; setOffset(target); if (onDone) onDone(); return; }
    const dur = Math.min(380, Math.max(120, Math.abs(dist) * 1.3));
    const t0  = performance.now();
    function step(now) {
      const p    = Math.min(1, (now - t0) / dur);
      const ease = 1 - Math.pow(1 - p, 3);
      offsetRef.current = from + dist * ease;
      setOffset(offsetRef.current);
      if (p < 1) { animRef.current = requestAnimationFrame(step); }
      else { offsetRef.current = target; setOffset(target); if (onDone) onDone(); }
    }
    animRef.current = requestAnimationFrame(step);
  }

  function snapToNearest() {
    const idx     = Math.round(offsetRef.current / ITEM_H);
    const clamped = Math.max(0, Math.min(max, idx));
    animateTo(clamped * ITEM_H, () => { if (!extRef.current) onChange(clamped); });
  }

  function startDrag(clientY) {
    if (disabled) return;
    cancelAnimationFrame(animRef.current);
    clearTimeout(wheelTimer.current);
    activeDial.current = dragRef;
    dragRef.current = { active:true, lastY:clientY, lastTime:performance.now(), velocity:0 };
  }

  function onTouchStart(e) { startDrag(e.touches[0].clientY); }
  function onTouchEnd()    { if (activeDial.current !== dragRef) return; activeDial.current = null; dragRef.current.active = false; releaseInertia(); }
  function onMouseDown(e)  { e.preventDefault(); startDrag(e.clientY); }

  function onWheel(e) {
    if (disabled) return;
    e.preventDefault();
    cancelAnimationFrame(animRef.current);
    clearTimeout(wheelTimer.current);
    offsetRef.current = clampOff(offsetRef.current + e.deltaY * 0.5);
    setOffset(offsetRef.current);
    wheelTimer.current = setTimeout(snapToNearest, 160);
  }

  const activeIdx = offset / ITEM_H;

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <div
        ref={containerRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        style={{
          position:'relative', height:ITEM_H*3, width:68,
          overflow:'hidden', borderRadius:12,
          touchAction:'none', userSelect:'none',
          cursor: disabled ? 'default' : 'ns-resize',
        }}
      >
        {/* top/bottom fades */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:ITEM_H, background:'linear-gradient(to bottom, #0a0a0a 20%, transparent)', zIndex:2, pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:ITEM_H, background:'linear-gradient(to top, #0a0a0a 20%, transparent)', zIndex:2, pointerEvents:'none' }}/>
        {/* center band */}
        <div style={{ position:'absolute', top:ITEM_H, left:2, right:2, height:ITEM_H, border:'1px solid #333', background:'rgba(255,255,255,0.03)', borderRadius:6, zIndex:1, pointerEvents:'none' }}/>
        {/* spinning list */}
        <div style={{
          position:'absolute', left:0, right:0, top:0,
          height:(max+1)*ITEM_H,
          transform:`translateY(${ITEM_H - offset}px)`,
          willChange:'transform',
        }}>
          {items.map(i => {
            const dist  = Math.abs(i - activeIdx);
            const close = dist < 0.6;
            return (
              <div key={i} style={{
                height:ITEM_H, display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:  close ? 40 : dist < 1.5 ? 26 : 20,
                fontWeight: close ? 700 : 400,
                color: `rgba(255,255,255,${close ? 1 : Math.max(0.08, 0.45 - dist * 0.2)})`,
                fontVariantNumeric:'tabular-nums',
                letterSpacing: close ? 1 : 0,
              }}>
                {String(i).padStart(2,'0')}
              </div>
            );
          })}
        </div>
      </div>
      <span style={{ fontSize:10, color:'#555', letterSpacing:2, textTransform:'uppercase', fontWeight:600 }}>{label}</span>
    </div>
  );
}

// - Rest Timer -
function RestTimer() {
  const [total,   setTotal]   = useState(90);
  const [remain,  setRemain]  = useState(90);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  useWakeLock(running);
  const [selH,    setSelH]    = useState(0);
  const [selM,    setSelM]    = useState(1);
  const [selS,    setSelS]    = useState(30);
  const selHRef = useRef(0);
  const selMRef = useRef(1);
  const selSRef = useRef(30);
  const ref = useRef(null);

  const pct       = total > 0 ? remain / total : 1;
  const r         = 80;
  const circ      = 2 * Math.PI * r;
  const offset    = circ * (1 - pct);
  const ringColor = pct > 0.5 ? '#ff6b4a' : pct > 0.2 ? '#d4a010' : '#cc4444';

  function setDial(h, m, s) {
    selHRef.current = h; selMRef.current = m; selSRef.current = s;
    setSelH(h); setSelM(m); setSelS(s);
    const t = h * 3600 + m * 60 + s;
    if (!t) return;
    clearInterval(ref.current); setRunning(false); setDone(false);
    setTotal(t); setRemain(t);
  }
  function toggle() {
    if (done) { setRemain(total); setDone(false); return; }
    if (!running) ensureNotifPermission();
    setRunning(r => !r);
  }
  function reset() { clearInterval(ref.current); setRunning(false); setDone(false); setRemain(total); }

  // Notify when timer is done
  useEffect(() => {
    if (done) sendNotif('Timer done! ✓', 'Your countdown has finished.');
  }, [done]);

  const endRef    = useRef(null);
  const remainRef = useRef(remain);
  useEffect(() => { remainRef.current = remain; }, [remain]);

  useEffect(() => {
    if (!running) { clearInterval(ref.current); endRef.current = null; return; }
    endRef.current = Date.now() + remainRef.current * 1000;
    function tick() {
      const r = Math.ceil((endRef.current - Date.now()) / 1000);
      if (r <= 0) { clearInterval(ref.current); setRunning(false); setDone(true); setRemain(0); endRef.current = null; return; }
      setRemain(r);
    }
    ref.current = setInterval(tick, 300);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(ref.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [running]);

  return (
    <div className="scroll" style={{ padding:'16px 20px' }}>
      <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-start', gap:4, marginBottom:20, visibility: (running || done) ? 'hidden' : 'visible' }}>
        <DrumPicker value={selH} max={23} label="HRS" disabled={running} onChange={h => setDial(h, selMRef.current, selSRef.current)} />
        <span style={{ color:'#333', fontSize:36, fontWeight:700, lineHeight:`${ITEM_H}px`, marginTop:ITEM_H, alignSelf:'flex-start' }}>:</span>
        <DrumPicker value={selM} max={59} label="MIN" disabled={running} onChange={m => setDial(selHRef.current, m, selSRef.current)} />
        <span style={{ color:'#333', fontSize:36, fontWeight:700, lineHeight:`${ITEM_H}px`, marginTop:ITEM_H, alignSelf:'flex-start' }}>:</span>
        <DrumPicker value={selS} max={59} label="SEC" disabled={running} onChange={s => setDial(selHRef.current, selMRef.current, s)} />
      </div>
      <div className="ring-container" style={{ position:'relative', width:190, height:190, margin:'0 auto 16px' }}>
        <svg className="ring-svg" width="190" height="190" viewBox="0 0 190 190">
          <circle cx="95" cy="95" r={r} fill="none" stroke="#333" strokeWidth="10"/>
          <circle cx="95" cy="95" r={r} fill="none" stroke={done?'#4db8ff':ringColor} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
            style={{ transition:'stroke-dashoffset 0.5s linear, stroke 0.3s' }}/>
        </svg>
        <div className="ring-label">
          <span className="time-big" style={{ color: done?'#4db8ff':'#e0e0e0', fontSize: remain >= 3600 ? 28 : 42 }}>
            {done ? '✓ Go!' : fmtCountdown(remain)}
          </span>
          <span className="time-sub">{running?'Resting...':done?'Next set!':'Ready'}</span>
        </div>
      </div>
      <div className="btn-row">
        <button className="btn-fde" style={{ flex:1 }} onClick={toggle}>
          {done?'↺ Again':running?'⏸ Pause':'▶ Start'}
        </button>
        <button className="btn-secondary" style={{ flex:1 }} onClick={reset}>↺ Reset</button>
      </div>
      <p style={{ fontSize:11, color:'#555', textAlign:'center', marginTop:10, lineHeight:1.5 }}>
        Tap Start after saving a set — timer counts down to your next set
      </p>
    </div>
  );
}

// - Analog Stopwatch Face -
function AnalogFace({ ms, lapMs }) {
  const SIZE = 345, cx = 172, cy = 172, R = 152;
  const secAngle = ((ms % 60000)     / 60000)   * 360;
  const minAngle = ((ms % 3600000)   / 3600000) * 360;
  const lapAngle = ((lapMs % 60000)  / 60000)   * 360;

  function polar(angleDeg, r, ocx = cx, ocy = cy) {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: ocx + r * Math.cos(rad), y: ocy + r * Math.sin(rad) };
  }

  const ticks = Array.from({ length: 60 }, (_, i) => i);
  const numLabels = [
    { label:'0',  angle:0   },
    { label:'15', angle:90  },
    { label:'30', angle:180 },
    { label:'45', angle:270 },
  ];

  const secTip  = polar(secAngle, R - 8);
  const secTail = polar(secAngle + 180, 16);
  const minTip  = polar(minAngle, R - 24);

  // Sub-dial: minutes counter (bottom-left), 30-min full rotation
  const sdR   = 32;
  const sdcx  = cx - R * 0.42;
  const sdcy  = cy + R * 0.42;
  const sdAng = ((ms % 1800000) / 1800000) * 360;
  const sdTip = polar(sdAng, sdR - 5, sdcx, sdcy);
  const sdTicks      = Array.from({ length: 6  }, (_, i) => i); // major: every 5 min
  const sdMinorTicks = Array.from({ length: 30 }, (_, i) => i); // minor: every 1 min

  // Milliseconds: bottom-right
  const mscx = cx + R * 0.42;
  const mscy = cy + R * 0.42;
  const msVal = String(ms % 1000).padStart(3, '0');

  return (
    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ display:'block', margin:'0 auto' }}>
      {/* face */}
      <circle cx={cx} cy={cy} r={R} fill="#0d0d0d" stroke="#2a2a2a" strokeWidth="2"/>

      {/* tick marks */}
      {ticks.map(i => {
        const isMajor = i % 5 === 0;
        const p1 = polar(i * 6, R);
        const p2 = polar(i * 6, isMajor ? R - 11 : R - 6);
        return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke={isMajor ? '#555' : '#2a2a2a'} strokeWidth={isMajor ? 2 : 1}/>;
      })}

      {/* labels */}
      {numLabels.map(({ label, angle }) => {
        const p = polar(angle, R - 24);
        return <text key={label} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
          fontSize="11" fill="#555" fontFamily="monospace" fontWeight="600">{label}</text>;
      })}

      {/* minute hand */}
      <line x1={cx} y1={cy} x2={minTip.x} y2={minTip.y}
        stroke="#888" strokeWidth="2.5" strokeLinecap="round"/>

      {/* second hand */}
      <line x1={secTail.x} y1={secTail.y} x2={secTip.x} y2={secTip.y}
        stroke="#ff3333" strokeWidth="1.5" strokeLinecap="round"/>

      {/* lap hand */}
      {lapMs > 0 && (() => {
        const lapTip  = polar(lapAngle, R - 8);
        const lapTail = polar(lapAngle + 180, 16);
        return <line x1={lapTail.x} y1={lapTail.y} x2={lapTip.x} y2={lapTip.y}
          stroke="#00ff88" strokeWidth="1.5" strokeLinecap="round"/>;
      })()}

      {/* minutes sub-dial (bottom left) */}
      <circle cx={sdcx} cy={sdcy} r={sdR} fill="#111" stroke="#333" strokeWidth="1.5"/>
      {sdMinorTicks.filter(i => i % 5 !== 0).map(i => {
        const a = i * 12;
        const p1 = polar(a, sdR, sdcx, sdcy);
        const p2 = polar(a, sdR - 3, sdcx, sdcy);
        return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#333" strokeWidth="1"/>;
      })}
      {sdTicks.map(i => {
        const minVal = i === 0 ? 30 : i * 5;
        const a = i * 60;
        const p1 = polar(a, sdR, sdcx, sdcy);
        const p2 = polar(a, sdR - 6, sdcx, sdcy);
        const lp = polar(a, sdR - 13, sdcx, sdcy);
        return <g key={i}>
          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#555" strokeWidth="1.5"/>
          <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central"
            fontSize="7" fill="#555" fontFamily="monospace">{minVal}</text>
        </g>;
      })}
      <line x1={sdcx} y1={sdcy} x2={sdTip.x} y2={sdTip.y} stroke="#aaa" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx={sdcx} cy={sdcy} r="2.5" fill="#555"/>

      {/* milliseconds counter (bottom right) */}
      <circle cx={mscx} cy={mscy} r={sdR} fill="#111" stroke="#333" strokeWidth="1.5"/>
      <circle cx={mscx} cy={mscy} r={sdR}
        fill="none" stroke="#4db8ff" strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={2 * Math.PI * sdR}
        strokeDashoffset={2 * Math.PI * sdR * (1 - (ms % 1000) / 1000)}
        transform={`rotate(-90, ${mscx}, ${mscy})`}/>
      <text x={mscx} y={mscy - 7} textAnchor="middle" dominantBaseline="central"
        fontSize="7" fill="#444" fontFamily="monospace">ms</text>
      <text x={mscx} y={mscy + 6} textAnchor="middle" dominantBaseline="central"
        fontSize="14" fill="#aaa" fontFamily="monospace" fontWeight="700">{msVal}</text>

      {/* center cap */}
      <circle cx={cx} cy={cy} r="4" fill="#ff3333"/>
      <circle cx={cx} cy={cy} r="2" fill="#111"/>
    </svg>
  );
}

// - Stopwatch -
function Stopwatch() {
  const [ms,       setMs]       = useState(0);
  const [running,  setRunning]  = useState(false);
  const [laps,     setLaps]     = useState([]);
  const [lapStart, setLapStart] = useState(0);
  const ref   = useRef(null);
  const msRef = useRef(0);
  useWakeLock(running);

  useEffect(() => {
    if (!running) { clearInterval(ref.current); return; }
    const start = Date.now() - msRef.current;
    function tick() { const n = Date.now() - start; msRef.current = n; setMs(n); }
    ref.current = setInterval(tick, 50);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(ref.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [running]);

  function toggle() { setRunning(r => !r); }
  function lap() {
    if (!running && ms===0) return;
    setLaps(prev => [...prev, { total:ms, split:ms-lapStart }]);
    setLapStart(ms);
  }
  function reset() {
    clearInterval(ref.current); setRunning(false);
    msRef.current=0; setMs(0); setLaps([]); setLapStart(0);
  }

  const bestSplit  = laps.length > 1 ? Math.min(...laps.map(l=>l.split)) : null;
  const worstSplit = laps.length > 1 ? Math.max(...laps.map(l=>l.split)) : null;

  return (
    <div className="scroll" style={{ padding:'8px 20px' }}>
      <AnalogFace ms={ms} lapMs={laps.length > 0 ? ms - lapStart : 0} />
      <div className="sw-display">{fmtMs(ms)}</div>
      <div className="btn-row" style={{ marginBottom:16 }}>
        <button className={running?'btn-green':'btn-fde'} style={{ flex:1 }} onClick={toggle}>
          {running?'⏸ Pause':'▶ Start'}
        </button>
        {!running && ms > 0
          ? <button className="btn-secondary" style={{ flex:1 }} onClick={reset}>↺ Reset</button>
          : <button className="btn-secondary" style={{ flex:1, opacity:ms===0&&!running?0.4:1 }}
              onClick={lap} disabled={ms===0&&!running}>⏱ Lap</button>
        }
      </div>
      {(running || ms > 0) && (
        <div className="lap-table">
          <div className="lap-header"><span>Lap</span><span>Split</span><span>Total</span></div>

          {/* Live current lap row */}
          {(running || ms > 0) && (
            <div className="lap-row-item" style={{ background:'#1a1a1a' }}>
              <span className="lap-num" style={{ color:'#4db8ff' }}>Lap {laps.length + 1}</span>
              <span className="lap-split" style={{ color:'#4db8ff' }}>{fmtMs(ms - lapStart)}</span>
              <span className="lap-total" style={{ color:'#4db8ff' }}>{fmtMs(ms)}</span>
            </div>
          )}

          {[...laps].reverse().map((l,i) => {
            const n = laps.length - i;
            return (
              <div key={n} className="lap-row-item">
                <span className="lap-num">Lap {n}</span>
                <span className={`lap-split${l.split===bestSplit?' best':l.split===worstSplit?' worst':''}`}>
                  {fmtMs(l.split)}
                </span>
                <span className="lap-total">{fmtMs(l.total)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// - Interval Timer -
function loadLastInterval() {
  try { return JSON.parse(localStorage.getItem('wt_last_interval')) || null; }
  catch { return null; }
}
function saveLastInterval(cfg) {
  localStorage.setItem('wt_last_interval', JSON.stringify(cfg));
}
function loadSavedIntervals() {
  try { return JSON.parse(localStorage.getItem('wt_saved_intervals')) || []; }
  catch { return []; }
}
function persistSavedIntervals(list) {
  localStorage.setItem('wt_saved_intervals', JSON.stringify(list));
}

function IntervalTimer() {
  const [cfg,            setCfg]            = useState({ work:40, rest:20, rounds:8, warmup:10 });
  const [lastTimer,      setLastTimer]      = useState(loadLastInterval);
  const [savedIntervals, setSavedIntervals] = useState(loadSavedIntervals);

  function saveInterval(t) {
    const updated = [...savedIntervals, t];
    persistSavedIntervals(updated);
    setSavedIntervals(updated);
  }
  function deleteInterval(i) {
    const updated = savedIntervals.filter((_,idx) => idx !== i);
    persistSavedIntervals(updated);
    setSavedIntervals(updated);
  }
  const [timer,     setTimer]     = useState({ phase:'idle', round:1, remain:0, phaseTotal:0 });
  const [paused,    setPaused]    = useState(false);
  const ref    = useRef(null);
  const cfgRef = useRef(cfg);
  const cuedRef = useRef({ warning:false, countdown:false });
  cfgRef.current = cfg;

  const { phase, round, remain, phaseTotal } = timer;
  const active = phase !== 'idle' && phase !== 'done';
  useWakeLock(active);

  function phaseMeta(p) {
    if (p==='warmup') return { label:'GET READY', color:'#6a9a6a', border:'#3a6a3a' };
    if (p==='work')   return { label:'WORK',      color:'#e8a030', border:'#ff6b4a' };
    if (p==='rest')   return { label:'REST',       color:'#4db8ff', border:'#4db8ff' };
    return { label:'', color:'#e0e0e0', border:'#333' };
  }

  function advance(p, r, c) {
    if (p==='warmup')              return { phase:'work', round:1,   remain:c.work, total:c.work };
    if (p==='work')                return { phase:'rest', round:r,   remain:c.rest, total:c.rest };
    if (p==='rest' && r>=c.rounds) return { phase:'done', round:r,   remain:0,      total:0      };
    return                                { phase:'work', round:r+1, remain:c.work, total:c.work };
  }

  function start() {
    try { getAudioContext().resume(); } catch(e) {}
    ensureNotifPermission();
    saveLastInterval(cfg);
    setLastTimer(cfg);
    setPaused(false);
    cuedRef.current = { warning:false, countdown:false };
    const p = cfg.warmup > 0 ? 'warmup' : 'work';
    const t = cfg.warmup > 0 ? cfg.warmup : cfg.work;
    setTimer({ phase:p, round:1, remain:t, phaseTotal:t });
  }

  // Notify when all rounds complete
  useEffect(() => {
    if (phase === 'done') sendNotif('Workout complete! 🏆', `${round} round${round !== 1 ? 's' : ''} finished. Great work!`);
  }, [phase]); // eslint-disable-line

  function stopTimer() {
    clearInterval(ref.current);
    setTimer({ phase:'idle', round:1, remain:0, phaseTotal:0 });
    setPaused(false);
    cuedRef.current = { warning:false, countdown:false };
  }

  function togglePause() {
    setPaused(p => !p);
  }

  const phaseEndRef  = useRef(null);
  const timerRef     = useRef(timer);
  timerRef.current   = timer;

  // Single persistent interval — restarts only when active/paused changes, NOT on phase change
  useEffect(() => {
    if (!active || paused) { clearInterval(ref.current); phaseEndRef.current = null; return; }

    // Set end time from current timer state (use ref for freshness)
    if (!phaseEndRef.current) {
      phaseEndRef.current = Date.now() + timerRef.current.remain * 1000;
    }

    function tick() {
      setTimer(s => {
        if (s.remain <= 0) return s;
        const now = Date.now();
        let newRemain = Math.ceil((phaseEndRef.current - now) / 1000);
        const c = cfgRef.current;

        // Cue sounds based on countdown
        if (newRemain === 5 && !cuedRef.current.warning) {
          cuedRef.current.warning = true;
          playDoubleBeep();
        }
        if (newRemain === 3 && !cuedRef.current.countdown) {
          cuedRef.current.countdown = true;
          playCountdownThenCue();
        }

        if (newRemain <= 0) {
          // Catch up through any phases skipped while backgrounded
          let cur = { ...s };
          let overshootMs = -phaseEndRef.current + now;
          while (overshootMs >= 0) {
            const next = advance(cur.phase, cur.round, c);
            cuedRef.current = { warning:false, countdown:false };
            if (next.phase === 'done' || next.remain === 0) {
              phaseEndRef.current = null;
              return { phase:next.phase, round:next.round, remain:0, phaseTotal:next.total };
            }
            overshootMs -= next.remain * 1000;
            cur = { phase:next.phase, round:next.round, remain:next.remain, phaseTotal:next.total };
          }
          // Land in the correct phase with correct remaining
          const catchupRemain = Math.ceil(-overshootMs / 1000);
          phaseEndRef.current = Date.now() + catchupRemain * 1000;
          return { ...cur, remain: catchupRemain };
        }

        return { ...s, remain: newRemain };
      });
    }

    ref.current = setInterval(tick, 300);
    const onVisible = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(ref.current); document.removeEventListener('visibilitychange', onVisible); };
  }, [active, paused]);

  const meta     = phaseMeta(phase);
  const totalSec = cfg.warmup + (cfg.work + cfg.rest) * cfg.rounds;

  // - Config screen -
  if (phase === 'idle') return (
    <div className="scroll" style={{ padding:'12px 20px' }}>
      <div className="section-label">Presets</div>
      <div className="int-preset-grid">
        {INT_PRESETS.map(p => (
          <div key={p.name} className="int-preset-card"
            onClick={() => setCfg({ work:p.work, rest:p.rest, rounds:p.rounds, warmup:p.warmup })}>
            <div className="int-preset-name">{p.name}</div>
            <div className="int-preset-detail">{p.work}s / {p.rest}s · {p.rounds} rounds</div>
          </div>
        ))}
      </div>

      <div className="section-label">Custom</div>
      {[
        { key:'warmup', label:'Warm-up',  sub:'seconds before start', min:0,  max:60,  step:5 },
        { key:'work',   label:'Work',     sub:'seconds on',           min:5,  max:300, step:5 },
        { key:'rest',   label:'Rest',     sub:'seconds off',          min:5,  max:300, step:5 },
        { key:'rounds', label:'Rounds',   sub:'total cycles',         min:1,  max:50,  step:1 },
      ].map(row => (
        <div key={row.key} className="int-cfg-row">
          <div>
            <div className="int-cfg-label">{row.label}</div>
            <div className="int-cfg-sub">{row.sub}</div>
          </div>
          <div className="stepper">
            <button className="step-btn" onClick={() => setCfg(c => ({ ...c, [row.key]:Math.max(row.min, c[row.key]-row.step) }))}>+</button>
            <span className="step-val">{cfg[row.key]}</span>
            <button className="step-btn" onClick={() => setCfg(c => ({ ...c, [row.key]:Math.min(row.max, c[row.key]+row.step) }))}>+</button>
          </div>
        </div>
      ))}

      <p style={{ fontSize:12, color:'#666', textAlign:'center', margin:'10px 0' }}>
        Total: {Math.floor(totalSec/60)}m {totalSec%60}s
      </p>

      <button className="btn-fde" onClick={start}>▶  Start Intervals</button>

      <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:9, padding:'10px 14px', marginBottom:8, marginTop:8 }}>
        <div style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Last Custom Timer</div>
        {lastTimer ? (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button
              onClick={() => saveInterval(lastTimer)}
              title="Save this timer"
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, flexShrink:0, color:'#888', display:'flex', alignItems:'center' }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>
            <div style={{ flex:1, fontSize:12, color:'#aaa', lineHeight:1.7 }}>
              <span style={{ color:'#e0e0e0', fontWeight:600 }}>{lastTimer.work}s</span> on &nbsp;·&nbsp;
              <span style={{ color:'#e0e0e0', fontWeight:600 }}>{lastTimer.rest}s</span> off &nbsp;·&nbsp;
              <span style={{ color:'#e0e0e0', fontWeight:600 }}>{lastTimer.rounds}</span> rounds &nbsp;·&nbsp;
              <span style={{ color:'#e0e0e0', fontWeight:600 }}>{lastTimer.warmup}s</span> warm-up
            </div>
            <button
              onClick={() => setCfg(lastTimer)}
              style={{ padding:'4px 10px', borderRadius:7, background:'#222', border:'1px solid #444', color:'#aaa', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}
            >Load</button>
          </div>
        ) : (
          <div style={{ fontSize:12, color:'#444' }}>No custom timer saved yet — start a timer to save it here.</div>
        )}
      </div>

      {savedIntervals.length > 0 && (
        <div style={{ background:'#1a1a1a', border:'1px solid #2a2a2a', borderRadius:9, padding:'10px 14px', marginBottom:12 }}>
          <div style={{ fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>Saved Timers</div>
          <div style={{ maxHeight:90, overflowY:'auto' }}>
          {savedIntervals.map((t, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:8, paddingBottom: i < savedIntervals.length-1 ? 8 : 0, marginBottom: i < savedIntervals.length-1 ? 8 : 0, borderBottom: i < savedIntervals.length-1 ? '1px solid #222' : 'none' }}>
              <div style={{ flex:1, fontSize:12, color:'#aaa' }}>
                <span style={{ color:'#e0e0e0', fontWeight:600 }}>{t.work}s</span> on &nbsp;·&nbsp;
                <span style={{ color:'#e0e0e0', fontWeight:600 }}>{t.rest}s</span> off &nbsp;·&nbsp;
                <span style={{ color:'#e0e0e0', fontWeight:600 }}>{t.rounds}</span> rounds &nbsp;·&nbsp;
                <span style={{ color:'#e0e0e0', fontWeight:600 }}>{t.warmup}s</span> warm-up
              </div>
              <button onClick={() => setCfg(t)} style={{ padding:'4px 10px', borderRadius:7, background:'#222', border:'1px solid #444', color:'#aaa', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>Load</button>
              <button onClick={() => deleteInterval(i)} style={{ padding:'4px 8px', borderRadius:7, background:'none', border:'1px solid #333', color:'#555', cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center' }}>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          ))}
          </div>
        </div>
      )}

      <div style={{ height:20 }} />
    </div>
  );

  // - Done screen -
  if (phase === 'done') return (
    <div className="done-screen">
      <div className="done-emoji">✅ </div>
      <div className="done-title">Done!</div>
      <div className="done-sub">{cfg.rounds} rounds · {(cfg.work+cfg.rest)*cfg.rounds}s total work</div>
      <button className="btn-fde" style={{ width:'100%', marginTop:20 }} onClick={stopTimer}>↺ New Workout</button>
    </div>
  );

  // - Active screen -
  const isWarning = remain <= 5 && remain > 0 && !paused;
  return (
    <div className="scroll" style={{ padding:'16px 20px', display:'flex', flexDirection:'column', alignItems:'center', background: isWarning ? 'rgba(160,0,0,0.18)' : 'transparent', transition:'background 0.3s' }}>
      <div className="int-phase-label" style={{ color:meta.color }}>{meta.label}</div>
      <div className="int-round-label">
        {phase==='warmup' ? 'Warm-up' : `Round ${round} / ${cfg.rounds}`}
      </div>

      <div className="int-count-wrap" style={{ borderColor:meta.border }}>
        <div className="int-count-big" style={{
          color:      remain <= 3 && remain > 0 ? '#ff3333' : '#ffffff',
          fontSize:   remain <= 3 && remain > 0 ? '88px' : remain <= 5 ? '72px' : '64px',
          textShadow: remain === 3 ? '0 0 18px rgba(255,50,50,0.8), 0 0 36px rgba(255,50,50,0.4)'
                    : remain === 2 ? '0 0 26px rgba(255,50,50,0.9), 0 0 52px rgba(255,50,50,0.55)'
                    : remain === 1 ? '0 0 36px rgba(255,50,50,1.0), 0 0 72px rgba(255,50,50,0.7)'
                    : 'none',
          transition: 'font-size 0.1s, color 0.15s',
        }}>{remain}</div>
        <div className="int-count-sub">seconds</div>
      </div>

      <div className="int-dots">
        {Array.from({ length:cfg.rounds }).map((_,i) => {
          const workDone = i < round - 1 || (i === round - 1 && (phase === 'rest' || phase === 'done'));
          const isCurrent = i === round - 1 && phase !== 'warmup' && !workDone;
          return <div key={i} className={`int-dot${workDone?' done':isCurrent?' active':''}`} />;
        })}
      </div>

      <div className="int-upnext">
        {phase==='warmup' ? `Up next: Work ${cfg.work}s` :
         phase==='work'   ? `Up next: Rest ${cfg.rest}s` :
         round < cfg.rounds ? `Up next: Work ${cfg.work}s (round ${round+1})` : 'Last round!'}
      </div>

      {remain <= 5 && remain > 0 && (
        <div style={{ fontSize:11, color:'#ff6b4a', fontWeight:600, marginBottom:10, letterSpacing:1 }}>
          ⏱ {remain}s remaining
        </div>
      )}

      <div className="btn-row" style={{ width:'100%' }}>
        <button className="btn-green" style={{ flex:1 }} onClick={togglePause}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>
        <button className="btn-secondary" style={{ flex:1 }} onClick={stopTimer}>⏹ Stop</button>
      </div>
    </div>
  );
}

// - Main Timers Screen -
export default function TimersScreen() {
  const [tab, setTab] = useState('rest');
  return (
    <div className="screen timers-page">
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="timer-tabs">
        {[['rest','⌚ Timer'],['stopwatch','⏱ Stopwatch'],['intervals','⏰ Intervals']].map(([key,label]) => (
          <div key={key} className={`timer-tab${tab===key?' active':''}`} onClick={() => setTab(key)}>
            {label}
          </div>
        ))}
      </div>
      {tab==='rest'      && <RestTimer />}
      {tab==='stopwatch' && <Stopwatch />}
      {tab==='intervals' && <IntervalTimer />}
    </div>
  );
}
