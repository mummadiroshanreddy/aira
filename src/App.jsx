// ════════════════════════════════
// FILE: src/App.jsx
// ════════════════════════════════

import React, { useState, useEffect, Suspense } from 'react';
import { useHotkeys } from './hooks/useHotkeys';
import { useTimer } from './hooks/useTimer';
import { useVault } from './hooks/useVault';
import { v4 as uuidv4 } from 'uuid';

import SetupScreen from './components/Setup/SetupScreen';
import Sidebar from './components/Layout/Sidebar';
import TopBar from './components/Layout/TopBar';
import InputBar from './components/Layout/InputBar';

import FakeGoogleDocs from './components/Stealth/FakeGoogleDocs';
import MiniBar from './components/Stealth/MiniBar';
import Teleprompter from './components/Stealth/Teleprompter';
import PanicOverlay from './components/Stealth/PanicOverlay';

import Toast from './components/UI/Toast';
import FillerCounter from './components/UI/FillerCounter';
import HelpOverlay from './components/UI/HelpOverlay';

const LiveCopilot = React.lazy(() => import('./components/Modes/LiveCopilot'));
const ConfidenceScorer = React.lazy(() => import('./components/Modes/ConfidenceScorer'));
const CompanyIntel = React.lazy(() => import('./components/Modes/CompanyIntel'));
const SalaryWarRoom = React.lazy(() => import('./components/Modes/SalaryWarRoom'));
const QuestionPredictor = React.lazy(() => import('./components/Modes/QuestionPredictor'));
const RapidFire = React.lazy(() => import('./components/Modes/RapidFire'));
const AnswerVault = React.lazy(() => import('./components/Modes/AnswerVault'));
const PostInterview = React.lazy(() => import('./components/Modes/PostInterview'));

export const AppContext = React.createContext();

const App = () => {
  const [setupComplete, setSetupComplete] = useState(false);
  const [setupData, setSetupData] = useState(null);
  
  const [currentMode, setCurrentMode] = useState(1);
  const [stealthMode, setStealthMode] = useState(false);
  const [miniMode, setMiniMode] = useState(false);
  const [teleprompterActive, setTeleprompterActive] = useState(false);
  const [opacity, setOpacity] = useState(100);
  const [prePanicOpacity, setPrePanicOpacity] = useState(100);
  const [panicMode, setPanicMode] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [fillerCounterOpen, setFillerCounterOpen] = useState(false);
  
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [toasts, setToasts] = useState([]);
  
  const { sessionTime, startSessionTimer } = useTimer();
  const { saveAnswer } = useVault();

  useEffect(() => {
    let saved = localStorage.getItem('aria_setup');
    let userId = localStorage.getItem('aria_user_id');
    
    if (!userId) {
      userId = uuidv4();
      localStorage.setItem('aria_user_id', userId);
    }

    if (saved) {
      const parsed = JSON.parse(saved);
      setSetupData({ ...parsed, userId });
      setSetupComplete(true);
    } else {
      setSetupData(prev => ({ ...prev, userId }));
    }
  }, []);

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 2500);
  };

  useHotkeys({
    onStealth: () => setStealthMode(s => !s),
    onMini: () => setMiniMode(m => !m),
    onTeleprompter: () => setTeleprompterActive(t => !t),
    onOpacity: () => setOpacity(o => o === 100 ? 18 : 100),
    onFiller: () => setFillerCounterOpen(f => !f),
    onRestore: () => {
      setStealthMode(false);
      setMiniMode(false);
      setTeleprompterActive(false);
      if (panicMode) {
        setOpacity(prePanicOpacity);
        setPanicMode(false);
      } else {
        setOpacity(100);
      }
    },
    onMode: (modeId) => setCurrentMode(modeId),
    onHelp: () => setHelpOpen(true),
    onEscape: () => setHelpOpen(false)
  });

  if (panicMode) return null;

  if (!setupComplete) {
    return <SetupScreen onComplete={(data) => {
      setSetupData(data);
      setSetupComplete(true);
      startSessionTimer();
    }} />;
  }

  const renderMode = () => {
    switch(currentMode) {
      case 1: return <LiveCopilot />;
      case 2: return <ConfidenceScorer />;
      case 3: return <CompanyIntel />;
      case 4: return <SalaryWarRoom />;
      case 5: return <QuestionPredictor />;
      case 6: return <RapidFire />;
      case 7: return <AnswerVault />;
      case 8: return <PostInterview />;
      default: return <LiveCopilot />;
    }
  };

  const modeNames = {
    1: 'Live Copilot', 2: 'Confidence Scorer', 3: 'Company Intel', 4: 'Salary War Room',
    5: 'Question Predictor', 6: 'Rapid Fire Drills', 7: 'Answer Vault', 8: 'Post-Interview'
  };

  return (
    <AppContext.Provider value={{ setupData, currentAnswer, setCurrentAnswer, saveAnswer, addToast }}>
      <div 
        className="app-container" 
        style={{ opacity: opacity / 100, transition: 'opacity 0.2s', backgroundColor: 'var(--bg-base)', minHeight: '100vh', display: 'flex' }}
      >
        <Sidebar 
          currentMode={currentMode} 
          setCurrentMode={setCurrentMode} 
          setupData={setupData}
          onEditProfile={() => setSetupComplete(false)}
          onHelp={() => setHelpOpen(true)}
          toggleStealth={() => setStealthMode(s=>!s)}
          toggleMini={() => setMiniMode(m=>!m)}
        />
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100vh' }}>
          <TopBar 
            modeName={modeNames[currentMode]} 
            sessionTime={sessionTime} 
            isStealthActive={stealthMode || miniMode || teleprompterActive}
            onToggleFiller={() => setFillerCounterOpen(f=>!f)}
          />
          
          <main style={{ flex: 1, overflowY: 'auto', padding: '24px', paddingBottom: '100px', position: 'relative' }}>
            <Suspense fallback={<div className="aria-card" style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><div style={{ animation: 'pulseGlow 1s infinite', color: 'var(--cyan)' }}>Loading Core Protocol...</div></div>}>
              {renderMode()}
            </Suspense>
          </main>

          {(currentMode === 1 || currentMode === 2) && (
            <InputBar />
          )}
        </div>

        {stealthMode && <FakeGoogleDocs />}
        {miniMode && <MiniBar currentAnswer={currentAnswer} />}
        {teleprompterActive && <Teleprompter currentAnswer={currentAnswer} onClose={() => setTeleprompterActive(false)} />}
        
        <PanicOverlay onTrigger={() => { setPrePanicOpacity(opacity); setOpacity(0); setPanicMode(true); }} />
        
        <div 
          style={{ position: 'fixed', top: 0, left: 0, width: 24, height: 24, zIndex: 9999999, cursor: 'pointer' }}
          onClick={() => setOpacity(o => o === 100 ? 18 : 100)}
          title="Toggle Opacity (Secret)"
        />
        
        {fillerCounterOpen && <FillerCounter onClose={() => setFillerCounterOpen(false)} />}
        {helpOpen && <HelpOverlay onClose={() => setHelpOpen(false)} />}
        
        <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 999999 }}>
          {toasts.map(t => (
            <Toast key={t.id} message={t.message} type={t.type} onClose={() => setToasts(prev => prev.filter(x => x.id !== t.id))} />
          ))}
        </div>
      </div>
    </AppContext.Provider>
  );
};

export default App;
