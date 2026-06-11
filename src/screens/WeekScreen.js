import { useBackground } from '../useBackground';
import React, { useState, useEffect, useRef } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { loadSets, addSet, updateSet, deleteSet, FIELD_DEFS, setMainValue, getPrescribedForDate, loadExercises } from '../storage';

const EXERCISES = [
  // Strength
  { name: 'Bench press',         type: 'strength'   },
  { name: 'Incline bench press', type: 'strength'   },
  { name: 'Squat',               type: 'strength'   },
  { name: 'Front squat',         type: 'strength'   },
  { name: 'Deadlift',            type: 'strength'   },
  { name: 'Romanian deadlift',   type: 'strength'   },
  { name: 'OHP',                 type: 'strength'   },
  { name: 'Barbell row',                      type: 'strength'   },
  { name: 'Barbell rows supinated',           type: 'strength'   },
  { name: 'Dumbbell rows',                    type: 'strength'   },
  { name: 'Chest supported dumbbell rows',    type: 'strength'   },
  { name: 'Chest supported T-bar rows',       type: 'strength'   },
  { name: 'Lat pulldown',                     type: 'strength'   },
  { name: 'Cable row',           type: 'strength'   },
  { name: 'Leg press',           type: 'strength'   },
  { name: 'Leg curl',            type: 'strength'   },
  { name: 'Leg extension',       type: 'strength'   },
  { name: 'Hip thrust',          type: 'strength'   },
  { name: 'Calf raise',          type: 'strength'   },
  { name: 'Dumbbell curl',       type: 'strength'   },
  { name: 'Skull crusher',       type: 'strength'   },
  { name: 'Tricep pushdown',     type: 'strength'   },
  { name: 'Face pull',           type: 'strength'   },
  { name: 'Shrug',               type: 'strength'   },
  // Olympic lifts
  { name: 'Clean',              type: 'strength'   },
  { name: 'Hang clean',         type: 'strength'   },
  { name: 'Power clean',        type: 'strength'   },
  { name: 'Clean pull',         type: 'strength'   },
  { name: 'Clean high pull',    type: 'strength'   },
  { name: 'Snatch',             type: 'strength'   },
  { name: 'Hang snatch',        type: 'strength'   },
  { name: 'Power snatch',       type: 'strength'   },
  { name: 'Snatch pull',        type: 'strength'   },
  { name: 'Snatch high pull',   type: 'strength'   },
  { name: 'Jerk',               type: 'strength'   },
  { name: 'Rack jerk',          type: 'strength'   },
  { name: 'Squat jerk',         type: 'strength'   },
  { name: 'Overhead squat',     type: 'strength'   },
  // Bodyweight
  { name: 'Pull-ups',            type: 'bodyweight' },
  { name: 'Chin-ups',            type: 'bodyweight' },
  { name: 'Push-ups',            type: 'bodyweight' },
  { name: 'Dips',                type: 'bodyweight' },
  { name: 'Inverted rows',       type: 'bodyweight' },
  { name: 'Burpees',             type: 'bodyweight' },
  { name: 'Interval Sprints 100m',  type: 'sprint'    },
  // Cardio
  { name: 'Running',             type: 'cardio'     },
  { name: 'Rowing',              type: 'cardio'     },
  { name: 'Walking',             type: 'cardio'     },
  { name: 'Swimming',            type: 'cardio'     },
  { name: 'Jump rope',           type: 'jumprope'   },
  { name: 'Rowing machine',      type: 'cardio'     },
  { name: 'Elliptical',          type: 'cardio'     },
  // Cycling
  { name: 'Cycling',             type: 'cycling'    },
];

const DAY_LABELS = ['M','T','W','T','F','S','S'];

const DIST_UNITS   = ['mi', 'km', 'm', 'yd', 'ft'];
const SPRINT_UNITS = ['yd', 'm', 'mi', 'km', 'ft'];
const WEIGHT_UNITS = ['lb', 'kg'];

// Fields that are numeric
const NUMERIC_FIELDS = new Set([
  'weight','reps','sets','rest','rpe','added','dist','dur','hr','cal','stime','wind','speed','power','elev'
]);

// - Rest Timer Audio -
function getAudioCtx() {
  if (!window._audioCtx) window._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return window._audioCtx;
}
function restBeep(freq = 1100, duration = 0.12, delay = 0) {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq; osc.type = 'sine';
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + duration);
    osc.start(t); osc.stop(t + duration + 0.05);
  } catch(e) {}
}
function restDoubleBeep(longer = false) {
  const dur = longer ? 0.22 : 0.10;
  restBeep(1100, dur, 0);
  restBeep(1100, dur, longer ? 0.30 : 0.18);
}

