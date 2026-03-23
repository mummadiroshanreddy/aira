import { useState, useEffect, useRef, useCallback } from 'react';

// ── Voice Input Engine ────────────────────────────────
// Native WebSpeech wrapper engineered for continuous execution,
// predictive interim dispatch, and barge-in integrations.

export const useSpeech = (options = {}) => {
  const { onSilence, silenceTimeoutMs = 700 } = options;
  
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const shouldListenRef = useRef(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event) => {
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
            setTranscript(prev => {
              const combined = (prev + ' ' + finalTrans).trim();
              return combined.replace(/\b(\w+)( \1\b)+/gi, '$1');
            });
          }
          setInterimTranscript(interimTrans);
        };

        recognitionRef.current.onerror = (event) => {
          console.error("[useSpeech] Recognition error:", event.error);
          if (event.error === 'not-allowed') {
            setPermissionDenied(true);
            shouldListenRef.current = false;
            setIsListening(false);
          }
          if (event.error === 'no-speech') {
             // perfectly normal, ignore
          }
        };

        recognitionRef.current.onend = () => {
          // Auto-reconnect explicitly unless manually stopped
          if (shouldListenRef.current) {
            try { recognitionRef.current.start(); } catch(e) {}
          } else {
            setIsListening(false);
          }
        };
      }
    }

    return () => {
      // Cleanup
    };
  }, []);

  // Decoupled Silence Tracker handles the logic cleanly without closure lock
  useEffect(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    const fullText = (transcript + ' ' + interimTranscript).trim();
    if (!fullText) return;

    silenceTimerRef.current = setTimeout(() => {
      setTranscript(fullText);
      setInterimTranscript('');
      if (fullText.length > 3 && onSilence) {
        onSilence(fullText);
      }
    }, silenceTimeoutMs);

    return () => clearTimeout(silenceTimerRef.current);
  }, [transcript, interimTranscript, silenceTimeoutMs]); // onSilence intentionally omitted to prevent loop

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    shouldListenRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setPermissionDenied(false);
    } catch (err) {
       // if already started
       setIsListening(true);
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const resetTranscript = () => {
    setTranscript('');
    setInterimTranscript('');
  };

  return {
    isListening,
    transcript,
    interimTranscript,
    permissionDenied,
    startListening,
    stopListening,
    resetTranscript
  };
};
