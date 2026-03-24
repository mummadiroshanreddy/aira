import { useState, useEffect, useRef, useCallback } from 'react';

// ── Voice Input Engine ────────────────────────────────
// WebSpeech API wrapper with continuous listening,
// silence detection, and barge-in support.

export const useSpeech = (options = {}) => {
  const { onSilence, silenceTimeoutMs = 700 } = options;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const shouldListenRef = useRef(false);
  const isListeningRef = useRef(false); // ref mirror to avoid stale closures

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[useSpeech] Web Speech API not supported in this browser.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onstart = () => {
      isListeningRef.current = true;
      setIsListening(true);
    };

    rec.onresult = (event) => {
      let finalTrans = '';
      let interimTrans = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTrans += event.results[i][0].transcript;
        } else {
          interimTrans += event.results[i][0].transcript;
        }
      }
      if (finalTrans) {
        setTranscript(prev => (prev + ' ' + finalTrans).trim());
      }
      setInterimTranscript(interimTrans);
    };

    rec.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setPermissionDenied(true);
        shouldListenRef.current = false;
        isListeningRef.current = false;
        setIsListening(false);
      }
      // 'no-speech', 'aborted' are normal — ignore
    };

    rec.onend = () => {
      isListeningRef.current = false;
      // Auto-restart unless manually stopped
      if (shouldListenRef.current) {
        try { rec.start(); } catch (_) {}
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = rec;

    return () => {
      shouldListenRef.current = false;
      try { rec.stop(); } catch (_) {}
    };
  }, []);

  // Silence detector — fires onSilence after no new words for silenceTimeoutMs
  useEffect(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (!fullText) return;

    silenceTimerRef.current = setTimeout(() => {
      setInterimTranscript('');
      if (fullText.length > 3 && onSilence) {
        onSilence(fullText);
      }
    }, silenceTimeoutMs);

    return () => clearTimeout(silenceTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, interimTranscript, silenceTimeoutMs]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListeningRef.current) return;
    shouldListenRef.current = true;
    setPermissionDenied(false);
    try {
      recognitionRef.current.start();
    } catch (_) {
      // already started — that's fine
    }
  }, []);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch (_) {}
    isListeningRef.current = false;
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    permissionDenied,
    startListening,
    stopListening,
    resetTranscript,
  };
};
