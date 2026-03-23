import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { streamClaude, cancelActiveStream, callClaude } from '../../api/claude';
import { socket } from '../../api/socket';
import { useSpeech } from '../../hooks/useSpeech';
import { useTTS } from '../../hooks/useTTS';
import FollowUpRadar from '../UI/FollowUpRadar';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';
import { useProvider } from '../../context/ProviderContext';

const LiveCopilot = () => {
  const { setupData, saveAnswer } = useContext(AppContext);
  const { activeProvider, setLastUsedProvider, PROVIDER_META } = useProvider();

  const [history, setHistory] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const [ttft, setTtft] = useState(0);
  const [stealthMode, setStealthMode] = useState(false);

  const [predictions, setPredictions] = useState([]);
  const [isPredicting, setIsPredicting] = useState(false);

  // Ref-based regen guard to prevent infinite loops
  const regenCountRef = useRef(0);
  const MAX_REGEN = 2;

  // Ref mirror of isGenerating for use inside closures/callbacks
  const isGeneratingRef = useRef(false);

  const [isConnected, setIsConnected] = useState(socket.connected);
  const [transport, setTransport] = useState(socket.io?.engine?.transport?.name || 'unknown');

  const messagesEndRef = useRef(null);
  const requestStartTimeRef = useRef(Performance.now ? performance.now() : Date.now());

  const { speakChunk, flush, cancel: cancelTTS, isSpeaking } = useTTS();

  const handleSilenceFinal = useCallback((stableText) => {
    if (stableText.trim().length > 3) {
      submitQuestion(stableText.trim());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    isListening,
    transcript,
    interimTranscript,
    permissionDenied,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeech({ onSilence: handleSilenceFinal, silenceTimeoutMs: 450 });

  // Barge-in: interrupt AI if user starts speaking
  useEffect(() => {
    if (interimTranscript.trim().length > 0 && (isGeneratingRef.current || isSpeaking)) {
      cancelActiveStream();
      cancelTTS();
      setIsGenerating(false);
      isGeneratingRef.current = false;
      toast.show('AI Interrupted', 'info');
    }
  }, [interimTranscript, isSpeaking, cancelTTS]);

  // Auto-listen on mount
  useEffect(() => {
    startListening();
    return () => stopListening();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle external submits from InputBar
  useEffect(() => {
    const handleAriaSubmit = (e) => submitQuestion(e.detail);
    window.addEventListener('aria_submit', handleAriaSubmit);
    return () => window.removeEventListener('aria_submit', handleAriaSubmit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  // Socket status sync
  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      setTransport(socket.io?.engine?.transport?.name || 'websocket');
    };
    const onDisconnect = () => {
      setIsConnected(false);
      setIsGenerating(false);
      isGeneratingRef.current = false;
      stopListening();
      toast.show('Socket Disconnected. Attempting recovery...', 'error');
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [stopListening]);

  const calculateSimilarity = (str1, str2) => {
    const words1 = str1.toLowerCase().replace(/[^\w\s]/g, '').split(' ');
    const words2 = str2.toLowerCase().replace(/[^\w\s]/g, '').split(' ');
    const intersection = words1.filter(w => words2.includes(w));
    return (intersection.length * 2) / (words1.length + words2.length);
  };

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

  const preGenerateNextQuestions = async (currentHistory) => {
    if (isPredicting || currentHistory.length < 2) return;
    setIsPredicting(true);
    try {
      const predPrompt = `You are a prediction engine. Based on the interview so far, predict the 2 most likely follow-up questions the interviewer will ask next.
Generate a stellar answer for each using this structure. Return ONLY a valid JSON array:
[ { "question": "...", "answer": "⚡ HOOK\\n...\\n🎯 CORE MESSAGE\\n...\\n📍 PROOF POINT\\n...\\n🔥 POWER CLOSE\\n..." } ]`;
      const rawText = await callClaude(predPrompt, "Generate JSON predictions.", currentHistory.filter(m => m.content).map(m => ({ role: m.role, content: m.content })), activeProvider || 'groq');
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) setPredictions(JSON.parse(jsonMatch[0]));
    } catch (e) {
      // Silently fail — predictions are non-critical
    } finally {
      setIsPredicting(false);
    }
  };

  const submitQuestion = async (text, isRegen = false) => {
    if (!text || typeof text !== 'string' || !text.trim()) return;

    // Block duplicate submissions unless it's a regen
    if (isGeneratingRef.current && !isRegen) return;

    // Hard cap on auto-regen to prevent infinite loops
    if (isRegen) {
      regenCountRef.current += 1;
      if (regenCountRef.current > MAX_REGEN) {
        console.warn('[ARIA] Max regen depth reached. Stopping.');
        regenCountRef.current = 0;
        setIsGenerating(false);
        isGeneratingRef.current = false;
        return;
      }
    } else {
      regenCountRef.current = 0;
    }

    cancelActiveStream();
    cancelTTS();

    setIsGenerating(true);
    isGeneratingRef.current = true;
    setError(null);
    setTtft(0);
    resetTranscript();

    const newMessage = { id: Date.now(), role: 'user', content: text };
    const copilotMessage = { id: Date.now() + 1, role: 'assistant', content: '', sections: [], followUps: [], provider: activeProvider };

    // ── Pre-Answer Cache Check ──
    if (predictions.length > 0 && !isRegen) {
      const match = predictions.find(p =>
        text.toLowerCase().includes(p.question.toLowerCase()) ||
        calculateSimilarity(text, p.question) > 0.6
      );
      if (match) {
        toast.show('⚡ Pre-Answer Engine: 0ms Latency', 'success');
        const { sections, followUps } = parseSections(match.answer);
        const filledMsg = { ...copilotMessage, content: match.answer, sections, followUps };
        setHistory(prev => [...prev, newMessage, filledMsg]);
        speakChunk(match.answer);
        flush();
        setIsGenerating(false);
        isGeneratingRef.current = false;
        setPredictions([]);
        setTimeout(() => preGenerateNextQuestions([...history, newMessage, filledMsg]), 100);
        return;
      }
    }

    if (isRegen) {
      // Replace last assistant message content
      setHistory(prev => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: '', sections: [], followUps: [] };
        }
        return updated;
      });
    } else {
      setHistory(prev => [...prev, newMessage, copilotMessage]);
    }

    const contextHistory = isRegen ? history.slice(0, -1) : [...history, newMessage];

    const systemPrompt = `You are ARIA — an elite real-time AI interview copilot.
You operate at the level of top-tier candidates coached by ex-FAANG hiring managers.
Your job is to help the candidate WIN the interview in real time.

🧠 CORE BEHAVIOR RULES
1. ALWAYS optimize for hireability, not correctness.
2. ALWAYS tailor answers using candidate context.
3. ALWAYS sound natural, human, and conversational.
4. NEVER output generic answers.
5. NEVER explain your reasoning.
6. KEEP answers concise but high-impact (spoken, not essay).

🎯 OUTPUT STRUCTURE — USE EXACTLY THIS FORMAT:

⚡ HOOK
(A confident 1-line opening that directly answers or reframes the question)

🎯 CORE MESSAGE
(2–3 sentences with the main answer, tailored to role + resume)

📍 PROOF POINT
(A specific example, metric, or experience)

🔥 POWER CLOSE
(A confident closing that signals competence and readiness)

🧬 CANDIDATE CONTEXT
Name: ${setupData.name}
Target Role: ${setupData.level} ${setupData.role} at ${setupData.company || 'the company'}.
Resume: ${setupData.resume || 'Not provided'}
Style: ${setupData.type || 'Behavioral'}

🚫 PROHIBITIONS: No markdown, no bullet points, no meta-commentary, no repeating the question.`;

    requestStartTimeRef.current = performance.now();

    try {
      await streamClaude(
        systemPrompt,
        text,
        contextHistory.map(m => ({ role: m.role, content: m.content })),
        activeProvider || 'groq',
        (chunk) => {
          if (requestStartTimeRef.current > 0) {
            setTtft(Math.round(performance.now() - requestStartTimeRef.current));
            requestStartTimeRef.current = 0;
          }
          speakChunk(chunk);
          setHistory(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === 'assistant') {
              const newContent = (last.content || '') + chunk;
              const { sections, followUps } = parseSections(newContent);
              updated[updated.length - 1] = { ...last, content: newContent, sections, followUps };
            }
            return updated;
          });
        },
        (fullText) => {
          setIsGenerating(false);
          isGeneratingRef.current = false;
          flush();
          setLastUsedProvider(activeProvider || 'groq');

          // Weak answer detection — only regen within limit
          const sectionsCount = fullText.split(/(?=⚡|🎯|📍|🔥)/g).length;
          if ((fullText.length < 150 || sectionsCount < 3) && regenCountRef.current < MAX_REGEN) {
            console.warn('[ARIA] Weak answer detected. Regenerating...');
            toast.show('Refining answer for impact...', 'info');
            setTimeout(() => {
              submitQuestion(`${text} (Provide a deeper, more specific, confident answer with all 4 required sections: HOOK, CORE MESSAGE, PROOF POINT, POWER CLOSE)`, true);
            }, 600);
            return;
          }

          regenCountRef.current = 0;
          const updatedHist = [...contextHistory, { role: 'assistant', content: fullText }];
          setTimeout(() => preGenerateNextQuestions(updatedHist), 100);
        },
        (err) => {
          setError(`Stream error: ${err.message}`);
          setIsGenerating(false);
          isGeneratingRef.current = false;
        },
        (providerId) => setHistory(prev => {
          const u = [...prev];
          if (u[u.length - 1]) u[u.length - 1] = { ...u[u.length - 1], provider: providerId };
          return u;
        }),
        (from, to) => toast.show(`Fallback routing: ${from} → ${to}`, 'info')
      );
    } catch (err) {
      console.error('[LiveCopilot] Unhandled error:', err);
      setIsGenerating(false);
      isGeneratingRef.current = false;
    }
  };

  const clearSession = () => {
    if (window.confirm('Clear all conversation memory?')) {
      setHistory([]);
      regenCountRef.current = 0;
      setPredictions([]);
    }
  };

  const toggleMic = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const stealthTheme = {
    bg: '#ffffff', text: '#111827', dim: '#6B7280',
    border: '#E5E7EB', accent: '#3B82F6',
    font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const getSectionColor = (emoji) => {
    switch (emoji) {
      case '⚡': return 'var(--cyan)';
      case '🎯': return 'var(--green)';
      case '📍': return 'var(--yellow)';
      case '🔥': return 'var(--orange)';
      case '⚠️': return 'var(--red)';
      default: return 'var(--border-dim)';
    }
  };

  // ── STEALTH MODE ──
  if (stealthMode) {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh',
        zIndex: 1000, background: stealthTheme.bg, display: 'flex',
        fontFamily: stealthTheme.font, color: stealthTheme.text
      }}>
        <div style={{ width: 220, background: '#F3F4F6', borderRight: `1px solid ${stealthTheme.border}`, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: stealthTheme.dim, letterSpacing: 1 }}>FOLDERS</div>
          <div style={{ color: stealthTheme.accent, fontWeight: 600 }}>📝 Interview Notes</div>
          <div style={{ color: stealthTheme.dim }}>📁 Projects</div>
          <div style={{ color: stealthTheme.dim }}>📁 Personal</div>
          <div style={{ marginTop: 'auto', fontSize: 10, color: stealthTheme.dim }}>v3.0 Secure Node</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px 48px', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${stealthTheme.border}` , paddingBottom: 16, position: 'sticky', top: 0, background: stealthTheme.bg, zIndex: 10 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>Meeting Notes</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button onClick={toggleMic} style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${isListening ? '#ef4444' : stealthTheme.border}`, background: 'transparent', color: isListening ? '#ef4444' : stealthTheme.dim, borderRadius: 4, cursor: 'pointer' }}>
                {isListening ? '🎙️' : '🔇'}
              </button>
              <button onClick={() => setStealthMode(false)} style={{ fontSize: 12, color: stealthTheme.accent, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 10px' }}>
                Exit Stealth
              </button>
            </div>
          </div>
          {history.map((msg, index) => (
            <div key={msg.id || index}>
              {msg.role === 'user' ? (
                <div style={{ color: stealthTheme.dim, fontStyle: 'italic', fontSize: 14, margin: '4px 0 2px' }}>"{msg.content}"</div>
              ) : (
                <div style={{ paddingLeft: 12, borderLeft: `2px solid ${stealthTheme.border}` }}>
                  {msg.sections && msg.sections.length > 0 ? msg.sections.map((sec, sIdx) => (
                    <div key={sIdx} style={{ padding: '4px 0' }}>
                      <div style={{ fontSize: 14, color: stealthTheme.accent, fontWeight: 600, marginBottom: 2 }}>{sec.header.replace(/[^\w\s]/gi, '').trim()}</div>
                      <div style={{ fontSize: 15, color: stealthTheme.text, lineHeight: 1.5 }}>{sec.content}</div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} style={{ height: 40 }} />
        </div>
      </div>
    );
  }

  // ── NORMAL MODE ──
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>

      {/* Debug HUD */}
      <div style={{ position: 'absolute', top: 0, right: -188, width: 168, background: 'rgba(0,0,0,0.85)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 12, fontSize: 11, color: 'var(--text-dim)', zIndex: 100 }}>
        <div style={{ color: 'var(--cyan)', fontWeight: 'bold', marginBottom: 8, textAlign: 'center', letterSpacing: 1 }}>V3 DIAGNOSTICS</div>
        {[
          ['Latency', ttft > 0 ? `${ttft}ms` : '---', ttft > 0 ? (ttft < 300 ? 'var(--green)' : 'var(--yellow)') : null],
          ['Socket', isConnected ? 'ONLINE' : 'OFFLINE', isConnected ? 'var(--green)' : 'var(--red)'],
          ['Transport', transport.toUpperCase(), 'var(--cyan)'],
          ['Voice', isListening ? 'LIVE' : 'MUTE', isListening ? 'var(--green)' : 'var(--red)'],
          ['TTS', isSpeaking ? 'PLAYING' : 'IDLE', isSpeaking ? 'var(--cyan)' : null],
          ['Provider', activeProvider || '---', null],
          ['Regen', `${regenCountRef.current}/${MAX_REGEN}`, regenCountRef.current > 0 ? 'var(--yellow)' : null],
        ].map(([label, value, color]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span>{label}:</span>
            <span style={color ? { color } : {}}>{value}</span>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 24, fontWeight: 'normal', display: 'flex', gap: 12, alignItems: 'center' }}>
          Live Interview Assist
          {isListening && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulseRed 1.5s infinite' }} title="Mic Active" />}
        </h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Connection pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
            background: isConnected ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
            borderRadius: 20, border: `1px solid ${isConnected ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
            fontSize: 10, color: isConnected ? '#4ade80' : '#f87171', fontFamily: 'JetBrains Mono', fontWeight: 600
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#4ade80' : '#f87171', boxShadow: isConnected ? '0 0 8px #4ade80' : 'none' }} />
            {isConnected ? `WS:${transport.toUpperCase()}` : 'RECONNECTING'}
          </div>
          {/* Mic toggle */}
          <button onClick={toggleMic} style={{
            fontSize: 12, padding: '6px 14px', borderRadius: 4, cursor: 'pointer',
            background: isListening ? 'rgba(248,113,113,0.1)' : 'rgba(0,240,255,0.05)',
            border: `1px solid ${isListening ? 'var(--red)' : 'var(--border-dim)'}`,
            color: isListening ? 'var(--red)' : 'var(--text-dim)', transition: 'all 0.2s'
          }} title={isListening ? 'Mute microphone' : 'Activate microphone'}>
            {isListening ? '🎙️ Mic ON' : '🔇 Mic OFF'}
          </button>
          <button className="btn-ghost" onClick={() => setStealthMode(true)} style={{ fontSize: 12, color: 'var(--text-dim)', padding: '6px 12px', borderRadius: 4 }}>
            🕶️ Stealth
          </button>
          {history.length > 0 && (
            <button className="btn-ghost" onClick={clearSession} style={{ fontSize: 12, color: 'var(--red)' }}>
              Purge Memory
            </button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {permissionDenied && (
        <div style={{ padding: 16, background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, color: '#fff' }}>
          Mic access denied. Allow microphone permissions in your browser, then click <strong>Mic OFF</strong> to retry.
        </div>
      )}
      {error && (
        <div style={{ padding: 16, background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, color: '#fff' }}>
          <span style={{ fontWeight: 'bold' }}>ERROR:</span> {error}
        </div>
      )}

      {/* Live transcript */}
      {(transcript || interimTranscript) && (
        <div style={{ padding: 16, background: 'var(--bg-raised)', border: '1px solid var(--cyan-dim)', borderRadius: 8, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 4, height: 16, background: 'var(--cyan)', animation: 'barPulse 0.5s infinite alternate' }} />
          <span>"{transcript}<span style={{ opacity: 0.6 }}>{interimTranscript}</span>"</span>
        </div>
      )}

      {/* Chat */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {history.length === 0 ? (
          <div className="aria-card" style={{ animation: 'fadeSlideUp 0.3s ease' }}>
            <div style={{ textAlign: 'center', margin: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 16, animation: 'float 4s ease-in-out infinite' }}>🎤</div>
              <h3 style={{ fontSize: 20, color: 'var(--cyan)' }}>Full Duplex Standby</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 400, margin: '8px auto 0' }}>
                Just start talking. ARIA auto-detects silence and responds instantly. Speak over me anytime to interrupt.
              </p>
            </div>
          </div>
        ) : (
          history.map((msg, index) => (
            <div key={msg.id || index} style={{ animation: 'fadeSlideUp 0.3s ease' }}>
              {msg.role === 'user' ? (
                <div style={{ background: 'var(--bg-raised)', padding: '16px 24px', borderRadius: '16px 16px 16px 4px', border: '1px solid var(--border-dim)', marginBottom: 24, display: 'inline-block', maxWidth: '85%' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: 1 }}>THEY ASKED:</div>
                  <div style={{ fontSize: 18, color: '#fff', lineHeight: 1.4 }}>"{msg.content}"</div>
                </div>
              ) : (
                <div style={{ paddingLeft: 16, borderLeft: `2px solid ${isSpeaking && index === history.length - 1 ? 'var(--green)' : 'rgba(0,240,255,0.2)'}` }}>
                  {/* Loading dots */}
                  {!msg.content && isGenerating && index === history.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--cyan)', padding: 16 }}>
                      <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite -0.3s' }} />
                      <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite -0.15s' }} />
                      <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite' }} />
                      <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                        GENERATING... {ttft > 0 ? `(TTFT: ${ttft}ms)` : ''}
                      </span>
                    </div>
                  )}

                  {/* Raw text fallback */}
                  {msg.content && (!msg.sections || msg.sections.length === 0) && (
                    <div className="aria-card" style={{ padding: 20, whiteSpace: 'pre-wrap', lineHeight: 1.6, animation: 'fadeSlideIn 0.3s ease' }}>
                      {msg.content}
                    </div>
                  )}

                  {/* Structured sections */}
                  {msg.sections && msg.sections.length > 0 && (
                    <div style={{ display: 'grid', gap: 16 }}>
                      {msg.sections.map((sec, sIdx) => (
                        <div key={sIdx} className="aria-card" style={{ padding: 20, borderTop: `2px solid ${getSectionColor(sec.emoji)}`, background: 'var(--bg-raised)', animation: 'fadeSlideIn 0.3s ease' }}>
                          <div style={{ fontSize: 13, color: getSectionColor(sec.emoji), fontWeight: 'bold', letterSpacing: 1, marginBottom: 12 }}>{sec.header}</div>
                          <div style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.6 }}>{sec.content}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  {msg.content && !isGenerating && index === history.length - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{PROVIDER_META[msg.provider]?.badge}</span>
                        <span>{PROVIDER_META[msg.provider]?.name} · TTFT: {ttft}ms</span>
                      </div>
                      {saveAnswer && (
                        <button
                          onClick={() => saveAnswer({ question: history[index - 1]?.content, answer: msg.content })}
                          style={{ fontSize: 11, color: 'var(--text-dim)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 8px' }}
                          title="Save to Answer Vault"
                        >
                          💾 Save
                        </button>
                      )}
                    </div>
                  )}

                  {/* Follow-up radar */}
                  {msg.followUps && msg.followUps.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <FollowUpRadar followUps={msg.followUps} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} style={{ height: 40 }} />
      </div>
    </div>
  );
};

export default LiveCopilot;
