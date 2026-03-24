import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { streamClaude, cancelActiveStream, callClaude } from '../../api/aiProvider';
import { socket } from '../../api/socket';
import { useSpeech } from '../../hooks/useSpeech';
import { useTTS } from '../../hooks/useTTS';
import FollowUpRadar from '../UI/FollowUpRadar';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const LiveCopilot = () => {
  const { setupData, saveAnswer } = useContext(AppContext);

  const [history, setHistory] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [ttft, setTtft] = useState(0);
  const [stealthMode, setStealthMode] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [isPredicting, setIsPredicting] = useState(false);
  const [activeProviderDisplay, setActiveProviderDisplay] = useState('⚡ Groq');
  const [selectedProvider, setSelectedProvider] = useState('groq'); // manual switcher
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [transport, setTransport] = useState(socket.io?.engine?.transport?.name || 'unknown');

  const regenCountRef = useRef(0);
  const MAX_REGEN = 2;
  const isGeneratingRef = useRef(false);
  const messagesEndRef = useRef(null);
  const requestStartTimeRef = useRef(0);
  // submitRef: lets handleSilenceFinal call the LATEST submitQuestion without stale closure
  const submitRef = useRef(null);

  const { speakChunk, flush, cancel: cancelTTS, isSpeaking } = useTTS();

  // Use a ref so useSpeech's onSilence always calls the latest submitQuestion
  const handleSilenceFinal = useCallback((stableText) => {
    if (stableText.trim().length > 3 && submitRef.current) {
      submitRef.current(stableText.trim());
    }
  }, []);

  const {
    isListening,
    transcript,
    interimTranscript,
    permissionDenied,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeech({ onSilence: handleSilenceFinal, silenceTimeoutMs: 750 });

  // Sync submitRef on every render to ensure handleSilenceFinal has latest closure
  useEffect(() => {
    submitRef.current = submitQuestion;
  });


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
  }, []); // intentional empty deps — run once on mount


  // Handle external submits from InputBar (Ctrl+Enter / send button)
  useEffect(() => {
    const handleAriaSubmit = (e) => { if (e.detail) submitQuestion(e.detail); };
    window.addEventListener('aria_submit', handleAriaSubmit);
    return () => window.removeEventListener('aria_submit', handleAriaSubmit);
  }, [history]); // re-register when history changes so submitQuestion has fresh closure


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
  }, []); // socket is a singleton — no deps needed


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
      const predPrompt = `You are a prediction engine. Based on this interview, predict the 2 most likely follow-up questions.
Return ONLY a valid JSON array: [ { "question": "...", "answer": "⚡ HOOK\\n...\\n🎯 CORE MESSAGE\\n...\\n📍 PROOF POINT\\n...\\n🔥 POWER CLOSE\\n..." } ]`;
      const rawText = await callClaude(predPrompt, "Generate JSON predictions.", currentHistory.filter(m => m.content).map(m => ({ role: m.role, content: m.content })));
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

    if (isGeneratingRef.current && !isRegen) return;


    if (isRegen) {
      regenCountRef.current += 1;
      if (regenCountRef.current > MAX_REGEN) {
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
    const copilotMessage = { id: Date.now() + 1, role: 'assistant', content: '', sections: [], followUps: [] };

    // Pre-Answer Cache Check
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
        return;
      }
    }

    if (isRegen) {
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
Name: ${setupData?.name}
Target Role: ${setupData?.level} ${setupData?.role} at ${setupData?.company || 'the company'}.
Resume: ${setupData?.resume || 'Not provided'}
Style: ${setupData?.type || 'Behavioral'}

🚫 PROHIBITIONS: No markdown, no bullet points, no meta-commentary, no repeating the question.`;

    requestStartTimeRef.current = performance.now();

    try {
      await streamClaude(
        systemPrompt,
        text,
        contextHistory.map(m => ({ role: m.role, content: m.content })),
        setupData?.userId || 'anonymous',
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

          // Weak answer detection — only regen within limit
          const sectionsCount = fullText.split(/(?=⚡|🎯|📍|🔥)/g).length;
          if ((fullText.length < 150 || sectionsCount < 3) && regenCountRef.current < MAX_REGEN) {
            toast.show('Refining answer for impact...', 'info');
            setTimeout(() => {
              submitQuestion(`${text} (Provide a deeper, more specific answer with all 4 sections: HOOK, CORE MESSAGE, PROOF POINT, POWER CLOSE)`, true);
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
          // Remove the empty assistant placeholder so next question works
          setHistory(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant' && !last.content) {
              return prev.slice(0, -1);
            }
            return prev;
          });
        },
        (name) => setActiveProviderDisplay(name),
        (from, to) => toast.show(`Fallback: ${from} → ${to}`, 'info')
      );
    } catch (err) {
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

  const toggleMic = () => isListening ? stopListening() : startListening();

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
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 1000, background: '#fff', display: 'flex', fontFamily: 'system-ui, sans-serif', color: '#111' }}>
        <div style={{ width: 220, background: '#F3F4F6', borderRight: '1px solid #E5E7EB', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#6B7280', letterSpacing: 1 }}>FOLDERS</div>
          <div style={{ color: '#3B82F6', fontWeight: 600 }}>📝 Interview Notes</div>
          <div style={{ color: '#6B7280' }}>📁 Projects</div>
          <div style={{ color: '#6B7280' }}>📁 Personal</div>
          <div style={{ marginTop: 'auto', fontSize: 10, color: '#6B7280' }}>ARIA Stealth Mode</div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '24px 48px', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #E5E7EB', paddingBottom: 16, position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
            <h2 style={{ fontSize: 18 }}>Meeting Notes</h2>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={toggleMic} style={{ fontSize: 11, padding: '4px 10px', border: `1px solid ${isListening ? '#ef4444' : '#E5E7EB'}`, background: 'transparent', color: isListening ? '#ef4444' : '#6B7280', borderRadius: 4, cursor: 'pointer' }}>
                {isListening ? '🎙️' : '🔇'}
              </button>
              <button onClick={() => setStealthMode(false)} style={{ fontSize: 12, color: '#3B82F6', background: 'transparent', border: 'none', cursor: 'pointer' }}>Exit Stealth</button>
            </div>
          </div>
          {history.map((msg, index) => (
            <div key={msg.id || index}>
              {msg.role === 'user' ? (
                <div style={{ color: '#6B7280', fontStyle: 'italic', fontSize: 14 }}>"{msg.content}"</div>
              ) : (
                <div style={{ paddingLeft: 12, borderLeft: '2px solid #E5E7EB' }}>
                  {msg.sections?.length > 0 ? msg.sections.map((sec, sIdx) => (
                    <div key={sIdx} style={{ padding: '4px 0' }}>
                      <div style={{ fontSize: 13, color: '#3B82F6', fontWeight: 600, marginBottom: 2 }}>{sec.header.replace(/[^\w\s]/gi, '').trim()}</div>
                      <div style={{ fontSize: 15, lineHeight: 1.5 }}>{sec.content}</div>
                    </div>
                  )) : (
                    <div style={{ fontSize: 15, lineHeight: 1.6 }}>{msg.content}</div>
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
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-raised)', padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border-dim)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          {/* Left: status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--cyan)', fontFamily: 'JetBrains Mono' }}>{activeProviderDisplay}</div>
            {isListening && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulseRed 1.5s infinite' }} />}
            <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: isConnected ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', border: `1px solid ${isConnected ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`, color: isConnected ? '#4ade80' : '#f87171', fontFamily: 'JetBrains Mono' }}>
              {isConnected ? `WS:${transport.toUpperCase()}` : 'RECONNECTING'}
            </div>
            {ttft > 0 && <div style={{ fontSize: 11, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono' }}>TTFT: {ttft}ms</div>}
          </div>
          {/* Right: controls */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Provider switcher */}
            {[{ id: 'groq', label: '⚡ Groq' }, { id: 'gemini', label: '✨ Gemini' }].map(p => (
              <button key={p.id} onClick={() => { setSelectedProvider(p.id); setActiveProviderDisplay(p.label); toast.show(`Switched to ${p.label}`, 'info'); }}
                className="btn-ghost"
                style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, border: `1px solid ${selectedProvider === p.id ? 'var(--cyan)' : 'var(--border-dim)'}`, color: selectedProvider === p.id ? 'var(--cyan)' : 'var(--text-dim)', background: selectedProvider === p.id ? 'rgba(0,240,255,0.08)' : 'transparent' }}>
                {p.label}
              </button>
            ))}
            <button onClick={toggleMic} className="btn-ghost" style={{ fontSize: 12, border: `1px solid ${isListening ? 'var(--red)' : 'var(--border-dim)'}`, color: isListening ? 'var(--red)' : 'var(--text-dim)', padding: '6px 14px' }}>
              {isListening ? '🎙️ Mic ON' : '🔇 Mic OFF'}
            </button>
            <button onClick={() => setStealthMode(true)} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>🕶️ Stealth</button>
            {history.length > 0 && <button onClick={clearSession} className="btn-ghost" style={{ fontSize: 12, color: 'var(--red)' }}>Purge Memory</button>}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {permissionDenied && (
        <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 8, color: '#fff', fontSize: 14 }}>
          ⚠️ Mic access denied. Allow microphone permissions in your browser, then click <strong>Mic OFF</strong> to retry.
        </div>
      )}
      {error && (
        <div style={{ padding: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 8, color: '#fff', fontSize: 14 }}>
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* ── ELITE AUDIO STATE BAR ── */}
      {(isListening || isGenerating || isSpeaking || transcript || interimTranscript) && (
        <div style={{ padding: '12px 20px', background: 'var(--bg-raised)', border: `1px solid ${
          isSpeaking ? 'rgba(74,222,128,0.3)' :
          isGenerating ? 'rgba(0,240,255,0.3)' :
          (transcript || interimTranscript) ? 'rgba(0,240,255,0.2)' :
          'rgba(255,255,255,0.05)'
        }`, borderRadius: 10, display: 'flex', alignItems: 'center', gap: 16, transition: 'border-color 0.3s' }}>
          {/* Animated waveform bars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2,
                background: isSpeaking ? 'var(--green)' : isGenerating ? 'var(--cyan)' : (transcript || interimTranscript) ? 'var(--cyan)' : 'var(--border-dim)',
                height: isSpeaking || isGenerating || transcript || interimTranscript ? `${12 + Math.random() * 12}px` : '4px',
                animation: (isSpeaking || isGenerating || (transcript || interimTranscript)) ? `barPulse 0.${4 + i}s infinite alternate` : 'none',
                transition: 'height 0.15s, background 0.3s'
              }} />
            ))}
          </div>
          {/* State label */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, fontFamily: 'JetBrains Mono',
            color: isSpeaking ? 'var(--green)' : isGenerating ? 'var(--cyan)' : 'var(--cyan)' }}>
            {isSpeaking ? '🔊 ARIA SPEAKING' : isGenerating ? '⚡ ARIA THINKING' : '🎙️ LISTENING'}
          </div>
          {/* Transcript text */}
          {(transcript || interimTranscript) && (
            <div style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.9)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              "{transcript}<span style={{ opacity: 0.5 }}>{interimTranscript}</span>"
            </div>
          )}
          {/* Silence countdown ring — visual cue before auto-submit */}
          {(transcript || interimTranscript) && !isGenerating && (
            <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'JetBrains Mono', flexShrink: 0 }}>AUTO-SUBMIT ON SILENCE</div>
          )}
        </div>
      )}

      {/* Chat */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, minHeight: '60vh', paddingBottom: 160 }}>
        {history.length === 0 ? (
          <div className="aria-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎤</div>
            <h3 style={{ fontSize: 20, color: 'var(--cyan)', marginBottom: 8 }}>Full Duplex Ready</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, maxWidth: 420, margin: '0 auto' }}>
              Speak to auto-submit on silence, or type and press <strong>Ctrl+Enter</strong>. Say anything to interrupt ARIA mid-response.
            </p>
          </div>
        ) : (
          history.map((msg, index) => (
            <div key={msg.id || index}>
              {msg.role === 'user' ? (
                <div style={{ background: 'var(--bg-raised)', padding: '14px 22px', borderRadius: '16px 16px 16px 4px', border: '1px solid var(--border-dim)', display: 'inline-block', maxWidth: '85%' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: 1 }}>THEY ASKED:</div>
                  <div style={{ fontSize: 18, color: '#fff', lineHeight: 1.4 }}>"{msg.content}"</div>
                </div>
              ) : (
                <div style={{ paddingLeft: 16, borderLeft: `2px solid ${isSpeaking && index === history.length - 1 ? 'var(--green)' : 'rgba(0,240,255,0.2)'}` }}>
                  {!msg.content && isGenerating && index === history.length - 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--cyan)', padding: 16, fontSize: 12, fontFamily: 'JetBrains Mono' }}>
                      <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite -0.3s' }} />
                      <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite -0.15s' }} />
                      <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite' }} />
                      ARIA THINKING...
                    </div>
                  )}

                  {msg.content && (!msg.sections || msg.sections.length === 0) && (
                    <div className="aria-card" style={{ padding: 20, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.content}</div>
                  )}

                  {msg.sections && msg.sections.length > 0 && (
                    <div style={{ display: 'grid', gap: 16 }}>
                      {msg.sections.map((sec, sIdx) => (
                        <div key={sIdx} className="aria-card" style={{ padding: 20, borderTop: `2px solid ${getSectionColor(sec.emoji)}` }}>
                          <div style={{ fontSize: 12, color: getSectionColor(sec.emoji), fontWeight: 'bold', letterSpacing: 1, marginBottom: 10 }}>{sec.header}</div>
                          <div style={{ fontSize: 15, lineHeight: 1.6 }}>{sec.content}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.content && !isGenerating && index === history.length - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12, gap: 10 }}>
                      {saveAnswer && (
                        <button onClick={() => saveAnswer({ question: history[index - 1]?.content, answer: msg.content })} style={{ fontSize: 11, color: 'var(--text-dim)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                          💾 Save Answer
                        </button>
                      )}
                    </div>
                  )}

                  {msg.followUps?.length > 0 && (
                    <div style={{ marginTop: 24 }}>
                      <FollowUpRadar followUps={msg.followUps} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default LiveCopilot;
