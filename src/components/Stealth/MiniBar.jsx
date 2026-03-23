// ════════════════════════════════
// FILE: src/components/Stealth/MiniBar.jsx
// ════════════════════════════════

import React, { useState } from 'react';

const MiniBar = ({ currentAnswer }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 300,
        maxHeight: isHovered ? 360 : 40,
        backgroundColor: '#05050c',
        border: '1px solid #1a1a2e',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,240,255,0.1)',
        zIndex: 99998,
        transition: 'max-height 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'fadeSlideUp 0.3s ease forwards'
      }}
    >
      {/* Header - Always visible */}
      <div style={{ 
        height: 40, 
        minHeight: 40,
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 12px',
        borderBottom: isHovered ? '1px solid #1a1a2e' : 'none',
        background: 'linear-gradient(90deg, rgba(0,240,255,0.05) 0%, transparent 100%)'
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 8px #00f0ff', marginRight: 8 }}></div>
        <div style={{ fontSize: 11, color: '#fff', fontFamily: 'JetBrains Mono', letterSpacing: 1, flex: 1 }}>SYSTEM ACTIVE</div>
        <div style={{ fontSize: 10, color: '#666' }}>{isHovered ? '▼' : '▲'}</div>
      </div>

      {/* Expanded Content */}
      <div style={{ 
        flex: 1, 
        padding: 16, 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.2s 0.1s'
      }}>
        <div style={{ 
          fontSize: 13, 
          color: '#e2e8f0', 
          lineHeight: 1.6, 
          fontFamily: 'Arial, sans-serif',
          whiteSpace: 'pre-wrap',
          flex: 1
        }}>
          {currentAnswer || "No active transmission. Run Live Copilot to receive data here."}
        </div>

        {currentAnswer && (
          <button 
            style={{ 
              marginTop: 16, 
              width: '100%', 
              padding: '8px', 
              background: '#1a1a2e', 
              border: '1px solid #333',
              color: '#00f0ff',
              borderRadius: 4,
              fontSize: 11,
              fontFamily: 'JetBrains Mono',
              cursor: 'pointer'
            }}
            onClick={() => navigator.clipboard.writeText(currentAnswer)}
          >
            COPY TRANSMISSION
          </button>
        )}
      </div>
    </div>
  );
};

export default MiniBar;
