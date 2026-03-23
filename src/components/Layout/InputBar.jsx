// ════════════════════════════════
// FILE: src/components/Layout/InputBar.jsx
// ════════════════════════════════

import React, { useState, useRef, useEffect, useContext } from 'react';
import { useSpeech } from '../../hooks/useSpeech';
import { AppContext } from '../../App';

const InputBar = () => {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef(null);
  const { isListening, transcript, resetTranscript, startListening, stopListening } = useSpeech();
  
  // Custom event listener for external submissions (e.g., from FollowUpRadar or Predictions)
  useEffect(() => {
    const handleAriaSubmit = (e) => {
      const submittedText = e.detail;
      setText('');
      setIsSubmitting(true);
      setTimeout(() => setIsSubmitting(false), 500); // Simulate network overhead for UI
    };
    window.addEventListener('aria_submit', handleAriaSubmit);
    return () => window.removeEventListener('aria_submit', handleAriaSubmit);
  }, []);

  // Sync speech transcript to text area
  useEffect(() => {
    if (transcript) setText(transcript);
  }, [transcript]);

  const toggleMic = () => {
    if (isListening) stopListening();
    else {
      resetTranscript();
      setText('');
      startListening();
    }
  };

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto'; // Reset height
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`; // Max 6 rows approx
    }
  };

  const handleInput = (e) => {
    setText(e.target.value);
    // V2: Removed redundant setTranscript hook cross-sync
    adjustHeight();
  };

  const handleSubmit = () => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    
    // Dispatch core submit event
    window.dispatchEvent(new CustomEvent('aria_submit', { detail: text.trim() }));
    
    setText('');
    resetTranscript();
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    // Quick timeout to reset button state
    setTimeout(() => setIsSubmitting(false), 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      // Optional: Enter to submit, Shift+Enter for newline. 
      // Spec says Ctrl+Enter submits, Shift+Enter new line. Standard enter should also new line or submit?
      // Spec: "Ctrl+Enter submits. Shift+Enter adds newline." 
      // We will let normal Enter add a newline by default in textarea to match standard behavior unless intercepting.
    }
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 280, // Offset for sidebar
      right: 0,
      background: 'linear-gradient(to top, var(--bg-base) 60%, transparent)',
      padding: '24px 32px 32px',
      zIndex: 100,
      pointerEvents: 'none' // Let clicks pass to content behind the gradient
    }}>
      <style>{`
        @media(max-width: 768px) {
          .input-bar-container { left: 0 !important; }
        }
      `}</style>
      
      <div className="input-bar-container" style={{ position: 'relative', left: '0', pointerEvents: 'auto', maxWidth: 900, margin: '0 auto' }}>
        
        {text.length >= 200 && (
          <div style={{ position: 'absolute', top: -24, right: 16, fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>
            {text.length} chars
          </div>
        )}

        <div style={{ 
          background: 'var(--bg-raised)',
          border: `1px solid ${isListening ? 'var(--red)' : 'var(--border-dim)'}`,
          borderRadius: 24,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          transition: 'all 0.3s ease',
          animation: isListening ? 'pulseGlow 2s infinite' : 'none'
        }}>
          
          <button 
            className="btn-ghost" 
            onClick={toggleMic}
            style={{ 
              padding: 12, 
              borderRadius: '50%', 
              color: isListening ? 'var(--red)' : 'var(--text-secondary)',
              background: isListening ? 'rgba(255, 42, 42, 0.1)' : 'transparent',
              marginBottom: 4
            }}
          >
            {isListening ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z"/>
              </svg>
            )}
          </button>

          <textarea
            ref={textareaRef}
            className="aria-input"
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening to interviewer... (Speak clearly)" : "Type interview question here... (Ctrl+Enter to submit)"}
            style={{ 
              flex: 1, 
              border: 'none', 
              background: 'transparent',
              padding: '12px 0',
              resize: 'none',
              minHeight: '24px',
              height: '24px',
              lineHeight: '1.5',
              fontSize: '16px'
            }}
          />

          <button 
            className="btn-primary" 
            onClick={handleSubmit}
            disabled={!text.trim() || isSubmitting}
            style={{ 
              padding: 12, 
              borderRadius: '50%', 
              background: text.trim() && !isSubmitting ? 'var(--cyan)' : 'var(--border-dim)',
              color: '#000',
              marginBottom: 4,
              opacity: text.trim() && !isSubmitting ? 1 : 0.5
            }}
          >
            {isSubmitting ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            )}
          </button>

        </div>
        
        <div style={{ textAlign: 'center', marginTop: 12, color: 'var(--text-dim)', fontSize: 11, fontFamily: 'JetBrains Mono', display: 'flex', justifyContent: 'center', gap: 16 }}>
           <span>{isListening ? '● LIVE TRANSCRIBING' : 'CO-PILOT READY'}</span>
           <span style={{ opacity: 0.5 }}>Ctrl+Enter to send</span>
        </div>
      </div>
    </div>
  );
};

export default InputBar;
