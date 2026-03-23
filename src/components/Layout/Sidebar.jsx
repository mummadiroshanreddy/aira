// ════════════════════════════════
// FILE: src/components/Layout/Sidebar.jsx
// ════════════════════════════════

import React from 'react';

const Sidebar = ({ currentMode, setCurrentMode, setupData, onEditProfile, onHelp, toggleStealth, toggleMini }) => {
  const modes = [
    { id: 1, icon: '🎯', label: 'Live Copilot', hotkey: '1' },
    { id: 2, icon: '⚖️', label: 'Confidence Score', hotkey: '2' },
    { id: 3, icon: '🏢', label: 'Company Intel', hotkey: '3' },
    { id: 4, icon: '💰', label: 'Salary War Room', hotkey: '4' },
    { id: 5, icon: '🔮', label: 'Question Predictor', hotkey: '5' },
    { id: 6, icon: '⏱️', label: 'Rapid Fire Drills', hotkey: '6' },
    { id: 7, icon: '💾', label: 'Answer Vault', hotkey: '7' },
    { id: 8, icon: '✉️', label: 'Post-Interview', hotkey: '8' },
  ];

  return (
    <>
      <style>{`
        .aria-sidebar {
          width: 280px;
          height: 100vh;
          background: #080812;
          border-right: 1px solid var(--border-dim);
          display: flex;
          flex-direction: column;
          padding: 24px;
        }
        @media(max-width: 768px) {
          .aria-sidebar { display: none !important; }
        }
      `}</style>
      
      <div className="aria-sidebar">
        {/* Logo Area */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40, padding: '0 8px' }}>
          <svg style={{ width: 28, height: 28, fill: 'var(--cyan)' }} viewBox="0 0 24 24">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/>
          </svg>
          <div>
            <div style={{ fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>ARIA</div>
            <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 2 }}>COPILOT v1.0</div>
          </div>
        </div>

        {/* Profile Card Summary */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-dim)', borderRadius: 12, padding: 16, marginBottom: 24, position: 'relative' }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 4 }} className="truncate">{setupData?.name || 'Candidate'}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }} className="truncate">Target: {setupData?.role || 'Role'}</div>
          <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', width: '100%' }} onClick={onEditProfile}>
            Edit Profile
          </button>
        </div>

        {/* Main Navigation */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 8, paddingLeft: 8 }}>TACTICAL MODES</div>
          {modes.map(mode => (
            <button
              key={mode.id}
              onClick={() => setCurrentMode(mode.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: currentMode === mode.id ? 'rgba(0, 240, 255, 0.08)' : 'transparent',
                border: 'none',
                borderLeft: currentMode === mode.id ? '3px solid var(--cyan)' : '3px solid transparent',
                borderRadius: '0 8px 8px 0',
                color: currentMode === mode.id ? 'var(--cyan)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.1s ease',
                fontFamily: 'Syne',
                fontSize: 14,
                width: '100%'
              }}
            >
              <span style={{ fontSize: 16 }}>{mode.icon}</span>
              <span style={{ flex: 1 }}>{mode.label}</span>
              <span style={{ 
                fontSize: 10, 
                fontFamily: 'JetBrains Mono', 
                background: currentMode === mode.id ? 'rgba(0,240,255,0.2)' : 'rgba(255,255,255,0.05)', 
                padding: '2px 6px', 
                borderRadius: 4,
                color: currentMode === mode.id ? 'var(--cyan)' : 'var(--text-dim)'
              }}>
                ^{mode.hotkey}
              </span>
            </button>
          ))}
        </div>

        {/* Bottom Stealth & Utility Controls */}
        <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: 20, marginTop: 20 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 12, paddingLeft: 8 }}>STEALTH SYSTEMS</div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
             <button onClick={toggleStealth} title="Google Docs Mask (Ctrl+Shift+H)" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
               📄 <span style={{fontSize: 12}}>Docs</span>
             </button>
             <button onClick={toggleMini} title="MiniBar Mode (Ctrl+Shift+M)" style={{ background: 'var(--bg-raised)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '10px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
               🪟 <span style={{fontSize: 12}}>Mini</span>
             </button>
          </div>

          <button className="btn-ghost" style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={onHelp}>
            <span>Keyboard Shortcuts</span>
            <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>?</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
