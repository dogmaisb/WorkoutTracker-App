import { useBackground } from '../useBackground';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { loadSets, METRIC_DEFS, METRIC_LABELS, calcSetVolume, loadSettings } from '../storage';

const ITEM_H = 18;

function RepWheel({ items, value, onChange }) {
  const idx       = Math.max(0, items.indexOf(value));
  const offsetRef = useRef(idx * ITEM_H);
  const [offset, setOffset] = useState(idx * ITEM_H);
  const dragRef   = useRef({ active: false, lastY: 0, velocity: 0, lastTime: 0 });
  const animRef   = useRef(null);
  const elRef     = useRef(null);
  const maxOff    = (items.length - 1) * ITEM_H;

  const clamp = v => Math.max(0, Math.min(maxOff, v));

  function animateTo(target, cb) {
    cancelAnimationFrame(animRef.current);
    function step() {
      const diff = target - offsetRef.current;
      if (Math.abs(diff) < 0.5) { offsetRef.current = target; setOffset(target); cb?.(); return; }
      offsetRef.current += diff * 0.25;
      setOffset(offsetRef.current);
      animRef.current = requestAnimationFrame(step);
    }
    animRef.current = requestAnimationFrame(step);
  }

  function snap() {
    const nearest = clamp(Math.round(offsetRef.current / ITEM_H) * ITEM_H);
    animateTo(nearest, () => onChange(items[Math.round(nearest / ITEM_H)]));
  }

  function releaseInertia() {
    let vel = dragRef.current.velocity * 16;
    cancelAnimationFrame(animRef.current);
    function inertia() {
      vel *= 0.85;
      if (Math.abs(vel) < 0.5) { snap(); return; }
      offsetRef.current = clamp(offsetRef.current + vel);
      setOffset(offsetRef.current);
      animRef.current = requestAnimationFrame(inertia);
    }
    animRef.current = requestAnimationFrame(inertia);
  }

  // Register non-passive touchmove to allow preventDefault
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onTouchMove = e => {
      if (!dragRef.current.active) return;
      e.preventDefault();
      const y = e.touches[0].clientY;
      const now = performance.now();
      const dy = dragRef.current.lastY - y;
      dragRef.current.velocity = dy / Math.max(1, now - dragRef.current.lastTime);
      dragRef.current.lastY = y; dragRef.current.lastTime = now;
      offsetRef.current = clamp(offsetRef.current + dy);
      setOffset(offsetRef.current);
    };
    const onMouseMove = e => {
      if (!dragRef.current.active) return;
      const y = e.clientY, now = performance.now();
      const dy = dragRef.current.lastY - y;
      dragRef.current.velocity = dy / Math.max(1, now - dragRef.current.lastTime);
      dragRef.current.lastY = y; dragRef.current.lastTime = now;
      offsetRef.current = clamp(offsetRef.current + dy);
      setOffset(offsetRef.current);
    };
    const onUp = () => { if (!dragRef.current.active) return; dragRef.current.active = false; releaseInertia(); };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [items.length]); // eslint-disable-line

  const onStart = e => {
    cancelAnimationFrame(animRef.current);
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    dragRef.current = { active: true, lastY: y, velocity: 0, lastTime: performance.now() };
  };

  const visIdx = offset / ITEM_H;

  return (
    <div ref={elRef} onMouseDown={onStart} onTouchStart={onStart} onTouchEnd={() => { dragRef.current.active = false; releaseInertia(); }}
      style={{ height: ITEM_H * 3, width: '100%', overflow: 'hidden', cursor: 'ns-resize', userSelect: 'none', position: 'relative' }}>
      <div style={{ position:'absolute', top: ITEM_H, left:0, right:0, height: ITEM_H,
        background:'rgba(0,255,136,0.08)', borderTop:'1px solid rgba(0,255,136,0.3)',
        borderBottom:'1px solid rgba(0,255,136,0.3)', pointerEvents:'none' }} />
      {items.map((item, i) => {
        const dist = Math.abs(i - visIdx);
        const top  = (i - visIdx) * ITEM_H + ITEM_H;
        if (top < -ITEM_H || top > ITEM_H * 3) return null;
        return (
          <div key={String(item)} style={{
            position:'absolute', left:0, right:0, top, height: ITEM_H,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:11, fontWeight: dist < 0.5 ? 700 : 500,
            color: dist < 0.5 ? '#00ff88' : '#4a7a9a',
            opacity: Math.max(0, 1 - dist * 0.6),
            transform: `scale(${Math.max(0.7, 1 - dist * 0.15)})`,
          }}>
            {item === null ? 'All' : item === 1 ? '1RM' : `${item}`}
          </div>
        );
      })}
    </div>
  );
}

