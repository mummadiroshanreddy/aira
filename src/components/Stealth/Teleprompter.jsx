// ════════════════════════════════
// FILE: src/components/Stealth/Teleprompter.jsx
// ════════════════════════════════

import React, { useState, useEffect } from 'react';

const Teleprompter = ({ currentAnswer, onClose }) => {
  const [speed, setSpeed] = useState(5);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === '=' || e.key === '+') setSpeed(s => Math.max(1, s - 1));
      if (e.key === '-' || e.key === '_') setSpeed(s => Math.min(15, s + 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 52,
      background: 'rgba(0, 0, 0, 0.95)',
      borderTop: '1px solid #333',
      zIndex: 99997,
      display: 'flex',
      alignItems: 'center',
      padding: '0 16px',
      overflow: 'hidden'
    }}>
      <style>{`
        @keyframes teleprompterScroll {
          0% { transform: translateX(100vw); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
      
      {/* Speed Controls (Subtle) */}
      <div style={{ position: 'absolute', left: 16, display: 'flex', gap: 8, zIndex: 2, background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: 4 }}>
        <div style={{ fontSize: 10, color: '#666', fontFamily: 'JetBrains Mono' }}>SPD {11 - speed} (+/-)</div>
      </div>
      
      {/* Close Button */}
      <div style={{ position: 'absolute', right: 16, zIndex: 2, background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: 4 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Scrolling Text */}
      <div style={{ width: '100%', whiteSpace: 'nowrap', position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
        <div style={{ 
          fontSize: 24, 
          fontWeight: 'bold', 
          color: '#fff', 
          fontFamily: 'Arial, sans-serif',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)',
          animation: `teleprompterScroll ${Math.max(30, (currentAnswer ? currentAnswer.length : 100) * 0.15 * (10 / speed))}s linear infinite`,
          display: 'inline-block',
          whiteSpace: 'nowrap'
        }}>
          {currentAnswer ? currentAnswer.replace(/\n/g, ' █ ') : "Awaiting input... Standby for transmission."}
        </div>
      </div>
    </div>
  );
};

export default Teleprompter;
