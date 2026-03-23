// ════════════════════════════════
// FILE: src/components/Modes/ConfidenceScorer.jsx
// ════════════════════════════════

import React, { useState, useContext } from 'react';
import { callClaude } from '../../api/claude';
import ScoreRing from '../UI/ScoreRing';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const ConfidenceScorer = () => {
  const { setupData } = useContext(AppContext);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isScoring, setIsScoring] = useState(false);
  const [result, setResult] = useState(null);

  const handleScore = async () => {
    if (!answer.trim()) return;
    setIsScoring(true);
    setResult(null);

    const prompt = `You are an elite executive interview coach. Evaluate this answer for a ${setupData.level} ${setupData.role} role at ${setupData.company}.
Question asked (optional context): ${question || 'General behavioral/technical question'}
Candidate's answer: ${answer}

Be brutal but highly constructive. Output EXACTLY with these sections exactly as named:
SCORE: [score from 1-10]
VERDICT: [1 sentence summary of the answer's impact]
STRENGTHS
- [point 1]
- [point 2]
FATAL FLAWS
- [point 1]
- [point 2]
POWER REWRITE
[The exact word-for-word way the candidate SHOULD have answered this to get a 10/10]`;

    try {
      const resp = await callClaude(prompt, "Score this answer.");
      
      const sections = { score: 0, verdict: '', strengths: '', flaws: '', rewrite: '' };
      
      const scoreMatch = resp.match(/SCORE:\s*(\d+)/i);
      if (scoreMatch) sections.score = parseInt(scoreMatch[1], 10);

      const verdictMatch = resp.match(/VERDICT:\s*(.*)/i);
      if (verdictMatch) sections.verdict = verdictMatch[1].trim();

      const parseSection = (startText, endText) => {
        const start = resp.indexOf(startText);
        if (start === -1) return '';
        const end = endText ? resp.indexOf(endText, start) : resp.length;
        return resp.substring(start + startText.length, end === -1 ? resp.length : end).trim();
      };

      sections.strengths = parseSection('STRENGTHS', 'FATAL FLAWS');
      sections.flaws = parseSection('FATAL FLAWS', 'POWER REWRITE');
      sections.rewrite = parseSection('POWER REWRITE', null);

      setResult(sections);
      toast.show('Answer scored successfully', 'success');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setIsScoring(false);
    }
  };

  const handleSendToLive = () => {
    if (result?.rewrite) {
      window.dispatchEvent(new CustomEvent('aria_submit', { detail: result.rewrite }));
      toast.show('Rewrite injected into Live Copilot memory', 'success');
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      
      {/* Input Column */}
      <div style={{ flex: 1, position: 'sticky', top: 80 }}>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>Confidence Scorer</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Paste your drafted answer for ruthless AI evaluation.</p>
        
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>THE QUESTION (OPTIONAL)</label>
            <input 
              className="aria-input" 
              value={question} 
              onChange={e=>setQuestion(e.target.value)} 
              placeholder="e.g. Tell me about a time you failed..." 
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>YOUR EXACT ANSWER</label>
            <textarea 
              className="aria-input" 
              value={answer} 
              onChange={e=>setAnswer(e.target.value)} 
              placeholder="Paste the transcript or drafted text here..." 
              rows={12} 
              style={{ width: '100%', resize: 'none', lineHeight: 1.5 }}
            />
          </div>
          
          <button 
            className="btn-primary" 
            style={{ width: '100%', padding: '16px', fontSize: 16 }} 
            onClick={handleScore} 
            disabled={isScoring || !answer.trim()}
          >
            {isScoring ? 'Analyzing Response...' : 'Score My Answer'}
          </button>
        </div>
      </div>

      {/* Results Column */}
      <div style={{ flex: 1.5 }}>
        {!result && !isScoring && (
          <div className="aria-card" style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>⚖️</div>
            Waiting for transmission...
          </div>
        )}

        {isScoring && (
          <div className="aria-card" style={{ height: '100%', minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--cyan)' }}>
               <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulseGlow 2s infinite' }}>⚖️</div>
               Running logic simulation...
            </div>
          </div>
        )}

        {result && !isScoring && (
          <div style={{ display: 'grid', gap: 24, animation: 'fadeSlideUp 0.4s ease forwards' }}>
            
            {/* Top Score Row */}
            <div className="aria-card" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <ScoreRing score={result.score} size={140} animated={true} label="CONFIDENCE" />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 18, marginBottom: 8, color: 'var(--text-primary)' }}>Executive Verdict</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, fontSize: 15 }}>{result.verdict}</p>
              </div>
            </div>

            {/* Critique Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="aria-card" style={{ borderTop: '3px solid var(--green)', padding: 20 }}>
                <h3 style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                  STRENGTHS
                </h3>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.strengths}</div>
              </div>
              <div className="aria-card" style={{ borderTop: '3px solid var(--red)', padding: 20 }}>
                <h3 style={{ color: 'var(--red)', fontSize: 13, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.47 2 2 6.47 2 12s4.47 10 10 10 10-4.47 10-10S17.53 2 12 2zm5 13.59L15.59 17 12 13.41 8.41 17 7 15.59 10.59 12 7 8.41 8.41 7 12 10.59 15.59 7 17 8.41 13.41 12 17 15.59z"/></svg>
                  FATAL FLAWS
                </h3>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.flaws}</div>
              </div>
            </div>

            {/* Power Rewrite */}
            <div className="aria-card" style={{ borderTop: '3px solid var(--cyan)', padding: 24, background: 'linear-gradient(180deg, rgba(0,240,255,0.05) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ color: 'var(--cyan)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                  POWER REWRITE
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { navigator.clipboard.writeText(result.rewrite); toast.show('Copied','success'); }}>Copy</button>
                  <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--cyan)' }} onClick={handleSendToLive}>Inject into Live</button>
                </div>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', fontSize: 16, color: '#fff', lineHeight: 1.6, fontStyle: 'italic' }}>
                "{result.rewrite}"
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
};

export default ConfidenceScorer;