const BASE_EX      = ['Bench press','Squat','Deadlift','OHP','Pull-ups','Push-ups','Running','Cycling'];
const CARDIO_METS  = ['dist','dur','hr'];
const CHART_PROPS  = { margin: { top:4, right:8, left:-20, bottom:0 } };

// Convert any distance value to metres for consistent PR comparison
const TO_METRES = { m:1, km:1000, mi:1609.34, yd:0.9144, ft:0.3048 };
function toMetres(val, unit) {
  return parseFloat(val) * (TO_METRES[unit] || 1);
}

// Tooltip that appends the unit to each value
function UnitTooltip({ unit, ...props }) {
  const { active, payload, label } = props;
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const w = p.payload?.weight;
  const wu = p.payload?.weightUnit || 'lb';
  const display = w ? `${p.value} reps @ ${w}${wu}` : `${p.value}${unit ? ' ' + unit : ''}`;
  return (
    <div style={{ background:'#0d1e30', border:'1px solid #1e5080', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#f0f8ff' }}>
      <div style={{ color:'#4a7a9a', marginBottom:2 }}>{label}</div>
      <div style={{ fontWeight:700, color:'#7dd8ff' }}>{display}</div>
    </div>
  );
}

function ChartBlock({ data, color, yReversed, unit, height=120 }) {
  if (data.length < 2) return (
    <div className="empty" style={{ padding:'10px 0' }}>Log at least 2 entries to see chart</div>
  );
  const gradId = `grad-${color.replace('#','')}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} {...CHART_PROPS}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.35}/>
            <stop offset="95%" stopColor={color} stopOpacity={0.02}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke="rgba(74,154,220,0.12)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill:'#4a7a9a', fontSize:9 }} tickLine={false} axisLine={{ stroke:'#1e3a55' }} />
        <YAxis tick={{ fill:'#4a7a9a', fontSize:9 }} tickLine={false} axisLine={{ stroke:'#1e3a55' }} reversed={!!yReversed} />
        <Tooltip content={<UnitTooltip unit={unit||''} />} />
        <Area type="monotone" dataKey="val" stroke={color} strokeWidth={2.5}
          fill={`url(#${gradId})`}
          dot={{ fill: color, r:4, stroke:'#071624', strokeWidth:1.5 }}
          activeDot={{ r:6, stroke: color, strokeWidth:2, fill:'#071624' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function getMonday(d) {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
}
function mondayKey(d) { return getMonday(d).toISOString().slice(0, 10); }
function toMMMd(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }

function WeekCalendar({ sets, selWeek, onSelect, onClose }) {
  const [calMonth, setCalMonth] = useState(() => {
    if (selWeek) {
      const d = new Date(selWeek + 'T00:00:00');
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const daysWithData = new Set(
    sets
      .filter(s => (s.type === 'strength' || s.type === 'bodyweight') && calcSetVolume(s) > 0)
      .map(s => s.date)
  );

  function weekHasData(monday) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      if (daysWithData.has(toMMMd(d))) return true;
    }
    return false;
  }

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startMon = getMonday(firstDay);
  const weeks = [];
  const cur = new Date(startMon);
  while (cur <= lastDay || weeks.length < 4) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cur); d.setDate(cur.getDate() + i); return new Date(d);
    });
    cur.setDate(cur.getDate() + 7);
    weeks.push(week);
    if (cur > lastDay && weeks.length >= 4) break;
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.82)', zIndex:200,
      display:'flex', alignItems:'center', justifyContent:'center' }} onClick={onClose}>
      <div style={{ background:'#0a1828', border:'1px solid #1e3a55', borderRadius:18,
        padding:'16px 14px', width:290, maxWidth:'92vw' }} onClick={e => e.stopPropagation()}>

        {/* Month nav */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <button onClick={() => setCalMonth(new Date(year, month - 1, 1))}
            style={{ background:'none', border:'none', color:'#7dd8ff', fontSize:18, cursor:'pointer', padding:'2px 8px' }}>‹</button>
          <div style={{ fontSize:13, fontWeight:700, color:'#e0f0ff' }}>
            {calMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <button onClick={() => setCalMonth(new Date(year, month + 1, 1))}
            style={{ background:'none', border:'none', color:'#7dd8ff', fontSize:18, cursor:'pointer', padding:'2px 8px' }}>›</button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
          {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:9, color:'#2a5a7a', fontWeight:700 }}>{d}</div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => {
          const mk = mondayKey(week[0]);
          const isSel = mk === selWeek;
          const hasData = weekHasData(week[0]);
          return (
            <div key={wi} onClick={() => { onSelect(mk); onClose(); }}
              style={{
                display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderRadius:8,
                cursor:'pointer', marginBottom:3, padding:'2px 0',
                background: isSel ? 'rgba(0,255,136,0.14)' : hasData ? 'rgba(0,255,136,0.04)' : 'transparent',
                border: isSel ? '1px solid rgba(0,255,136,0.45)' : '1px solid transparent',
                transition:'background .12s',
              }}>
              {week.map((d, di) => {
                const inMonth = d.getMonth() === month;
                const hasVol = daysWithData.has(toMMMd(d));
                return (
                  <div key={di} style={{ textAlign:'center', padding:'3px 0' }}>
                    <div style={{
                      fontSize:11, fontWeight: inMonth ? 600 : 400,
                      color: isSel ? '#00ff88' : inMonth ? '#c0d8f0' : '#1e3a55',
                    }}>{d.getDate()}</div>
                    <div style={{
                      width: 4, height: 4, borderRadius:'50%', margin:'1px auto 0',
                      background: hasVol ? '#00ff88' : 'transparent',
                    }} />
                  </div>
                );
              })}
            </div>
          );
        })}

        <button onClick={onClose} style={{
          width:'100%', marginTop:10, background:'transparent', border:'1px solid #1e3a55',
          borderRadius:9, padding:'9px', color:'#4a7a9a', fontSize:12, cursor:'pointer',
        }}>Cancel</button>
      </div>
    </div>
  );
}

