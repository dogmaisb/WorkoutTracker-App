import React, { useState } from 'react';
import './styles.css';

import WeekScreen      from './screens/WeekScreen';
import ProgressScreen  from './screens/ProgressScreen';
import { HistoryScreen, DetailScreen } from './screens/HistoryScreen';
import TimersScreen    from './screens/TimersScreen';
import { SettingsScreen, NotesScreen } from './screens/OtherScreens';
import DietScreen from './screens/DietScreen';

const NAV = [
  { key:'week',     label:'Week',     icon:<WeekIcon /> },
  { key:'progress', label:'Progress', icon:<ProgressIcon /> },
  { key:'history',  label:'History',  icon:<HistoryIcon /> },
  { key:'timers',   label:'Timers',   icon:<TimerIcon /> },
  { key:'diet',     label:'Diet',     icon:<DietIcon />     },
  { key:'settings', label:'Settings', icon:<SettingsIcon /> },
];

export default function App() {
  const [tab,       setTab]       = useState('week');
  const [detailEx,  setDetailEx]  = useState(null);
  const [showNotes, setShowNotes] = useState(false);

  // Lifted up so they survive the Notes screen mount/unmount
  const [noteText,  setNoteText]  = useState('');
  const [fieldVals, setFieldVals] = useState({});
  const [sprintMode,setSprintMode]= useState(false);
  const [curExIdx,  setCurExIdx]  = useState(0);
  const [distUnit,   setDistUnit]   = useState('mi');
  const [sprintUnit, setSprintUnit] = useState('yd');
  const [weightUnit, setWeightUnit] = useState('lb');
  const [stateVersion, setStateVersion] = useState(0);

  function bumpState() { setStateVersion(v => v + 1); }

  function openNotes() { setShowNotes(true); }
  function saveNote(txt) { setNoteText(txt); setShowNotes(false); }

  function switchTab(key) {
    setTab(key);
    setDetailEx(null);
    setShowNotes(false);
  }

  function renderScreen() {
    if (showNotes) return (
      <NotesScreen
        exerciseName={curExIdx}
        initialNote={noteText}
        onSave={saveNote}
        onBack={() => setShowNotes(false)}
      />
    );
    if (tab === 'week') return (
      <WeekScreen
        onOpenNotes={openNotes}
        stateVersion={stateVersion}
        noteText={noteText}
        setNoteText={setNoteText}
        fieldVals={fieldVals}
        setFieldVals={setFieldVals}
        sprintMode={sprintMode}
        setSprintMode={setSprintMode}
        curExIdx={curExIdx}
        setCurExIdx={setCurExIdx}
        distUnit={distUnit}
        setDistUnit={setDistUnit}
        sprintUnit={sprintUnit}
        setSprintUnit={setSprintUnit}
        weightUnit={weightUnit}
        setWeightUnit={setWeightUnit}
      />
    );
    if (tab === 'progress') return <ProgressScreen stateVersion={stateVersion} />;
    if (tab === 'history') {
      if (detailEx) return <DetailScreen exerciseName={detailEx} onBack={() => setDetailEx(null)} stateVersion={stateVersion} />;
      return <HistoryScreen onOpenDetail={ex => setDetailEx(ex)} stateVersion={stateVersion} />;
    }
    if (tab === 'timers')   return <TimersScreen />;
    if (tab === 'diet')     return <DietScreen stateVersion={stateVersion} />;
    if (tab === 'settings') return <SettingsScreen onImport={bumpState} />;
  }

  return (
    <div className="app">
      <div className="phone">
        {renderScreen()}
        {!showNotes && (
          <nav className="nav">
            {NAV.map(n => (
              <div key={n.key} className={`nav-tab${tab===n.key?' active':''}`} onClick={() => switchTab(n.key)}>
                {n.icon}
                {n.label}
              </div>
            ))}
          </nav>
        )}
      </div>
    </div>
  );
}

function WeekIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function ProgressIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function HistoryIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="5" y1="20" x2="19" y2="20"/><line x1="7" y1="6" x2="17" y2="6"/><line x1="5" y1="4" x2="19" y2="4"/><line x1="8" y1="6" x2="8" y2="20"/><line x1="12" y1="6" x2="12" y2="20"/><line x1="16" y1="6" x2="16" y2="20"/></svg> }
function TimerIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14 15"/><line x1="9" y1="2" x2="15" y2="2"/></svg> }
function DietIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> }
function SettingsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
