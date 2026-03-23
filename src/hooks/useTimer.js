// ════════════════════════════════
// FILE: src/hooks/useTimer.js
// ════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

export const useTimer = () => {
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef(null);

  const startSessionTimer = useCallback(() => {
    if (!isActive) {
      setIsActive(true);
      intervalRef.current = setInterval(() => {
        setSeconds((sc) => sc + 1);
      }, 1000);
    }
  }, [isActive]);

  const pauseSessionTimer = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const resetSessionTimer = useCallback(() => {
    setIsActive(false);
    setSeconds(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const formatSessionTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    sessionTime: formatSessionTime(seconds),
    sessionSeconds: seconds,
    startSessionTimer,
    pauseSessionTimer,
    resetSessionTimer,
    isActive
  };
};

export const useCountdown = (initialSeconds, onExpire) => {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef(null);

  const startCountdown = useCallback(() => {
    setIsActive(true);
    setIsExpired(false);
    
    if (intervalRef.current) clearInterval(intervalRef.current);
    
    intervalRef.current = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setIsActive(false);
          setIsExpired(true);
          if (onExpire) onExpire();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [onExpire]);

  const pauseCountdown = useCallback(() => {
    setIsActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const resetCountdown = useCallback((newSeconds) => {
    setIsActive(false);
    setIsExpired(false);
    setRemaining(newSeconds || initialSeconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [initialSeconds]);

  const formatCountdown = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    remaining,
    display: formatCountdown(remaining),
    isExpired,
    isActive,
    startCountdown,
    pauseCountdown,
    resetCountdown
  };
};
