import { useBackground } from '../useBackground';
import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { loadSets, METRIC_DEFS, METRIC_LABELS } from '../storage';

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
  return (
    <div style={{ background:'#2a1008', border:'1px solid #ff6b35', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#f0d8c0' }}>
      <div style={{ color:'#9a6a4a', marginBottom:2 }}>{label}</div>
      <div style={{ fontWeight:700, color:'#ff9a60' }}>{payload[0].value} {unit}</div>
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
        <CartesianGrid stroke="rgba(255,107,53,0.15)" strokeDasharray="3 3" />
        <XAxis dataKey="date" tick={{ fill:'#7a4a2a', fontSize:9 }} tickLine={false} axisLine={{ stroke:'#3a1a08' }} />
        <YAxis tick={{ fill:'#7a4a2a', fontSize:9 }} tickLine={false} axisLine={{ stroke:'#3a1a08' }} reversed={!!yReversed} />
        <Tooltip content={<UnitTooltip unit={unit||''} />} />
        <Area type="monotone" dataKey="val" stroke={color} strokeWidth={2.5}
          fill={`url(#${gradId})`}
          dot={{ fill: color, r:4, stroke:'#1f1008', strokeWidth:1.5 }}
          activeDot={{ r:6, stroke: color, strokeWidth:2, fill:'#1f1008' }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function ProgressScreen({ stateVersion }) {
  const [sets,      setSets]      = useState([]);
  const [search,    setSearch]    = useState('');
  const [selEx,     setSelEx]     = useState('Bench press');
  const [selMet,    setSelMet]    = useState('weight');
  // For distance running: selected unit filter ('all' or a specific unit)
  const [distFilter, setDistFilter] = useState('all');
  // For sprints: selected combo key "dist|unit"
  const [selSprint,  setSelSprint]  = useState(null);

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
  function genericChartData(met) {
    return sets
      .filter(s => s.ex === activeEx && s.vals[met] !== undefined)
      .map(s => ({ val: parseFloat(s.vals[met]), date: s.date }))
      .filter(p => !isNaN(p.val));
  }

  const genData  = genericChartData(activeMet);
  const genNums  = genData.map(p => p.val);
  const genBest  = genNums.length ? String(Math.max(...genNums)) : '—';
  const genAvg   = genNums.length ? (genNums.reduce((a,b)=>a+b,0)/genNums.length).toFixed(1) : '—';
  const genTotal = sets.filter(s => s.ex === activeEx).length;

  const unitLabel = METRIC_LABELS[activeMet]
    ? METRIC_LABELS[activeMet].match(/\(([^)]+)\)/)?.[1] || ''
    : '';

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
              onClick={() => { setSelEx(ex); setSelMet(null); setSelSprint(null); setDistFilter('all'); }}>
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
            <div className="stat-box"><div className="val">{genBest}</div><div className="lbl">Best</div></div>
            <div className="stat-box"><div className="val">{genAvg}</div><div className="lbl">Avg</div></div>
            <div className="stat-box"><div className="val">{genTotal}</div><div className="lbl">Sets</div></div>
          </div>
          <div className="chart-card">
            <div className="chart-title">
              {genData.length >= 2
                ? `${activeEx} · ${METRIC_LABELS[activeMet]||activeMet}`
                : 'Log more sets to see chart'}
            </div>
            <ChartBlock data={genData} color="#ff7a40" unit={unitLabel} height={130} />
          </div>
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
              color="#ff7a40"
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
                <div className="stat-box"><div className="val" style={{ color:'#ffd700' }}>{sprintBest}</div><div className="lbl">Best</div></div>
                <div className="stat-box"><div className="val" style={{ color:'#ffd700' }}>{sprintAvg}</div><div className="lbl">Avg</div></div>
                <div className="stat-box"><div className="val" style={{ color:'#ffd700' }}>{selGroup.sets.length}</div><div className="lbl">Runs</div></div>
              </div>
              <ChartBlock data={sprintPts} color="#ffd700" yReversed unit="sec" height={110} />
            </div>
          )}

        </>)}

        <div style={{ height:20 }} />
      </div>
    </div>
  );
}
