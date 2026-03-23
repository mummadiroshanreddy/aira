import React, { useState, useEffect, useRef, useContext } from 'react';
import { streamClaude, cancelActiveStream } from '../../api/claude';
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
  
  // HUD Debug States
  const [ttft, setTtft] = useState(0);
  const [activeTransport, setActiveTransport] = useState('websocket');
  
  // Stealth Mode Toggle
  const [stealthMode, setStealthMode] = useState(false);
  const [lastStreamId, setLastStreamId] = useState(null);

  const messagesEndRef = useRef(null);
  const requestStartTimeRef = useRef(0);

  const { speakChunk, flush, cancel: cancelTTS, isSpeaking } = useTTS();

  const handleSilenceFinal = (stableText) => {
    if (stableText.trim().length > 3) {
       submitQuestion(stableText.trim());
    }
  };

  const {
    isListening,
    transcript,
    interimTranscript,
    permissionDenied,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeech({ onSilence: handleSilenceFinal, silenceTimeoutMs: 700 });

  // Predictive Barge-in: Interrupt AI instantly if user speaks
  useEffect(() => {
    if (interimTranscript.trim().length > 2) {
      if (isGenerating || isSpeaking) {
        cancelActiveStream();
        cancelTTS();
        setIsGenerating(false);
        toast.show('AI Interrupted', 'info');
      }
    }
  }, [interimTranscript, isGenerating, isSpeaking, cancelTTS]);

  // Initial Auto-listen
  useEffect(() => {
    startListening();
    return () => stopListening();
  }, [startListening, stopListening]);

  // Handle external manual submits from InputBar
  useEffect(() => {
    const handleAriaSubmit = (e) => submitQuestion(e.detail);
    window.addEventListener('aria_submit', handleAriaSubmit);
    return () => window.removeEventListener('aria_submit', handleAriaSubmit);
  }, [history]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const submitQuestion = async (text) => {
    if (!text || typeof text !== 'string' || !text.trim()) return;
    
    // Auto-Interrupt any lingering streams
    cancelActiveStream();
    cancelTTS();
    
    setIsGenerating(true);
    setError(null);
    setTtft(0);
    resetTranscript();

    const newMessage = { id: Date.now(), role: 'user', content: text };
    const copilotMessage = { id: Date.now() + 1, role: 'assistant', content: '', sections: [], followUps: [], provider: activeProvider };

    const newHistory = [...history, newMessage];
    setHistory([...newHistory, copilotMessage]);

    const systemPrompt = `You are ARIA, an elite AI interview copilot.
Candidate: ${setupData.name}. Target Role: ${setupData.level} ${setupData.role} at ${setupData.company}.
Candidate DNA/Resume: ${setupData.resume}
Response Style: ${setupData.style}. Tactic Base: ${setupData.type}.

Analyze the interviewer's question and generate a structured, highly strategic answer.
OUTPUT EXACTLY IN THIS FORMAT using these emojis as section headers. Do NOT use markdown bold headers, literally just the emoji and ALL CAPS text, followed by the content on the next lines.

⚡ HOOK
[1 sentence opening statement mapping directly to their pain point]

🎯 CORE MESSAGE
[The main 2-3 sentence answer, referencing candidate's specific DNA if provided]

📍 PROOF POINT
[A specific example/metric backing up the core message]

🔥 POWER CLOSE
[1 string sentence to pass the mic back confidently]
`;

    requestStartTimeRef.current = performance.now();

    try {
      await streamClaude(
        systemPrompt, 
        text, 
        newHistory.map(m => ({ role: m.role, content: m.content })),
        activeProvider || 'groq',
        (chunk) => {
          // TTFT Calculate
          if (requestStartTimeRef.current > 0) {
            setTtft(Math.round(performance.now() - requestStartTimeRef.current));
            requestStartTimeRef.current = 0;
          }
          
          // Stream directly into TTS Audio Buffer
          speakChunk(chunk);

          setHistory(prev => {
            const updated = [...prev];
            const activeMatch = { ...updated[updated.length - 1] };
            if (activeMatch && activeMatch.role === 'assistant') {
              activeMatch.content = (activeMatch.content || '') + chunk;
              
              const parts = activeMatch.content.split(/(?=⚡|🎯|📍|🔥|⚠️|💡)/g).map(s => s.trim()).filter(Boolean);
              const parsedSections = [];
              let followUps = [];
              
              parts.forEach(part => {
                const headerEnd = part.indexOf('\n');
                const headerRaw = headerEnd > -1 ? part.substring(0, headerEnd).trim() : part.trim();
                const textRaw = headerEnd > -1 ? part.substring(headerEnd).trim() : '';
                if (headerRaw.includes('💡 FOLLOWUPS:')) {
                  followUps = headerRaw.replace('💡 FOLLOWUPS:', '').split('|').concat(textRaw.split('|')).map(s=>s.trim()).filter(Boolean).slice(0, 3);
                } else {
                  parsedSections.push({ header: headerRaw, content: textRaw, emoji: headerRaw[0] || '🔹' });
                }
              });
              activeMatch.sections = parsedSections;
              activeMatch.followUps = followUps;
              updated[updated.length - 1] = activeMatch;
            }
            return updated;
          });
        },
        () => {
          setIsGenerating(false);
          flush(); // flush any remaining TTS tokens
          setLastUsedProvider(activeProvider || 'groq');
        },
        (err) => { 
          setError(`Stream aborted: ${err.message}`); 
          setIsGenerating(false);
        },
        (providerId) => setHistory(prev => { const u = [...prev]; if (u[u.length-1]) u[u.length-1].provider = providerId; return u; }),
        (from, to) => {
           toast.show(`Fallback routing: ${from} → ${to}`, 'info');
           setActiveTransport('websocket-fallback');
        }
      );
    } catch (err) {
       console.error(err);
    }
  };

  const clearSession = () => { if(window.confirm('Clear memory?')) setHistory([]); };

  const getSectionColor = (emoji) => {
    switch (emoji) {
      case '⚡': return stealthMode ? 'var(--cyan-dim)' : 'var(--cyan)';
      case '🎯': return stealthMode ? 'var(--green-dim)' : 'var(--green)';
      case '📍': return stealthMode ? 'var(--yellow-dim)' : 'var(--yellow)';
      case '🔥': return stealthMode ? 'var(--orange-dim)' : 'var(--orange)';
      case '⚠️': return stealthMode ? 'var(--red-dim)' : 'var(--red)';
      default: return 'var(--border-dim)';
    }
  };

  return (
    <div style={{ 
        maxWidth: stealthMode ? 480 : 900, 
        margin: '0 auto', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: stealthMode ? 16 : 24, 
        position: 'relative',
        transition: 'all 0.3s ease'
    }}>

      {/* DEBUG HUD PANEL (Part 15) */}
      {!stealthMode && (
      <div style={{ position: 'absolute', top: 0, right: -180, width: 160, background: 'rgba(0,0,0,0.8)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 12, fontSize: 11, color: 'var(--text-dim)', zIndex: 100 }}>
        <div style={{ color: 'var(--cyan)', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>V2.0 DIAGNOSTICS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Latency:</span> <span style={{ color: ttft > 0 ? (ttft < 300 ? 'var(--green)' : 'var(--yellow)') : 'inherit' }}>{ttft > 0 ? `${ttft}ms` : '---'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Network:</span> <span>{activeTransport}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Voice:</span> <span style={{ color: isListening ? 'var(--green)' : 'var(--red)' }}>{isListening ? 'LIVE' : 'MUTE'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TTS:</span> <span style={{ color: isSpeaking ? 'var(--cyan)' : 'inherit' }}>{isSpeaking ? 'PLAYING' : 'IDLE'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Provider:</span> <span>{activeProvider}</span></div>
      </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: stealthMode ? '1px solid var(--border-dim)' : 'none', paddingBottom: stealthMode ? 12 : 0 }}>
        <h2 style={{ fontSize: stealthMode ? 16 : 24, display: 'flex', gap: 12, alignItems: 'center', opacity: stealthMode ? 0.7 : 1 }}>
          {stealthMode ? 'ARIA Stealth UI' : 'Live Tactical Feed'}
          {/* Active Status Indicator */}
          {isListening && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulseRed 1.5s infinite' }} title="Full Duplex Mic Active" />}
        </h2>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <button 
            className="btn-ghost" 
            onClick={() => setStealthMode(!stealthMode)} 
            style={{ fontSize: 12, color: stealthMode ? 'var(--cyan)' : 'var(--text-dim)', background: stealthMode ? 'rgba(0, 240, 255, 0.05)' : 'transparent', padding: '6px 12px', borderRadius: 4 }}
          >
            {stealthMode ? '🥷 Stealth Active' : '🕶️ Enter Stealth'}
          </button>
          
          {history.length > 0 && <button className="btn-ghost" onClick={clearSession} style={{ fontSize: 12, color: 'var(--red)' }}>Purge Memory</button>}
        </div>
      </div>

      {permissionDenied && <div style={{ padding: 16, background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, color: '#fff' }}>Mic access denied. Please allow microphone permissions to use Voice Barge-in.</div>}
      {error && <div style={{ padding: 16, background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, color: '#fff' }}><span style={{ fontWeight: 'bold' }}>SYSTEM ERROR:</span> {error}</div>}

      {/* Live Voice Input Feedback */}
      {(transcript || interimTranscript) && (
        <div style={{ padding: 16, background: 'var(--bg-raised)', border: '1px solid var(--cyan-dim)', borderRadius: 8, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 4, height: 16, background: 'var(--cyan)', animation: 'barPulse 0.5s infinite alternate' }} />
          <span>"{transcript} <span style={{ opacity: 0.6 }}>{interimTranscript}</span>"</span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: stealthMode ? 16 : 32 }}>
        {history.length === 0 ? (
          <div className="aria-card" style={{ display: 'grid', gap: 24, animation: 'fadeSlideUp 0.3s ease', background: stealthMode ? 'transparent' : 'var(--bg-raised)' }}>
            <div style={{ textAlign: 'center', margin: stealthMode ? '16px 0' : '32px 0' }}>
               {!stealthMode && <div style={{ fontSize: 48, marginBottom: 16, animation: 'float 4s ease-in-out infinite' }}>🎤</div>}
               <h3 style={{ fontSize: stealthMode ? 16 : 20, color: 'var(--cyan)' }}>{stealthMode ? 'Awaiting Audio...' : 'Full Duplex Standby'}</h3>
               <p style={{ color: 'var(--text-secondary)', fontSize: stealthMode ? 12 : 14 }}>
                 {stealthMode ? 'Minimize window and pin next to camera. Auto-intercepting interview traffic.' : 'Just start talking. I will auto-detect silence and respond instantly. Speak over me anytime to interrupt.'}
               </p>
            </div>
          </div>
        ) : (
          history.map((msg, index) => (
            <div key={msg.id} style={{ animation: 'fadeSlideUp 0.3s ease' }}>
              {msg.role === 'user' ? (
                <div style={{ 
                  background: stealthMode ? 'transparent' : 'var(--bg-raised)', 
                  padding: stealthMode ? '8px 12px' : '16px 24px', 
                  borderRadius: stealthMode ? 0 : '16px 16px 16px 4px', 
                  border: stealthMode ? 'none' : '1px solid var(--border-dim)', 
                  borderLeft: stealthMode ? '2px solid rgba(255,255,255,0.1)' : '1px solid var(--border-dim)',
                  marginBottom: stealthMode ? 8 : 24, 
                  display: 'inline-block', 
                  maxWidth: stealthMode ? '100%' : '85%' 
                }}>
                   <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: 1 }}>THEY ASKED:</div>
                   <div style={{ fontSize: stealthMode ? 14 : 18, color: '#fff', lineHeight: 1.4 }}>"{msg.content}"</div>
                </div>
              ) : (
                <div style={{ 
                  paddingLeft: stealthMode ? 12 : 16, 
                  borderLeft: `2px solid ${isSpeaking && index === history.length - 1 ? 'var(--green)' : 'rgba(0, 240, 255, 0.2)'}` 
                }}>
                  
                  {!msg.content && isGenerating && index === history.length - 1 && (
                     <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--cyan)', padding: 16 }}>
                        <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite -0.3s' }}></div>
                        <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite -0.15s' }}></div>
                        <div style={{ width: 6, height: 6, background: 'var(--cyan)', borderRadius: '50%', animation: 'dotPulse 1.4s infinite' }}></div>
                        <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono' }}>GENERATING MATRIX... ({ttft}ms)</span>
                     </div>
                  )}

                  {msg.content && (!msg.sections || msg.sections.length === 0) && (
                    <div className="aria-card" style={{ padding: 20, whiteSpace: 'pre-wrap', lineHeight: 1.6, animation: `fadeSlideIn 0.3s ease forwards` }}>
                      {msg.content}
                    </div>
                  )}

                  {msg.sections && msg.sections.length > 0 && (
                    <div style={{ display: 'grid', gap: stealthMode ? 8 : 16 }}>
                      {msg.sections.map((sec, sIdx) => {
                        const color = getSectionColor(sec.emoji);
                        return (
                          <div key={sIdx} className={stealthMode ? "" : "aria-card"} style={{ 
                            padding: stealthMode ? "12px 0" : 20, 
                            borderTop: stealthMode ? 'none' : `2px solid ${color}`, 
                            borderLeft: stealthMode ? `2px solid ${color}` : 'none',
                            paddingLeft: stealthMode ? 12 : 20,
                            background: stealthMode ? 'transparent' : 'var(--bg-raised)',
                            animation: `fadeSlideIn 0.3s ease forwards` 
                          }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: stealthMode ? 4 : 12 }}>
                               <div style={{ fontSize: stealthMode ? 11 : 13, color, fontWeight: 'bold', letterSpacing: 1 }}>{stealthMode ? sec.emoji + ' ' + sec.header.replace(/[^\w\s]/gi, '') : sec.header}</div>
                             </div>
                             <div style={{ fontSize: stealthMode ? 14 : 15, color: stealthMode ? '#e0e0e0' : 'var(--text-primary)', lineHeight: stealthMode ? 1.4 : 1.6 }}>{sec.content}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {msg.content && !isGenerating && index === history.length - 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', opacity: 0.6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{PROVIDER_META[msg.provider]?.badge}</span>
                        <span>{PROVIDER_META[msg.provider]?.name} (TTFT: {ttft}ms)</span>
                      </div>
                    </div>
                  )}

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
