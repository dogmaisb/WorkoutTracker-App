import { useBackground } from '../useBackground';
import React, { useState, useEffect, useRef } from 'react';
import {
  loadSets, saveSets, deleteSet, getPR, getVolumePR, setMainValue,
  PR_METRIC, METRIC_LABELS, FIELD_DEFS,
  getStrengthPRs, getGenericPRs, getPRsForSet, calcSetVolume,
} from '../storage';

const BASE_EX = [
  'Bench press','Incline bench press','Squat','Front squat','Deadlift','Romanian deadlift',
  'OHP','Barbell row','Barbell rows supinated','Dumbbell rows','Chest supported dumbbell rows','Chest supported T-bar rows',
  'Lat pulldown','Cable row','Leg press','Leg curl','Leg extension',
  'Hip thrust','Calf raise','Dumbbell curl','Skull crusher','Tricep pushdown','Face pull','Shrug',
  'Clean','Hang clean','Power clean','Clean pull','Clean high pull',
  'Snatch','Hang snatch','Power snatch','Snatch pull','Snatch high pull',
  'Jerk','Rack jerk','Squat jerk','Overhead squat',
  'Pull-ups','Chin-ups','Push-ups','Dips','Inverted rows','Burpees',
  'Interval Sprints 100m',
  'Running','Rowing','Walking','Swimming','Jump rope','Rowing machine','Elliptical','Cycling',
];

const DIST_UNITS   = ['mi', 'km', 'm', 'yd', 'ft'];
const SPRINT_UNITS = ['yd', 'm', 'mi', 'km', 'ft'];
const WEIGHT_UNITS = ['lb', 'kg'];

