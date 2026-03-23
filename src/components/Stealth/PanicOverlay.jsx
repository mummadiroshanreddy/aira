// ════════════════════════════════
// FILE: src/components/Stealth/PanicOverlay.jsx
// ════════════════════════════════

import React from 'react';

const PanicOverlay = ({ onTrigger }) => {
  const triggerPanic = () => {
    // Attempt to open google in a new tab to create a distraction
    try { window.open('https://google.com', '_blank'); } catch(e){}
    onTrigger();
  };

  return (
    <div 
      onClick={triggerPanic}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: 50,
        height: 50,
        cursor: 'default', // Don't use pointer to avoid suspicion
        zIndex: 999999,
        background: 'transparent' // Completely invisible
      }}
      title="" // Empty title so no tooltip shows
    />
  );
};

export default PanicOverlay;
