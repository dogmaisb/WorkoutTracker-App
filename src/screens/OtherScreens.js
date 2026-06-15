import React, { useState } from 'react';
import { savePrescribed, loadPrescribed, loadExercises, saveExercises, loadSettings, saveSettings } from '../storage';

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

export function SettingsScreen({ onImport }) {
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
              toAdd.push({ name: ex.name, type: ex.type || 'strength' });
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
    <div className="screen week-page">
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="top-bar"><h1>Settings</h1></div>
      <div className="scroll">

        <div className="section-label">App</div>
        <div className="card">
          {[['Version','1.0.0'],['Weight unit','lbs'],['Distance','miles']].map(([l,v]) => (
            <div key={l} className="settings-row">
              <span className="settings-label">{l}</span>
              <span className="settings-val">{v}</span>
            </div>
          ))}
        </div>

        <div className="section-label">Coach Import</div>
        <div className="card">
          <div style={{ fontSize:12, color:'#8bbdd8', marginBottom:12, lineHeight:1.6 }}>
            Import a workout program exported from the <strong style={{ color:'#5adb9a' }}>Workout Coach</strong> app. The program will be merged into your calendar.
          </div>
          {importFlash && (
            <div style={{
              background: importFlash.warn ? '#1e1a08' : importFlash.ok ? '#0a2e1a' : '#2e0a0a',
              border: `1px solid ${importFlash.warn ? '#9e7a1d' : importFlash.ok ? '#1d9e75' : '#9e1d1d'}`,
              borderRadius:9, padding:'10px 14px', marginBottom:12, fontSize:12, fontWeight:700,
              color: importFlash.warn ? '#d4aa40' : importFlash.ok ? '#4adbaa' : '#e05050',
              whiteSpace:'pre-line',
            }}>
              {importFlash.msg}
            </div>
          )}
          <label style={{ display:'flex', alignItems:'center', gap:10, background:'#162d48', border:'1px solid #1e3a55', borderRadius:9, padding:'11px 14px', cursor:'pointer', transition:'border-color .15s' }}
            onMouseOver={e => e.currentTarget.style.borderColor='#1d9e75'}
            onMouseOut={e  => e.currentTarget.style.borderColor='#1e3a55'}>
            <span style={{ fontSize:18 }}>📂</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#5adb9a' }}>Import Coach JSON</div>
              <div style={{ fontSize:11, color:'#4a7a9a', marginTop:2 }}>Tap to select a .json file from your coach</div>
            </div>
            <input type="file" accept=".json" style={{ display:'none' }} onChange={handleImportJSON} />
          </label>
        </div>

        <div className="section-label">Data Backup</div>
        <div className="card">
          <div style={{ fontSize:12, color:'#8bbdd8', marginBottom:12, lineHeight:1.6 }}>
            Export all your data — sets, PRs, meals, food library, program — to a local file. Restore it anytime on any device.
          </div>
          {backupFlash && (
            <div style={{ background: backupFlash.ok ? '#0a2e1a' : '#2e0a0a', border: `1px solid ${backupFlash.ok ? '#1d9e75' : '#9e1d1d'}`, borderRadius:9, padding:'10px 14px', marginBottom:12, fontSize:12, fontWeight:700, color: backupFlash.ok ? '#4adbaa' : '#e05050' }}>
              {backupFlash.msg}
            </div>
          )}
          {/* Export */}
          <div onClick={exportData} style={{ display:'flex', alignItems:'center', gap:10, background:'#162d48', border:'1px solid #1e3a55', borderRadius:9, padding:'11px 14px', cursor:'pointer', marginBottom:8 }}>
            <span style={{ fontSize:18 }}>💾</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#7dd8ff' }}>Export Backup</div>
              <div style={{ fontSize:11, color:'#4a7a9a', marginTop:2 }}>Download a .json file with all your data</div>
            </div>
          </div>
          {/* Restore */}
          <label style={{ display:'flex', alignItems:'center', gap:10, background:'#162d48', border:'1px solid #1e3a55', borderRadius:9, padding:'11px 14px', cursor:'pointer' }}>
            <span style={{ fontSize:18 }}>📥</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#a878f0' }}>Restore from Backup</div>
              <div style={{ fontSize:11, color:'#4a7a9a', marginTop:2 }}>Load a previously exported backup file</div>
            </div>
            <input type="file" accept=".json" style={{ display:'none' }} onChange={handleRestoreFile} />
          </label>
        </div>

        <div className="section-label">Display</div>
        <div className="card">
          {[
            { key:'showBodyweightProgress', label:'Body Weight on Progress', desc:'Show weight trend & log on the Progress screen' },
            { key:'showBodyweightDiet',     label:'Body Weight on Diet',     desc:'Show weight input & graph mode on the Diet screen' },
          ].map(({ key, label, desc }, i, arr) => (
            <div key={key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0',
              borderBottom: i < arr.length - 1 ? '1px solid #1e3a55' : 'none' }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:'#e0f0e0' }}>{label}</div>
                <div style={{ fontSize:11, color:'#4a7a9a', marginTop:2 }}>{desc}</div>
              </div>
              <div onClick={() => toggleSetting(key)} style={{
                width:44, height:26, borderRadius:13, cursor:'pointer', position:'relative', transition:'background .2s',
                background: settings[key] ? '#1d9e75' : '#1e3a55',
                border: `1px solid ${settings[key] ? '#00ff88' : '#2a5a7a'}`,
                flexShrink:0, marginLeft:12,
              }}>
                <div style={{
                  position:'absolute', top:3, left: settings[key] ? 20 : 3,
                  width:18, height:18, borderRadius:'50%', background: settings[key] ? '#00ff88' : '#4a7a9a',
                  transition:'left .2s, background .2s',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div className="section-label">Coming Soon</div>
        <div className="card">
          {['Custom exercise library','Dark / light theme','Rest timer notifications','Workout templates','Apple Health sync'].map(f => (
            <div key={f} className="coming-item">• {f}</div>
          ))}
        </div>

      </div>

      {/* Restore confirmation modal */}
      {restoreWarn && (
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.75)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, borderRadius:'inherit' }}>
          <div style={{ background:'#160d20', border:'1px solid #4a2d6a', borderRadius:16,
            padding:'24px 20px', margin:'0 20px', textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
            <div style={{ fontSize:15, fontWeight:700, color:'#e8d0ff', marginBottom:6 }}>Replace all data?</div>
            <div style={{ fontSize:12, color:'#6a4a8a', marginBottom:20, lineHeight:1.6 }}>
              This will overwrite your current sets, program, meals, and all saved data with the backup file. This cannot be undone.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setRestoreWarn(false); setPendingRestore(null); }} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:'transparent', border:'1px solid #3a1a5a', color:'#9a7abf', fontSize:13,
              }}>Cancel</button>
              <button onClick={() => commitRestore(pendingRestore)} style={{
                flex:1, padding:'11px', borderRadius:10, cursor:'pointer',
                background:'#4a1a6a', border:'1px solid #7a3aaa', color:'#e8d0ff', fontSize:13, fontWeight:700,
              }}>Yes, Restore</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TAGS = ['💪 Felt strong','🏆 New PR','🔥 Tough set','⬆ Increase weight','✅ Good form','😴 Fatigued'];

export function NotesScreen({ exerciseName, initialNote, onSave, onBack }) {
  const [note, setNote] = useState(initialNote || '');

  function addTag(t) { setNote(n => n ? n + ' · ' + t : t); }

  function handleDone() { onSave(note); onBack(); }

  return (
    <div className="screen">
      <div className="status-bar"><span>9:41</span><span>●●●</span></div>
      <div className="notes-screen">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <div style={{ fontSize:18, fontWeight:700, color:'#e0f0e0', marginBottom:3 }}>
          Notes · {exerciseName}
        </div>
        <div style={{ fontSize:12, color:'#6a9a6a', marginBottom:14 }}>
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
