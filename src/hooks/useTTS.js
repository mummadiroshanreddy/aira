import { useRef, useCallback, useState, useEffect } from 'react';
import { socket } from '../api/socket';

// ── Native + ElevenLabs Text-To-Speech Hook ────────────
export const useTTS = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsMode, setTtsMode] = useState('native'); // 'native' or 'elevenlabs'
  const bufferRef = useRef('');
  const activeUtterances = useRef(0);
  const audioQueue = useRef([]);
  const isAudioPlaying = useRef(false);

  // Play ElevenLabs audio chunk queue
  const playNextInQueue = useCallback(() => {
    if (audioQueue.current.length === 0) {
      isAudioPlaying.current = false;
      setIsSpeaking(false);
      return;
    }
    
    isAudioPlaying.current = true;
    setIsSpeaking(true);
    const base64 = audioQueue.current.shift();
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
    audio.onended = playNextInQueue;
    audio.onerror = playNextInQueue;
    audio.play().catch(e => {
        console.error('[TTS] Playback error:', e);
        playNextInQueue();
    });
  }, []);

  useEffect(() => {
    const handleChunk = ({ chunk }) => {
      audioQueue.current.push(chunk);
      if (!isAudioPlaying.current) playNextInQueue();
    };
    
    const handleEnd = () => {}; // Could trigger cleanup
    
    socket.on('tts_audio_chunk', handleChunk);
    socket.on('tts_audio_end', handleEnd);
    
    return () => {
      socket.off('tts_audio_chunk', handleChunk);
      socket.off('tts_audio_end', handleEnd);
    };
  }, [playNextInQueue]);

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
    if (ttsMode === 'elevenlabs') {
      socket.emit('tts_stream', { text });
      return;
    }
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
    // Deep stop for ElevenLabs
    audioQueue.current = [];
    isAudioPlaying.current = false;
  }, []);

  return { speakChunk, flush, cancel, isSpeaking, setTtsMode, ttsMode };
};
