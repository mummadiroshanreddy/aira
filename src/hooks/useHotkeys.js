// ════════════════════════════════
// FILE: src/hooks/useHotkeys.js
// ════════════════════════════════

import { useEffect } from 'react';

export const useHotkeys = (callbacks) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Modifiers
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key.toLowerCase();
      
      const isInput = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT';
      
      // Ctrl + Shift + Key bindings
      if (ctrl && shift && !isInput) {
        if (key === 'h' && callbacks.onStealth) { e.preventDefault(); callbacks.onStealth(); }
        if (key === 'm' && callbacks.onMini) { e.preventDefault(); callbacks.onMini(); }
        if (key === 't' && callbacks.onTeleprompter) { e.preventDefault(); callbacks.onTeleprompter(); }
        if (key === 'o' && callbacks.onOpacity) { e.preventDefault(); callbacks.onOpacity(); }
        if (key === 'f' && callbacks.onFiller) { e.preventDefault(); callbacks.onFiller(); }
        if (key === 'r' && callbacks.onRestore) { e.preventDefault(); callbacks.onRestore(); }
        
        // Mode switching 1-8
        if (key === '1' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(1); }
        if (key === '2' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(2); }
        if (key === '3' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(3); }
        if (key === '4' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(4); }
        if (key === '5' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(5); }
        if (key === '6' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(6); }
        if (key === '7' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(7); }
        if (key === '8' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(8); }
        if (key === '9' && callbacks.onMode) { e.preventDefault(); callbacks.onMode(9); }
      }

      // Ctrl + Key bindings (no shift)
      if (ctrl && !shift) {
        if (key === 'Enter' && callbacks.onSubmit) {
          e.preventDefault();
          callbacks.onSubmit();
        }
        if (key === 's' && callbacks.onSave) {
          e.preventDefault();
          callbacks.onSave();
        }
      }

      // Single Key bindings
      if (key === '?' && callbacks.onHelp) {
        // Only if not inside an input/textarea
        if (!isInput) {
          e.preventDefault();
          callbacks.onHelp();
        }
      }
      
      if (e.key === 'Escape' && callbacks.onEscape) {
        e.preventDefault();
        callbacks.onEscape();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callbacks]);
};