// - Inline Rest Timer -
function RestTimerField({ defaultDur, onChange }) {
  const fmtMSS = s => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  const [duration, setDuration] = useState(defaultDur);
  const [remain,   setRemain]   = useState(defaultDur);
  const [running,  setRunning]  = useState(false);
  const [done,     setDone]     = useState(false);
  const tickRef = useRef(null);

  // seed fieldVals.rest with the default on mount
  useEffect(() => { onChange(String(defaultDur)); }, []); // intentional: run once on mount

  function setDur(d) {
    const v = Math.max(15, Math.min(600, d));
    clearInterval(tickRef.current);
    setRunning(false);
    setDone(false);
    setDuration(v);
    setRemain(v);
    onChange(String(v));
  }

  function toggle() {
    if (done) { setRemain(duration); setDone(false); return; }
    setRunning(r => !r);
  }

  function reset() {
    clearInterval(tickRef.current);
    setRunning(false);
    setDone(false);
    setRemain(duration);
  }

  useEffect(() => {
    if (!running) { clearInterval(tickRef.current); return; }
    tickRef.current = setInterval(() => {
      setRemain(r => {
        if (r <= 1) {
          restDoubleBeep(true);
          clearInterval(tickRef.current); setRunning(false); setDone(true); return 0;
        }
        const newR = r - 1;
        if (newR === 30) restDoubleBeep();
        if (newR === 5)  restDoubleBeep();
        return newR;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const pct         = duration > 0 ? remain / duration : 1;
  const timeColor   = done ? '#5adb9a' : (running && pct <= 0.25) ? '#cc4444' : running ? '#ff6b4a' : '#e0f0e0';
  const borderColor = done ? '#1d9e75' : running ? '#ff6b4a' : '#1e3a55';

  const btnStyle = (active) => ({
    width:18, height:18, borderRadius:4, border:'1px solid #1e3a55', flexShrink:0,
    background: active ? '#0d1e30' : '#1e3a55',
    color: active ? '#4a7a9a' : '#8bbdd8',
    fontSize:12, fontWeight:700, lineHeight:1, cursor: active ? 'default' : 'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
  });

  return (
    <div style={{ background:'#0d1e30', border:`1px solid ${borderColor}`, borderRadius:7, padding:'3px 5px', transition:'border-color .2s' }}>
      {/*   editable time / countdown  + */}
      <div style={{ display:'flex', alignItems:'center', gap:3, marginBottom:3 }}>
        <button onClick={() => setDur(duration - 15)} disabled={running} style={btnStyle(running)}>−</button>

        <span style={{
          flex:1, textAlign:'center', fontSize:14, fontWeight:700, color:timeColor,
          fontVariantNumeric:'tabular-nums', transition:'color .25s',
        }}>
          {done ? '✓ Go!' : fmtMSS(remain)}
        </span>

        <button onClick={() => setDur(duration + 15)} disabled={running} style={btnStyle(running)}>+</button>
      </div>

      {/* Start / Pause + Reset */}
      <div style={{ display:'flex', gap:3 }}>
        <button
          onClick={toggle}
          style={{
            flex:1, padding:'2px 0', borderRadius:5,
            background: done ? '#0d3520' : running ? '#2a1800' : '#1e3a55',
            border: `1px solid ${done ? '#1d9e75' : running ? '#ff6b4a' : '#4a9adc'}`,
            color: done ? '#5adb9a' : running ? '#ff6b4a' : '#8bbdd8',
            fontSize:10, fontWeight:700, cursor:'pointer', transition:'all .15s',
          }}
        >
          {done ? '↺ Again' : running ? '⏸' : '▶ Start'}
        </button>
        {(running || done || remain !== duration) && (
          <button
            onClick={reset}
            style={{
              width:22, borderRadius:5, lineHeight:1,
              background:'#1e3a55', border:'1px solid #2d4a6a',
              color:'#8bbdd8', fontSize:11, cursor:'pointer',
            }}
          >↺</button>
        )}
      </div>
    </div>
  );
}
export default function WeekScreen({
  onOpenNotes, noteText, setNoteText,
  fieldVals, setFieldVals,
  sprintMode, setSprintMode,
  curExIdx, setCurExIdx,
  distUnit, setDistUnit,
  sprintUnit, setSprintUnit,
  weightUnit, setWeightUnit,
  stateVersion,
}) {
  const bgStyle = useBackground("week");

  const [sets,         setSets]         = useState(loadSets());
  const [customExercises, setCustomExercises] = useState(() => loadExercises());
  const [flash,        setFlash]        = useState(false);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'MMM d'));
  const [checkedItems, setCheckedItems] = useState(new Set());
  const [logExercise,  setLogExercise]  = useState(null); // { exIdx, pIdx }
  const [selectedPIdx, setSelectedPIdx] = useState(null);
  const [blankWarning, setBlankWarning] = useState(null);
  const [editingSetId, setEditingSetId] = useState(null);
  const [eachSide,     setEachSide]     = useState(false);
  const [showMonth,    setShowMonth]    = useState(false);
  const [monthYear,    setMonthYear]    = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [weekAnchor,   setWeekAnchor]   = useState(new Date());

  // Reload sets when noteText changes (came back from notes)
  useEffect(() => { setSets(loadSets()); }, [noteText]);

  // Reload everything when stateVersion bumps (e.g. after coach import)
  useEffect(() => {
    setSets(loadSets());
    setCustomExercises(loadExercises());
  }, [stateVersion]);

  // Reset checklist when day changes
  useEffect(() => { setCheckedItems(new Set()); }, [selectedDate]);

  // Auto-detect "each side" from prescribed reps (e.g. "8 each", "10e", "8each")
  useEffect(() => {
    if (logExercise === null) { setEachSide(false); return; }
    const pres = getPrescribedForDate(selectedDate);
    const presEx = pres && pres.exercises[logExercise.pIdx];
    if (presEx && presEx.reps != null) {
      const r = String(presEx.reps).toLowerCase();
      setEachSide(/each|e$/.test(r));
    } else {
      setEachSide(false);
    }
  }, [logExercise, selectedDate]);

  // Merge hardcoded list with any custom exercises added via coach import
  const allExercises = (() => {
    const known  = new Set(EXERCISES.map(e => e.name.toLowerCase()));
    const extras = customExercises.filter(e => !known.has(e.name.toLowerCase()));
    return [...EXERCISES, ...extras];
  })();

  const today     = new Date();
  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 1 });
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  function isDone(day) {
    return sets.some(s => s.date === format(day, 'MMM d'));
  }

  const prescribed = getPrescribedForDate(selectedDate);

  function toggleCheck(i, exName) {
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
    const exIdx = allExercises.findIndex(e => e.name === exName);
    if (exIdx !== -1) pickEx(exIdx, i);
  }

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const fmtDay = d => `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;

  function getMonthGrid(year, month) {
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const startDow = first.getDay();
    const offset   = startDow === 0 ? 6 : startDow - 1;
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function prevMonth() { setMonthYear(m => { const d = new Date(m.year, m.month - 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; }); }
  function nextMonth() { setMonthYear(m => { const d = new Date(m.year, m.month + 1, 1); return { year: d.getFullYear(), month: d.getMonth() }; }); }

  const curEx      = allExercises[curExIdx];
  const isRunning  = curEx.name === 'Running';
  const effectType = isRunning && sprintMode ? 'sprint' : curEx.type;
  const fieldDef   = FIELD_DEFS[effectType] || FIELD_DEFS.strength;

  function setVal(id, val) { setFieldVals(p => ({ ...p, [id]: val })); }

  function pickEx(i, pIdx = null) {
    setCurExIdx(i);
    setSelectedPIdx(pIdx);
    setSprintMode(false);
    setFieldVals({});
    setNoteText('');
    setEachSide(false);
    setEditingSetId(null);
  }

  function doSave() {
    const now = new Date();
    const valsToSave = { ...fieldVals };
    if (eachSide && valsToSave.reps) valsToSave.reps = String(valsToSave.reps).replace(/e$/i, '') + 'e';
    if ((effectType === 'cardio' || effectType === 'cycling') && valsToSave.dist) {
      valsToSave.distUnit = distUnit;
    }
    if (effectType === 'sprint' && valsToSave.sdist) {
      valsToSave.sprintUnit = sprintUnit;
    }
    if ((effectType === 'strength' || effectType === 'bodyweight') && (valsToSave.weight || valsToSave.added)) {
      valsToSave.weightUnit = weightUnit;
    }
    if (editingSetId !== null) {
      setSets(updateSet(editingSetId, valsToSave));
      setEditingSetId(null);
    } else {
      const set = {
        id:   Date.now(),
        ex:   curEx.name,
        type: effectType,
        date: selectedDate,
        time: format(now, 'h:mm a'),
        ts:   now.toISOString(),
        vals: valsToSave,
        note: noteText,
      };
      setSets(addSet(set));
      if (logExercise !== null) {
        setCheckedItems(prev => { const next = new Set(prev); next.add(logExercise.pIdx); return next; });
      }
    }
    setFieldVals({});
    setNoteText('');
    setBlankWarning(null);
    setFlash(true);
    setTimeout(() => setFlash(false), 1800);
  }

  function handleSave() {
    const missingWeight = effectType === 'strength'   && !fieldVals.weight;
    const missingReps   = (effectType === 'strength' || effectType === 'bodyweight') && !fieldVals.reps;
    const missingTime   = effectType === 'sprint' && !fieldVals.stime;
    const missingDist   = effectType === 'sprint' && !fieldVals.sdist;
    const missingCardio   = effectType === 'cardio'    && !fieldVals.dist && !fieldVals.dur;
    const missingCycling  = effectType === 'cycling'   && !fieldVals.dist && !fieldVals.dur;
    const missingJumprope = effectType === 'jumprope'  && !fieldVals.reps && !fieldVals.dur;
    if (missingWeight || missingReps || missingTime || missingDist || missingCardio || missingCycling || missingJumprope) {
      let msg;
      if (missingTime && missingDist) msg = 'Time and distance are blank. Are you sure you want to save this sprint set?';
      else if (missingTime)           msg = 'Time is blank. Are you sure you want to save this sprint set?';
      else if (missingDist)           msg = 'Distance is blank. Are you sure you want to save this sprint set?';
      else if (missingCardio)         msg = 'Distance and duration are both blank. Are you sure you want to save this entry?';
      else if (missingCycling)        msg = 'Distance and duration are both blank. Are you sure you want to save this ride?';
      else if (missingJumprope)       msg = 'Jumps and duration are both blank. Are you sure you want to save this set?';
      else                            msg = 'Weight or reps are blank. Are you sure you want to save this set?';
      setBlankWarning(msg);
      return;
    }
    doSave();
  }

  const todayStr   = format(today, 'MMM d');
  const todaySets  = logExercise !== null
    ? sets.filter(s => s.date === selectedDate && s.ex === curEx.name)
    : [];

  // - Log Page -
  if (logExercise !== null) {
    const presEx = prescribed && prescribed.exercises[logExercise.pIdx];
    return (
      <div className="screen week-page" style={bgStyle}>
        <div className="status-bar"><span>9:41</span><span>●●●</span></div>
        <div className="scroll" style={{ paddingTop:12 }}>
          <button className="back-btn" onClick={() => setLogExercise(null)}>← Workout</button>

          {/* Exercise header */}
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:20, fontWeight:700, color:'#f0f8ff' }}>{curEx.name}</div>
            <div style={{ fontSize:11, color:'#8bbdd8', marginTop:2 }}>{curEx.type.charAt(0).toUpperCase()+curEx.type.slice(1)}</div>
          </div>

          {/* Prescribed target */}
          {presEx && (
            <div style={{ background:'#162d48', border:'1px solid #1e3a55', borderRadius:9, padding:'9px 14px', marginBottom:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:11, color:'#8bbdd8' }}>Prescribed</div>
              <div style={{ fontSize:14, fontWeight:700, color:'#5adb9a' }}>
                {(() => {
                  const target = parseInt(presEx.sets) || 0;
                  const done   = todaySets.length;
                  const left   = Math.max(0, target - done);
                  return (
                    <>
                      {done > 0 ? (
                        <>
                          <span style={{ textDecoration:'line-through', color:'#3a7a5a', marginRight:5 }}>{target}</span>
                          <span style={{ color: left === 0 ? '#4adbaa' : '#5adb9a' }}>{left}</span>
                        </>
                      ) : (
                        <span>{target}</span>
                      )}
                      {' sets × '}{presEx.reps || '—'} reps
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Today's logged sets */}
          {todaySets.length > 0 && (
            <>
              {(() => {
                const target = presEx ? parseInt(presEx.sets) || 3 : 3;
                const left   = Math.max(0, target - todaySets.length);
                return (
                  <div className="section-label" style={{ display:'flex', alignItems:'center', gap:8 }}>
                    Today's Sets
                    {left > 0 && (
                      <span style={{ fontSize:11, fontWeight:700, color:'#ff9a40', background:'rgba(255,107,53,0.15)', border:'1px solid rgba(255,107,53,0.4)', borderRadius:20, padding:'1px 8px' }}>
                        {left} left!
                      </span>
                    )}
                    {left === 0 && (
                      <span style={{ fontSize:11, fontWeight:700, color:'#4adbaa', background:'rgba(74,219,170,0.12)', border:'1px solid rgba(74,219,170,0.35)', borderRadius:20, padding:'1px 8px' }}>
                        Done!
                      </span>
                    )}
                  </div>
                );
              })()}
              {todaySets.map((s, i) => {
                const isEditing = editingSetId === s.id;
                return (
                  <div key={s.id}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background: isEditing ? '#162d48' : '#2d4a6a', border: `1px solid ${isEditing ? '#4adbaa' : '#1e3a55'}`, borderRadius:9, padding:'9px 12px', marginBottom:7, transition:'all .15s' }}>
                    <div style={{ fontSize:12, color: isEditing ? '#4adbaa' : '#8bbdd8' }}>Set {i + 1}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#f0f8ff' }}>
                        {setMainValue(s)}
                        {s.vals.reps && (s.type === 'strength' || s.type === 'bodyweight') && (
                          <span style={{ color:'#8bbdd8', fontWeight:400, marginLeft:5 }}>× {s.vals.reps} reps</span>
                        )}
                      </div>
                      <span
                        onClick={() => {
                          if (isEditing) { setEditingSetId(null); setFieldVals({}); setEachSide(false); return; }
                          setEditingSetId(s.id);
                          const editVals = { ...s.vals };
                          if (typeof editVals.reps === 'string' && editVals.reps.endsWith('e')) {
                            setEachSide(true);
                            editVals.reps = editVals.reps.slice(0, -1);
                          } else { setEachSide(false); }
                          setFieldVals(editVals);
                        }}
                        style={{ fontSize:15, cursor:'pointer', color: isEditing ? '#4adbaa' : '#5a9adc', lineHeight:1, padding:'2px 4px' }}
                      >✎</span>
                    </div>
                  </div>
                );
              })}
            </>
          )}

          <div className="section-label" style={{ marginTop: todaySets.length ? 6 : 0 }}>
            {editingSetId !== null ? 'Edit Set' : 'Log Set'}
          </div>

          {/* Log form */}
          <div className="card">
            {isRunning && (
              <div style={{ display:'flex', gap:8, marginBottom:12 }}>
                <button onClick={() => setSprintMode(false)} style={{ flex:1, padding:'10px 6px', borderRadius:9, border:'2px solid', cursor:'pointer', fontWeight:700, fontSize:12, transition:'all .15s', background:!sprintMode?'#0d1e30':'#162d48', borderColor:!sprintMode?'#4a9adc':'#1e3a55', color:!sprintMode?'#7dd8ff':'#8bbdd8' }}>🏃 Distance Run</button>
                <button onClick={() => setSprintMode(true)}  style={{ flex:1, padding:'10px 6px', borderRadius:9, border:'2px solid', cursor:'pointer', fontWeight:700, fontSize:12, transition:'all .15s', background:sprintMode?'#2a1a00':'#162d48', borderColor:sprintMode?'#ff6b4a':'#1e3a55', color:sprintMode?'#ff6b4a':'#8bbdd8' }}>⚡ Sprint / Timed</button>
              </div>
            )}

            {fieldDef.map((row, ri) => (
              <div key={ri} className="field-row">
                {row.fields.map(f => {
                  const isRestField   = f.id === 'rest';
                  const isWeightField = (f.id === 'weight' && effectType === 'strength') || (f.id === 'added' && effectType === 'bodyweight');
                  const isDistField   = f.id === 'dist'  && (effectType === 'cardio' || effectType === 'cycling');
                  const isSprintDist  = f.id === 'sdist' && effectType === 'sprint';
                  return (
                    <div key={isRestField ? `rest-${curExIdx}` : f.id} className="field-wrap">
                      <label className="field-label">{f.id === 'reps' && eachSide ? <>{f.label} <span style={{color:'#5adb9a',fontWeight:700,fontSize:10}}>· each</span></> : f.label}</label>
                      {isRestField ? (
                        <RestTimerField defaultDur={parseInt(f.ph) || 90} onChange={v => setVal('rest', v)} />
                      ) : isWeightField ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <input className="input-field" style={{ flex:1 }} placeholder={`${f.ph} ${weightUnit === 'lb' ? 'lbs' : weightUnit}`} value={fieldVals[f.id]||''} onChange={e => setVal(f.id, e.target.value)} type="number" />
                          <button onClick={() => setWeightUnit(u => u === 'lb' ? 'kg' : 'lb')} style={{ background:'#1e3a55', border:'1px solid #2d4a6a', borderRadius:7, padding:'6px 10px', fontSize:12, color:'#5adb9a', cursor:'pointer', fontWeight:700, minWidth:36 }}>{weightUnit}</button>
                        </div>
                      ) : isDistField ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <input className="input-field" style={{ flex:1 }} placeholder={f.ph} value={fieldVals[f.id]||''} onChange={e => setVal(f.id, e.target.value)} type="number" />
                          <select value={distUnit} onChange={e => setDistUnit(e.target.value)} style={{ background:'#1e3a55', border:'1px solid #2d4a6a', borderRadius:7, padding:'6px 4px', fontSize:12, color:'#5adb9a', cursor:'pointer', outline:'none', fontWeight:600 }}>
                            {DIST_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      ) : isSprintDist ? (
                        <div style={{ display:'flex', gap:4 }}>
                          <input className="input-field" style={{ flex:1 }} placeholder="e.g. 100" value={fieldVals[f.id]||''} onChange={e => setVal(f.id, e.target.value)} type="number" />
                          <select value={sprintUnit} onChange={e => setSprintUnit(e.target.value)} style={{ background:'#1e3a55', border:'1px solid #2d4a6a', borderRadius:7, padding:'6px 4px', fontSize:12, color:'#e8a030', cursor:'pointer', outline:'none', fontWeight:600, width:36, flexShrink:0 }}>
                            {SPRINT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      ) : (
                        <input className="input-field" placeholder={f.ph} value={fieldVals[f.id]||''} onChange={e => setVal(f.id, e.target.value)} type={NUMERIC_FIELDS.has(f.id) ? 'number' : 'text'} />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <button className="notes-btn" onClick={onOpenNotes}>
              📝
                            <span className="notes-preview" style={{ color: noteText ? '#9ae0b0' : undefined }}>{noteText || 'Add a note...'}</span>
              <span style={{ color:'#3a5a3a', marginLeft:'auto' }}>›</span>
            </button>
            <button className="btn-fde" style={{ marginTop:10, background:'#1a7a4a', boxShadow:'0 0 14px rgba(29,158,117,0.35)' }} onClick={handleSave}>
              {editingSetId !== null ? 'Update Set' : 'Save Set'}
            </button>
            {editingSetId !== null && (
              <div style={{ display:'flex', gap:6, marginTop:6 }}>
                <button onClick={() => { setSets(deleteSet(editingSetId)); setEditingSetId(null); setFieldVals({}); }} style={{ flex:'0 0 auto', background:'#3a0000', border:'2px solid #aa0000', borderRadius:9, padding:'8px 12px', color:'#ff4444', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                  🗑 Delete
                </button>
                <button onClick={() => { setEditingSetId(null); setFieldVals({}); }} style={{ flex:1, background:'#5a0a0a', border:'2px solid #cc2222', borderRadius:9, padding:'8px', color:'#ff6666', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  Cancel Edit
                </button>
              </div>
            )}
            {flash && <div className="flash">✓ Set saved!</div>}
          </div>

          <div style={{ height:20 }} />
        </div>
        {blankWarning && <BlankWarningModal message={blankWarning} onConfirm={doSave} onCancel={() => setBlankWarning(null)} />}
      </div>
    );
  }

  // - Checklist View -
  return (
    <div className="screen week-page" style={bgStyle}>
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h1 style={{ margin:0 }}>My Workouts</h1>
          <p style={{ margin:0 }}>
            <span style={{ fontSize:13, fontWeight:700, color:'#f0f8ff',
              background:'rgba(29,158,117,0.15)', border:'1px solid rgba(29,158,117,0.5)',
              borderRadius:20, padding:'2px 12px', display:'inline-block' }}>
              {format(weekAnchor, 'MMMM yyyy')}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowMonth(m => !m)}
          style={{
            background: showMonth ? '#1a2e45' : '#0d1e30',
            border: `1px solid ${showMonth ? '#ff6b4a' : '#1e3a55'}`,
            borderRadius:9, padding:'6px 10px', cursor:'pointer',
            fontSize:16, lineHeight:1, color: showMonth ? '#ff6b4a' : '#8bbdd8',
            transition:'all .15s',
          }}
        >📅</button>
      </div>
      <div className="scroll">

        {/* Week strip  always visible */}
        <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:14 }}>
          <button
            onClick={() => setWeekAnchor(d => addDays(d, -7))}
            style={{ background:'none', border:'none', color:'#6a9a6a', fontSize:20, cursor:'pointer', padding:'0 2px', lineHeight:1, flexShrink:0 }}
          >‹</button>
          <div className="week-row" style={{ flex:1, margin:0 }}>
          {weekDays.map((day, i) => {
            const dateStr    = format(day, 'MMM d');
            const isToday    = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const logged     = isDone(day);
            const hasPrescribed = getPrescribedForDate(dateStr) !== null;
            return (
              <div
                key={i}
                className={`day-pill${isToday ? ' today' : logged ? ' done' : ''}`}
                style={{
                  cursor:'pointer',
                  ...(isSelected && !isToday ? { borderColor:'#7dff4f', background:'#162d48', boxShadow:'0 0 10px rgba(125,255,79,0.5)' } : {}),
                  ...(isToday ? { boxShadow:'0 0 8px rgba(125,255,79,0.6)' } : {}),
                }}
                onClick={() => { setSelectedDate(dateStr); setShowMonth(false); }}
              >
                <span className="day-label">{DAY_LABELS[i]}</span>
                <span className="day-num">{format(day,'d')}</span>
                <div style={{ display:'flex', gap:2, justifyContent:'center', minHeight:7 }}>
                  {logged      && <div className="day-dot" style={{ margin:0 }} />}
                  {hasPrescribed && <div style={{ width:5, height:5, borderRadius:'50%', background:'#ff6b4a' }} />}
                </div>
              </div>
            );
          })}
          </div>
          <button
            onClick={() => setWeekAnchor(d => addDays(d, 7))}
            style={{ background:'none', border:'none', color:'#6a9a6a', fontSize:20, cursor:'pointer', padding:'0 2px', lineHeight:1, flexShrink:0 }}
          >›</button>
        </div>

        {/*  Month view  */}
        {showMonth && (() => {
          const grid = getMonthGrid(monthYear.year, monthYear.month);
          const todayFmt = fmtDay(today);
          return (
            <div style={{ background:'#0d1e30', border:'1px solid #1e3a55', borderRadius:14, padding:'10px 8px', marginBottom:12 }}>
              {/* Month nav */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <button onClick={prevMonth} style={{ background:'none', border:'none', color:'#ff6b4a', fontSize:18, cursor:'pointer', padding:'0 6px' }}>‹</button>
                <span style={{ fontSize:14, fontWeight:700, color:'#e0f0e0',
                  background:'rgba(29,158,117,0.15)', border:'1px solid rgba(29,158,117,0.5)',
                  borderRadius:20, padding:'3px 16px' }}>
                  {MONTH_NAMES[monthYear.month]} {monthYear.year}
                </span>
                <button onClick={nextMonth} style={{ background:'none', border:'none', color:'#ff6b4a', fontSize:18, cursor:'pointer', padding:'0 6px' }}>›</button>
              </div>

              {/* Day-of-week headers */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
                {['M','T','W','T','F','S','S'].map((d,i) => (
                  <div key={i} style={{ textAlign:'center', fontSize:9, color:'#4a7a9a', fontWeight:700, textTransform:'uppercase' }}>{d}</div>
                ))}
              </div>

              {/* Calendar grid */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
                {grid.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const ds       = fmtDay(day);
                  const isToday  = ds === todayFmt;
                  const isSel    = ds === selectedDate;
                  const logged   = sets.some(s => s.date === ds);
                  const prescribed = getPrescribedForDate(ds) !== null;
                  return (
                    <div
                      key={i}
                      onClick={() => { setSelectedDate(ds); setWeekAnchor(day); setShowMonth(false); }}
                      style={{
                        borderRadius:7, padding:'5px 2px 4px', textAlign:'center', cursor:'pointer',
                        background: isToday ? '#0f2238' : isSel ? '#162d48' : '#0d1e30',
                        border: `1px solid ${isToday ? '#4a9adc' : isSel ? '#ff6b4a' : '#1e3a55'}`,
                        transition:'background .1s',
                      }}
                    >
                      <div style={{ fontSize:12, fontWeight:600, color: isToday ? '#fff' : isSel ? '#ff6b4a' : '#c8e0f0', marginBottom:3 }}>
                        {day.getDate()}
                      </div>
                      <div style={{ display:'flex', justifyContent:'center', gap:2 }}>
                        {logged     && <div style={{ width:5, height:5, borderRadius:'50%', background:'#1d9e75' }} />}
                        {prescribed && <div style={{ width:5, height:5, borderRadius:'50%', background:'#ff6b4a' }} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display:'flex', gap:12, marginTop:10, marginBottom:6 }}>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#1d9e75' }} />
                  <span style={{ fontSize:10, color:'#8bbdd8' }}>Logged</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:7, height:7, borderRadius:'50%', background:'#ff6b4a' }} />
                  <span style={{ fontSize:10, color:'#8bbdd8' }}>Prescribed</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/*  Checklist view (hidden when month is open)  */}
        {!showMonth && (<>

        {/* All-done affirmation banner */}
        {prescribed && (() => {
          const total = prescribed.exercises.length;
          const done  = prescribed.exercises.filter((ex, i) =>
            checkedItems.has(i) || sets.filter(s => s.date === selectedDate && s.ex === ex.name).length >= (parseInt(ex.sets) || 0)
          ).length;
          if (done < total) return null;
          const MSGS = [
            "Fantastic — Workout in the Books! 📖",
            "Awesome! File that under DONE! 🗂️",
            "Beast mode: activated. You crushed it! 💪",
            "That's a wrap. Your future self thanks you! 🙌",
            "Every rep counted. Well done! ✅",
            "Done and dusted. Go recover like a champion! 🏆",
            "You showed up and delivered. That's the game! 🔥",
            "Another one in the vault. Keep stacking! 💼",
          ];
          const msg = MSGS[Math.floor(new Date(selectedDate).getDate() + done) % MSGS.length];
          return (
            <div style={{ background:'linear-gradient(135deg,#2a1a00,#3d2600)', border:'2px solid #c9920a', borderRadius:14, padding:'14px 16px', marginBottom:12, textAlign:'center', boxShadow:'0 0 24px rgba(255,200,50,0.4)' }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#ffd700' }}>{msg}</div>
            </div>
          );
        })()}

        {/* Prescribed workout checklist */}
        {prescribed ? (
          <>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:7, marginTop:4 }}>
              <div className="section-label" style={{ margin:0 }}>{prescribed.name}</div>
              <div style={{ fontSize:10, color:'#6a9a6a' }}>{prescribed.exercises.filter((ex, i) => checkedItems.has(i) || sets.filter(s => s.date === selectedDate && s.ex === ex.name).length >= (parseInt(ex.sets) || 0)).length}/{prescribed.exercises.length} done</div>
            </div>
            <div className="card" style={{ padding:'6px 10px', border:'1px solid #1e3a55', borderRadius:14 }}>
              {(() => {
                const renderExRow = (ex, i) => {
                  const target  = parseInt(ex.sets) || 0;
                  const done    = sets.filter(s => s.date === selectedDate && s.ex === ex.name).length;
                  const checked = checkedItems.has(i) || done >= target;
                  const exIdx   = allExercises.findIndex(e => e.name === ex.name);
                  return (
                    <div
                      key={i}
                      className={`ex-row${curExIdx === exIdx && selectedPIdx === i ? ' selected' : ''}`}
                      style={{ background: checked ? '#0a1410' : undefined, opacity: checked ? 0.6 : 1 }}
                      onClick={() => { if (exIdx !== -1) pickEx(exIdx, i); }}
                    >
                      <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                        <div
                          style={{ width:17, height:17, borderRadius:4, flexShrink:0, border:`1px solid ${checked?'#1d9e75':'#2d4a2d'}`, background:checked?'#1d9e75':'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}
                          onClick={e => {
                            e.stopPropagation();
                            setCheckedItems(prev => { const next = new Set(prev); checked ? next.delete(i) : next.add(i); return next; });
                          }}
                        >
                          {checked && <span style={{ color:'#fff', fontSize:10, lineHeight:1 }}>✓</span>}
                        </div>
                        <div className="ex-name" style={{ textDecoration: checked ? 'line-through' : 'none' }}>{ex.name}</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                        {(() => {
                          const left = Math.max(0, target - done);
                          return (
                            <>
                              {done > 0 && left > 0 && (
                                <span style={{ fontSize:9, color:'#ffb060', fontWeight:700, whiteSpace:'nowrap' }}>{left} left!</span>
                              )}
                              <span className="badge">
                                {done === 0 ? (
                                  <>{target}×{ex.reps || '—'}</>
                                ) : (
                                  <>
                                    <span style={{ textDecoration:'line-through', opacity:0.45 }}>{target}</span>
                                    <span style={{ color: left === 0 ? '#4adbaa' : '#ffb060', marginLeft:3 }}>{left}</span>
                                    ×{ex.reps || '—'}
                                  </>
                                )}
                              </span>
                            </>
                          );
                        })()}
                        <span
                          style={{ fontSize:16, color:'#ff6b4a', cursor:'pointer', padding:'0 2px' }}
                          onClick={e => {
                            e.stopPropagation();
                            if (exIdx === -1) return;
                            pickEx(exIdx, i);
                            setLogExercise({ exIdx, pIdx: i });
                          }}
                        >›</span>
                      </div>
                    </div>
                  );
                };

                // Group consecutive circuit exercises into labeled blocks
                const items = prescribed.exercises;
                const segments = [];
                let idx = 0;
                while (idx < items.length) {
                  const ex = items[idx];
                  if (ex.inCircuit && ex.circuitLabel !== undefined) {
                    const label = ex.circuitLabel;
                    const group = [];
                    while (idx < items.length && items[idx].inCircuit) {
                      group.push({ ex: items[idx], i: idx });
                      idx++;
                    }
                    segments.push({ type: 'circuit', label, group });
                  } else {
                    segments.push({ type: 'exercise', ex, i: idx });
                    idx++;
                  }
                }

                return segments.map((seg, si) => {
                  if (seg.type === 'exercise') return renderExRow(seg.ex, seg.i);
                  return (
                    <div key={`circuit-${si}`}>
                      <div className="circuit-header">{seg.label}</div>
                      <div className="circuit-group">
                        {seg.group.map(({ ex, i }) => renderExRow(ex, i))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        ) : (
          <>
            <div className="section-label" style={{ marginTop:4 }}>Workout</div>
            <div className="card">
              <div style={{ fontSize:12, color:'#3a5a3a', textAlign:'center', padding:'10px 0' }}>No workout prescribed for this day</div>
            </div>
          </>
        )}

        <div style={{ height:10 }} />
        </>)}

      </div>

      {/* Quick-log panel  anchored to bottom, hidden in month view */}
      {!showMonth && (<>
      <div style={{ flexShrink:0, background:'#162d48', padding:'6px 14px 8px', margin:'0 8px 12px', borderRadius:14, border:'1px solid #1e3a55' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
          <span style={{ fontSize:10, color:'#8bbdd8', textTransform:'uppercase', letterSpacing:'.06em' }}>Quick Log</span>
          <span style={{ fontSize:11, fontWeight:700, color:'#5adb9a' }}>{curEx.name}</span>
        </div>

        {isRunning && (
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <button onClick={() => setSprintMode(false)} style={{ flex:1, padding:'8px 6px', borderRadius:9, border:'2px solid', cursor:'pointer', fontWeight:700, fontSize:11, transition:'all .15s', background:!sprintMode?'#0d1e30':'#0d1e30', borderColor:!sprintMode?'#4a9adc':'#1e3a55', color:!sprintMode?'#7dd8ff':'#8bbdd8' }}>🏃 Distance Run</button>
            <button onClick={() => setSprintMode(true)}  style={{ flex:1, padding:'8px 6px', borderRadius:9, border:'2px solid', cursor:'pointer', fontWeight:700, fontSize:11, transition:'all .15s', background:sprintMode?'#2a1a00':'#0d1e30', borderColor:sprintMode?'#ff6b4a':'#1e3a55', color:sprintMode?'#ff6b4a':'#8bbdd8' }}>⚡ Sprint / Timed</button>
          </div>
        )}

        {fieldDef.map((row, ri) => (
          <div key={ri} className="field-row" style={{ marginBottom:4 }}>
            {row.fields.map(f => {
              const isRestField   = f.id === 'rest';
              const isWeightField = (f.id === 'weight' && effectType === 'strength') || (f.id === 'added' && effectType === 'bodyweight');
              const isDistField   = f.id === 'dist'  && (effectType === 'cardio' || effectType === 'cycling');
              const isSprintDist  = f.id === 'sdist' && effectType === 'sprint';
              return (
                <div key={isRestField ? `rest-${curExIdx}` : f.id} className="field-wrap">
                  <label className="field-label">{f.label}</label>
                  {isRestField ? (
                    <RestTimerField defaultDur={parseInt(f.ph) || 90} onChange={v => setVal('rest', v)} />
                  ) : isWeightField ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input className="input-field" style={{ flex:1 }} placeholder={`${f.ph} ${weightUnit === 'lb' ? 'lbs' : weightUnit}`} value={fieldVals[f.id]||''} onChange={e => setVal(f.id, e.target.value)} type="number" />
                      <button onClick={() => setWeightUnit(u => u === 'lb' ? 'kg' : 'lb')} style={{ background:'#1e3a55', border:'1px solid #2d4a6a', borderRadius:7, padding:'6px 10px', fontSize:12, color:'#5adb9a', cursor:'pointer', fontWeight:700, minWidth:36 }}>{weightUnit}</button>
                    </div>
                  ) : isDistField ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input className="input-field" style={{ flex:1 }} placeholder={f.ph} value={fieldVals[f.id]||''} onChange={e => setVal(f.id, e.target.value)} type="number" />
                      <select value={distUnit} onChange={e => setDistUnit(e.target.value)} style={{ background:'#1e3a55', border:'1px solid #2d4a6a', borderRadius:7, padding:'6px 4px', fontSize:12, color:'#5adb9a', cursor:'pointer', outline:'none', fontWeight:600 }}>
                        {DIST_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  ) : isSprintDist ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input className="input-field" style={{ flex:1 }} placeholder="e.g. 100" value={fieldVals[f.id]||''} onChange={e => setVal(f.id, e.target.value)} type="number" />
                      <select value={sprintUnit} onChange={e => setSprintUnit(e.target.value)} style={{ background:'#1e3a55', border:'1px solid #2d4a6a', borderRadius:7, padding:'6px 4px', fontSize:12, color:'#e8a030', cursor:'pointer', outline:'none', fontWeight:600 }}>
                        {SPRINT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  ) : (
                    <input className="input-field" placeholder={f.ph} value={fieldVals[f.id]||''} onChange={e => setVal(f.id, e.target.value)} type={NUMERIC_FIELDS.has(f.id) ? 'number' : 'text'} />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div style={{ display:'flex', gap:8, marginTop:4 }}>
          <button className="notes-btn" style={{ flex:1, marginTop:0 }} onClick={onOpenNotes}>
            📝
                          <span className="notes-preview" style={{ color: noteText ? '#9ae0b0' : undefined }}>{noteText || 'Add a note...'}</span>
            <span style={{ color:'#3a5a3a', marginLeft:'auto' }}>›</span>
          </button>
          <button className="btn-fde" style={{ flex:1, background:'#1a7a4a', boxShadow:'0 0 14px rgba(29,158,117,0.35)' }} onClick={handleSave}>Save Set</button>
        </div>
        {flash && <div className="flash">✓ Set saved!</div>}
      </div>
      </>)}
      {blankWarning && <BlankWarningModal message={blankWarning} onConfirm={doSave} onCancel={() => setBlankWarning(null)} />}
    </div>
  );
}

function BlankWarningModal({ onConfirm, onCancel, message }) {
  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.75)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000,
    }}>
      <div style={{
        background:'#0d1e30', border:'2px solid #cc2222', borderRadius:16,
        padding:'24px 20px', width:300, maxWidth:'85vw',
        boxShadow:'0 0 32px rgba(200,30,30,0.5)',
      }}>
        <div style={{ fontSize:17, fontWeight:700, marginBottom:10 }}>
          <span style={{ color:'#ff6b4a' }}>⚠ </span>
          <span style={{ color:'#ffffff' }}>MISSING FIELDS</span>
        </div>
        <div style={{ fontSize:13, color:'#c8e0f0', marginBottom:20, lineHeight:1.6 }}>
          {message || 'Weight or reps are blank. Are you sure you want to save this set?'}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={onConfirm}
            style={{ flex:1, padding:11, borderRadius:9, background:'#cc2222', border:'none', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer' }}
          >Save Anyway</button>
          <button
            onClick={onCancel}
            style={{ flex:1, padding:11, borderRadius:9, background:'#0d1e30', border:'1px solid #1e3a55', color:'#8bbdd8', fontSize:13, cursor:'pointer' }}
          >Go Back</button>
        </div>
      </div>
    </div>
  );
}
