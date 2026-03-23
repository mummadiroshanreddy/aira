// ════════════════════════════════
// FILE: src/components/Layout/TopBar.jsx
// ════════════════════════════════

import React from 'react';
import ProviderSwitcher from '../UI/ProviderSwitcher';

const TopBar = ({ modeName, sessionTime, isStealthActive, onToggleFiller }) => {
  return (
    <div style={{ 
      height: 72, 
      borderBottom: '1px solid var(--border-dim)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'space-between',
      padding: '0 24px',
      background: 'rgba(5, 5, 12, 0.8)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      
      {/* Left Area - Mode Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ color: 'var(--cyan)', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 }}>{modeName}</div>
        <div style={{ height: 16, width: 1, background: 'var(--border-dim)' }}></div>
        <div style={{ color: 'var(--text-dim)', fontSize: 12, fontFamily: 'JetBrains Mono' }}>System Online</div>
      </div>

      {/* Center Area - Live Session Timer */}
      <div style={{ 
        background: 'var(--bg-raised)', 
        padding: '6px 16px', 
        borderRadius: 20, 
        border: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'JetBrains Mono',
        fontSize: 13,
        color: 'var(--text-primary)'
      }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', animation: 'pulseGlow 2s infinite' }}></span>
        SESSION <span style={{ color: 'var(--cyan)' }}>
          {typeof sessionTime === 'number' ? 
            `${Math.floor(sessionTime / 60).toString().padStart(2, '0')}:${(sessionTime % 60).toString().padStart(2, '0')}` 
            : '00:00'}
        </span>
      </div>

      {/* Right Area - Utilities */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        
        {/* Stealth Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }} title="Stealth System Status">
          Stealth
          <span style={{ 
            width: 8, height: 8, borderRadius: '50%', 
            background: isStealthActive ? 'var(--red)' : 'var(--border-dim)',
            animation: isStealthActive ? 'blink 1s infinite' : 'none'
          }}></span>
        </div>

        <ProviderSwitcher />

        <div style={{ height: 16, width: 1, background: 'var(--border-dim)' }}></div>

        {/* Filler Word Counter Badge */}
        <button 
          onClick={onToggleFiller}
          className="btn-ghost"
          style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}
          title="Toggle Filler Counters (Ctrl+Shift+F)"
        >
          Um/Uh Stats
        </button>

      </div>
    </div>
  );
};

export default TopBar;
