import React, { useEffect, useState } from 'react';

const ScoreRing = ({ score = 0, size = 120, animated = true }) => {
  const [displayScore, setDisplayScore] = useState(0);
  
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  const numScore = Number(score);
  const color = numScore >= 8 ? 'var(--green)' : numScore >= 5 ? 'var(--yellow)' : 'var(--red)';
  
  const fillTarget = circumference - (numScore / 10) * circumference;

  useEffect(() => {
    if (animated) {
      let start = 0;
      const step = () => {
        start += 0.2;
        if (start < numScore) {
          setDisplayScore(start.toFixed(1));
          requestAnimationFrame(step);
        } else {
          setDisplayScore(numScore.toFixed(1));
        }
      };
      step();
    } else {
      setDisplayScore(numScore.toFixed(1));
    }
  }, [numScore, animated]);

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-dim)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: animated ? fillTarget : fillTarget,
            animation: animated ? 'ringFill 1.2s ease-out forwards' : 'none',
            '--ring-circumference': circumference,
            '--ring-fill-target': fillTarget
          }}
        />
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <span style={{ fontSize: size * 0.25, fontWeight: 'bold', fontFamily: 'Syne', color: '#fff' }}>
          {displayScore}
        </span>
        <span style={{ fontSize: size * 0.1, color: 'var(--text-secondary)' }}>/10</span>
      </div>
    </div>
  );
};
export default ScoreRing;
