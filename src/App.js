import React, { useState, useEffect, useRef } from 'react';
import goatImg from './assets/splash/PerformanceGOAT.png';
import limestoneImg from './assets/splash/Limestonewall.png';
import './styles.css';

import WeekScreen      from './screens/WeekScreen';
import ProgressScreen  from './screens/ProgressScreen';
import { HistoryScreen, DetailScreen, AllExercisesScreen } from './screens/HistoryScreen';
import TimersScreen    from './screens/TimersScreen';
import { SettingsScreen, NotesScreen, ExerciseLibraryScreen } from './screens/OtherScreens';
import DietScreen from './screens/DietScreen';
import { loadSettings, saveSettings } from './storage';
import { ThemeProvider } from './ThemeContext';

const NAV = [
  { key:'week',     label:'Week',     icon:<WeekIcon /> },
  { key:'progress', label:'Progress', icon:<ProgressIcon /> },
  { key:'history',  label:'History',  icon:<HistoryIcon /> },
  { key:'timers',   label:'Timers',   icon:<TimerIcon /> },
  { key:'diet',     label:'Diet',     icon:<DietIcon />     },
  { key:'settings', label:'Settings', icon:<SettingsIcon /> },
];

function SplashScreen({ onDismiss }) {
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 3500);
    return () => clearTimeout(t);
  }, []);
  function dismiss() {
    if (!ready) return;
    setFading(true);
    setTimeout(onDismiss, 400);
  }
  return (
    <div onClick={dismiss} style={{
      position:'absolute', inset:0, zIndex:999, borderRadius:'inherit',
      overflow:'hidden', background:'#111',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:18,
      transition:'opacity 0.4s ease', opacity: fading ? 0 : 1,
      cursor: ready ? 'pointer' : 'default',
    }}>
      {/* Layer 1: Goat behind wall */}
      <img src={goatImg} alt="PerformanceGOAT" style={{ width:260, height:260, objectFit:'cover', borderRadius:16, position:'absolute', zIndex:0, marginTop:-77, marginLeft:20 }} />

      {/* Layer 2: Limestone wall on top */}
      <img src={limestoneImg} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover', zIndex:1 }} />
      {/* Dark overlay to deepen the wall */}
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.25)', zIndex:1 }} />

      {/* Layer 3: All text */}
      <div style={{ textAlign:'right', position:'absolute', bottom:117, right:16, zIndex:2 }}>
        <div style={{ fontSize:22, fontWeight:800, color:'#fff', letterSpacing:'0.02em',
          textShadow:'0 0 20px rgba(255,255,255,0.4), 0 2px 4px rgba(0,0,0,1), 0 4px 20px rgba(0,0,0,0.8), 0 0 40px rgba(57,224,122,0.3), 3px 3px 0px rgba(0,0,0,0.6)' }}>PerformanceGOAT</div>
        <div style={{ fontSize:11, color:'#39e07a', fontWeight:600, marginTop:5, letterSpacing:'0.04em',
          textShadow:'0 0 10px rgba(57,224,122,0.6), 0 2px 4px rgba(0,0,0,0.9), 0 4px 12px rgba(0,0,0,0.7), 0 0 25px rgba(57,224,122,0.3)' }}>
          Coach Smith, CSCS · USAW-2 · FRCms
        </div>
      </div>
      <div style={{ position:'absolute', bottom:28, fontSize:10, color:'#FFD700', letterSpacing:'0.06em', zIndex:2, display:'flex', alignItems:'center', gap:3,
        textShadow:'0 0 10px rgba(255,215,0,0.7), 0 2px 4px rgba(0,0,0,0.9), 0 0 20px rgba(255,215,0,0.4)' }}>
        <span style={{ position:'relative', display:'inline-flex', alignItems:'center' }}>
          <svg viewBox="0 0 24 24" style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', width:28, height:28, opacity:0.35, zIndex:-1 }}>
            <polygon points="13,1 3,14 11,14 11,23 21,10 13,10" fill="#FFD700" />
          </svg>
          POWERED
        </span>
        {' BY COACH SMITH COACHING SYSTEMS'}
      </div>
    </div>
  );
}

