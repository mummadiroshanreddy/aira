import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { streamClaude, cancelActiveStream } from '../../api/claude';
import { socket } from '../../api/socket';
import { useSpeech } from '../../hooks/useSpeech';
import { useTTS } from '../../hooks/useTTS';
import FollowUpRadar from '../UI/FollowUpRadar';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const LiveCopilot = () => {
  const { setupData } = useContext(AppContext);
  const [history, setHistory] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [activeProvider, setActiveProvider] = useState({ name: '⚡ Groq', id: 'groq' });
  const [stealthMode, setStealthMode] = useState(false);

  const isGeneratingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const { speakChunk, flush, cancel: cancelTTS, isSpeaking } = useTTS();

  // ── Wire aria_submit: fired by InputBar Ctrl+Enter or send button ──
  useEffect(() => {
    const handleAriaSubmit = (e) => {
      if (e.detail) submitQuestion(e.detail);
    };
    window.addEventListener('aria_submit', handleAriaSubmit);
    return () => window.removeEventListener('aria_submit', handleAriaSubmit);
  }, []); // eslint-disable-line

  const handleSilenceFinal = useCallback((stableText) => {
    if (stableText.trim().length > 3) submitQuestion(stableText.trim());
  }, []); // eslint-disable-line

  const {
    isListening,
    interimTranscript,
    permissionDenied,
    startListening,
    stopListening,
    resetTranscript 
  } = useSpeech({ onSilence: handleSilenceFinal, silenceTimeoutMs: 450 });

  // ── Barge-in: new speech while AI is talking → cancel ──
  useEffect(() => {
    if (interimTranscript.trim().length > 0 && (isGeneratingRef.current || isSpeaking)) {
      cancelActiveStream();
      cancelTTS();
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  }, [interimTranscript, isSpeaking, cancelTTS]);

  useEffect(() => {
    startListening();
    return () => stopListening();
  }, []); // eslint-disable-line

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);


  const parseSections = (content) => {
    const parts = content.split(/(?=⚡|🎯|📍|🔥|⚠️|💡)/g).map(s => s.trim()).filter(Boolean);
    const sections = [];
    const followUps = [];
    parts.forEach(part => {
      const headerEnd = part.indexOf('\n');
      const headerRaw = headerEnd > -1 ? part.substring(0, headerEnd).trim() : part.trim();
      const textRaw = headerEnd > -1 ? part.substring(headerEnd).trim() : '';
      if (headerRaw.includes('💡 FOLLOWUPS:')) {
        const combined = headerRaw.replace('💡 FOLLOWUPS:', '') + '|' + textRaw;
        followUps.push(...combined.split('|').map(s => s.trim()).filter(Boolean).slice(0, 3));
      } else {
        sections.push({ header: headerRaw, content: textRaw, emoji: headerRaw[0] || '🔹' });
      }
    });
    return { sections, followUps };
  };

  const submitQuestion = async (text) => {
    if (!text || !text.trim() || isGeneratingRef.current) return;

    cancelActiveStream();
    cancelTTS();

    setIsGenerating(true);
    isGeneratingRef.current = true;
    setError(null);
    resetTranscript();

    const newMessage = { id: Date.now(), role: 'user', content: text };
    const copilotMessage = { id: Date.now() + 1, role: 'assistant', content: '', sections: [], followUps: [] };

    setHistory(prev => [...prev, newMessage, copilotMessage]);

    const systemPrompt = `You are ARIA — an elite real-time AI interview copilot. 
    Use the hook/message/proof logic. Be tactical. Concise but sharp.`;

    try {
      await streamClaude(
        systemPrompt,
        text,
        history,
        setupData.userId || 'anonymous',
        (chunk) => {
          speakChunk(chunk);
          setHistory(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              const newContent = (last.content || '') + chunk;
              const { sections, followUps } = parseSections(newContent);
              return [...updated.slice(0, -1), { ...last, content: newContent, sections, followUps }];
            }
            return updated;
          });
        },
        (fullText) => {
          setIsGenerating(false);
          isGeneratingRef.current = false;
          flush();
        },
        (err) => {
          setError(err.message);
          setIsGenerating(false);
          isGeneratingRef.current = false;
        },
        (name, id) => setActiveProvider({ name, id }),
        (from, to) => toast.show(`Fallback: ${from} → ${to}`, 'info')
      );
    } catch (err) {
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  };

  const toggleMic = () => isListening ? stopListening() : startListening();

  if (stealthMode) {
    return (
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 1000, background: '#fff', padding: 48, fontFamily: 'system-ui' }}>
        <button onClick={() => setStealthMode(false)} style={{ position: 'absolute', top: 24, right: 24 }}>Exit Stealth</button>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {history.map((msg, i) => (
            <div key={i} style={{ marginBottom: 24, color: msg.role === 'user' ? '#777' : '#111' }}>
              {msg.content}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-raised)', padding: 16, borderRadius: 12, border: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--cyan)' }}>{activeProvider.name}</div>
          {isListening && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulseRed 1.5s infinite' }} />}
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={toggleMic} className="btn-ghost" style={{ border: `1px solid ${isListening ? 'var(--red)' : 'var(--border-dim)'}`, color: isListening ? 'var(--red)' : 'var(--text-dim)' }}>
            {isListening ? '🎙️ Mic ON' : '🔇 Mic OFF'}
          </button>
          <button onClick={() => setStealthMode(true)} className="btn-ghost">🕶️ Stealth</button>
        </div>
      </div>

      {error && <div style={{ padding: 16, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--red)', borderRadius: 8, color: 'var(--red)' }}>{error}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, minHeight: '60vh' }}>
        {history.map((msg, idx) => (
          <div key={msg.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {msg.role === 'user' ? (
              <div style={{ alignSelf: 'flex-start', background: 'var(--border-dim)', padding: '12px 20px', borderRadius: '16px 16px 16px 2px' }}>
                <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>QUESTION:</div>
                <div style={{ fontSize: 18 }}>"{msg.content}"</div>
              </div>
            ) : (
              <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--cyan-dim)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {msg.sections.map((sec, sIdx) => (
                  <div key={sIdx} className="aria-card" style={{ padding: 20 }}>
                    <div style={{ fontSize: 12, color: 'var(--cyan)', fontWeight: 'bold', marginBottom: 8 }}>{sec.header}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.6 }}>{sec.content}</div>
                  </div>
                ))}
                {!msg.content && isGenerating && idx === history.length - 1 && (
                  <div style={{ padding: 16, color: 'var(--cyan)', fontSize: 12 }}>THINKING...</div>
                )}
                {msg.followUps.length > 0 && <FollowUpRadar followUps={msg.followUps} />}
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default LiveCopilot;
