import { useBackground } from '../useBackground';
import React, { useState, useEffect } from 'react';

// ── Persistence ───────────────────────────────────────────────────────────────
const DIET_KEY = 'wt_diet_v1';
function loadDiet() {
  try { return JSON.parse(localStorage.getItem(DIET_KEY)) || {}; } catch { return {}; }
}
function saveDiet(data) {
  try { localStorage.setItem(DIET_KEY, JSON.stringify(data)); } catch {}
}

// ── TDEE helpers ──────────────────────────────────────────────────────────────
const ACTIVITY = [
  { key:'sedentary',  label:'Sedentary',        desc:'Little/no exercise', mul:1.2   },
  { key:'light',      label:'Lightly Active',   desc:'1–3 days/wk',        mul:1.375 },
  { key:'moderate',   label:'Moderately Active',desc:'3–5 days/wk',        mul:1.55  },
  { key:'active',     label:'Very Active',      desc:'6–7 days/wk',        mul:1.725 },
  { key:'athlete',    label:'Athlete',          desc:'2× training/day',    mul:1.9   },
];
const GOAL_OFFSETS = [
  { key:'lose2',    label:'Lose 2 lb/wk',   offset:-1000 },
  { key:'lose1',    label:'Lose 1 lb/wk',   offset:-500  },
  { key:'lose05',   label:'Lose 0.5 lb/wk', offset:-250  },
  { key:'maintain', label:'Maintain',        offset:0     },
  { key:'gain05',   label:'Gain 0.5 lb/wk', offset:250   },
  { key:'gain1',    label:'Gain 1 lb/wk',   offset:500   },
];

function calcTDEE({ age, weight, height, gender, activity }) {
  const a = parseFloat(age), w = parseFloat(weight), h = parseFloat(height);
  if (!a || !w || !h) return null;
  const bmr = gender === 'female'
    ? 10 * w * 0.453592 + 6.25 * h * 2.54 - 5 * a - 161
    : 10 * w * 0.453592 + 6.25 * h * 2.54 - 5 * a + 5;
  const mul = ACTIVITY.find(x => x.key === activity)?.mul || 1.55;
  return Math.round(bmr * mul);
}

// ── Macro fields ──────────────────────────────────────────────────────────────
const MACROS = [
  { id:'carbs',  label:'Carbs',   unit:'g',  color:'#f4a261' },
  { id:'fats',   label:'Fats',    unit:'g',  color:'#ff6b4a' },
  { id:'protein',label:'Protein', unit:'g',  color:'#7dd8ff' },
  { id:'chol',   label:'Cholesterol', unit:'mg', color:'#a78bfa' },
  { id:'sodium', label:'Sodium',  unit:'mg', color:'#7dff4f' },
];

// ── Meal config ───────────────────────────────────────────────────────────────
const MEALS = [
  { key:'breakfast', label:'Breakfast', color:'#f4a261', bg:'rgba(244,162,97,0.12)',  border:'rgba(244,162,97,0.4)',  icon:'🌅' },
  { key:'lunch',     label:'Lunch',     color:'#7dd8ff', bg:'rgba(125,216,255,0.12)', border:'rgba(125,216,255,0.4)', icon:'☀️' },
  { key:'dinner',    label:'Dinner',    color:'#a78bfa', bg:'rgba(167,139,250,0.12)', border:'rgba(167,139,250,0.4)', icon:'🌙' },
  { key:'snacks',    label:'Snacks',    color:'#7dff4f', bg:'rgba(125,255,79,0.12)',  border:'rgba(125,255,79,0.4)',  icon:'🍎' },
];

// ── Aggregate macros across all meals ─────────────────────────────────────────
function sumMacros(mealItems) {
  const totals = { carbs:0, fats:0, protein:0, chol:0, sodium:0 };
  Object.values(mealItems).forEach(items =>
    items.forEach(item =>
      MACROS.forEach(m => { totals[m.id] += parseFloat(item[m.id]) || 0; })
    )
  );
  // Round to 1 decimal
  Object.keys(totals).forEach(k => { totals[k] = Math.round(totals[k] * 10) / 10; });
  return totals;
}