export default function ProgressScreen({ stateVersion }) {
  const [sets,      setSets]      = useState([]);
  const [search,    setSearch]    = useState('');
  const [selEx,     setSelEx]     = useState('Bench press');
  const [selMet,    setSelMet]    = useState('weight');
  // For distance running: selected unit filter ('all' or a specific unit)
  const [distFilter, setDistFilter] = useState('all');
  const [repFilter,  setRepFilter]  = useState(null); // null = all, number string = specific rep count
  // For sprints: selected combo key "dist|unit"
  const [selSprint,  setSelSprint]  = useState(null);
  // Weekly volume calendar picker
  const [selWeek,       setSelWeek]       = useState(null);
  const [weekPickerOpen, setWeekPickerOpen] = useState(false);
  // Set history collapse
  const [historyOpen, setHistoryOpen] = useState(false);
  // Body weight
  const showBodyweight = loadSettings().showBodyweightProgress;
  const [bwDraft, setBwDraft] = useState('');
  const [dietHistory, setDietHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem('wt_diet_v1'))?.history || {}; } catch { return {}; }
  });

  function saveBwEntry(val) {
    const key = new Date().toISOString().slice(0,10);
    const ts  = new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
    const next = { ...dietHistory, [key]: { ...(dietHistory[key] || {}), weight: val, weightUnit: 'lb', weightTime: ts } };
    setDietHistory(next);
    try {
      const stored = JSON.parse(localStorage.getItem('wt_diet_v1')) || {};
      localStorage.setItem('wt_diet_v1', JSON.stringify({ ...stored, history: next }));
    } catch {}
    setBwDraft('');
  }

  const bwChartData = (() => {
    const entries = Object.entries(dietHistory)
      .filter(([, v]) => v.weight != null)
      .map(([k, v]) => ({ ts: new Date(k+'T12:00:00').getTime(), date: new Date(k+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}), val: parseFloat(v.weight) }))
      .sort((a, b) => a.ts - b.ts)
      .slice(-30);
    return entries;
  })();

  const bwMin = bwChartData.length ? Math.min(...bwChartData.map(d => d.val)) : 0;
  const bwMax = bwChartData.length ? Math.max(...bwChartData.map(d => d.val)) : 0;
  const bwChange = bwChartData.length >= 2
    ? (bwChartData[bwChartData.length-1].val - bwChartData[0].val).toFixed(1)
    : null;

  useEffect(() => { setSets(loadSets()); }, [stateVersion]);

  const allEx    = [...new Set([...BASE_EX, ...sets.map(s => s.ex)])];
  const filtered = search.trim()
    ? allEx.filter(e => e.toLowerCase().includes(search.toLowerCase()))
    : allEx;
  const activeEx  = filtered.includes(selEx) ? selEx : (filtered[0] || '');
  const isRunning = activeEx === 'Running';
  const sample    = sets.find(s => s.ex === activeEx);
  const exType    = sample ? sample.type : 'strength';
  const mets      = isRunning ? CARDIO_METS : (METRIC_DEFS[exType] || METRIC_DEFS.strength);
  const activeMet = mets.includes(selMet) ? selMet : mets[0];

  // ── Distance running data ──────────────────────────────────────────────────
  const cardioSets = sets.filter(s => s.ex === 'Running' && s.type === 'cardio');

  // All units used in distance runs
  const usedDistUnits = [...new Set(cardioSets.map(s => s.vals.distUnit || 'mi'))];

  // Apply unit filter
  const filteredCardio = distFilter === 'all'
    ? cardioSets
    : cardioSets.filter(s => (s.vals.distUnit || 'mi') === distFilter);

  // Build chart data for selected metric
  function cardioChartData(met) {
    return filteredCardio
      .map(s => ({ val: parseFloat(s.vals[met]), date: s.date, unit: s.vals.distUnit || 'mi' }))
      .filter(p => !isNaN(p.val));
  }

  function cardioStats(met) {
    const pts = cardioChartData(met);
    if (!pts.length) return { best:'—', avg:'—' };
    const nums = pts.map(p => p.val);
    return {
      best: String(Math.max(...nums)),
      avg:  (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(1),
    };
  }

  const distChartData = cardioChartData(activeMet);
  const distStats     = cardioStats(activeMet);
  // Unit label for axis/tooltip — show unit if single, 'mixed' if multiple
  const activeDistUnit = distFilter === 'all'
    ? (usedDistUnits.length === 1 ? usedDistUnits[0] : 'mixed units')
    : distFilter;

  // ── Sprint data ────────────────────────────────────────────────────────────
  const sprintSets = sets.filter(s => s.ex === 'Running' && s.type === 'sprint');

  // Group sprints by "distance value + unit" combo
  const sprintGroups = {};
  sprintSets.forEach(s => {
    const dist = s.vals.sdist || '?';
    const unit = s.vals.sprintUnit || 'yd';
    const key  = `${dist}|${unit}`;
    if (!sprintGroups[key]) sprintGroups[key] = { dist, unit, label:`${dist} ${unit}`, sets:[] };
    sprintGroups[key].sets.push(s);
  });
  const sprintGroupList = Object.entries(sprintGroups)
    .sort(([,a],[,b]) => toMetres(a.dist, a.unit) - toMetres(b.dist, b.unit));

  // Selected sprint group data
  const selGroup    = selSprint ? sprintGroups[selSprint] : null;
  const sprintPts   = selGroup
    ? selGroup.sets.map(s => ({ val: parseFloat(s.vals.stime), date: s.date })).filter(p => !isNaN(p.val))
    : [];
  const sprintTimes = sprintPts.map(p => p.val);
  const sprintBest  = sprintTimes.length ? Math.min(...sprintTimes).toFixed(2)+'s' : '—';
  const sprintAvg   = sprintTimes.length ? (sprintTimes.reduce((a,b)=>a+b,0)/sprintTimes.length).toFixed(2)+'s' : '—';

  // ── Generic exercise data ──────────────────────────────────────────────────

  // Available rep counts for this exercise (for the rep filter chips)
  const availableReps = (() => {
    const counts = [...new Set(
      sets
        .filter(s => s.ex === activeEx && s.vals.reps)
        .map(s => parseInt(String(s.vals.reps).match(/\d+/)?.[0]))
        .filter(n => !isNaN(n))
    )].sort((a, b) => a - b);
    return counts;
  })();

  const isWeightMet = activeMet === 'weight' || activeMet === 'added';

  const isVolumeMet = activeMet === 'volume';

  function genericChartData(met) {
    if (met === 'volume') {
      const exSets = sets.filter(s => s.ex === activeEx);
      const byDate = new Map();
      exSets.forEach(s => {
        const vol = calcSetVolume(s);
        if (vol <= 0) return;
        if (!byDate.has(s.date)) byDate.set(s.date, { date: s.date, val: 0, ts: s.ts || 0 });
        byDate.get(s.date).val += vol;
      });
      return [...byDate.values()]
        .sort((a, b) => (a.ts || 0) - (b.ts || 0))
        .map(d => ({ date: d.date, val: Math.round(d.val) }));
    }
    return sets
      .filter(s => {
        if (s.ex !== activeEx) return false;
        if (s.vals[met] === undefined) return false;
        if (isWeightMet && repFilter !== null) {
          const r = parseInt(String(s.vals.reps || '').match(/\d+/)?.[0]);
          if (r !== repFilter) return false;
        }
        return true;
      })
      .map(s => ({
        val: parseFloat(s.vals[met]),
        date: s.date,
        ...(met === 'reps' && s.vals.weight ? { weight: s.vals.weight, weightUnit: s.vals.weightUnit || 'lb' } : {}),
      }))
      .filter(p => !isNaN(p.val));
  }

  const exSetsFiltered = sets.filter(s => {
    if (s.ex !== activeEx) return false;
    if (isWeightMet && repFilter !== null) {
      const r = parseInt(String(s.vals.reps || '').match(/\d+/)?.[0]);
      if (r !== repFilter) return false;
    }
    return true;
  });

  const genData  = genericChartData(activeMet);
  const genNums  = genData.map(p => p.val);
  const genTotal = exSetsFiltered.length;
  const genAvg   = genNums.length
    ? isVolumeMet
      ? Math.round(genNums.reduce((a,b)=>a+b,0)/genNums.length).toLocaleString()
      : (genNums.reduce((a,b)=>a+b,0)/genNums.length).toFixed(1)
    : '—';

  const genBest = (() => {
    if (!genNums.length) return '—';
    const maxVal = Math.max(...genNums);
    if (isVolumeMet) return maxVal.toLocaleString();
    if (activeMet === 'reps') {
      const bestSet = sets
        .filter(s => s.ex === activeEx && parseFloat(s.vals.reps) === maxVal)
        .sort((a, b) => (parseFloat(b.vals.weight) || 0) - (parseFloat(a.vals.weight) || 0))[0];
      const w = bestSet?.vals?.weight;
      const u = bestSet?.vals?.weightUnit || 'lb';
      return w ? `${maxVal} @ ${w}${u}` : String(maxVal);
    }
    return String(maxVal);
  })();

  // Weekly total volume across all strength/bodyweight exercises (last 10 weeks)
  const weeklyVolumeData = (() => {
    const byWeek = {};
    sets
      .filter(s => s.type === 'strength' || s.type === 'bodyweight')
      .forEach(s => {
        const vol = calcSetVolume(s);
        if (vol <= 0) return;
        let monday;
        if (s.ts) {
          const d = new Date(s.ts);
          const day = d.getDay();
          const diff = day === 0 ? -6 : 1 - day;
          monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
        } else {
          monday = new Date();
        }
        const weekKey = monday.toISOString().slice(0, 10);
        const label = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!byWeek[weekKey]) byWeek[weekKey] = { date: label, val: 0, ts: monday.getTime() };
        byWeek[weekKey].val += vol;
      });
    return Object.values(byWeek)
      .sort((a, b) => a.ts - b.ts)
      .slice(-10)
      .map(d => ({ date: d.date, val: Math.round(d.val) }));
  })();

  const weeklyBest = weeklyVolumeData.length
    ? Math.max(...weeklyVolumeData.map(d => d.val)).toLocaleString()
    : '—';
  const weeklyAvg = weeklyVolumeData.length
    ? Math.round(weeklyVolumeData.reduce((s, d) => s + d.val, 0) / weeklyVolumeData.length).toLocaleString()
    : '—';

  // Daily breakdown for selected week
  const selectedWeekDailyData = (() => {
    if (!selWeek) return [];
    const monday = new Date(selWeek + 'T00:00:00');
    return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((dayLabel, i) => {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const dateStr = toMMMd(d);
      const vol = sets
        .filter(s => (s.type === 'strength' || s.type === 'bodyweight') && s.date === dateStr)
        .reduce((sum, s) => sum + calcSetVolume(s), 0);
      return { date: dayLabel, val: Math.round(vol) };
    });
  })();
  const selWeekTotal = selectedWeekDailyData.reduce((s, d) => s + d.val, 0);
  const selWeekLabel = selWeek
    ? (() => { const m = new Date(selWeek + 'T00:00:00'); return `Week of ${toMMMd(m)}`; })()
    : null;

  const unitLabel = isVolumeMet ? 'lb' : (METRIC_LABELS[activeMet]
    ? METRIC_LABELS[activeMet].match(/\(([^)]+)\)/)?.[1] || ''
    : '');

  const bgStyle = useBackground("progress");
  return (
    <div className="screen progress-page" style={bgStyle}>
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar"><h1>Progress</h1></div>
      <div className="scroll">

        {/* Search */}
        <div className="search-bar">
          <span style={{ color:'#8bbdd8' }}>🔍</span>
          <input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <span style={{ cursor:'pointer', color:'#8bbdd8' }} onClick={() => setSearch('')}>✕</span>}
        </div>

        {/* Exercise chips */}
        <div className="chip-row">
          {filtered.map(ex => (
            <div key={ex} className={`chip${ex===activeEx?' active':''}`}
              onClick={() => { setSelEx(ex); setSelMet(null); setSelSprint(null); setDistFilter('all'); setRepFilter(null); }}>
              {ex}
            </div>
          ))}
        </div>

        {!filtered.length && <div className="empty">No exercises match your search</div>}

        {/* ── Generic exercise ── */}
        {!isRunning && !!activeEx && (<>
          <div className="chip-row">
            {mets.map(m => (
              <div key={m} className={`mchip${m===activeMet?' active':''}`} onClick={() => setSelMet(m)}>
                {METRIC_LABELS[m]||m}
              </div>
            ))}
          </div>
          <div className="stat-row">
            <div className="stat-box" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <div className="val">{genBest}</div>
              <div className="lbl">{isVolumeMet ? 'Peak Session' : repFilter !== null ? `Best @ ${repFilter === 1 ? '1RM' : repFilter+' reps'}` : 'Best'}</div>
            </div>
            <div className="stat-box" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              <div className="val">{genAvg}</div>
              <div className="lbl">{isVolumeMet ? 'Avg Session' : 'Avg'}</div>
            </div>
            <div className="stat-box" style={{ padding:'4px 6px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
              {isVolumeMet ? (
                <><div className="val">{genData.length || '—'}</div><div className="lbl">Sessions</div></>
              ) : isWeightMet && availableReps.length > 0 ? (
                <>
                  <RepWheel
                    items={[null, ...availableReps]}
                    value={repFilter}
                    onChange={v => setRepFilter(v)}
                  />
                  <div className="lbl" style={{ marginTop:2 }}>Reps</div>
                </>
              ) : isWeightMet ? (
                <><div className="val">—</div><div className="lbl">Reps</div></>
              ) : (
                <><div className="val">{genTotal || '—'}</div><div className="lbl">Sets</div></>
              )}
            </div>
          </div>
          <div className="chart-card">
            <div className="chart-title">
              {genData.length >= 2
                ? `${activeEx} · ${METRIC_LABELS[activeMet]||activeMet}`
                : 'Log more sets to see chart'}
            </div>
            <ChartBlock data={genData} color="#00ff88" unit={unitLabel} height={130} />
          </div>

          {/* Set history list — collapsible */}
          {(() => {
            const exSets = exSetsFiltered.slice().reverse();
            if (!exSets.length) return null;
            return (
              <div style={{ marginBottom:10 }}>
                <div
                  onClick={() => setHistoryOpen(o => !o)}
                  style={{
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    cursor:'pointer', userSelect:'none',
                    padding:'4px 2px 8px',
                  }}
                >
                  <div className="section-label" style={{ margin:0 }}>Set History</div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ fontSize:10, color:'#4a7a9a' }}>{exSets.length} sets</span>
                    <span style={{ fontSize:13, color:'#4a7a9a', transition:'transform .2s', display:'inline-block', transform: historyOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                  </div>
                </div>
                {historyOpen && exSets.map((s, i) => {
                  const w    = s.vals.weight || s.vals.added;
                  const wu   = s.vals.weightUnit || 'lb';
                  const reps = s.vals.reps;
                  const dist = s.vals.dist;
                  const du   = s.vals.distUnit || 'mi';
                  const dur  = s.vals.dur;
                  const vol  = calcSetVolume(s);
                  return (
                    <div key={s.id || i} style={{
                      display:'flex', justifyContent:'space-between', alignItems:'center',
                      background:'#0d1e30', border:'1px solid #1e3a55', borderRadius:9,
                      padding:'9px 14px', marginBottom:6,
                    }}>
                      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                        {w && <span style={{ fontSize:13, fontWeight:700, color:'#f0f8ff' }}>{w} <span style={{ color:'#4a7a9a', fontSize:11 }}>{wu}</span></span>}
                        {reps && <span style={{ fontSize:12, color:'#8bbdd8' }}>× {reps} reps</span>}
                        {dist && !reps && <span style={{ fontSize:12, color:'#8bbdd8' }}>{dist} {du}</span>}
                        {dur  && !reps && <span style={{ fontSize:12, color:'#8bbdd8' }}>{dur} min</span>}
                        {!w && !reps && !dist && !dur && <span style={{ fontSize:12, color:'#4a7a9a' }}>—</span>}
                        {vol > 0 && <span style={{ fontSize:10, color:'rgba(0,255,136,0.6)', background:'rgba(0,255,136,0.06)', border:'1px solid rgba(0,255,136,0.18)', borderRadius:5, padding:'1px 5px' }}>{vol.toLocaleString()} lb</span>}
                      </div>
                      <span style={{ fontSize:10, color:'#4a7a9a' }}>{s.date}{s.time ? ' · ' + s.time : ''}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>)}

        {/* ── Running ── */}
        {isRunning && (<>

          {/* ── Distance Running section ── */}
          <div className="section-label">Distance Running</div>

          {/* Metric chips */}
          <div className="chip-row">
            {CARDIO_METS.map(m => (
              <div key={m} className={`mchip${m===activeMet?' active':''}`} onClick={() => setSelMet(m)}>
                {METRIC_LABELS[m]||m}
              </div>
            ))}
          </div>

          {/* Unit filter chips — only show if more than one unit used */}
          {usedDistUnits.length > 1 && (
            <div style={{ marginBottom:8 }}>
              <div style={{ fontSize:10, color:'#8bbdd8', marginBottom:5 }}>Filter by unit:</div>
              <div className="chip-row">
                <div className={`chip${distFilter==='all'?' active':''}`} onClick={() => setDistFilter('all')}>
                  All
                </div>
                {usedDistUnits.map(u => (
                  <div key={u} className={`chip${distFilter===u?' active':''}`} onClick={() => setDistFilter(u)}>
                    {u}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="stat-row">
            <div className="stat-box"><div className="val">{distStats.best}</div><div className="lbl">Best {distFilter!=='all'?distFilter:''}</div></div>
            <div className="stat-box"><div className="val">{distStats.avg}</div><div className="lbl">Avg</div></div>
            <div className="stat-box"><div className="val">{filteredCardio.length}</div><div className="lbl">Runs</div></div>
          </div>

          <div className="chart-card">
            <div className="chart-title">
              {distChartData.length >= 2
                ? `Running · ${METRIC_LABELS[activeMet]||activeMet}${activeDistUnit !== 'mixed units' ? ` (${activeDistUnit})` : ' — mixed units'}`
                : cardioSets.length ? 'Log at least 2 runs to see chart' : 'Log distance runs to see chart'}
            </div>
            <ChartBlock
              data={distChartData}
              color="#00ff88"
              unit={distFilter !== 'all' ? distFilter : ''}
              height={120}
            />
            {activeDistUnit === 'mixed units' && distChartData.length >= 2 && (
              <div style={{ fontSize:10, color:'#4db8ff', marginTop:6 }}>
                ⚠ Chart contains mixed units — use the filter chips above to compare runs in the same unit
              </div>
            )}
          </div>

          {/* ── Sprint & Timed Runs section ── */}
          <div className="divider" />
          <div className="section-label">Sprint &amp; Timed Runs</div>

          {sprintGroupList.length === 0 ? (
            <div style={{ fontSize:12, color:'#4a7a9a', marginBottom:10 }}>
              No sprints logged yet — switch to Sprint / Timed mode on the Week tab to log one
            </div>
          ) : (
            <div className="sprint-grid">
              {sprintGroupList.map(([key, grp]) => {
                const times = grp.sets.map(s => parseFloat(s.vals.stime)).filter(v => !isNaN(v));
                const pr    = times.length ? Math.min(...times).toFixed(2) : null;
                return (
                  <div key={key}
                    className={`sprint-card${selSprint===key?' active':''}`}
                    onClick={() => setSelSprint(selSprint===key ? null : key)}
                  >
                    <div className="sprint-dist">{grp.label}</div>
                    {pr
                      ? <div className="sprint-pr">{pr}s PR</div>
                      : <div className="sprint-none">No times</div>}
                    <div className="sprint-cnt">
                      {grp.sets.length} run{grp.sets.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected sprint chart */}
          {selSprint && selGroup && (
            <div className="chart-card">
              <div className="chart-title">{selGroup.label} · time (sec) — lower is faster ↓</div>
              <div className="stat-row" style={{ marginBottom:8 }}>
                <div className="stat-box"><div className="val" style={{ color:'#5adb9a' }}>{sprintBest}</div><div className="lbl">Best</div></div>
                <div className="stat-box"><div className="val" style={{ color:'#5adb9a' }}>{sprintAvg}</div><div className="lbl">Avg</div></div>
                <div className="stat-box"><div className="val" style={{ color:'#5adb9a' }}>{selGroup.sets.length}</div><div className="lbl">Runs</div></div>
              </div>
              <ChartBlock data={sprintPts} color="#00ff88" yReversed unit="sec" height={110} />
            </div>
          )}

        </>)}

        {/* ── Weekly Training Volume ── */}
        {weeklyVolumeData.length > 0 && (<>
          <div className="divider" />
          <div className="section-label">Weekly Training Volume</div>
          <div className="stat-row">
            <div className="stat-box"><div className="val">{weeklyBest}</div><div className="lbl">Best Week</div></div>
            <div className="stat-box"><div className="val">{weeklyAvg}</div><div className="lbl">Avg Week</div></div>
            <div className="stat-box"
              onClick={() => setWeekPickerOpen(true)}
              style={{ cursor:'pointer', border:'1px solid rgba(0,255,136,0.28)', background:'rgba(0,255,136,0.04)', transition:'background .15s' }}
              onMouseOver={e => e.currentTarget.style.background='rgba(0,255,136,0.10)'}
              onMouseOut={e  => e.currentTarget.style.background='rgba(0,255,136,0.04)'}
            >
              <div className="val" style={{ color:'#00ff88' }}>{weeklyVolumeData.length}</div>
              <div className="lbl" style={{ color:'rgba(0,255,136,0.7)' }}>Weeks ▾</div>
            </div>
          </div>

          {/* Daily breakdown for selected week */}
          {selWeek ? (
            <div className="chart-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                <div className="chart-title" style={{ marginBottom:0 }}>{selWeekLabel} · Daily Volume</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#00ff88' }}>{selWeekTotal.toLocaleString()} lb total</div>
              </div>
              {selWeekTotal > 0
                ? <ChartBlock data={selectedWeekDailyData} color="#00ff88" unit="lb" height={120} />
                : <div className="empty" style={{ padding:'14px 0' }}>No volume logged this week</div>}
              <div style={{ fontSize:10, color:'#2a5a7a', textAlign:'center', marginTop:4, cursor:'pointer' }}
                onClick={() => setWeekPickerOpen(true)}>Tap Weeks ▾ to change week</div>
            </div>
          ) : (
            <div style={{ fontSize:12, color:'#2a5a7a', textAlign:'center', padding:'12px 0 4px' }}>
              Tap <span style={{ color:'#00ff88' }}>Weeks ▾</span> to pick a week and see its daily breakdown
            </div>
          )}
        </>)}

        {/* Week calendar modal */}
        {weekPickerOpen && (
          <WeekCalendar
            sets={sets}
            selWeek={selWeek}
            onSelect={setSelWeek}
            onClose={() => setWeekPickerOpen(false)}
          />
        )}

        {/* ── Body Weight ── */}
        {showBodyweight && (<>
          <div className="divider" />
          <div className="section-label">Body Weight</div>

          {/* Stats row */}
          {bwChartData.length > 0 && (
            <div className="stat-row">
              <div className="stat-box">
                <div className="val">{bwChartData[bwChartData.length-1].val} lb</div>
                <div className="lbl">Latest</div>
              </div>
              <div className="stat-box">
                <div className="val">{bwMin} lb</div>
                <div className="lbl">Low (30d)</div>
              </div>
              <div className="stat-box">
                <div className="val" style={{ color: bwChange > 0 ? '#ff6b4a' : bwChange < 0 ? '#00ff88' : '#e0f0e0' }}>
                  {bwChange !== null ? (bwChange > 0 ? '+' : '') + bwChange + ' lb' : '—'}
                </div>
                <div className="lbl">Change</div>
              </div>
            </div>
          )}

          {/* Chart */}
          {bwChartData.length >= 2 && (
            <div className="chart-card">
              <div className="chart-title">Weight · Last 30 Days</div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={bwChartData} margin={{ top:8, right:4, left:0, bottom:0 }}>
                  <defs>
                    <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7dd8ff" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#7dd8ff" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill:'#2a5a7a', fontSize:9 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis domain={[bwMin - 2, bwMax + 2]} tick={{ fill:'#2a5a7a', fontSize:9 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ background:'#0a1828', border:'1px solid #1e3a55', borderRadius:8, fontSize:11 }}
                    labelStyle={{ color:'#7dd8ff' }}
                    itemStyle={{ color:'#e0f0ff' }}
                    formatter={v => [v + ' lb', 'Weight']}
                  />
                  <Area type="monotone" dataKey="val" stroke="#7dd8ff" strokeWidth={2} fill="url(#bwGrad)" dot={{ fill:'#7dd8ff', r:3 }} connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {bwChartData.length === 0 && (
            <div className="empty">No weight entries yet — log your weight on the Diet screen</div>
          )}

          {/* Quick-log today's weight */}
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#0e1a2a', border:'1px solid #1e3a55', borderRadius:10, padding:'8px 12px', marginTop:6 }}>
            <span style={{ fontSize:11, color:'#4a7a9a', flex:1 }}>Log today's weight</span>
            <input
              type="number" placeholder="lbs" step="0.1"
              value={bwDraft}
              onChange={e => setBwDraft(e.target.value)}
              style={{ width:64, padding:'5px 8px', borderRadius:7, fontSize:13,
                background:'#0a1828', border:'1px solid #1e3a55', color:'#7dd8ff', outline:'none', textAlign:'right' }}
            />
            <button onClick={() => { const v = parseFloat(bwDraft); if (v) saveBwEntry(v); }}
              style={{ background: bwDraft ? '#0d3a5a' : 'transparent', border:`1px solid ${bwDraft?'#1d6e9e':'#1e3a55'}`,
                borderRadius:7, padding:'5px 10px', fontSize:12, color: bwDraft ? '#7dd8ff' : '#2a5a7a',
                cursor: bwDraft ? 'pointer' : 'default', fontWeight:700, transition:'all .15s' }}>
              Save
            </button>
          </div>
        </>)}

        <div style={{ height:20 }} />
      </div>
    </div>
  );
}
