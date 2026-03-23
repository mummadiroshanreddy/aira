import { useRef, useCallback, useState, useEffect } from 'react';

// ── Native Streaming Text-To-Speech Engine ────────────
// Buffers incoming tokens and plays them dynamically at sentence boundaries.
// Bypasses the need for expensive, latency-heavy external TTS APIs.

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const bufferRef = useRef('');
  const activeUtterances = useRef(0);

  // Load voices proactively on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const getPremiumVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    return englishVoices.find(v => v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Premium')) || englishVoices[0];
  };

  const dispatchSpeech = (text) => {
    if (!('speechSynthesis' in window) || !text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.voice = getPremiumVoice();
    utterance.rate = 1.05; // Slightly sped up for assistant feel
    utterance.volume = 0.65;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      activeUtterances.current += 1;
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      activeUtterances.current = Math.max(0, activeUtterances.current - 1);
      if (activeUtterances.current === 0) {
        setIsSpeaking(false);
      }
    };

    utterance.onerror = () => {
      activeUtterances.current = Math.max(0, activeUtterances.current - 1);
      if (activeUtterances.current === 0) {
        setIsSpeaking(false);
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  const speakChunk = useCallback((tokenStreamText) => {
    bufferRef.current += tokenStreamText;

    // Regex for sentence boundaries (split on punctuation)
    const match = bufferRef.current.match(/([^.!?\n]+[.!?\n]+)/);

    if (match) {
      const sentence = match[0];
      bufferRef.current = bufferRef.current.slice(sentence.length);
      dispatchSpeech(sentence);
    }
  }, []);

  const flush = useCallback(() => {
    if (bufferRef.current.trim()) {
      dispatchSpeech(bufferRef.current);
      bufferRef.current = '';
    }
  }, []);

  const cancel = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      bufferRef.current = '';
      activeUtterances.current = 0;
      setIsSpeaking(false);
    }
  }, []);

  return { speakChunk, flush, cancel, isSpeaking };
};