// ── Calorie Ring ──────────────────────────────────────────────────────────────
function CalorieRing({ total, goal, mealTotals, macros }) {
  const SIZE = 250, cx = 125, cy = 125, R = 72, stroke = 16;
  const circ = 2 * Math.PI * R;
  const over = goal > 0 && total > goal;

  let segments = [], cumFrac = 0;
  MEALS.forEach(m => {
    const cal = mealTotals[m.key] || 0;
    if (!cal || !goal) return;
    const frac = Math.min(cal / goal, 1 - cumFrac);
    if (frac <= 0) return;
    segments.push({ color: m.color, startFrac: cumFrac, frac });
    cumFrac += frac;
  });

  const pct = goal > 0 ? Math.round((total / goal) * 100) : 0;
  const remaining = goal - total;

  // Corner label helper
  const corner = (content, x, y, align='middle') => (
    <text x={x} y={y} textAnchor={align} fontFamily="system-ui,sans-serif">{content}</text>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', margin:'0 0 4px' }}>
      <svg width={SIZE} height={SIZE}>
        {/* Track */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1e3a55" strokeWidth={stroke} />

        {/* Meal arc segments */}
        {segments.map((seg, i) => {
          const dashLen = seg.frac * circ;
          const offset  = circ * 0.25 - seg.startFrac * circ;
          return (
            <circle key={i} cx={cx} cy={cy} r={R}
              fill="none" stroke={seg.color} strokeWidth={stroke}
              strokeDasharray={`${dashLen} ${circ - dashLen}`}
              strokeDashoffset={offset}
              strokeLinecap="butt"
              style={{ transition:'all .5s ease' }}
            />
          );
        })}

        {over && (
          <circle cx={cx} cy={cy} r={R} fill="none"
            stroke="#ff4444" strokeWidth={stroke + 6} opacity={0.12}
            strokeDasharray={circ} strokeDashoffset={circ * 0.25} />
        )}

        {/* Center text */}
        <text x={cx} y={cy - 16} textAnchor="middle" fill="#f0f8ff"
          fontSize="24" fontWeight="700" fontFamily="system-ui,sans-serif">
          {total.toLocaleString()}
        </text>
        <text x={cx} y={cy - 2} textAnchor="middle" fill="#4a7a9a"
          fontSize="9" fontFamily="system-ui,sans-serif">kcal consumed</text>
        {goal > 0 ? (
          <>
            <text x={cx} y={cy + 14} textAnchor="middle"
              fill={over ? '#ff6b4a' : '#7dff4f'}
              fontSize="11" fontWeight="700" fontFamily="system-ui,sans-serif">
              {over ? `${(total-goal).toLocaleString()} over` : `${remaining.toLocaleString()} left`}
            </text>
            <text x={cx} y={cy + 27} textAnchor="middle" fill="#4a7a9a"
              fontSize="9" fontFamily="system-ui,sans-serif">
              Goal {goal.toLocaleString()} · {pct}%
            </text>
          </>
        ) : (
          <text x={cx} y={cy + 14} textAnchor="middle" fill="#4a7a9a"
            fontSize="9" fontFamily="system-ui,sans-serif">Set goal with TDEE ↓</text>
        )}

        {/* ── Corner macro labels ── */}

        {/* TOP LEFT — Carbs */}
        <text x={6} y={38} fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700">
          <tspan fill="#f4a261">CARBS (</tspan>{total > 0 && <tspan fill="#ffffff">{Math.round(macros.carbs*4/total*100)}</tspan>}{total > 0 && <tspan fill="#ffffff">%</tspan>}<tspan fill="#f4a261">{total > 0 ? ')' : ''}</tspan>
        </text>
        <text x={6} y={52} fill="#f0f8ff" fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif">{macros.carbs}g</text>

        {/* TOP RIGHT — Protein */}
        <text x={SIZE-6} y={38} fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700" textAnchor="end">
          <tspan fill="#7dd8ff">PROTEIN{total > 0 ? ' (' : ''}</tspan>{total > 0 && <tspan fill="#ffffff">{Math.round(macros.protein*4/total*100)}</tspan>}{total > 0 && <tspan fill="#ffffff">%</tspan>}<tspan fill="#7dd8ff">{total > 0 ? ')' : ''}</tspan>
        </text>
        <text x={SIZE-6} y={54} fill="#f0f8ff" fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif" textAnchor="end">{macros.protein}g</text>

        {/* BOTTOM LEFT — Fats */}
        <text x={6} y={SIZE-54} fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700">
          <tspan fill="#ff6b4a">FATS (</tspan>{total > 0 && <tspan fill="#ffffff">{Math.round(macros.fats*9/total*100)}</tspan>}{total > 0 && <tspan fill="#ffffff">%</tspan>}<tspan fill="#ff6b4a">{total > 0 ? ')' : ''}</tspan>
        </text>
        <text x={6} y={SIZE-40} fill="#f0f8ff" fontSize="13" fontWeight="700" fontFamily="system-ui,sans-serif">{macros.fats}g</text>

        {/* BOTTOM RIGHT — Chol & Sodium stacked */}
        <text x={SIZE-6} y={SIZE-54} fill="#a78bfa" fontSize="10" fontWeight="700" fontFamily="system-ui,sans-serif" textAnchor="end">CHOL</text>
        <text x={SIZE-6} y={SIZE-40} fill="#f0f8ff" fontSize="12" fontWeight="700" fontFamily="system-ui,sans-serif" textAnchor="end">{macros.chol}mg</text>
        <text x={SIZE-6} y={SIZE-26} fill="#7dff4f" fontSize="10" fontWeight="700" fontFamily="system-ui,sans-serif" textAnchor="end">SODIUM</text>
        <text x={SIZE-6} y={SIZE-12} fill="#f0f8ff" fontSize="12" fontWeight="700" fontFamily="system-ui,sans-serif" textAnchor="end">{macros.sodium}mg</text>

      </svg>

      {/* Legend */}
      <div style={{ display:'flex', gap:14 }}>
        {MEALS.map(m => (
          <div key={m.key} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{ width:8, height:8, borderRadius:'50%', background:m.color }} />
            <span style={{ fontSize:10, color:'#8bbdd8' }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── TDEE Panel ────────────────────────────────────────────────────────────────
function TDEEPanel({ tdeeData, setTdeeData, tdee, goalCal, onSave }) {
  const inp = (id, label, ph) => (
    <div style={{ flex:1, minWidth:60 }}>
      <div style={{ fontSize:9, color:'#4a7a9a', marginBottom:3, textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
      <input type="number" placeholder={ph} value={tdeeData[id] || ''}
        onChange={e => setTdeeData(d => ({ ...d, [id]: e.target.value }))}
        style={{ width:'100%', boxSizing:'border-box', padding:'7px 8px', borderRadius:7,
          fontSize:13, background:'#0d1e30', border:'1px solid #1e5080', color:'#f0f8ff', outline:'none' }} />
    </div>
  );
  return (
    <div style={{ background:'#0d1e30', border:'1px solid #1e5080', borderRadius:12, padding:'12px', marginBottom:12 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#7dd8ff', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>
        TDEE Calculator
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:8 }}>
        {inp('age','Age','25')} {inp('weight','Weight (lb)','170')} {inp('height','Height (in)','70')}
      </div>
      <div style={{ display:'flex', gap:6, marginBottom:8 }}>
        {['male','female'].map(g => (
          <button key={g} onClick={() => setTdeeData(d => ({ ...d, gender:g }))}
            style={{ flex:1, padding:'6px', borderRadius:7, cursor:'pointer', fontSize:12, fontWeight:700,
              background: tdeeData.gender===g ? '#1a3d60' : '#071624',
              border: `1px solid ${tdeeData.gender===g ? '#4a9adc' : '#1e5080'}`,
              color: tdeeData.gender===g ? '#7dd8ff' : '#4a7a9a', transition:'all .15s' }}>
            {g === 'male' ? '♂ Male' : '♀ Female'}
          </button>
        ))}
      </div>
      <div style={{ fontSize:9, color:'#4a7a9a', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>Activity Level</div>
      <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
        {ACTIVITY.map(a => (
          <button key={a.key} onClick={() => setTdeeData(d => ({ ...d, activity:a.key }))}
            style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'6px 10px', borderRadius:7, cursor:'pointer', fontSize:11,
              background: tdeeData.activity===a.key ? '#0d2a45' : '#071624',
              border: `1px solid ${tdeeData.activity===a.key ? '#4a9adc' : '#1e5080'}`,
              color: tdeeData.activity===a.key ? '#7dd8ff' : '#4a7a9a', transition:'all .15s' }}>
            <span style={{ fontWeight:700 }}>{a.label}</span>
            <span style={{ fontSize:10 }}>{a.desc}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize:9, color:'#4a7a9a', marginBottom:4, textTransform:'uppercase', letterSpacing:'.05em' }}>Weight Goal</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:10 }}>
        {GOAL_OFFSETS.map(g => (
          <button key={g.key} onClick={() => setTdeeData(d => ({ ...d, goalKey:g.key }))}
            style={{ padding:'5px 4px', borderRadius:7, cursor:'pointer', fontSize:10, fontWeight:700,
              background: tdeeData.goalKey===g.key ? '#0d2a45' : '#071624',
              border: `1px solid ${tdeeData.goalKey===g.key ? '#ff6b4a' : '#1e5080'}`,
              color: tdeeData.goalKey===g.key ? '#ff6b4a' : '#4a7a9a', transition:'all .15s' }}>
            {g.label}
          </button>
        ))}
      </div>
      {tdee && (
        <div style={{ display:'flex', gap:8, marginBottom:0 }}>
          <div style={{ flex:1, background:'#071624', border:'1px solid #1e5080', borderRadius:9, padding:'8px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'#4a7a9a', marginBottom:2 }}>TDEE</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#7dd8ff' }}>{tdee.toLocaleString()}</div>
            <div style={{ fontSize:9, color:'#4a7a9a' }}>kcal/day</div>
          </div>
          <div style={{ flex:1, background:'#071624', border:'1px solid #ff6b4a', borderRadius:9, padding:'8px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'#4a7a9a', marginBottom:2 }}>Goal</div>
            <div style={{ fontSize:20, fontWeight:700, color:'#ff6b4a' }}>{goalCal.toLocaleString()}</div>
            <div style={{ fontSize:9, color:'#4a7a9a' }}>kcal/day</div>
          </div>
        </div>
      )}
      <button onClick={onSave} style={{
        width:'100%', marginTop:12, padding:'12px', borderRadius:10, cursor:'pointer',
        background:'#4a9adc', border:'none', color:'#fff',
        fontSize:14, fontWeight:700, boxShadow:'0 4px 14px rgba(74,154,220,0.4)',
      }}>Save &amp; Close</button>
    </div>
  );
}

// ── Meal Detail Page ──────────────────────────────────────────────────────────
function MealPage({ meal, items, onBack, onSubmit }) {
  const bgStyle = useBackground('diet');
  const blankRow = () => ({ id: Date.now() + Math.random(), name:'', cal:'', carbs:'', fats:'', protein:'', chol:'', sodium:'' });

  const [rows, setRows] = useState(
    items.length > 0 ? items.map(i => ({ ...i })) : [blankRow()]
  );

  function updateRow(id, field, val) {
    setRows(r => r.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: val };
      if (['carbs','fats','protein'].includes(field)) {
        const c = parseFloat(field === 'carbs'   ? val : updated.carbs)   || 0;
        const f = parseFloat(field === 'fats'    ? val : updated.fats)    || 0;
        const p = parseFloat(field === 'protein' ? val : updated.protein) || 0;
        const auto = Math.round(c * 4 + f * 9 + p * 4);
        updated.cal = auto > 0 ? String(auto) : '';
      }
      return updated;
    }));
  }
  function addRow() { setRows(r => [...r, blankRow()]); }
  function removeRow(id) {
    setRows(r => r.length > 1 ? r.filter(row => row.id !== id) : [blankRow()]);
  }
  const [saveWarn, setSaveWarn] = useState(false);

  function submit() {
    const valid = rows
      .filter(r => r.name.trim() && parseInt(r.cal) > 0)
      .map(r => ({
        id: r.id, name: r.name.trim(), cal: parseInt(r.cal) || 0,
        carbs: parseFloat(r.carbs) || 0, fats: parseFloat(r.fats) || 0,
        protein: parseFloat(r.protein) || 0, chol: parseFloat(r.chol) || 0,
        sodium: parseFloat(r.sodium) || 0,
      }));
    if (valid.length === 0) { setSaveWarn(true); return; }
    onSubmit(valid);
    onBack();
  }

  const runningCal     = rows.reduce((s,r) => s + (parseInt(r.cal)     || 0), 0);
  const runningCarbs   = rows.reduce((s,r) => s + (parseFloat(r.carbs)   || 0), 0);
  const runningFats    = rows.reduce((s,r) => s + (parseFloat(r.fats)    || 0), 0);
  const runningProtein = rows.reduce((s,r) => s + (parseFloat(r.protein) || 0), 0);
  const runningChol    = rows.reduce((s,r) => s + (parseFloat(r.chol)    || 0), 0);
  const runningNa      = rows.reduce((s,r) => s + (parseFloat(r.sodium)  || 0), 0);

  const macroPct = (row, id) => {
    const macroCals = (parseFloat(row.carbs)||0)*4 + (parseFloat(row.fats)||0)*9 + (parseFloat(row.protein)||0)*4;
    const cal = parseInt(row.cal) || macroCals || 0;
    if (!cal) return null;
    const cals = id === 'carbs' ? (parseFloat(row.carbs)||0)*4
               : id === 'fats'  ? (parseFloat(row.fats) ||0)*9
               : id === 'protein' ? (parseFloat(row.protein)||0)*4
               : null;
    if (cals === null || cals === 0) return null;
    const pct = Math.round(cals / cal * 100);
    const color = id === 'carbs' ? '#f4a261' : id === 'fats' ? '#ff6b4a' : '#7dd8ff';
    return (
      <div style={{ marginTop:3 }}>
        <div style={{ height:3, borderRadius:2, background:'rgba(255,255,255,0.1)', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background: color, borderRadius:2 }} />
        </div>
        <div style={{ fontSize:8, color, textAlign:'right', marginTop:1 }}>{pct}%</div>
      </div>
    );
  };

  const macroInp = (row, id, label) => {
    const macroCals = (parseFloat(row.carbs)||0)*4 + (parseFloat(row.fats)||0)*9 + (parseFloat(row.protein)||0)*4;
    const cal = parseInt(row.cal) || macroCals || 0;
    const pctVal = cal > 0 && ['carbs','fats','protein'].includes(id)
      ? Math.round(((id==='carbs'?(parseFloat(row.carbs)||0)*4:id==='fats'?(parseFloat(row.fats)||0)*9:(parseFloat(row.protein)||0)*4)/cal)*100)
      : null;
    return (
    <div style={{ flex:1, minWidth:0 }}>
      <div style={{ fontSize:8, color:'#4a7a9a', marginBottom:2, textTransform:'uppercase' }}>
        {label}{pctVal !== null ? <span style={{ color: id==='carbs'?'#f4a261':id==='fats'?'#ff6b4a':'#7dd8ff' }}> ({pctVal}%)</span> : ''}
      </div>
      <input type="number" placeholder="0" value={row[id]}
        onChange={e => updateRow(row.id, id, e.target.value)}
        style={{ width:'100%', boxSizing:'border-box', padding:'5px 6px', borderRadius:6, fontSize:12,
          background:'rgba(0,0,0,0.35)', border:`1px solid ${meal.border}`,
          color:'#f0f8ff', outline:'none' }} />
      {['carbs','fats','protein'].includes(id) && macroPct(row, id)}
    </div>
    );
  };

  return (
    <div className="screen diet-page" style={bgStyle}>
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button onClick={onBack} style={{ background:'none', border:'none', color:'#8bbdd8', fontSize:20, cursor:'pointer', padding:0, lineHeight:1 }}>←</button>
          <h1 style={{ margin:0, display:'flex', alignItems:'center', gap:6 }}>
            <span>{meal.icon}</span>
            <span style={{ color: meal.color }}>{meal.label}</span>
          </h1>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:10, color:'#4a7a9a' }}>Calories</div>
          <div style={{ fontSize:20, fontWeight:700, color: meal.color }}>{runningCal.toLocaleString()} kcal</div>
        </div>
      </div>

      <div className="scroll">

        {/* Food rows */}
        {rows.map((row, i) => (
          <div key={row.id} style={{
            background: meal.bg, border:`1px solid ${meal.border}`,
            borderRadius:12, padding:'10px 10px', marginBottom:10,
          }}>
            {/* Name + cal + remove */}
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
              <div style={{ width:20, height:20, borderRadius:'50%', background: meal.color,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:10, fontWeight:700, color:'#000', flexShrink:0 }}>{i+1}</div>
              <input placeholder="Food item..." value={row.name}
                onChange={e => updateRow(row.id, 'name', e.target.value)}
                style={{ flex:2, padding:'7px 9px', borderRadius:8, fontSize:13,
                  background:'rgba(0,0,0,0.35)', border:`1px solid ${meal.border}`,
                  color:'#f0f8ff', outline:'none' }} />
              <input placeholder="kcal" type="number" value={row.cal}
                readOnly={!!(parseFloat(row.carbs)||parseFloat(row.fats)||parseFloat(row.protein))}
                onChange={e => updateRow(row.id, 'cal', e.target.value)}
                style={{ flex:1, padding:'7px 8px', borderRadius:8, fontSize:13,
                  background: (parseFloat(row.carbs)||parseFloat(row.fats)||parseFloat(row.protein)) ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.35)',
                  border:`1px solid ${meal.border}`,
                  color: (parseFloat(row.carbs)||parseFloat(row.fats)||parseFloat(row.protein)) ? '#7dff4f' : '#f0f8ff',
                  outline:'none', minWidth:0 }} />
              <button onClick={() => removeRow(row.id)}
                style={{ background:'none', border:'none', color:'#4a7a9a',
                  cursor:'pointer', padding:'0 2px', flexShrink:0, display:'flex', alignItems:'center' }}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>

            {/* Macro inputs */}
            <div style={{ display:'flex', gap:6 }}>
              {macroInp(row, 'carbs',   'Carbs (g)')}
              {macroInp(row, 'fats',    'Fats (g)')}
              {macroInp(row, 'protein', 'Protein (g)')}
              {macroInp(row, 'chol',    'Chol (mg)')}
              {macroInp(row, 'sodium',  'Sodium (mg)')}
            </div>
          </div>
        ))}

        {/* Add row */}
        <button onClick={addRow} style={{
          width:'100%', padding:'10px', borderRadius:10, cursor:'pointer',
          background:'transparent', border:`2px dashed ${meal.border}`,
          color: meal.color, fontSize:13, fontWeight:700, marginBottom:14,
        }}>+ Add Item</button>

        {/* Running total card */}
        <div style={{ background:'#0d1e30', border:`2px solid ${meal.border}`, borderRadius:12,
          padding:'14px 16px', marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div>
              <div style={{ fontSize:11, color:'#4a7a9a', marginBottom:2 }}>Running Total</div>
              <div style={{ fontSize:26, fontWeight:700, color: meal.color }}>{runningCal.toLocaleString()} <span style={{ fontSize:12, color:'#4a7a9a' }}>kcal</span></div>
            </div>
            <div style={{ fontSize:36 }}>{meal.icon}</div>
          </div>
          <div style={{ display:'flex', gap:6 }}>
            {[
              { label:'Carbs',   val:`${Math.round(runningCarbs*10)/10}g`,   color:'#f4a261' },
              { label:'Fats',    val:`${Math.round(runningFats*10)/10}g`,    color:'#ff6b4a' },
              { label:'Protein', val:`${Math.round(runningProtein*10)/10}g`, color:'#7dd8ff' },
              { label:'Chol',    val:`${Math.round(runningChol)}mg`,         color:'#a78bfa' },
              { label:'Sodium',  val:`${Math.round(runningNa)}mg`,           color:'#7dff4f' },
            ].map(m => (
              <div key={m.label} style={{ flex:1, background:'rgba(0,0,0,0.3)', borderRadius:8,
                padding:'6px 4px', textAlign:'center' }}>
                <div style={{ fontSize:8, color: m.color, textTransform:'uppercase', marginBottom:2 }}>{m.label}</div>
                <div style={{ fontSize:11, fontWeight:700, color:'#f0f8ff' }}>{m.val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit / Cancel */}
        {saveWarn && (
          <div style={{ background:'#3a1a1a', border:'1px solid #c04040', borderRadius:10,
            padding:'12px 14px', marginBottom:10, textAlign:'center' }}>
            <div style={{ color:'#ff8888', fontSize:13, marginBottom:10 }}>No food recorded for meal. Do you wish to continue?</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => { setSaveWarn(false); onSubmit([]); onBack(); }} style={{
                flex:1, padding:'9px', borderRadius:8, cursor:'pointer',
                background:'#c04040', border:'none', color:'#fff', fontSize:13, fontWeight:700,
              }}>Yes, Save Empty</button>
              <button onClick={() => setSaveWarn(false)} style={{
                flex:1, padding:'9px', borderRadius:8, cursor:'pointer',
                background:'transparent', border:'1px solid #5a3a3a', color:'#ff8888', fontSize:13,
              }}>Go Back</button>
            </div>
          </div>
        )}
        <button onClick={submit} style={{
          width:'100%', padding:'14px', borderRadius:12, cursor:'pointer',
          background: meal.color, border:'none', color:'#000',
          fontSize:15, fontWeight:700, marginBottom:8,
          boxShadow:`0 4px 20px ${meal.border}`,
        }}>Save {meal.label}</button>
        <button onClick={onBack} style={{
          width:'100%', padding:'12px', borderRadius:12, cursor:'pointer',
          background:'transparent', border:'1px solid #1e5080', color:'#8bbdd8', fontSize:13,
        }}>Cancel</button>

        <div style={{ height:16 }} />
      </div>
    </div>
  );
}

// ── Trend Graph ───────────────────────────────────────────────────────────────
function TrendGraph({ history, goalCal }) {
  const [mode,   setMode]   = useState('calories'); // 'calories' | 'weight'
  const [period, setPeriod] = useState('week');     // 'week' | 'month' | 'year'

  const now = new Date();
  const fmtKey = d => d.toISOString().slice(0,10);

  // Build date range
  const getDates = () => {
    const dates = [];
    const count = period === 'week' ? 7 : period === 'month' ? 30 : 365;
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i); dates.push(fmtKey(d));
    }
    return dates;
  };

  // Aggregate by week/month for larger periods
  const getPoints = () => {
    const dates = getDates();
    if (period === 'week') {
      return dates.map(k => ({
        label: new Date(k+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'}),
        val: mode === 'calories' ? (history[k]?.calories || null) : (history[k]?.weight || null),
        goal: goalCal || null,
      }));
    }
    if (period === 'month') {
      // Group into ~4-day buckets
      const buckets = [];
      for (let i = 0; i < dates.length; i += 3) {
        const chunk = dates.slice(i, i+3);
        const vals = chunk.map(k => mode === 'calories' ? history[k]?.calories : history[k]?.weight).filter(v => v != null);
        const avg = vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null;
        const d = new Date(chunk[0]+'T12:00:00');
        buckets.push({ label: d.toLocaleDateString('en-US',{month:'short',day:'numeric'}), val: avg, goal: goalCal||null });
      }
      return buckets;
    }
    // year — group by month
    const byMonth = {};
    dates.forEach(k => {
      const mo = k.slice(0,7);
      if (!byMonth[mo]) byMonth[mo] = [];
      const v = mode === 'calories' ? history[k]?.calories : history[k]?.weight;
      if (v != null) byMonth[mo].push(v);
    });
    return Object.entries(byMonth).map(([mo, vals]) => ({
      label: new Date(mo+'-15T12:00:00').toLocaleDateString('en-US',{month:'short'}),
      val: vals.length ? Math.round(vals.reduce((a,b)=>a+b,0)/vals.length) : null,
      goal: goalCal||null,
    }));
  };

  const points = getPoints();
  const W = 320, H = 90, padL = 28, padR = 8, padT = 8, padB = 20;
  const vals = points.map(p => p.val).filter(v => v != null);
  const allVals = mode === 'calories' && goalCal ? [...vals, goalCal] : vals;
  const minV = allVals.length ? Math.min(...allVals) * 0.92 : 0;
  const maxV = allVals.length ? Math.max(...allVals) * 1.08 : 100;
  const xStep = (W - padL - padR) / Math.max(points.length - 1, 1);
  const yScale = v => padT + (H - padT - padB) * (1 - (v - minV) / (maxV - minV));

  const lineColor = mode === 'calories' ? '#a878f0' : '#7dff4f';
  const dotColor  = mode === 'calories' ? '#c8a8ff' : '#7dff4f';

  // Build polyline path
  const linePoints = points.map((p, i) => p.val != null ? `${padL + i*xStep},${yScale(p.val)}` : null).filter(Boolean);
  // Build connected segments (skip nulls)
  let pathD = '';
  points.forEach((p, i) => {
    if (p.val == null) return;
    const x = padL + i * xStep, y = yScale(p.val);
    pathD += pathD === '' ? `M${x},${y}` : `L${x},${y}`;
  });

  // Goal line
  const goalY = goalCal && mode === 'calories' ? yScale(goalCal) : null;

  return (
    <div style={{ background:'#0e0818', border:'1px solid #2a1a3a', borderRadius:14,
      padding:'10px 12px', marginTop:10 }}>

      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ display:'flex', gap:5 }}>
          {['calories','weight'].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer', fontWeight:600,
              background: mode === m ? (m==='calories'?'#2a1a4a':'#1a2a1a') : 'transparent',
              border: `1px solid ${mode===m ? (m==='calories'?'#6a3a9a':'#3a7a3a') : '#2a1a3a'}`,
              color: mode === m ? (m==='calories'?'#c8a8ff':'#7dff4f') : '#5a4a6a',
            }}>{m === 'calories' ? 'Calories' : 'Weight'}</button>
          ))}
        </div>
        <div style={{ display:'flex', gap:4 }}>
          {['week','month','year'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding:'3px 8px', borderRadius:6, fontSize:10, cursor:'pointer',
              background: period === p ? '#1a0d2a' : 'transparent',
              border: `1px solid ${period===p?'#4a2a6a':'#2a1a3a'}`,
              color: period === p ? '#a878f0' : '#4a3a5a',
            }}>{p.charAt(0).toUpperCase()+p.slice(1)}</button>
          ))}
        </div>
      </div>

      {/* SVG chart */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:'block', overflow:'visible' }}>
        {/* Y grid lines */}
        {[0.25,0.5,0.75,1].map(f => {
          const y = padT + (H-padT-padB)*f;
          const v = Math.round(maxV - f*(maxV-minV));
          return (
            <g key={f}>
              <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="#2a1a3a" strokeWidth="1"/>
              <text x={padL-3} y={y+3} fontSize="7" fill="#4a3a5a" textAnchor="end">{v}</text>
            </g>
          );
        })}

        {/* Goal line */}
        {goalY != null && (
          <>
            <line x1={padL} y1={goalY} x2={W-padR} y2={goalY}
              stroke="#ff6b4a" strokeWidth="1" strokeDasharray="4,3" opacity="0.7"/>
            <text x={W-padR+2} y={goalY+3} fontSize="7" fill="#ff6b4a">goal</text>
          </>
        )}

        {/* Area fill */}
        {pathD && (
          <path d={`${pathD} L${padL + (points.findLastIndex(p=>p.val!=null))*xStep},${H-padB} L${padL},${H-padB} Z`}
            fill={lineColor} opacity="0.08"/>
        )}

        {/* Line */}
        {pathD && <path d={pathD} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round"/>}

        {/* Dots + x labels */}
        {points.map((p, i) => {
          const x = padL + i * xStep;
          const showLabel = period === 'week' || i % Math.ceil(points.length/6) === 0;
          return (
            <g key={i}>
              {showLabel && (
                <text x={x} y={H-4} fontSize="7" fill="#4a3a5a" textAnchor="middle">{p.label}</text>
              )}
              {p.val != null && (
                <circle cx={x} cy={yScale(p.val)} r="3" fill={dotColor} stroke="#0e0818" strokeWidth="1"/>
              )}
            </g>
          );
        })}
      </svg>

      {/* Empty state */}
      {vals.length === 0 && (
        <div style={{ textAlign:'center', fontSize:11, color:'#3a2a4a', marginTop:-10, paddingBottom:4 }}>
          No {mode} data yet — log meals to populate
        </div>
      )}
    </div>
  );
}

// ── Main Diet Screen ──────────────────────────────────────────────────────────
export default function DietScreen() {
  const bgStyle = useBackground("diet");
  const stored = loadDiet();

  const [tdeeData,  setTdeeData]  = useState(stored.tdeeData || {
    age:'', weight:'', height:'', gender:'male', activity:'moderate', goalKey:'maintain'
  });
  const [mealsByDate, setMealsByDate] = useState(stored.mealsByDate || (stored.mealItems ? { [new Date().toISOString().slice(0,10)]: stored.mealItems } : {}));
  const [activeMeal, setActiveMeal] = useState(null);
  const [showTDEE,   setShowTDEE]   = useState(false);
  const [showClearWarn, setShowClearWarn] = useState(false);
  const [weightDraft, setWeightDraft] = useState('');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCal, setShowCal] = useState(false);
  const [history, setHistory] = useState(stored.history || {});

  const dateKey    = selectedDate.toISOString().slice(0,10);
  const blankMeals = { breakfast:[], lunch:[], dinner:[], snacks:[] };
  const mealItems  = mealsByDate[dateKey] || blankMeals;

  function setMealItems(updater) {
    setMealsByDate(prev => {
      const cur = prev[dateKey] || blankMeals;
      const next = typeof updater === 'function' ? updater(cur) : updater;
      return { ...prev, [dateKey]: next };
    });
  }

  // Auto-record calorie total for the selected day whenever meals change
  useEffect(() => {
    const dayTotal = Object.values(mealItems).flat().reduce((s,i) => s + (i.cal||0), 0);
    setHistory(h => {
      const prev = h[dateKey] || {};
      if (dayTotal > 0) return { ...h, [dateKey]: { ...prev, calories: dayTotal } };
      const { calories: _, ...rest } = prev;
      return { ...h, [dateKey]: rest };
    });
  }, [mealsByDate, dateKey]);

  useEffect(() => { saveDiet({ tdeeData, mealsByDate, history }); }, [tdeeData, mealsByDate, history]);

  const tdee    = calcTDEE(tdeeData);
  const offset  = GOAL_OFFSETS.find(g => g.key === tdeeData.goalKey)?.offset || 0;
  const goalCal = tdee ? Math.max(1200, tdee + offset) : 0;

  const mealTotals = {};
  MEALS.forEach(m => {
    mealTotals[m.key] = (mealItems[m.key] || []).reduce((s,i) => s + i.cal, 0);
  });
  const total  = Object.values(mealTotals).reduce((s,v) => s + v, 0);
  const macros = sumMacros(mealItems);

  // Meal detail page
  if (activeMeal) {
    const meal = MEALS.find(m => m.key === activeMeal);
    return (
      <MealPage
        meal={meal}
        items={mealItems[activeMeal] || []}
        onBack={() => setActiveMeal(null)}
        onSubmit={items => setMealItems(prev => ({ ...prev, [activeMeal]: items }))}
      />
    );
  }

  // Week strip helpers
  const startOfWeek = (d) => { const s = new Date(d); s.setDate(d.getDate() - d.getDay()); s.setHours(0,0,0,0); return s; };
  const weekDays = Array.from({length:7}, (_,i) => { const d = new Date(startOfWeek(selectedDate)); d.setDate(d.getDate()+i); return d; });
  const today = new Date(); today.setHours(0,0,0,0);
  const isSameDay = (a,b) => a.toDateString() === b.toDateString();
  const DAY_LABELS = ['S','M','T','W','T','F','S'];

  // Calendar grid helpers
  const calYear = selectedDate.getFullYear(), calMonth = selectedDate.getMonth();
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const calCells = Array.from({length: firstDay + daysInMonth}, (_,i) => i < firstDay ? null : i - firstDay + 1);

  return (
    <div className="screen diet-page">
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <h1 style={{ margin:0 }}>Diet</h1>
          <p style={{ margin:0, fontSize:11, color:'#9a7abf' }}>
            {selectedDate.toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' })}
          </p>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setShowCal(s => !s)} style={{
            background: showCal ? '#1a0d2a' : '#071624',
            border: `1px solid ${showCal ? '#6a3a9a' : '#3a1a5a'}`,
            borderRadius:9, padding:'6px 10px', cursor:'pointer', fontSize:15,
          }}>📅</button>
          <button onClick={() => setShowTDEE(s => !s)} style={{
            background: showTDEE ? '#0d2a45' : '#071624',
            border: `1px solid ${showTDEE ? '#4a9adc' : '#1e5080'}`,
            borderRadius:9, padding:'6px 10px', cursor:'pointer',
            fontSize:13, color: showTDEE ? '#7dd8ff' : '#8bbdd8',
          }}>⚡ TDEE</button>
          <button onClick={() => setShowClearWarn(true)}
            style={{ background:'#071624', border:'1px solid #1e5080', borderRadius:9,
              padding:'6px 10px', cursor:'pointer', fontSize:13, color:'#4a7a9a' }}>🗑</button>
        </div>
      </div>

      {/* Week strip */}
      <div style={{ display:'flex', justifyContent:'space-around', alignItems:'center',
        padding:'8px 10px 4px', borderBottom:'1px solid #2a1a3a' }}>
        <button onClick={() => setSelectedDate(d => { const n=new Date(d); n.setDate(n.getDate()-7); return n; })}
          style={{ background:'none', border:'none', color:'#6a3a9a', fontSize:18, cursor:'pointer', padding:'0 4px' }}>‹</button>
        {weekDays.map((d,i) => {
          const isSel = isSameDay(d, selectedDate);
          const isToday = isSameDay(d, today);
          return (
            <div key={i} onClick={() => setSelectedDate(new Date(d))}
              style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                cursor:'pointer', padding:'4px 6px', borderRadius:8,
                background: isSel ? '#3a1a5a' : 'transparent',
                border: isToday ? '1px solid #6a3a9a' : '1px solid transparent' }}>
              <span style={{ fontSize:9, color: isSel ? '#c8a8ff' : '#6a5a7a', textTransform:'uppercase' }}>{DAY_LABELS[i]}</span>
              <span style={{ fontSize:13, fontWeight: isSel||isToday ? 700 : 400,
                color: isSel ? '#e8d0ff' : isToday ? '#a878f0' : '#8a6a9a' }}>{d.getDate()}</span>
            </div>
          );
        })}
        <button onClick={() => setSelectedDate(d => { const n=new Date(d); n.setDate(n.getDate()+7); return n; })}
          style={{ background:'none', border:'none', color:'#6a3a9a', fontSize:18, cursor:'pointer', padding:'0 4px' }}>›</button>
      </div>

      {/* Calendar dropdown */}
      {showCal && (
        <div style={{ margin:'8px 14px 0', background:'#1a0d2a', border:'1px solid #3a1a5a',
          borderRadius:12, padding:'10px', zIndex:10 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
            <button onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth()-1, 1))}
              style={{ background:'none', border:'none', color:'#6a3a9a', fontSize:18, cursor:'pointer' }}>‹</button>
            <span style={{ fontSize:13, fontWeight:700, color:'#c8a8ff' }}>
              {selectedDate.toLocaleDateString('en-US',{month:'long', year:'numeric'})}
            </span>
            <button onClick={() => setSelectedDate(d => new Date(d.getFullYear(), d.getMonth()+1, 1))}
              style={{ background:'none', border:'none', color:'#6a3a9a', fontSize:18, cursor:'pointer' }}>›</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, textAlign:'center' }}>
            {['S','M','T','W','T','F','S'].map((l,i) => (
              <div key={i} style={{ fontSize:9, color:'#6a4a8a', padding:'2px 0', textTransform:'uppercase' }}>{l}</div>
            ))}
            {calCells.map((day, i) => {
              if (!day) return <div key={i} />;
              const d = new Date(calYear, calMonth, day);
              const isSel = isSameDay(d, selectedDate);
              const isToday = isSameDay(d, today);
              return (
                <div key={i} onClick={() => { setSelectedDate(d); setShowCal(false); }}
                  style={{ padding:'5px 2px', borderRadius:6, cursor:'pointer', fontSize:11,
                    background: isSel ? '#3a1a5a' : 'transparent',
                    color: isSel ? '#e8d0ff' : isToday ? '#a878f0' : '#9a7abf',
                    border: isToday ? '1px solid #6a3a9a' : '1px solid transparent',
                    fontWeight: isSel||isToday ? 700 : 400 }}>{day}</div>
              );
            })}
          </div>
        </div>
      )}

      <div className="scroll" style={{ padding:'6px 14px 8px', overflowY: showTDEE ? 'auto' : 'hidden' }}>
        {showTDEE && (
          <TDEEPanel tdeeData={tdeeData} setTdeeData={setTdeeData}
            tdee={tdee} goalCal={goalCal} onSave={() => setShowTDEE(false)} />
        )}

        {/* Ring with corner macros */}
        <CalorieRing total={total} goal={goalCal} mealTotals={mealTotals} macros={macros} />

        {/* Meal buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {MEALS.map(m => {
            const cal = mealTotals[m.key] || 0;
            const hasItems = (mealItems[m.key] || []).length > 0;
            return (
              <button key={m.key} onClick={() => setActiveMeal(m.key)} style={{
                background: m.bg, border:`2px solid ${m.border}`,
                borderRadius:12, padding:'10px 12px', cursor:'pointer',
                textAlign:'left', transition:'all .15s',
                boxShadow: hasItems ? `0 0 10px ${m.border}` : 'none',
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontSize:20 }}>{m.icon}</span>
                  <span style={{ fontSize:11, fontWeight:700, color: m.color }}>{m.label}</span>
                </div>
                <div style={{ fontSize:20, fontWeight:700, color:'#f0f8ff', lineHeight:1 }}>
                  {cal > 0 ? cal.toLocaleString() : '—'}
                </div>
                <div style={{ fontSize:9, color:'#4a7a9a', marginTop:2 }}>
                  {cal > 0 ? `kcal · ${mealItems[m.key].length} item${mealItems[m.key].length !== 1 ? 's' : ''}` : 'tap to log'}
                </div>
              </button>
            );
          })}
        </div>

        {/* Weight input */}
        <div style={{ background:'#0e0818', border:'1px solid #2a1a3a', borderRadius:10, padding:'8px 12px', marginTop:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:11, color:'#6a4a8a', flex:1 }}>
              {selectedDate.toDateString() === new Date().toDateString() ? "Today's Weight" : `Weight · ${selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`}
            </span>
            <input type="number" placeholder={weightUnit === 'lb' ? 'lbs' : 'kg'} step="0.1"
              value={weightDraft}
              onChange={e => setWeightDraft(e.target.value)}
              style={{ width:70, padding:'5px 8px', borderRadius:7, fontSize:13,
                background:'#160d20', border:'1px solid #3a1a5a', color:'#c8a8ff', outline:'none', textAlign:'right' }} />
            <button onClick={() => setWeightUnit(u => u === 'lb' ? 'kg' : 'lb')} style={{
              background:'#1a0d2a', border:'1px solid #3a1a5a', borderRadius:6,
              color:'#9a7abf', fontSize:11, fontWeight:700, cursor:'pointer', padding:'3px 6px',
            }}>{weightUnit}</button>
            <button onClick={() => {
              const v = parseFloat(weightDraft);
              if (!v) return;
              const ts = new Date().toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
              setHistory(h => ({ ...h, [dateKey]: { ...h[dateKey], weight: v, weightUnit, weightTime: ts } }));
              setWeightDraft('');
            }} style={{ background:'none', border:'none', cursor:'pointer', color: weightDraft ? '#c8a8ff' : '#3a2a4a',
              padding:0, display:'flex', alignItems:'center', transition:'color .15s' }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
            </button>
          </div>
          {history[dateKey]?.weight && (
            <div style={{ fontSize:10, color:'#6a4a8a', marginTop:5 }}>
              Saved: <span style={{ color:'#c8a8ff', fontWeight:700 }}>{history[dateKey].weight} {history[dateKey].weightUnit || 'lb'}</span>
              {history[dateKey].weightTime && <span style={{ color:'#4a3a5a' }}> · {history[dateKey].weightTime}</span>}
            </div>
          )}
        </div>

        {/* Trend graph */}
        <TrendGraph history={history} goalCal={goalCal} />

        {/* Calories remaining bar */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          background:'#0d1e30', border:'1px solid #1e5080', borderRadius:10,
          padding:'8px 14px', marginTop:8 }}>
          <div>
            <div style={{ fontSize:10, color:'#4a7a9a' }}>Daily Total</div>
            <div style={{ fontSize:18, fontWeight:700, color:'#f0f8ff' }}>
              {total.toLocaleString()} <span style={{ fontSize:11, color:'#4a7a9a' }}>kcal</span>
            </div>
          </div>
          {goalCal > 0 && (
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:10, color:'#4a7a9a' }}>{total > goalCal ? 'over goal' : 'remaining'}</div>
              <div style={{ fontSize:18, fontWeight:700, color: total > goalCal ? '#ff6b4a' : '#7dff4f' }}>
                {total > goalCal
                  ? `+${(total - goalCal).toLocaleString()}`
                  : (goalCal - total).toLocaleString()}
                <span style={{ fontSize:11, color:'#4a7a9a' }}> kcal</span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Clear day warning modal */}
      {showClearWarn && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, borderRadius:'inherit' }}>
          <div style={{ background:'#160d20', border:'1px solid #4a2d6a', borderRadius:16,
            padding:'24px 20px', margin:'0 20px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>🗑</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#e8d0ff', marginBottom:6 }}>Clear this day?</div>
            <div style={{ fontSize:12, color:'#6a4a8a', marginBottom:20 }}>
              All meals logged for {selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})} will be erased.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setShowClearWarn(false)} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:'transparent', border:'1px solid #3a1a5a', color:'#9a7abf', fontSize:13,
              }}>Cancel</button>
              <button onClick={() => { setMealItems(blankMeals); setShowClearWarn(false); }} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:'#4a1a1a', border:'1px solid #8a3a3a', color:'#ff8888', fontSize:13, fontWeight:700,
              }}>Clear Day</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
