import React, { useEffect, useState } from 'react';
import { useSpeech } from '../../hooks/useSpeech';

const FillerCounter = () => {
  const { isListening, stopListening, startListening, fillerWords } = useSpeech();

  useEffect(() => {
    if (!isListening) {
      startListening();
    }
    return () => {
      stopListening();
    };
  }, [isListening, startListening, stopListening]);

  let currentTotal = Object.values(fillerWords).reduce((a, b) => a + b, 0);

  const color = currentTotal === 0 ? 'var(--green)' : currentTotal < 5 ? 'var(--yellow)' : 'var(--red)';

  return (
    <div style={{
      position: 'fixed', top: 70, right: 24,
      background: 'var(--bg-surface)', border: `1px solid ${color}`,
      padding: 16, borderRadius: 12, zIndex: 1000,
      width: 250, boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontWeight: 'bold', fontSize: 14, color }}>Filler Tracker</span>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: 'var(--red)',
          animation: isListening ? 'dotPulse 1s infinite' : 'none'
        }} />
      </div>
      
      <div style={{ fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 12 }}>
        {currentTotal} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>SESSION</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
        {Object.entries(fillerWords).map(([word, count]) => count > 0 && (
          <div key={word} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)' }}>"{word}"</span>
            <span style={{ color: '#fff' }}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
export default FillerCounter;
