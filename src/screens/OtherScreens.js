import React, { useState } from 'react';
import {
  savePrescribed, loadPrescribed, loadExercises, saveExercises, loadSettings, saveSettings,
  addCustomExercise, updateCustomExercise, deleteCustomExercise,
} from '../storage';
import { useTheme } from '../ThemeContext';
import { themes, THEME_NAMES } from '../themes';
import { useBackground } from '../useBackground';

const ALL_KEYS = [
  'wt_sets', 'wt_exercises', 'wt_prescribed',
  'wt_diet_v1', 'wt_food_lib', 'wt_meal_lib',
  'wt_last_interval', 'wt_saved_intervals',
];

function exportData() {
  const payload = { _wt_backup: true, exportedAt: new Date().toISOString(), data: {} };
  ALL_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v != null) payload.data[k] = JSON.parse(v);
  });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `workout-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsScreen({ onImport, onOpenExerciseLibrary, weightUnit = 'lb', setWeightUnit, distUnit = 'mi', setDistUnit, sprintUnit = 'yd', setSprintUnit }) {
  const { theme, themeName, changeTheme } = useTheme();
  const bgStyle = useBackground('settings');
  const [themeOpen, setThemeOpen] = useState(false);
  const [importFlash,  setImportFlash]  = useState(null);
  const [backupFlash,  setBackupFlash]  = useState(null);
  const [restoreWarn,  setRestoreWarn]  = useState(false);
  const [pendingRestore, setPendingRestore] = useState(null);
  const [settings, setSettings] = useState(() => loadSettings());

  function toggleSetting(key) {
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next);
    saveSettings(next);
  }

  function handleRestoreFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const payload = JSON.parse(ev.target.result);
        if (!payload._wt_backup || !payload.data) {
          setBackupFlash({ ok: false, msg: 'Invalid file — select a Workout Tracker backup.' });
          setTimeout(() => setBackupFlash(null), 3500);
          return;
        }
        setPendingRestore(payload.data);
        setRestoreWarn(true);
      } catch {
        setBackupFlash({ ok: false, msg: 'Failed to read file.' });
        setTimeout(() => setBackupFlash(null), 3500);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function commitRestore(data) {
    Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
    setRestoreWarn(false);
    setPendingRestore(null);
    setBackupFlash({ ok: true, msg: '✓ Data restored! Refresh to apply.' });
    setTimeout(() => setBackupFlash(null), 4000);
    if (onImport) onImport();
  }

  function validateCoachJSON(data) {
    const errors = [];
    const warnings = [];

    if (!data._coach_export)           errors.push('Not a Coach App export file');
    if (!Array.isArray(data.workouts)) errors.push('Missing workouts array');
    if (errors.length) return { valid: false, errors, warnings };

    if (data.workouts.length === 0) { errors.push('File contains no workouts'); return { valid: false, errors, warnings }; }

    const VALID_TYPES = new Set(['strength','bodyweight','cardio','sprint','cycling','jumprope']);
    let missingDates = 0, missingNames = 0, missingReps = 0, badTypes = 0, totalEx = 0;

    data.workouts.forEach(w => {
      if (!w.date) missingDates++;
      const allEx = [...(w.exercises || []), ...(w.circuits || []).flatMap(c => c.exercises || [])];
      totalEx += allEx.length;
      allEx.forEach(ex => {
        if (!ex.name || typeof ex.name !== 'string') missingNames++;
        if (ex.reps == null || ex.reps === '') missingReps++;
        if (ex.type && !VALID_TYPES.has(ex.type)) badTypes++;
      });
    });

    if (!data.client)    warnings.push('No client name in file');
    if (missingDates)    warnings.push(`${missingDates} workout${missingDates > 1 ? 's' : ''} missing date`);
    if (missingNames)    warnings.push(`${missingNames} exercise${missingNames > 1 ? 's' : ''} missing name — will be skipped`);
    if (missingReps)     warnings.push(`${missingReps} exercise${missingReps > 1 ? 's' : ''} missing rep count`);
    if (badTypes)        warnings.push(`${badTypes} exercise${badTypes > 1 ? 's' : ''} with unknown type — defaulted to strength`);

    return { valid: true, errors, warnings, stats: { workouts: data.workouts.length, exercises: totalEx } };
  }

  function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const v = validateCoachJSON(data);

        if (!v.valid) {
          setImportFlash({ ok: false, msg: `✗ ${v.errors.join(' · ')}` });
          setTimeout(() => setImportFlash(null), 4000);
          return;
        }

        const existing = loadPrescribed();
        const merged   = [...existing];
        data.workouts.forEach(w => {
          const circuitExes = (w.circuits || []).flatMap(ct =>
            ct.exercises.map((ex, j) => ({
              ...ex,
              inCircuit: true,
              circuitLabel: j === 0 ? (ct.name || 'Circuit') : undefined,
              isLastInCircuit: j === ct.exercises.length - 1,
            }))
          );
          const transformed = { ...w, exercises: [...(w.exercises || []), ...circuitExes] };
          const idx = merged.findIndex(x => x.date === w.date);
          if (idx >= 0) merged[idx] = transformed; else merged.push(transformed);
        });
        savePrescribed(merged);

        // Register any unknown exercises
        const known = new Set(loadExercises().map(e => e.name.toLowerCase()));
        const toAdd = [];
        data.workouts.forEach(w => {
          [...(w.exercises || []), ...(w.circuits || []).flatMap(c => c.exercises || [])].forEach(ex => {
            if (ex.name && !known.has(ex.name.toLowerCase())) {
              known.add(ex.name.toLowerCase());
              toAdd.push({ name: ex.name, type: ex.type || 'strength', origin: 'coach' });
            }
          });
        });
        if (toAdd.length) saveExercises([...loadExercises(), ...toAdd]);

        const client = data.client || 'Program';
        const { workouts, exercises } = v.stats;
        let msg = `✓ ${client} imported — ${workouts} workout${workouts !== 1 ? 's' : ''}, ${exercises} exercise${exercises !== 1 ? 's' : ''}`;
        if (v.warnings.length) msg += `\n⚠ ${v.warnings.join(' · ')}`;

        setImportFlash({ ok: v.warnings.length === 0, warn: v.warnings.length > 0, msg });
        setTimeout(() => setImportFlash(null), v.warnings.length ? 5000 : 3000);
        if (onImport) onImport();
      } catch {
        setImportFlash({ ok: false, msg: '✗ Failed to parse file — make sure it is valid JSON.' });
        setTimeout(() => setImportFlash(null), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="screen week-page" style={bgStyle}>
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar" style={{ position:'relative' }}>
        <h1 style={{ margin:0 }}>Settings</h1>
      </div>
      <div className="scroll">

        <div className="section-label">App</div>
        <div className="card">
          <div className="settings-row">
            <span className="settings-label">Version</span>
            <span className="settings-val">1.0.0</span>
          </div>
          <div className="settings-row" style={{ borderTop:`1px solid ${theme.borderDefault}` }}>
            <span className="settings-label">Weight unit</span>
            {(() => {
              const imperial = weightUnit === 'lb';
              return <button onClick={() => setWeightUnit && setWeightUnit(imperial ? 'kg' : 'lb')}
                style={{ background: imperial ? 'rgba(0,255,136,0.1)' : `${theme.accentBlueSky}1a`, border:`1px solid ${imperial ? 'rgba(0,255,136,0.4)' : `${theme.accentBlueSky}66`}`, borderRadius:8, padding:'4px 14px', fontSize:13, fontWeight:700, color: imperial ? theme.accentGreenBright : theme.accentBlueSky, cursor:'pointer', letterSpacing:'0.04em' }}>
                {imperial ? 'LBS' : 'KG'}
              </button>;
            })()}
          </div>
          <div className="settings-row" style={{ borderTop:`1px solid ${theme.borderDefault}` }}>
            <span className="settings-label">Distance</span>
            {(() => {
              const imperial = distUnit === 'mi';
              return <button onClick={() => setDistUnit && setDistUnit(imperial ? 'km' : 'mi')}
                style={{ background: imperial ? 'rgba(0,255,136,0.1)' : `${theme.accentBlueSky}1a`, border:`1px solid ${imperial ? 'rgba(0,255,136,0.4)' : `${theme.accentBlueSky}66`}`, borderRadius:8, padding:'4px 14px', fontSize:13, fontWeight:700, color: imperial ? theme.accentGreenBright : theme.accentBlueSky, cursor:'pointer', letterSpacing:'0.04em' }}>
                {imperial ? 'MI' : 'KM'}
              </button>;
            })()}
          </div>
          <div className="settings-row" style={{ borderTop:`1px solid ${theme.borderDefault}` }}>
            <span className="settings-label">Sprint distance</span>
            {(() => {
              const imperial = sprintUnit === 'yd';
              return <button onClick={() => setSprintUnit && setSprintUnit(imperial ? 'm' : 'yd')}
                style={{ background: imperial ? 'rgba(0,255,136,0.1)' : `${theme.accentBlueSky}1a`, border:`1px solid ${imperial ? 'rgba(0,255,136,0.4)' : `${theme.accentBlueSky}66`}`, borderRadius:8, padding:'4px 14px', fontSize:13, fontWeight:700, color: imperial ? theme.accentGreenBright : theme.accentBlueSky, cursor:'pointer', letterSpacing:'0.04em' }}>
                {imperial ? 'YD' : 'M'}
              </button>;
            })()}
          </div>
        </div>

        <div className="section-label">Coach Import</div>
        <div className="card">
          <div style={{ fontSize:12, color:theme.textSecondary, marginBottom:12, lineHeight:1.6 }}>
            Import a workout program exported from the <strong style={{ color:theme.accentGreen }}>Workout Coach</strong> app. The program will be merged into your calendar.
          </div>
          {importFlash && (
            <div style={{
              background: importFlash.warn ? '#1e1a08' : importFlash.ok ? '#0a2e1a' : '#2e0a0a',
              border: `1px solid ${importFlash.warn ? theme.accentOrangeGold : importFlash.ok ? theme.accentGreenDark : '#9e1d1d'}`,
              borderRadius:9, padding:'10px 14px', marginBottom:12, fontSize:12, fontWeight:700,
              color: importFlash.warn ? theme.accentOrangeGold : importFlash.ok ? theme.accentGreen : '#e05050',
              whiteSpace:'pre-line',
            }}>
              {importFlash.msg}
            </div>
          )}
          <label style={{ display:'flex', alignItems:'center', gap:10, background:theme.bgSurface, border:`1px solid ${theme.borderDefault}`, borderRadius:9, padding:'11px 14px', cursor:'pointer', transition:'border-color .15s' }}
            onMouseOver={e => e.currentTarget.style.borderColor=theme.accentGreenDark}
            onMouseOut={e  => e.currentTarget.style.borderColor=theme.borderDefault}>
            <span style={{ fontSize:18 }}>📂</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:theme.accentGreen }}>Import Coach JSON</div>
              <div style={{ fontSize:11, color:theme.textMuted, marginTop:2 }}>Tap to select a .json file from your coach</div>
            </div>
            <input type="file" accept=".json" style={{ display:'none' }} onChange={handleImportJSON} />
          </label>
        </div>

        <div className="section-label">Data Backup</div>
        <div className="card">
          <div style={{ fontSize:12, color:theme.textSecondary, marginBottom:12, lineHeight:1.6 }}>
            Export all your data — sets, PRs, meals, food library, program — to a local file. Restore it anytime on any device.
          </div>
          {backupFlash && (
            <div style={{ background: backupFlash.ok ? '#0a2e1a' : '#2e0a0a', border: `1px solid ${backupFlash.ok ? theme.accentGreenDark : '#9e1d1d'}`, borderRadius:9, padding:'10px 14px', marginBottom:12, fontSize:12, fontWeight:700, color: backupFlash.ok ? theme.accentGreen : '#e05050' }}>
              {backupFlash.msg}
            </div>
          )}
          {/* Export */}
          <div onClick={exportData} style={{ display:'flex', alignItems:'center', gap:10, background:theme.bgSurface, border:`1px solid ${theme.borderDefault}`, borderRadius:9, padding:'11px 14px', cursor:'pointer', marginBottom:8 }}>
            <span style={{ fontSize:18 }}>💾</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:theme.accentBlueLight }}>Export Backup</div>
              <div style={{ fontSize:11, color:theme.textMuted, marginTop:2 }}>Download a .json file with all your data</div>
            </div>
          </div>
          {/* Restore */}
          <label style={{ display:'flex', alignItems:'center', gap:10, background:theme.bgSurface, border:`1px solid ${theme.borderDefault}`, borderRadius:9, padding:'11px 14px', cursor:'pointer' }}>
            <span style={{ fontSize:18 }}>📥</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:theme.accentPurple }}>Restore from Backup</div>
              <div style={{ fontSize:11, color:theme.textMuted, marginTop:2 }}>Load a previously exported backup file</div>
            </div>
            <input type="file" accept=".json" style={{ display:'none' }} onChange={handleRestoreFile} />
          </label>
        </div>

        <div className="section-label">Exercise Library</div>
        <div className="card">
          <div onClick={onOpenExerciseLibrary} style={{ display:'flex', alignItems:'center', gap:10, background:theme.bgSurface, border:`1px solid ${theme.borderDefault}`, borderRadius:9, padding:'11px 14px', cursor:'pointer' }}>
            <span style={{ fontSize:18 }}>🏋️</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:theme.accentBlueLight }}>Manage Custom Exercises</div>
              <div style={{ fontSize:11, color:theme.textMuted, marginTop:2 }}>Add, edit, or remove your own exercises</div>
            </div>
          </div>
        </div>

        <div className="section-label">Display</div>
        <div className="card">
          {[
            { key:'showBodyweightProgress', label:'Body Weight on Progress', desc:'Show weight trend & log on the Progress screen' },
            { key:'showBodyweightDiet',     label:'Body Weight on Diet',     desc:'Show weight input & graph mode on the Diet screen' },
          ].map(({ key, label, desc }, i, arr) => (
            <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0',
              borderBottom: i < arr.length - 1 ? `1px solid ${theme.borderDefault}` : 'none' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:theme.textHeading }}>{label}</div>
                <div style={{ fontSize:11, color:theme.textMuted, marginTop:2 }}>{desc}</div>
              </div>
              <div onClick={() => toggleSetting(key)} style={{
                width:44, height:26, borderRadius:13, cursor:'pointer', position:'relative', transition:'background .2s',
                background: settings[key] ? theme.toggleOnBg : theme.toggleOffBg,
                border: `1px solid ${settings[key] ? theme.toggleOnBorder : theme.toggleOffBorder}`,
                flexShrink:0, marginLeft:12,
              }}>
                <div style={{
                  position:'absolute', top:3, left: settings[key] ? 20 : 3,
                  width:18, height:18, borderRadius:'50%', background: settings[key] ? theme.toggleOnBorder : theme.textMuted,
                  transition:'left .2s, background .2s',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div className="section-label">Appearance</div>
        <div className="card">
          <div style={{ fontSize:12, color:theme.textSecondary, marginBottom:10 }}>Theme</div>
          {/* Selected theme row — click to open */}
          <div onClick={() => setThemeOpen(o => !o)} style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            background:theme.bgCardAlt, border:`1px solid ${themeOpen ? theme.accentBlue : theme.borderDefault}`,
            borderRadius:10, padding:'10px 14px', cursor:'pointer', transition:'border-color .15s',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ display:'flex', gap:4 }}>
                {themes[themeName].previewSwatches.map((c, i) => (
                  <div key={i} style={{ width:14, height:14, borderRadius:'50%', background:c, border:'1px solid rgba(255,255,255,0.15)' }} />
                ))}
              </div>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:theme.textPrimary }}>{themeName}</div>
                <div style={{ fontSize:10, color:theme.textMuted, marginTop:1 }}>{themes[themeName].previewLabel}</div>
              </div>
            </div>
            <div style={{ fontSize:16, color:theme.textMuted, transform: themeOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>▾</div>
          </div>

          {/* Dropdown options */}
          {themeOpen && (
            <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:4 }}>
              {THEME_NAMES.map(name => {
                const t = themes[name];
                const active = name === themeName;
                return (
                  <div key={name} onClick={() => { changeTheme(name); setThemeOpen(false); }} style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    background: active ? theme.bgSurface : theme.bgCardAlt,
                    border:`1px solid ${active ? theme.accentBlue : theme.borderMuted}`,
                    borderRadius:9, padding:'9px 14px', cursor:'pointer', transition:'background .15s',
                  }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ display:'flex', gap:4 }}>
                        {t.previewSwatches.map((c, i) => (
                          <div key={i} style={{ width:13, height:13, borderRadius:'50%', background:c, border:'1px solid rgba(255,255,255,0.15)' }} />
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color: active ? theme.accentBlueLight : theme.accentBluePale }}>{name}</div>
                        <div style={{ fontSize:10, color:theme.textMuted, marginTop:1 }}>{t.previewLabel}</div>
                      </div>
                    </div>
                    {active && <div style={{ fontSize:13, color:theme.accentGreen }}>✓</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="section-label">Coming Soon</div>
        <div className="card">
          {['Rest timer notifications','Workout templates','Apple Health sync'].map(f => (
            <div key={f} className="coming-item">• {f}</div>
          ))}
        </div>

      </div>

      {/* Restore confirmation modal */}
      {restoreWarn && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, borderRadius:'inherit' }}>
          <div style={{ background:theme.bgCardAlt, border:`1px solid ${theme.dietBorder}`, borderRadius:16,
            padding:'24px 20px', margin:'0 20px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
            <div style={{ fontSize:15, fontWeight:700, color:theme.textPrimary, marginBottom:6 }}>Replace all data?</div>
            <div style={{ fontSize:12, color:theme.textMuted, marginBottom:20, lineHeight:1.6 }}>
              This will overwrite your current sets, program, meals, and all saved data with the backup file. This cannot be undone.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setRestoreWarn(false); setPendingRestore(null); }} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:'transparent', border:`1px solid ${theme.dietPurpleSel}`, color:theme.textMuted, fontSize:13,
              }}>Cancel</button>
              <button onClick={() => commitRestore(pendingRestore)} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:theme.dietPurpleDeep, border:`1px solid ${theme.accentPurple}`, color:theme.textPrimary, fontSize:13, fontWeight:700,
              }}>Yes, Restore</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const EX_TYPES = [
  { key:'strength',   label:'Strength' },
  { key:'bodyweight', label:'Bodyweight' },
  { key:'cardio',     label:'Cardio' },
  { key:'sprint',     label:'Sprint' },
  { key:'cycling',    label:'Cycling' },
  { key:'jumprope',   label:'Jump Rope' },
];
const ORIGIN_BADGE = {
  default: { label:'Built-in', colorKey:'textMuted',    bgKey:'bgCardAlt' },
  coach:   { label:'Coach',    colorKey:'accentGreen',  bgKey:'accentGreenDeep' },
  custom:  { label:'Custom',   colorKey:'accentPurple', bgKey:'dietPurpleBg' },
};

export function ExerciseLibraryScreen({ onBack }) {
  const { theme } = useTheme();
  const [exercises, setExercises] = useState(() => loadExercises());
  const [search,    setSearch]    = useState('');
  const [editing,   setEditing]   = useState(null); // null = closed, {} = new, {name,type} = edit
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error,     setError]     = useState('');

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  const customCount = exercises.filter(e => e.origin === 'custom').length;

  function openNew()  { setError(''); setEditing({ name:'', type:'strength' }); }
  function openEdit(e){ setError(''); setEditing({ origName: e.name, name: e.name, type: e.type }); }

  function handleSave() {
    const name = editing.name.trim();
    if (!name) { setError('Name is required'); return; }
    try {
      const updated = editing.origName
        ? updateCustomExercise(editing.origName, { name, type: editing.type })
        : addCustomExercise({ name, type: editing.type });
      setExercises(updated);
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDelete(name) {
    try {
      const updated = deleteCustomExercise(name);
      setExercises(updated);
    } catch {}
    setPendingDelete(null);
  }

  return (
    <div className="screen week-page">
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar" style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button className="back-btn" onClick={onBack}>← Back</button>
        <h1 style={{ margin:0 }}>Exercise Library</h1>
      </div>
      <div className="scroll">

        <div className="search-bar">
          <span style={{ color:theme.textSecondary }}>🔍</span>
          <input placeholder="Search exercises..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <span style={{ cursor:'pointer', color:theme.textSecondary }} onClick={() => setSearch('')}>✕</span>}
        </div>

        <div onClick={openNew} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8,
          background:theme.dietPurpleBg, border:`1px solid ${theme.dietBorder}`, borderRadius:10, padding:'11px', cursor:'pointer', margin:'4px 0 12px' }}>
          <span style={{ fontSize:16, color:theme.accentPurpleLight, fontWeight:700 }}>+ Add Custom Exercise</span>
        </div>

        <div style={{ fontSize:11, color:theme.textMuted, marginBottom:8, lineHeight:1.5 }}>
          Built-in and coach-imported exercises are read-only and can't be deleted, so your program and history always stay intact.
          {customCount > 0 && <> You have <strong style={{ color:theme.accentPurple }}>{customCount}</strong> custom exercise{customCount !== 1 ? 's' : ''}.</>}
        </div>

        <div className="card" style={{ padding:0 }}>
          {filtered.map((ex, i) => {
            const badge = ORIGIN_BADGE[ex.origin] || ORIGIN_BADGE.default;
            const isCustom = ex.origin === 'custom';
            return (
              <div key={ex.name} style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px',
                borderBottom: i < filtered.length - 1 ? `1px solid ${theme.borderMuted}` : 'none' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:theme.textHeading, overflow:'hidden', textOverflow:'ellipsis' }}>{ex.name}</div>
                  <div style={{ display:'flex', gap:6, marginTop:3, alignItems:'center' }}>
                    <span style={{ fontSize:9, fontWeight:700, color: theme[badge.colorKey], background: theme[badge.bgKey],
                      border:`1px solid ${theme[badge.colorKey]}`, borderRadius:5, padding:'1px 6px' }}>{badge.label}</span>
                    <span style={{ fontSize:10, color:theme.textMuted }}>{EX_TYPES.find(t => t.key === ex.type)?.label || ex.type}</span>
                  </div>
                </div>
                {isCustom ? (
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => openEdit(ex)} style={{ background:'none', border:`1px solid ${theme.borderDefault}`, borderRadius:7,
                      color:theme.accentBlueLight, fontSize:14, padding:'5px 9px', cursor:'pointer' }}>✎</button>
                    <button onClick={() => setPendingDelete(ex.name)} style={{ background:'none', border:'1px solid #5a1a1a', borderRadius:7,
                      color:'#e05050', fontSize:14, padding:'5px 9px', cursor:'pointer' }}>🗑</button>
                  </div>
                ) : (
                  <span style={{ fontSize:14, color:theme.textMuted }} title="Protected — cannot be edited or deleted">🔒</span>
                )}
              </div>
            );
          })}
          {!filtered.length && <div className="empty" style={{ padding:'16px 0' }}>No exercises match your search</div>}
        </div>

        <div style={{ height:20 }} />
      </div>

      {/* Add/Edit modal */}
      {editing && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, borderRadius:'inherit' }}>
          <div style={{ background:theme.bgCardAlt, border:`1px solid ${theme.borderDefault}`, borderRadius:16,
            padding:'20px 18px', margin:'0 20px', width:'100%', maxWidth:320 }}>
            <div style={{ fontSize:15, fontWeight:700, color:theme.textPrimary, marginBottom:14 }}>
              {editing.origName ? 'Edit Exercise' : 'Add Custom Exercise'}
            </div>

            <div style={{ fontSize:11, color:theme.accentBlueLight, marginBottom:4 }}>Name</div>
            <input
              autoFocus value={editing.name}
              onChange={e => setEditing(v => ({ ...v, name: e.target.value }))}
              placeholder="e.g. Bulgarian split squat"
              style={{ width:'100%', padding:'9px 10px', borderRadius:8, fontSize:13, marginBottom:12,
                background:theme.bgCardAlt, border:`1px solid ${theme.borderDefault}`, color:theme.textPrimary, outline:'none', boxSizing:'border-box' }}
            />

            <div style={{ fontSize:11, color:theme.accentBlueLight, marginBottom:6 }}>Type</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
              {EX_TYPES.map(t => (
                <div key={t.key} onClick={() => setEditing(v => ({ ...v, type: t.key }))}
                  style={{ padding:'6px 10px', borderRadius:8, fontSize:11, cursor:'pointer', fontWeight:600,
                    background: editing.type === t.key ? theme.accentBlueDeep : 'transparent',
                    border:`1px solid ${editing.type === t.key ? theme.accentBlueDeep : theme.borderDefault}`,
                    color: editing.type === t.key ? theme.accentBlueLight : theme.textMuted }}>{t.label}</div>
              ))}
            </div>

            {error && <div style={{ fontSize:11, color:'#e05050', marginBottom:10 }}>{error}</div>}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setEditing(null)} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:'transparent', border:`1px solid ${theme.borderDefault}`, color:theme.textMuted, fontSize:13,
              }}>Cancel</button>
              <button onClick={handleSave} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:theme.accentBlueDeep, border:`1px solid ${theme.accentBlueDeep}`, color:theme.accentBlueLight, fontSize:13, fontWeight:700,
              }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {pendingDelete && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, borderRadius:'inherit' }}>
          <div style={{ background:theme.bgCardAlt, border:'1px solid #5a1a1a', borderRadius:16,
            padding:'24px 20px', margin:'0 20px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
            <div style={{ fontSize:15, fontWeight:700, color:theme.textPrimary, marginBottom:6 }}>Delete "{pendingDelete}"?</div>
            <div style={{ fontSize:12, color:theme.textMuted, marginBottom:20, lineHeight:1.6 }}>
              It'll be removed from the exercise picker. Sets already logged under this name stay in your history.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setPendingDelete(null)} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:'transparent', border:`1px solid ${theme.dietPurpleSel}`, color:theme.textMuted, fontSize:13,
              }}>Cancel</button>
              <button onClick={() => handleDelete(pendingDelete)} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:'#5a1a1a', border:'1px solid #9e1d1d', color:'#ffd0d0', fontSize:13, fontWeight:700,
              }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TAGS = ['💪 Felt strong','🏆 New PR','🔥 Tough set','⬆ Increase weight','✅ Good form','😴 Fatigued'];

export function NotesScreen({ exerciseName, initialNote, onSave, onBack }) {
  const { theme } = useTheme();
  const [note, setNote] = useState(initialNote || '');

  function addTag(t) { setNote(n => n ? n + ' · ' + t : t); }

  function handleDone() { onSave(note); onBack(); }

  return (
    <div className="screen">
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="notes-screen">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div style={{ fontSize:18, fontWeight:700, color:theme.textHeading, marginBottom:3 }}>
          Notes · {exerciseName}
        </div>
        <div style={{ fontSize:12, color:theme.accentGreenDark, marginBottom:14 }}>
          {new Date().toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric', year:'numeric' })}
        </div>
        <textarea
          className="notes-textarea"
          placeholder="How did this feel? Form cues, PRs, things to remember next time..."
          value={note}
          onChange={e => setNote(e.target.value)}
          autoFocus
        />
        <div className="section-label">Quick tags</div>
        <div className="tag-row">
          {TAGS.map(t => (
            <button key={t} className="tag-btn" onClick={() => addTag(t)}>{t}</button>
          ))}
        </div>
        <button className="btn-fde" onClick={handleDone}>Done</button>
      </div>
    </div>
  );
}
