// ════════════════════════════════
// FILE: src/components/Modes/ConfidenceScorer.jsx
// ════════════════════════════════

import React, { useState, useContext, useRef } from 'react';
import { streamClaude } from '../../api/aiProvider';
import ScoreRing from '../UI/ScoreRing';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const ConfidenceScorer = () => {
  const { setupData } = useContext(AppContext);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isScoring, setIsScoring] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [result, setResult] = useState(null);
  const [activeProvider, setActiveProvider] = useState('');

  const scrollRef = useRef(null);

  const parseFullResult = (resp) => {
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
    
    return sections;
  };

  const handleScore = async () => {
    if (!answer.trim()) return;
    setIsScoring(true);
    setResult(null);
    setLiveText('');

    const prompt = `You are an elite executive interview coach. Evaluate this answer for a ${setupData.level} ${setupData.role} role at ${setupData.company}.
    Question asked: ${question || 'General behavioral/technical question'}
    Candidate's answer: ${answer}

    Be brutal but highly constructive. Output EXACTLY with these sections:
    SCORE: [score from 1-10]
    VERDICT: [1 sentence summary]
    STRENGTHS [bullet points]
    FATAL FLAWS [bullet points]
    POWER REWRITE [full corrected text]`;

    try {
      await streamClaude(
        prompt,
        "Score this answer.",
        [],
        setupData.userId,
        (chunk) => {
          setLiveText(prev => prev + chunk);
          scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        },
        (fullText) => {
          const sections = parseFullResult(fullText);
          setResult(sections);
          setIsScoring(false);
          toast.show('Evaluation Complete', 'success');
        },
        (err) => {
          toast.show(err.message, 'error');
          setIsScoring(false);
        },
        (name) => setActiveProvider(name)
      );
    } catch (err) {
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
      <div style={{ flex: 1, position: 'sticky', top: 40 }}>
        <h2 style={{ fontSize: 24, marginBottom: 8 }}>Confidence Scorer</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Paste your answer for ruthless AI evaluation.</p>
        
        <div style={{ display: 'grid', gap: 16 }}>
          <input className="aria-input" value={question} onChange={e=>setQuestion(e.target.value)} placeholder="The question asked..." />
          <textarea className="aria-input" value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Paste your answer text..." rows={12} style={{ resize: 'none' }} />
          <button className="btn-primary" style={{ padding: 16 }} onClick={handleScore} disabled={isScoring || !answer.trim()}>
            {isScoring ? `Analysing via ${activeProvider || 'AI'}...` : 'Score My Answer'}
          </button>
        </div>
      </div>

      {/* Results Column */}
      <div style={{ flex: 1.5 }}>
        {isScoring && !result && (
          <div className="aria-card" style={{ padding: 24, minHeight: 400, fontSize: 13, background: 'var(--bg-base)', border: '1px dashed var(--cyan)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {liveText}
            <div ref={scrollRef} />
          </div>
        )}

        {!isScoring && !result && (
          <div className="aria-card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            Awaiting transmission...
          </div>
        )}

        {result && (
          <div style={{ display: 'grid', gap: 24, animation: 'fadeIn 0.5s' }}>
            <div className="aria-card" style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <ScoreRing score={result.score} size={120} label="IMPACT" />
              <div>
                <h3 style={{ fontSize: 16, color: 'var(--cyan)', marginBottom: 4 }}>EXECUTIVE VERDICT</h3>
                <p style={{ fontSize: 14 }}>{result.verdict}</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="aria-card" style={{ borderTop: '2px solid var(--green)' }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--green)', marginBottom: 12 }}>STRENGTHS</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.strengths}</div>
              </div>
              <div className="aria-card" style={{ borderTop: '2px solid var(--red)' }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--red)', marginBottom: 12 }}>FATAL FLAWS</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.flaws}</div>
              </div>
            </div>

            <div className="aria-card" style={{ borderTop: '2px solid var(--cyan)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--cyan)' }}>POWER REWRITE</div>
                <button onClick={handleSendToLive} className="btn-ghost" style={{ fontSize: 10 }}>Inject to Live</button>
              </div>
              <div style={{ fontSize: 15, fontStyle: 'italic', lineHeight: 1.6 }}>"{result.rewrite}"</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConfidenceScorer;
