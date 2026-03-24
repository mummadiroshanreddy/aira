import { useRef, useCallback, useState, useEffect } from 'react';

// ── Elite Streaming TTS Engine ────────────────────────
// Ultra-low latency chunk speaking:
// - Speaks at phrase boundaries (comma, period, question mark)
// - Does NOT wait for sentence end — fires on commas too
// - Barge-in via cancel() clears the entire queue instantly

export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const bufferRef = useRef('');
  const activeUtterances = useRef(0);
  const voiceRef = useRef(null);

  // Proactively load and cache the best available voice
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;

    const loadVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const en = voices.filter(v => v.lang.startsWith('en'));
      // Priority: Google US English > Microsoft > Samantha > any English
      voiceRef.current =
        en.find(v => v.name === 'Google US English') ||
        en.find(v => v.name.includes('Microsoft') && v.name.includes('Natural')) ||
        en.find(v => v.name.includes('Samantha')) ||
        en.find(v => v.name.includes('Google')) ||
        en[0] ||
        null;
    };

    loadVoice();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoice);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoice);
  }, []);

  const dispatchSpeech = useCallback((text) => {
    if (!('speechSynthesis' in window) || !text.trim()) return;

    const utterance = new SpeechSynthesisUtterance(text.trim());
    if (voiceRef.current) utterance.voice = voiceRef.current;
    utterance.rate = 1.1;   // Slightly faster = more natural interview assistant
    utterance.pitch = 1.0;
    utterance.volume = 0.75;

    utterance.onstart = () => {
      activeUtterances.current += 1;
      setIsSpeaking(true);
    };
    utterance.onend = () => {
      activeUtterances.current = Math.max(0, activeUtterances.current - 1);
      if (activeUtterances.current === 0) setIsSpeaking(false);
    };
    utterance.onerror = () => {
      activeUtterances.current = Math.max(0, activeUtterances.current - 1);
      if (activeUtterances.current === 0) setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  // speakChunk — fires at PHRASE boundaries (comma/period/?/!) for ultra-low latency
  // Also fires when buffer exceeds 80 chars to prevent long silences
  const speakChunk = useCallback((tokenStreamText) => {
    bufferRef.current += tokenStreamText;

    // Fire on any phrase boundary: . ! ? \n ,
    const phraseMatch = bufferRef.current.match(/^(.+?[.!?\n,]+)\s*/);
    if (phraseMatch) {
      const phrase = phraseMatch[1];
      bufferRef.current = bufferRef.current.slice(phraseMatch[0].length);
      // Skip tiny comma fragments — only speak if meaningful
      if (phrase.trim().length > 8) {
        dispatchSpeech(phrase);
      }
      return;
    }

    // Force-flush if buffer gets long (prevents stalling on run-on text)
    if (bufferRef.current.length > 80) {
      const chunk = bufferRef.current;
      bufferRef.current = '';
      dispatchSpeech(chunk);
    }
  }, [dispatchSpeech]);

  // Flush remaining buffer at end of response
  const flush = useCallback(() => {
    if (bufferRef.current.trim()) {
      dispatchSpeech(bufferRef.current);
      bufferRef.current = '';
    }
  }, [dispatchSpeech]);

  // Hard cancel — barge-in support
  const cancel = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    bufferRef.current = '';
    activeUtterances.current = 0;
    setIsSpeaking(false);
  }, []);

  return { speakChunk, flush, cancel, isSpeaking };
};
