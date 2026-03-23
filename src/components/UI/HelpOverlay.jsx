import React from 'react';

const HelpOverlay = ({ onClose }) => {
  const shortcuts = [
    { key: 'Ctrl+Shift+H', desc: 'Stealth Google Docs' },
    { key: 'Ctrl+Shift+M', desc: 'MiniBar Notification Mode' },
    { key: 'Ctrl+Shift+T', desc: 'Teleprompter Mode' },
    { key: 'Ctrl+Shift+O', desc: 'Toggle App Opacity (18% / 100%)' },
    { key: 'Ctrl+Shift+R', desc: 'Restore App Visibility' },
    { key: 'Ctrl+Shift+F', desc: 'Toggle Filler Words Tracker' },
    { key: 'Ctrl+Enter', desc: 'Submit Message' },
    { key: 'Ctrl+S', desc: 'Save to Vault' },
    { key: '⌘ 1-8', desc: 'Switch Modes' },
    { key: 'Esc', desc: 'Close modals/menus' },
  ];

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(5,5,12,0.85)', backdropFilter: 'blur(4px)',
        zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <div className="aria-card" onClick={e => e.stopPropagation()} style={{ width: 600, maxWidth: '90%' }}>
        <h2 style={{ marginBottom: 24, fontSize: 24, color: 'var(--cyan)' }}>Keyboard Command Center</h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {shortcuts.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', padding: 12, background: 'var(--bg-raised)', borderRadius: 8 }}>
              <span style={{ color: 'var(--cyan)', fontWeight: 'bold', marginBottom: 4 }}>{s.key}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{s.desc}</span>
            </div>
          ))}
        </div>
        
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button className="btn-ghost" onClick={onClose}>Press ? or Esc to close</button>
        </div>
      </div>
    </div>
  );
};
export default HelpOverlay;