export default function App() {
  const [splash,    setSplash]    = useState(true);
  const [tab,       setTab]       = useState('week');

  const [detailEx,  setDetailEx]  = useState(null);
  const [allExPage, setAllExPage] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showExLib, setShowExLib] = useState(false);

  // Lifted up so they survive the Notes screen mount/unmount
  const [noteText,  setNoteText]  = useState('');
  const [fieldVals, setFieldVals] = useState({});
  const [sprintMode,setSprintMode]= useState(false);
  const [curExIdx,  setCurExIdx]  = useState(0);
  const [distUnit,   setDistUnit]   = useState(() => loadSettings().distUnit   || 'mi');
  const [sprintUnit, setSprintUnit] = useState(() => loadSettings().sprintUnit || 'yd');
  const [weightUnit, setWeightUnit] = useState(() => loadSettings().weightUnit || 'lb');
  const [pageSwipe,  setPageSwipe]  = useState(() => loadSettings().pageSwipe !== false);

  const [swipeAdjacentTab, setSwipeAdjacentTab] = useState(null);
  const [swipeDir, setSwipeDir] = useState(null); // 'left' | 'right'
  const trackRef = useRef(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, animating: false, adjacentTab: null, direction: null });

  function handleTouchStart(e) {
    if (!pageSwipe || dragRef.current.animating) return;
    dragRef.current.startX = e.touches[0].clientX;
    dragRef.current.startY = e.touches[0].clientY;
    dragRef.current.active = false;
    dragRef.current.adjacentTab = null;
    dragRef.current.direction = null;
  }

  function handleTouchMove(e) {
    if (!pageSwipe || dragRef.current.animating) return;
    const dx = e.touches[0].clientX - dragRef.current.startX;
    const dy = e.touches[0].clientY - dragRef.current.startY;

    if (!dragRef.current.active) {
      if (Math.abs(dx) < 8) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
      const keys = NAV.map(n => n.key);
      const idx = keys.indexOf(tab);
      const direction = dx < 0 ? 'left' : 'right';
      const adjacentTab = direction === 'left' ? keys[idx + 1] : keys[idx - 1];
      if (!adjacentTab) return;
      dragRef.current.active = true;
      dragRef.current.direction = direction;
      dragRef.current.adjacentTab = adjacentTab;
      setSwipeAdjacentTab(adjacentTab);
      setSwipeDir(direction);
      return;
    }

    if (!trackRef.current) return;
    const w = trackRef.current.parentElement.offsetWidth;
    const clamped = dragRef.current.direction === 'left' ? Math.min(0, dx) : Math.max(0, dx);
    trackRef.current.style.transform = `translateX(${-w + clamped}px)`;
  }

  function handleTouchEnd(e) {
    if (!pageSwipe || !dragRef.current.active || dragRef.current.animating) {
      dragRef.current.active = false;
      return;
    }
    const dx = e.changedTouches[0].clientX - dragRef.current.startX;
    const shouldSwitch = Math.abs(dx) >= 72;
    const { adjacentTab, direction } = dragRef.current;
    dragRef.current.animating = true;

    if (trackRef.current) {
      const w = trackRef.current.parentElement.offsetWidth;
      trackRef.current.style.transition = 'transform 0.28s cubic-bezier(0.25,0.46,0.45,0.94)';
      trackRef.current.style.transform = shouldSwitch
        ? `translateX(${direction === 'left' ? -w * 2 : 0}px)`
        : `translateX(${-w}px)`;
      setTimeout(() => {
        if (shouldSwitch) switchTab(adjacentTab);
        setSwipeAdjacentTab(null);
        setSwipeDir(null);
        dragRef.current.active = false;
        dragRef.current.animating = false;
        if (trackRef.current) { trackRef.current.style.transition = ''; trackRef.current.style.transform = ''; }
      }, 280);
    } else {
      if (shouldSwitch) switchTab(adjacentTab);
      setSwipeAdjacentTab(null);
      setSwipeDir(null);
      dragRef.current.active = false;
      dragRef.current.animating = false;
    }
  }

  function changeWeightUnit(u) {
    const next = typeof u === 'function' ? u(weightUnit) : u;
    setWeightUnit(next);
    saveSettings({ ...loadSettings(), weightUnit: next });
  }
  function changeDistUnit(u) {
    const next = typeof u === 'function' ? u(distUnit) : u;
    setDistUnit(next);
    saveSettings({ ...loadSettings(), distUnit: next });
  }
  function changeSprintUnit(u) {
    const next = typeof u === 'function' ? u(sprintUnit) : u;
    setSprintUnit(next);
    saveSettings({ ...loadSettings(), sprintUnit: next });
  }
  const [stateVersion, setStateVersion] = useState(0);

  function bumpState() { setStateVersion(v => v + 1); }

  function openNotes() { setShowNotes(true); }
  function saveNote(txt) { setNoteText(txt); setShowNotes(false); }

  function switchTab(key) {
    setTab(key);
    setDetailEx(null);
    setAllExPage(false);
    setShowNotes(false);
    setShowExLib(false);
  }

  function renderScreen(forTab) {
    const t = forTab !== undefined ? forTab : tab;
    const isCurrent = forTab === undefined;
    if (isCurrent && showExLib) return <ExerciseLibraryScreen onBack={() => { setShowExLib(false); bumpState(); }} />;
    if (isCurrent && showNotes) return (
      <NotesScreen
        exerciseName={curExIdx}
        initialNote={noteText}
        onSave={saveNote}
        onBack={() => setShowNotes(false)}
      />
    );
    if (t === 'week') return (
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
        setDistUnit={changeDistUnit}
        sprintUnit={sprintUnit}
        setSprintUnit={changeSprintUnit}
        weightUnit={weightUnit}
        setWeightUnit={changeWeightUnit}
      />
    );
    if (t === 'progress') return <ProgressScreen stateVersion={stateVersion} weightUnit={weightUnit} setWeightUnit={changeWeightUnit} />;
    if (t === 'history') {
      if (isCurrent && detailEx) return <DetailScreen exerciseName={detailEx} onBack={() => setDetailEx(null)} stateVersion={stateVersion} />;
      if (isCurrent && allExPage) return <AllExercisesScreen onBack={() => setAllExPage(false)} onOpenDetail={ex => setDetailEx(ex)} stateVersion={stateVersion} />;
      return <HistoryScreen onOpenDetail={ex => setDetailEx(ex)} onOpenAllEx={() => setAllExPage(true)} stateVersion={stateVersion} />;
    }
    if (t === 'timers')   return <TimersScreen />;
    if (t === 'diet')     return <DietScreen stateVersion={stateVersion} weightUnit={weightUnit} setWeightUnit={changeWeightUnit} />;
    if (t === 'settings') return <SettingsScreen onImport={bumpState} onOpenExerciseLibrary={() => setShowExLib(true)} weightUnit={weightUnit} setWeightUnit={changeWeightUnit} distUnit={distUnit} setDistUnit={changeDistUnit} sprintUnit={sprintUnit} setSprintUnit={changeSprintUnit} pageSwipe={pageSwipe} setPageSwipe={v => { setPageSwipe(v); saveSettings({ ...loadSettings(), pageSwipe: v }); }} />;
  }

  return (
    <ThemeProvider>
    <div className="app">
      <div className="phone">
        {splash && <SplashScreen onDismiss={() => setSplash(false)} />}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden', position:'relative' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {swipeAdjacentTab ? (
            <div ref={trackRef} style={{
              display:'flex', flexDirection:'row',
              width:'300%', height:'100%',
              transform:`translateX(-33.333%)`,
              willChange:'transform',
            }}>
              <div style={{ width:'33.333%', flexShrink:0, height:'100%', overflow:'hidden', pointerEvents:'none' }}>
                {swipeDir === 'right' ? renderScreen(swipeAdjacentTab) : null}
              </div>
              <div style={{ width:'33.333%', flexShrink:0, height:'100%', overflow:'hidden' }}>
                {renderScreen()}
              </div>
              <div style={{ width:'33.333%', flexShrink:0, height:'100%', overflow:'hidden', pointerEvents:'none' }}>
                {swipeDir === 'left' ? renderScreen(swipeAdjacentTab) : null}
              </div>
            </div>
          ) : (
            renderScreen()
          )}
        </div>
        {!showNotes && !showExLib && (
          <nav className="nav">
            {NAV.map(n => (
              <div key={n.key} className={`nav-tab${tab===n.key?' active':''}`} onClick={() => switchTab(n.key)}>
                {n.icon}
                <span className="nav-label">{n.label}</span>
              </div>
            ))}
          </nav>
        )}
      </div>
    </div>
    </ThemeProvider>
  );
}

function WeekIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> }
function ProgressIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> }
function HistoryIcon()  { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="5" y1="20" x2="19" y2="20"/><line x1="7" y1="6" x2="17" y2="6"/><line x1="5" y1="4" x2="19" y2="4"/><line x1="8" y1="6" x2="8" y2="20"/><line x1="12" y1="6" x2="12" y2="20"/><line x1="16" y1="6" x2="16" y2="20"/></svg> }
function TimerIcon()    { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 14 15"/><line x1="9" y1="2" x2="15" y2="2"/></svg> }
function DietIcon()     { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg> }
function SettingsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> }
