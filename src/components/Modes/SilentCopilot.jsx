import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { streamAI, cancelStream } from '../../api/aiProvider';
import { useSystemAudio } from '../../hooks/useSystemAudio';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const SilentCopilot = () => {
  const { setupData } = useContext(AppContext);
  const [history, setHistory] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [fullTranscript, setFullTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState('');
  const [activeProviderDisplay, setActiveProviderDisplay] = useState('⚡ Groq');

  const transcriptBufferRef = useRef('');
  const lastSubmitTimeRef = useRef(0);
  const isGeneratingRef = useRef(false);

  // Auto-trigger logic: detects questions in the transcript stream
  const detectAndSubmit = useCallback(async (newText) => {
    transcriptBufferRef.current += ' ' + newText;
    const buffer = transcriptBufferRef.current.trim();
    
    // UI feedback for the rolling transcript
    setFullTranscript(buffer);

    const questionPatterns = [/how/i, /what/i, /why/i, /explain/i, /tell me/i, /describe/i, /\?/];
    const isQuestion = questionPatterns.some(pattern => pattern.test(newText));
    
    // Trigger if question detected OR if buffer is long enough and it's been a while
    const now = Date.now();
    const timeSinceLast = now - lastSubmitTimeRef.current;

    if ((isQuestion || buffer.length > 50) && timeSinceLast > 3000 && !isGeneratingRef.current) {
      lastSubmitTimeRef.current = now;
      submitToAI(buffer);
      transcriptBufferRef.current = ''; // Clear buffer after submission
    }
  }, []);

  const { isActive, startCapture, stopCapture, error } = useSystemAudio({
    onTranscript: detectAndSubmit
  });

  const submitToAI = async (text) => {
    if (!text || isGeneratingRef.current) return;
    
    setIsGenerating(true);
    isGeneratingRef.current = true;
    setCurrentResponse('');
    
    const systemPrompt = `You are a SILENT AI Interview Copilot. 
Target Role: ${setupData.role}
Seniority: ${setupData.level}
Style: ${setupData.style}
Resume Summary: ${setupData.resumeSummary || 'Not provided'}
JD: ${setupData.jd || 'Not provided'}

TASK: Provide the best answer to the detected question in the transcript. 
FORMAT: 
⚡ HOOK (1 sentence)
🎯 CORE MESSAGE (Bullet points)
📍 PROOF POINT (STAR method)
🔥 POWER CLOSE
KEEP IT CONCISE - The user is reading this live during an interview.`;

    try {
      setHistory(prev => [...prev, { role: 'user', content: text }]);
      
      let fullText = '';
      await streamAI(text, {
        system: systemPrompt,
        history: history.slice(-3), // Keep context lean
        onChunk: (chunk) => {
          fullText += chunk;
          setCurrentResponse(fullText);
        },
        onDone: (final) => {
          setHistory(prev => [...prev, { role: 'assistant', content: final }]);
          setIsGenerating(false);
          isGeneratingRef.current = false;
        },
        onError: (err) => {
          toast.show(err.message, 'error');
          setIsGenerating(false);
          isGeneratingRef.current = false;
        },
        onProviderInfo: (name) => setActiveProviderDisplay(name)
      });
    } catch (err) {
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: 'var(--cyan)', margin: 0, fontSize: 18 }}>Silent Copilot</h2>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: 1 }}>PARAKEET MODE ACTIVE</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button 
            onClick={isActive ? stopCapture : startCapture}
            className={isActive ? "btn-ghost" : "btn-primary"}
            style={{ padding: '8px 16px', fontSize: 12 }}
          >
            {isActive ? '⏹ Stop Capture' : '🚀 Start System Audio'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.1)', color: 'var(--red)', borderRadius: 8, fontSize: 12, marginBottom: 20 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Floating Minimal Panel Style */}
      <div className="aria-card" style={{ padding: 20, background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(10px)', border: '1px solid rgba(0,240,255,0.1)' }}>
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
          <span>LIVE TRANSCRIPT</span>
          <span>{activeProviderDisplay}</span>
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14, minHeight: 40, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 12, marginBottom: 12 }}>
          {fullTranscript || (isActive ? 'Waiting for speech...' : 'Click Start to begin capturing meeting audio...')}
        </div>

        <div style={{ fontSize: 10, color: 'var(--cyan)', marginBottom: 12 }}>AI SUGGESTION</div>
        <div style={{ minHeight: 200, color: '#fff', fontSize: 16, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {currentResponse || (isGenerating ? 'Analyzing question...' : 'Answers will appear here automatically when a question is detected.')}
        </div>
      </div>

      {/* Recent History (Minimalist) */}
      {history.length > 2 && (
        <div style={{ marginTop: 40 }}>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 20 }}>PAST EXCHANGES</div>
          {history.filter(m => m.role === 'assistant' && m.content !== currentResponse).slice(-2).map((msg, idx) => (
            <div key={idx} className="aria-card" style={{ padding: 16, marginBottom: 12, opacity: 0.6, fontSize: 13 }}>
              {msg.content.slice(0, 150)}...
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SilentCopilot;
