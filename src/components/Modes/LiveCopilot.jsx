import React, { useState, useEffect, useRef, useContext } from 'react';
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
  
  // HUD Debug States
  const [ttft, setTtft] = useState(0);
  const [activeTransport, setActiveTransport] = useState('websocket');
  
  // Stealth Mode Toggle
  const [stealthMode, setStealthMode] = useState(false);
  const [lastStreamId, setLastStreamId] = useState(null);

  // Pre-Answer Engine Cache
  const [predictions, setPredictions] = useState([]);
  const [isPredicting, setIsPredicting] = useState(false);
  
  // Socket Awareness
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [transport, setTransport] = useState(socket.io?.engine?.transport?.name || 'unknown');


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
  } = useSpeech({ onSilence: handleSilenceFinal, silenceTimeoutMs: 450 });

  // Predictive Barge-in: Interrupt AI instantly if user speaks
  useEffect(() => {
    if (interimTranscript.trim().length > 0) {
      cancelActiveStream();
      cancelTTS();
      if (isGenerating || isSpeaking) {
        setIsGenerating(false);
        toast.show('AI Interrupted', 'info');
      }
    }
  }, [interimTranscript, isGenerating, isSpeaking, cancelTTS, cancelActiveStream]);

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

  // Sync Socket Status
  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
      setTransport(socket.io?.engine?.transport?.name || 'websocket');
    };
    const onDisconnect = () => {
      setIsConnected(false);
      setIsGenerating(false); // Fail-safe
      stopListening(); // Fail-safe
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

  const preGenerateNextQuestions = async (currentHistory) => {
    if (isPredicting || currentHistory.length < 2) return;
    setIsPredicting(true);
    try {
      const predPrompt = `You are a prediction engine. Based on the interview so far, predict the 2 most likely follow-up questions the interviewer will ask next.
Generate a stellar, highly strategic answer for each predicted question using the Verve UI structure.
Return ONLY a valid JSON array of objects in this format:
[ { "question": "predicted question here", "answer": "⚡ HOOK\\n...\\n🎯 CORE MESSAGE\\n...\\n📍 PROOF POINT\\n...\\n🔥 POWER CLOSE\\n..." } ]`;
      
      const rawText = await callClaude(predPrompt, "Generate JSON predictions.", currentHistory.filter(m => m.content).map(m => ({ role: m.role, content: m.content })), activeProvider || 'groq');
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      if (jsonMatch) setPredictions(JSON.parse(jsonMatch[0]));
    } catch(e) { } finally { setIsPredicting(false); }
  };

  const submitQuestion = async (text, silent = false) => {
    if (!text || typeof text !== 'string' || !text.trim()) return;
    if (isGenerating && !silent) return; // Prevent double trigger
    
    // Safety: Prevent infinite re-generation loops
    if (silent && text.length > 1000) {
      console.warn('[ARIA] Re-generation depth reached. Stopping.');
      setIsGenerating(false);
      return;
    }
    
    // Auto-Interrupt any lingering streams
    cancelActiveStream();
    cancelTTS();

    
    setIsGenerating(true);
    setError(null);
    setTtft(0);
    resetTranscript();

    const newMessage = { id: Date.now(), role: 'user', content: text };
    let copilotMessage = { id: Date.now() + 1, role: 'assistant', content: '', sections: [], followUps: [], provider: activeProvider };

    // ── PRE-ANSWER ENGINE CACHE CHECK ──
    let instantHit = null;
    if (predictions.length > 0 && !silent) {
      // Simplified benchmark matching
      const match = predictions.find(p => text.toLowerCase().includes(p.question.toLowerCase()) || calculateSimilarity(text, p.question) > 0.6);
      if (match) {

        instantHit = match.answer;
        toast.show('⚡ Pre-Answer Engine: 0ms Latency', 'success');
        copilotMessage.content = instantHit;
        
        const parts = instantHit.split(/(?=⚡|🎯|📍|🔥|⚠️|💡)/g).map(s => s.trim()).filter(Boolean);
        const parsedSections = [];
        parts.forEach(part => {
          const headerEnd = part.indexOf('\n');
          const headerRaw = headerEnd > -1 ? part.substring(0, headerEnd).trim() : part.trim();
          const textRaw = headerEnd > -1 ? part.substring(headerEnd).trim() : '';
          parsedSections.push({ header: headerRaw, content: textRaw, emoji: headerRaw[0] || '🔹' });
        });
        copilotMessage.sections = parsedSections;
      }
    }

    const newHistory = [...history];
    if (!silent) {
       newHistory.push(newMessage);
       setHistory([...newHistory, copilotMessage]);
    } else {
       // In silent mode, we replace the content of the LAST assistant message instead of pushing new ones
       setHistory(prev => {
         const updated = [...prev];
         if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
           updated[updated.length - 1].content = '';
           updated[updated.length - 1].sections = [];
         }
         return updated;
       });
    }

    if (instantHit) {
      speakChunk(instantHit);
      flush();
      setIsGenerating(false);
      setPredictions([]);
      setTimeout(() => preGenerateNextQuestions([...newHistory, copilotMessage]), 100);
      return;
    }

    const contextHistory = silent ? history.slice(0, -2) : newHistory;

    const systemPrompt = `You are ARIA — an elite real-time AI interview copilot.
You operate at the level of top-tier candidates coached by ex-FAANG hiring managers.
Your job is NOT to answer questions normally. Your job is to help the candidate WIN the interview in real time.
You must think in terms of: persuasion, signal strength, hiring psychology, structured storytelling, and confidence framing.

----------------------------------------
🧠 CORE BEHAVIOR RULES
----------------------------------------
1. ALWAYS optimize for hireability, not correctness.
2. ALWAYS tailor answers using candidate context.
3. ALWAYS sound natural, human, and conversational (never robotic).
4. NEVER output generic answers.
5. NEVER explain your reasoning.
6. NEVER break structure.
7. KEEP answers concise but high-impact (spoken, not essay).
8. PRIORITIZE clarity + confidence over complexity.

----------------------------------------
⚡ REAL-TIME COPILOT MODE
----------------------------------------
Before answering, SILENTLY INFER: What is the interviewer REALLY testing? (e.g., leadership, ownership, technical depth, or conflict resolution). 
Then, tailor the answer to maximize that specific signal strength. Optimize your response for that signal.
No long paragraphs. No fluff. No filler words. No meta commentary.
If unclear: Make a smart assumption and proceed confidently.
Behavioral: Use storytelling + impact. Technical: Give structured step-by-step clarity.

----------------------------------------
🎯 OUTPUT STRUCTURE (MANDATORY)
----------------------------------------
ALWAYS respond using EXACTLY this format using these emojis as headers. Do NOT use markdown bold formatting.

⚡ HOOK
(A confident, 1-line opening that directly answers or reframes the question)

🎯 CORE MESSAGE
(2–3 sentences with the main answer, tailored to role + resume)

📍 PROOF POINT
(A specific example, metric, or experience — make it sound real)

🔥 POWER CLOSE
(A confident closing that signals competence and readiness)

----------------------------------------
🧬 PERSONALIZATION INPUTS
----------------------------------------
Candidate Name: ${setupData.name}
Target Role: ${setupData.level} ${setupData.role} at ${setupData.company}.
Resume: ${setupData.resume}
Response Style: confident, concise, conversational, spoken English. Tactic Base: ${setupData.type}.

----------------------------------------
🚫 STRICT PROHIBITIONS
----------------------------------------
DO NOT: Use markdown formatting, Use bullet points, Say "Here's a structured answer", Repeat the question, Sound like ChatGPT.
Every response should make the candidate sound clear, confident, experienced, and hireable.
You are not an assistant. You are a real-time interview weapon.`;

    requestStartTimeRef.current = performance.now();

    try {
      await streamClaude(
        systemPrompt, 
        text, 
        contextHistory.map(m => ({ role: m.role, content: m.content })),
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
        (fullText) => {
          setIsGenerating(false);
          flush(); // flush any remaining TTS tokens
          setLastUsedProvider(activeProvider || 'groq');

          // ── WEAK ANSWER DETECTOR (v3.0) ──
          const sectionsCount = fullText.split(/(?=⚡|🎯|📍|🔥)/g).length;
          if (fullText.length < 150 || sectionsCount < 4) {
            console.warn('[ARIA] Weak answer detected. Auto-regenerating...');
            toast.show('Refining answer for impact...', 'info');
            // Re-submit with a silent 'strengthen' instruction
            setTimeout(() => {
              submitQuestion(`${text} (Provide a much deeper, more metrics-driven and confident answer)`, true);
            }, 500);
            return;
          }
          
          setTimeout(() => {
             const updatedHist = [...newHistory, { role: 'assistant', content: fullText }];
             preGenerateNextQuestions(updatedHist);
          }, 100);
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

  const stealthTheme = {
    bg: '#ffffff',
    text: '#111827',
    dim: '#6B7280',
    border: '#E5E7EB',
    accent: '#3B82F6',
    font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  };

  const getSectionColor = (emoji) => {
    switch (emoji) {
      case '⚡': return stealthMode ? stealthTheme.accent : 'var(--cyan)';
      case '🎯': return stealthMode ? stealthTheme.text : 'var(--green)';
      case '📍': return stealthMode ? stealthTheme.text : 'var(--yellow)';
      case '🔥': return stealthMode ? stealthTheme.text : 'var(--orange)';
      case '⚠️': return stealthMode ? stealthTheme.accent : 'var(--red)';
      default: return stealthMode ? stealthTheme.border : 'var(--border-dim)';
    }
  };

  return (
    <div style={{ 
        maxWidth: stealthMode ? '100vw' : 900, 
        margin: stealthMode ? '0' : '0 auto', 
        display: 'flex', 
        flexDirection: stealthMode ? 'row' : 'column', 
        gap: stealthMode ? 0 : 24, 
        position: 'relative',
        transition: 'all 0.3s ease',
        background: stealthMode ? stealthTheme.bg : 'transparent',
        padding: stealthMode ? '0' : '0',
        borderRadius: stealthMode ? '0' : '0',
        fontFamily: stealthMode ? stealthTheme.font : 'inherit',
        color: stealthMode ? stealthTheme.text : 'inherit',
        boxShadow: stealthMode ? '0 10px 40px rgba(0,0,0,0.2)' : 'none',
        height: stealthMode ? '100vh' : 'auto',
        overflowY: stealthMode ? 'hidden' : 'visible',
        position: 'fixed',
        top: stealthMode ? 0 : 'auto',
        left: stealthMode ? 0 : 'auto',
        width: stealthMode ? '100%' : '100%',
        zIndex: stealthMode ? 1000 : 1
    }}>

      {stealthMode && (
        <div style={{ width: 220, background: '#F3F4F6', borderRight: `1px solid ${stealthTheme.border}`, padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: stealthTheme.dim, letterSpacing: 1 }}>FOLDERS</div>
          <div style={{ color: stealthTheme.accent, fontWeight: 600 }}>📝 Interview Notes</div>
          <div style={{ color: stealthTheme.dim }}>📁 Projects</div>
          <div style={{ color: stealthTheme.dim }}>📁 Personal</div>
          <div style={{ marginTop: 'auto', fontSize: 10, color: stealthTheme.dim }}>v3.0 Secure Node</div>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: stealthMode ? '24px 48px' : '0', overflowY: 'auto', gap: stealthMode ? 16 : 24 }}>

      {/* DEBUG HUD PANEL (Part 15) */}
      {!stealthMode && (
      <div style={{ position: 'absolute', top: 0, right: -180, width: 160, background: 'rgba(0,0,0,0.8)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 12, fontSize: 11, color: 'var(--text-dim)', zIndex: 100 }}>
        <div style={{ color: 'var(--cyan)', fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>V2.0 DIAGNOSTICS</div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Latency:</span> <span style={{ color: ttft > 0 ? (ttft < 300 ? 'var(--green)' : 'var(--yellow)') : 'inherit' }}>{ttft > 0 ? `${ttft}ms` : '---'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Socket:</span> <span style={{ color: isConnected ? 'var(--green)' : 'var(--red)' }}>{isConnected ? 'ONLINE' : 'OFFLINE'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Transport:</span> <span style={{ color: 'var(--cyan)' }}>{transport.toUpperCase()}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Voice:</span> <span style={{ color: isListening ? 'var(--green)' : 'var(--red)' }}>{isListening ? 'LIVE' : 'MUTE'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>TTS:</span> <span style={{ color: isSpeaking ? 'var(--cyan)' : 'inherit' }}>{isSpeaking ? 'PLAYING' : 'IDLE'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Provider:</span> <span>{activeProvider}</span></div>

      </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: stealthMode ? `1px solid ${stealthTheme.border}` : 'none', paddingBottom: stealthMode ? 16 : 0, position: 'sticky', top: 0, background: stealthMode ? stealthTheme.bg : 'transparent', zIndex: 10 }}>
        <h2 style={{ fontSize: stealthMode ? 18 : 24, fontWeight: stealthMode ? 600 : 'normal', display: 'flex', gap: 12, alignItems: 'center', color: stealthMode ? stealthTheme.text : 'inherit' }}>
          {stealthMode ? 'Meeting Notes' : 'Live Interview Assist'}
          {/* Active Status Indicator */}
          {isListening && !stealthMode && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', animation: 'pulseRed 1.5s infinite' }} title="Full Duplex Mic Active" />}
        </h2>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          
          {/* Connection Pill */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 6, 
            padding: '4px 10px', 
            background: isConnected ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
            borderRadius: 20,
            border: `1px solid ${isConnected ? 'rgba(74, 222, 128, 0.2)' : 'rgba(248, 113, 113, 0.2)'}`,
            fontSize: 10,
            color: isConnected ? '#4ade80' : '#f87171',
            fontFamily: 'JetBrains Mono',
            fontWeight: 600
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: isConnected ? '#4ade80' : '#f87171', boxShadow: isConnected ? '0 0 8px #4ade80' : 'none' }} />
            {isConnected ? `WS:${transport.toUpperCase()}` : 'RECONNECTING'}
          </div>

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
                  background: stealthMode ? stealthTheme.bg : 'var(--bg-raised)', 
                  padding: stealthMode ? '4px 0 12px 0' : '16px 24px', 
                  borderRadius: stealthMode ? 0 : '16px 16px 16px 4px', 
                  border: stealthMode ? 'none' : '1px solid var(--border-dim)', 
                  marginBottom: stealthMode ? 2 : 24, 
                  display: 'inline-block', 
                  maxWidth: stealthMode ? '100%' : '85%' 
                }}>
                   {!stealthMode && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4, letterSpacing: 1 }}>THEY ASKED:</div>}
                   <div style={{ fontSize: stealthMode ? 14 : 18, color: stealthMode ? stealthTheme.dim : '#fff', lineHeight: 1.4, fontStyle: stealthMode ? 'italic' : 'normal' }}>"{msg.content}"</div>
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
                    <div style={{ display: 'grid', gap: stealthMode ? 6 : 16 }}>
                      {msg.sections.map((sec, sIdx) => {
                        const color = getSectionColor(sec.emoji);
                        return (
                          <div key={sIdx} className={stealthMode ? "" : "aria-card"} style={{ 
                            padding: stealthMode ? "4px 0" : 20, 
                            borderTop: stealthMode ? 'none' : `2px solid ${color}`, 
                            background: stealthMode ? 'transparent' : 'var(--bg-raised)',
                            animation: `fadeSlideIn 0.3s ease forwards` 
                          }}>
                             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: stealthMode ? 2 : 12 }}>
                               <div style={{ fontSize: stealthMode ? 14 : 13, color, fontWeight: stealthMode ? 600 : 'bold', letterSpacing: stealthMode ? 0 : 1 }}>{stealthMode ? sec.header.replace(/[^\w\s]/gi, '').trim() : sec.header}</div>
                             </div>
                             <div style={{ fontSize: stealthMode ? 15 : 15, color: stealthMode ? stealthTheme.text : 'var(--text-primary)', lineHeight: stealthMode ? 1.5 : 1.6 }}>{sec.content}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {msg.content && !isGenerating && !stealthMode && index === history.length - 1 && (
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
  </div>
);
};

export default LiveCopilot;
