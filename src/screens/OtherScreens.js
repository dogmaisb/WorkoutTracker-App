import React, { useState } from 'react';
import { savePrescribed, loadPrescribed, loadExercises, saveExercises } from '../storage';

export function SettingsScreen({ onImport }) {
  const [importFlash, setImportFlash] = useState(null);

  function handleImportJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data._coach_export || !Array.isArray(data.workouts)) {
          setImportFlash({ ok: false, msg: 'Invalid file — export from the Coach App first.' });
          setTimeout(() => setImportFlash(null), 3500);
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

        // Register any unknown exercises so they appear in WeekScreen picker, History, etc.
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

        setImportFlash({ ok: true, msg: `✓ ${data.client}'s program imported!` });
        setTimeout(() => setImportFlash(null), 3000);
        if (onImport) onImport();
      } catch {
        setImportFlash({ ok: false, msg: 'Failed to read file.' });
        setTimeout(() => setImportFlash(null), 3500);
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
            <div style={{ background: importFlash.ok ? '#0a2e1a' : '#2e0a0a', border: `1px solid ${importFlash.ok ? '#1d9e75' : '#9e1d1d'}`, borderRadius:9, padding:'10px 14px', marginBottom:12, fontSize:12, fontWeight:700, color: importFlash.ok ? '#4adbaa' : '#e05050' }}>
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

        <div className="section-label">Coming Soon</div>
        <div className="card">
          {['Custom exercise library','Dark / light theme','Export data to CSV','Rest timer notifications','Workout templates','Apple Health sync'].map(f => (
            <div key={f} className="coming-item">• {f}</div>
          ))}
        </div>

      </div>
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
