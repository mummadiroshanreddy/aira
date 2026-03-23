import React from 'react';

const FollowUpRadar = ({ followups = [], onClick }) => {
  if (!followups || followups.length === 0) return null;

  return (
    <div style={{ marginTop: 24, animation: 'fadeSlideUp 0.3s ease forwards' }}>
      <div style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 }}>
        FOLLOW-UP RADAR
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {followups.map((q, i) => (
          <button
            key={i}
            onClick={() => onClick(q)}
            style={{
              background: 'transparent',
              border: '1px solid var(--orange-dim)',
              color: 'var(--orange)',
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 12,
              fontFamily: 'JetBrains Mono',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.target.style.background = 'var(--orange-dim)'; e.target.style.color = '#fff'; }}
            onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--orange)'; }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};
export default FollowUpRadar;