// ── History Index ─────────────────────────────────────────────────────────────
export function HistoryScreen({ onOpenDetail, onOpenAllEx, stateVersion }) {
  const bgStyle = useBackground("history");
  const [sets,   setSets]   = useState([]);
  const [search, setSearch] = useState('');
  const prRef   = useRef(null);
  const dragRef = useRef({ dragging: false, startX: 0, scrollLeft: 0 });
  const velRef  = useRef({ v: 0, lastX: 0, lastT: 0, raf: null });

  useEffect(() => { setSets(loadSets()); }, [stateVersion]);

  function onPrMouseDown(e) {
    cancelAnimationFrame(velRef.current.raf);
    dragRef.current = { dragging: true, startX: e.pageX, scrollLeft: prRef.current.scrollLeft };
    velRef.current  = { v: 0, lastX: e.pageX, lastT: Date.now(), raf: null };
    prRef.current.style.cursor = 'grabbing';
  }
  function onPrMouseMove(e) {
    if (!dragRef.current.dragging) return;
    e.preventDefault();
    const now = Date.now();
    const dt  = now - velRef.current.lastT;
    const dx  = e.pageX - velRef.current.lastX;
    if (dt > 0) velRef.current.v = velRef.current.v * 0.6 + (dx / dt) * 0.4;
    velRef.current.lastX = e.pageX;
    velRef.current.lastT = now;
    prRef.current.scrollLeft = dragRef.current.scrollLeft - (e.pageX - dragRef.current.startX);
  }
  function onPrMouseUp() {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    prRef.current.style.cursor = 'grab';
    let v = velRef.current.v * -18;
    const FRICTION = 0.91;
    function momentum() {
      if (!prRef.current || Math.abs(v) < 0.4) return;
      prRef.current.scrollLeft += v;
      v *= FRICTION;
      velRef.current.raf = requestAnimationFrame(momentum);
    }
    velRef.current.raf = requestAnimationFrame(momentum);
  }

  const allEx = [...new Set([...BASE_EX, ...sets.map(s => s.ex)])];

  // Only exercises with at least one logged set, alphabetical
  const recordedEx = allEx
    .filter(ex => sets.some(s => s.ex === ex))
    .sort((a, b) => a.localeCompare(b));

  const filtered = search.trim()
    ? recordedEx.filter(e => e.toLowerCase().includes(search.toLowerCase()))
    : recordedEx;
  const prs = allEx.flatMap(ex => {
    const cards = [];
    const pr = getPR(sets, ex);
    if (pr) cards.push({ ex, pr });
    const vpr = getVolumePR(sets, ex);
    if (vpr) cards.push({ ex, pr: vpr });
    return cards;
  });
  const sortedPrs = search.trim()
    ? [...prs].sort((a, b) => {
        const aMatch = a.ex.toLowerCase().includes(search.toLowerCase());
        const bMatch = b.ex.toLowerCase().includes(search.toLowerCase());
        return aMatch === bMatch ? 0 : aMatch ? -1 : 1;
      })
    : prs;

  return (
    <div className="screen history-page" style={bgStyle}>
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar"><h1>History</h1></div>

      {/* Fixed header — search + PRs */}
      <div style={{ flexShrink:0, padding:'14px 16px 8px' }}>
        <div className="search-bar">
          <span style={{ color:'#6a9a6a' }}>🔍</span>
          <input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <span style={{ cursor:'pointer', color:'#6a9a6a' }} onClick={() => setSearch('')}>✕</span>}
        </div>

        <div className="section-label">Personal Records</div>
        {prs.length > 0 ? (
          <div
            ref={prRef}
            className="pr-strip"
            style={{ cursor:'grab', userSelect:'none' }}
            onMouseDown={onPrMouseDown}
            onMouseMove={onPrMouseMove}
            onMouseUp={onPrMouseUp}
            onMouseLeave={onPrMouseUp}
          >
            {sortedPrs.map(({ ex, pr }) => (
              <div key={ex} className="pr-card">
                <div className="pr-ex">{ex}</div>
                <div className="pr-val">{pr.val}</div>
                <div className="pr-lbl">{pr.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize:12, color:'#3a5a3a', marginBottom:4 }}>Log sets to see your PRs here</p>
        )}
      </div>

      {/* Scrollable exercises list */}
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 12px', borderTop:'1px solid #2d4a2d' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8, marginBottom:6 }}>
          <div className="section-label" style={{ margin:0 }}>Exercises</div>
          <button onClick={onOpenAllEx} style={{
            background:'rgba(200,168,74,0.12)', border:'1px solid rgba(200,168,74,0.4)',
            borderRadius:20, padding:'3px 10px', cursor:'pointer',
            fontSize:9, color:'#c8a84a', fontWeight:700, letterSpacing:'0.05em',
          }}>ALL EXERCISES</button>
        </div>
        {!filtered.length && <div className="empty">No exercises found</div>}
        {filtered.map(ex => {
          const exSets  = sets.filter(s => s.ex === ex);
          const last    = exSets.length ? exSets[exSets.length - 1] : null;
          const lastVal = last ? setMainValue(last) : '—';
          const lastTime = last ? `${last.date} · ${last.time}` : 'No entries yet';
          return (
            <div key={ex} className="ei-row" onClick={() => onOpenDetail(ex)}>
              <div>
                <div className="ei-name">{ex}</div>
                <div className="ei-sub">{exSets.length} set{exSets.length !== 1 ? 's' : ''} logged</div>
              </div>
              <div>
                <div className="ei-val">{lastVal}</div>
                <div className="ei-time">{lastTime}</div>
              </div>
            </div>
          );
        })}
        <div style={{ height:12 }} />
      </div>
    </div>
  );
}

// ── All Exercises Screen ──────────────────────────────────────────────────────
export function AllExercisesScreen({ onBack, onOpenDetail, stateVersion }) {
  const bgStyle = useBackground("history");
  const [sets,   setSets]   = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => { setSets(loadSets()); }, [stateVersion]);

  const allEx = [...new Set([...BASE_EX, ...sets.map(s => s.ex)])]
    .sort((a, b) => a.localeCompare(b));

  const filtered = search.trim()
    ? allEx.filter(e => e.toLowerCase().includes(search.toLowerCase()))
    : allEx;

  return (
    <div className="screen history-page" style={bgStyle}>
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar" style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'#6a9a6a', fontSize:20, cursor:'pointer', padding:0, lineHeight:1 }}>←</button>
        <h1 style={{ margin:0 }}>All Exercises</h1>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 12px' }}>
        <div className="search-bar" style={{ margin:'10px 0 12px' }}>
          <span style={{ color:'#6a9a6a' }}>🔍</span>
          <input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <span style={{ cursor:'pointer', color:'#6a9a6a' }} onClick={() => setSearch('')}>✕</span>}
        </div>
        <div style={{ fontSize:11, color:'#3a5a3a', marginBottom:10 }}>{filtered.length} exercise{filtered.length !== 1 ? 's' : ''}</div>
        {filtered.map(ex => {
          const exSets  = sets.filter(s => s.ex === ex);
          const last    = exSets.length ? exSets[exSets.length - 1] : null;
          const lastVal = last ? setMainValue(last) : '—';
          const lastTime = last ? `${last.date} · ${last.time}` : 'No entries yet';
          return (
            <div key={ex} className="ei-row" onClick={() => onOpenDetail(ex)}>
              <div>
                <div className="ei-name">{ex}</div>
                <div className="ei-sub">{exSets.length} set{exSets.length !== 1 ? 's' : ''} logged</div>
              </div>
              <div>
                <div className="ei-val">{lastVal}</div>
                <div className="ei-time">{lastTime}</div>
              </div>
            </div>
          );
        })}
        <div style={{ height:12 }} />
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ set, onSave, onDelete, onClose }) {
  const fieldDef = FIELD_DEFS[set.type] || FIELD_DEFS.strength;
  const [vals, setVals] = useState({ ...set.vals });
  const [note, setNote] = useState(set.note || '');
  const [distUnit,   setDistUnit]   = useState(set.vals.distUnit   || 'mi');
  const [sprintUnit, setSprintUnit] = useState(set.vals.sprintUnit || 'yd');
  const [weightUnit, setWeightUnit] = useState(set.vals.weightUnit || 'lb');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSave() {
    const valsToSave = { ...vals };
    if ((set.type === 'cardio' || set.type === 'cycling') && valsToSave.dist) {
      valsToSave.distUnit = distUnit;
    }
    if (set.type === 'sprint' && valsToSave.sdist) {
      valsToSave.sprintUnit = sprintUnit;
    }
    if ((set.type === 'strength' || set.type === 'bodyweight') && (valsToSave.weight || valsToSave.added)) {
      valsToSave.weightUnit = weightUnit;
    }
    onSave(set.id, valsToSave, note);
    onClose();
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    onDelete(set.id);
    onClose();
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000,
    }} onClick={onClose}>
      <div style={{
        background:'#1f2f1f', border:'1px solid #2d4a2d', borderRadius:16,
        padding:20, width:340, maxWidth:'90vw',
      }} onClick={e => e.stopPropagation()}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div style={{ fontSize:15, fontWeight:700, color:'#e0f0e0' }}>Edit Set</div>
          <div style={{ fontSize:11, color:'#6a9a6a' }}>{set.date} · {set.time}</div>
        </div>

        {fieldDef.map((row, ri) => (
          <div key={ri} className="field-row">
            {row.fields.map(f => {
              const isWeightField = (f.id === 'weight' && set.type === 'strength') || (f.id === 'added' && set.type === 'bodyweight');
              const isDistField   = f.id === 'dist'  && (set.type === 'cardio' || set.type === 'cycling');
              const isSprintDist  = f.id === 'sdist' && set.type === 'sprint';
              return (
                <div key={f.id} className="field-wrap">
                  <label className="field-label">{f.label}</label>
                  {isWeightField ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input
                        className="input-field"
                        style={{ flex:1 }}
                        placeholder={f.ph}
                        value={vals[f.id] || ''}
                        onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))}
                        type="number"
                      />
                      <select
                        value={weightUnit}
                        onChange={e => setWeightUnit(e.target.value)}
                        style={{
                          background:'#152515', border:'1px solid #2d4a2d',
                          borderRadius:7, padding:'6px 4px', fontSize:12,
                          color:'#5adb9a', cursor:'pointer', outline:'none',
                          fontWeight:600,
                        }}
                      >
                        {WEIGHT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  ) : isDistField ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input
                        className="input-field"
                        style={{ flex:1 }}
                        placeholder={f.ph}
                        value={vals[f.id] || ''}
                        onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))}
                        type="number"
                      />
                      <select
                        value={distUnit}
                        onChange={e => setDistUnit(e.target.value)}
                        style={{
                          background:'#152515', border:'1px solid #2d4a2d',
                          borderRadius:7, padding:'6px 4px', fontSize:12,
                          color:'#5adb9a', cursor:'pointer', outline:'none',
                          fontWeight:600,
                        }}
                      >
                        {DIST_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  ) : isSprintDist ? (
                    <div style={{ display:'flex', gap:4 }}>
                      <input
                        className="input-field"
                        style={{ flex:1 }}
                        placeholder={f.ph}
                        value={vals[f.id] || ''}
                        onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))}
                        type="number"
                      />
                      <select
                        value={sprintUnit}
                        onChange={e => setSprintUnit(e.target.value)}
                        style={{
                          background:'#152515', border:'1px solid #2d4a2d',
                          borderRadius:7, padding:'6px 4px', fontSize:12,
                          color:'#e8a030', cursor:'pointer', outline:'none',
                          fontWeight:600, width:36, flexShrink:0,
                        }}
                      >
                        {SPRINT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  ) : (
                    <input
                      className="input-field"
                      placeholder={f.ph}
                      value={vals[f.id] || ''}
                      onChange={e => setVals(v => ({ ...v, [f.id]: e.target.value }))}
                      type={f.id === 'sdist' || f.id === 'surf' || f.id === 'pace' ? 'text' : 'number'}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <label className="field-label" style={{ marginTop:6, display:'block' }}>Note</label>
        <textarea
          style={{
            width:'100%', background:'#152515', border:'1px solid #2d4a2d',
            borderRadius:7, padding:'7px 9px', fontSize:12, color:'#e0f0e0',
            resize:'none', height:64, outline:'none', marginBottom:14,
            fontFamily:'inherit',
          }}
          placeholder="Notes..."
          value={note}
          onChange={e => setNote(e.target.value)}
        />

        <div style={{ display:'flex', gap:8 }}>
          <button className="btn-fde" style={{ flex:2 }} onClick={handleSave}>Save Changes</button>
          <button
            onClick={handleDelete}
            style={{
              flex:1, padding:10, border:'none', borderRadius:9, cursor:'pointer',
              background: confirmDelete ? '#7a1a1a' : '#2a1a1a',
              color: confirmDelete ? '#ffaaaa' : '#cc4444',
              fontSize:12, fontWeight:700, transition:'background .2s',
            }}
          >
            {confirmDelete ? 'Confirm' : '🗑 Delete'}
          </button>
        </div>
        {confirmDelete && (
          <div style={{ fontSize:11, color:'#cc4444', textAlign:'center', marginTop:6 }}>
            Tap Confirm to permanently delete this set
          </div>
        )}

        <button
          className="btn-secondary"
          style={{ width:'100%', marginTop:8, fontSize:12 }}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Detail Screen ─────────────────────────────────────────────────────────────
export function DetailScreen({ exerciseName, onBack }) {
  const bgStyle = useBackground("history");
  const [sets,    setSets]    = useState([]);
  const [editing, setEditing] = useState(null); // set object being edited

  function reload() { setSets(loadSets()); }
  useEffect(() => { reload(); }, []);

  const exSets = sets.filter(s => s.ex === exerciseName);
  const sorted = [...exSets].sort((a, b) => b.id - a.id); // newest first
  const type   = exSets.length ? exSets[0].type : 'strength';
  const pm     = PR_METRIC[type] || 'reps';
  const isTime = type === 'sprint';

  // ── Correct PR calculation ──
  // For strength: separate weight PR and reps PR, only strictly increasing
  // For others: single metric, strictly increasing (or decreasing for sprints)
  let prData = null;
  if (type === 'strength') {
    prData = getStrengthPRs(sets, exerciseName);
  } else {
    const g = getGenericPRs(sets, exerciseName, type);
    prData = { prSet: g.prSet, best: g.best };
  }

  // Stats
  const vals  = exSets.map(s => parseFloat(s.vals[pm])).filter(v => !isNaN(v));
  const best  = vals.length ? (isTime ? Math.min(...vals) : Math.max(...vals)) : null;
  const avg   = vals.length ? (vals.reduce((a,b) => a+b, 0) / vals.length).toFixed(1) : null;

  // Volume stats (strength + bodyweight only)
  const hasVolume = type === 'strength' || type === 'bodyweight';
  const sessionVolumes = (() => {
    if (!hasVolume) return [];
    const byDate = {};
    exSets.forEach(s => {
      const vol = calcSetVolume(s);
      if (vol > 0) byDate[s.date] = (byDate[s.date] || 0) + vol;
    });
    return Object.values(byDate);
  })();
  const peakVolume  = sessionVolumes.length ? Math.max(...sessionVolumes) : null;
  const totalVolume = exSets.reduce((sum, s) => sum + calcSetVolume(s), 0);

  // PR display for stat box
  const prDisplay = type === 'strength'
    ? (prData.bestWeight !== null ? `${prData.bestWeight} lb` : '—')
    : (prData.best !== null ? (isTime ? prData.best.toFixed(2)+'s' : String(prData.best)) : '—');
  const prLabel = type === 'strength' ? 'Weight PR' : (METRIC_LABELS[pm] || pm) + ' PR';

  // Best reps for strength
  const bestRepsDisplay = type === 'strength' && prData.bestReps !== null
    ? `${prData.bestReps} reps`
    : null;

  function handleSaveEdit(id, newVals, newNote) {
    const allSets = loadSets();
    const updated = allSets.map(s =>
      s.id === id ? { ...s, vals: { ...s.vals, ...newVals }, note: newNote } : s
    );
    saveSets(updated);
    setSets(loadSets());
  }

  function handleDelete(id) {
    deleteSet(id);
    setSets(loadSets());
  }

  function SetRow({ set }) {
    const main   = setMainValue(set);
    const prLabels = type === 'strength'
      ? getPRsForSet(prData, set)
      : (prData.prSet && prData.prSet.has(set.id) ? ['PR'] : []);

    const sub = Object.entries(set.vals)
      .filter(([k]) => k !== 'weight' && k !== 'reps' && k !== pm)
      .slice(0, 2)
      .map(([k, v]) => `${METRIC_LABELS[k]||k}: ${v}`)
      .join(' · ');

    // For strength show weight + reps together
    const displayVal = set.type === 'strength'
      ? `${set.vals.weight ? set.vals.weight + ' lb' : 'No Weight'} × ${set.vals.reps || '?'} reps`
      : main;

    const hasPR = prLabels.length > 0;
    const setVol = calcSetVolume(set);

    return (
      <div
        className={`detail-row${hasPR ? ' is-pr' : ''}`}
        style={{ cursor:'pointer' }}
        onClick={() => setEditing(set)}
      >
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div className="dr-val">{displayVal}</div>
            <div style={{ fontSize:11, color:'#6a9a6a' }}>✎</div>
          </div>
          {sub && <div style={{ fontSize:11, color:'#6a9a6a', marginTop:2 }}>{sub}</div>}
          {setVol > 0 && <div style={{ fontSize:10, color:'rgba(74,219,170,0.7)', marginTop:2 }}>{setVol.toLocaleString()} lb vol</div>}
          {set.note && <div className="dr-note">{set.note}</div>}
          {prLabels.length > 0 && (
            <div style={{ display:'flex', gap:5, marginTop:4, flexWrap:'wrap' }}>
              {prLabels.map(lbl => (
                <span key={lbl} className="pr-badge">{lbl}</span>
              ))}
            </div>
          )}
        </div>
        <div style={{ textAlign:'right', flexShrink:0, marginLeft:10 }}>
          <div className="dr-date">{set.date}</div>
          <div className="dr-time">{set.time}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen history-page">
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="scroll" style={{ paddingTop:12 }}>
        <button className="back-btn" onClick={onBack}>← History</button>

        <div style={{ fontSize:20, fontWeight:700, color:'#e8d8a0', marginBottom:2 }}>{exerciseName}</div>
        <div style={{ fontSize:12, color:'#7a6a3a', marginBottom:12 }}>{exSets.length} total sets logged · tap any set to edit</div>

        {/* Stats */}
        {(() => {
          const cols = [1, bestRepsDisplay ? 1 : 0, 1, 1, hasVolume ? 1 : 0].filter(Boolean).length;
          return (
            <div className="stat-row" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
              <div className="stat-box">
                <div className="val">{prDisplay}</div>
                <div className="lbl">{prLabel}</div>
              </div>
              {bestRepsDisplay && (
                <div className="stat-box">
                  <div className="val">{bestRepsDisplay}</div>
                  <div className="lbl">Reps PR</div>
                </div>
              )}
              <div className="stat-box">
                <div className="val">{avg || '—'}{isTime && avg ? 's' : ''}</div>
                <div className="lbl">Avg {METRIC_LABELS[pm]||pm}</div>
              </div>
              <div className="stat-box">
                <div className="val">{exSets.length}</div>
                <div className="lbl">Total Sets</div>
              </div>
              {hasVolume && (
                <div className="stat-box">
                  <div className="val" style={{ fontSize: peakVolume && peakVolume >= 10000 ? 11 : undefined }}>
                    {peakVolume ? peakVolume.toLocaleString() : '—'}
                  </div>
                  <div className="lbl">Peak Session</div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Volume summary banner */}
        {hasVolume && totalVolume > 0 && (
          <div style={{ fontSize:11, color:'rgba(0,255,136,0.75)', background:'rgba(0,255,136,0.05)', border:'1px solid rgba(0,255,136,0.18)', borderRadius:8, padding:'8px 12px', marginBottom:10, lineHeight:1.5, display:'flex', justifyContent:'space-between' }}>
            <span>Total Lifetime Volume</span>
            <strong style={{ color:'#00ff88' }}>{totalVolume.toLocaleString()} lb</strong>
          </div>
        )}

        {/* PR rules note for strength */}
        {type === 'strength' && (
          <div style={{ fontSize:11, color:'#a08040', background:'#1e1508', border:'1px solid #5a4a20', borderRadius:8, padding:'8px 12px', marginBottom:10, lineHeight:1.5 }}>
            🏆 <strong style={{ color:'#e8c84a' }}>Weight PR</strong> = highest weight ever lifted &nbsp;·&nbsp;
            <strong style={{ color:'#e8c84a' }}>Reps PR</strong> = most reps ever performed at that weight
          </div>
        )}

        <div className="section-label">Most Recent Entry</div>
        {sorted.length > 0
          ? <SetRow set={sorted[0]} />
          : <div className="empty">No entries yet</div>}

        {sorted.length > 1 && (<>
          <div className="section-label" style={{ marginTop:10 }}>All Sets</div>
          {sorted.slice(1).map(set => <SetRow key={set.id} set={set} />)}
        </>)}

        <div style={{ height:30 }} />
      </div>

      {editing && (
        <EditModal
          set={editing}
          onSave={handleSaveEdit}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
