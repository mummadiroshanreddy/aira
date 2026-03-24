import { useState, useRef, useEffect, useCallback } from 'react';
import { socket } from '../api/socket';

/**
 * useSystemAudio — Latency-optimized screen audio capture.
 * Captures tab/system audio via getDisplayMedia and streams chunks to Groq Whisper.
 */
export const useSystemAudio = (options = {}) => {
  const { onTranscript, chunkIntervalMs = 3000 } = options;
  
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState(null);
  
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const checkIntervalRef = useRef(null);

  const stopCapture = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    
    streamRef.current = null;
    mediaRecorderRef.current = null;
    setIsActive(false);
  }, []);

  const startCapture = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true, // Required for getDisplayMedia, but we only want audio
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        stream.getTracks().forEach(t => t.stop());
        throw new Error('No audio track found. Make sure to check "Share Audio" when selecting a tab.');
      }

      streamRef.current = stream;
      setIsActive(true);

      // Handle stream end (user clicks "Stop sharing" in browser UI)
      audioTrack.onended = () => stopCapture();

      // Chunking setup
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && socket.connected) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result.split(',')[1];
            socket.emit('whisper_chunk', { audio: base64data, format: 'webm' });
          };
          reader.readAsDataURL(event.data);
        }
      };

      // Start recording with 3s slices
      mediaRecorder.start(chunkIntervalMs);

    } catch (err) {
      console.error('[useSystemAudio] Capture failed:', err);
      setError(err.message || 'System audio capture failed.');
      setIsActive(false);
    }
  };

  useEffect(() => {
    const handleTranscript = ({ text }) => {
      if (onTranscript) onTranscript(text);
    };
    socket.on('whisper_transcript', handleTranscript);
    return () => {
      socket.off('whisper_transcript', handleTranscript);
      stopCapture();
    };
  }, [onTranscript, stopCapture]);

  return { isActive, startCapture, stopCapture, error };
};
