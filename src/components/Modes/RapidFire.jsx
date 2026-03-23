// ════════════════════════════════
// FILE: src/components/Modes/RapidFire.jsx
// ════════════════════════════════

import React, { useState, useEffect, useContext } from 'react';
import { callClaude } from '../../api/claude';
import { useCountdown } from '../../hooks/useTimer';
import ScoreRing from '../UI/ScoreRing';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const RapidFire = () => {
  const { setupData } = useContext(AppContext);
  const [phase, setPhase] = useState('setup'); // setup, drill, report
  const [settings, setSettings] = useState({ category: 'All', count: 5, timePerQ: 60 });
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isScoring, setIsScoring] = useState(false);
  const [scoreData, setScoreData] = useState(null);

  const { remaining, isExpired, startCountdown, pauseCountdown } = useCountdown(settings.timePerQ);

  const handleStart = async () => {
    setIsGenerating(true);
    const prompt = `Generate exactly ${settings.count} interview questions for a ${setupData.level} ${setupData.role} candidate.
Category context: ${settings.category}.
Mix: realistic, specific to the role, varying difficulty.
Output ONLY the questions, one per line, numbered. No other text.`;

    try {
      const resp = await callClaude(prompt, "Start drill.");
      const qs = resp.split('\n').map(q => q.replace(/^\d+\.\s*/, '').trim()).filter(Boolean).slice(0, settings.count);
      setQuestions(qs);
      setAnswers([]);
      setCurrentIndex(0);
      setScoreData(null);
      setPhase('drill');
      if (settings.timePerQ !== 'No limit') {
        startCountdown();
      }
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (phase === 'drill' && isExpired && !isScoring && !scoreData) {
      handleSubmitAnswer(true);
    }
  }, [isExpired, phase, isScoring, scoreData]); // eslint-disable-line

  const handleSubmitAnswer = async (timedOut = false) => {
    pauseCountdown();
    const finalAns = currentAnswer || (timedOut ? "(Ran out of time)" : "(Skipped)");
    setIsScoring(true);

    const prompt = `Score this interview answer for a ${setupData.level} ${setupData.role} position.
Question: ${questions[currentIndex]}
Answer: ${finalAns}
Output EXACTLY:
SCORE: [1-10]
KEY_INSIGHT: [one specific improvement in 15 words max]`;

    try {
      let score = 0;
      let insight = 'Try to be more specific and data-driven.';
      
      if (finalAns !== '(Skipped)' && finalAns !== '(Ran out of time)' && finalAns.trim() !== '') {
        const resp = await callClaude(prompt, "Score this.");
        const scoreMatch = resp.match(/SCORE:\s*(\d+)/i);
        if (scoreMatch) score = parseInt(scoreMatch[1], 10);
        
        const insightMatch = resp.match(/KEY_INSIGHT:\s*(.*)/i);
        if (insightMatch) insight = insightMatch[1].trim();
      } else {
        score = 0;
        insight = 'No answer provided. In an interview, silence is an automatic failure. Always attempt to answer.';
      }

      const resObj = { q: questions[currentIndex], a: finalAns, score, insight, timedOut };
      setScoreData(resObj);
      setAnswers(prev => [...prev, resObj]);
      
      setTimeout(() => {
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(curr => curr + 1);
          setCurrentAnswer('');
          setScoreData(null);
          if (settings.timePerQ !== 'No limit') startCountdown(); 
        } else {
          setPhase('report');
        }
      }, 3000);

    } catch (e) {
      toast.show(e.message, 'error');
      setIsScoring(false);
      if (currentIndex < questions.length - 1) {
          setCurrentIndex(curr => curr + 1);
          setCurrentAnswer('');
          setScoreData(null);
          if (settings.timePerQ !== 'No limit') startCountdown();
      } else {
          setPhase('report');
      }
    }
  };

  if (phase === 'setup') {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto' }}>
        <div className="aria-card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 64, marginBottom: 16, animation: 'pulseGlow 2s infinite', color: 'var(--red)' }}>🔥</div>
          <h2 style={{ fontSize: 32, marginBottom: 8, color: 'var(--red)', letterSpacing: 2 }}>RAPID FIRE DRILL</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 48 }}>
            High-pressure, timed simulation to build muscle memory under stress. Complete answers before the clock expires.
          </p>

          <div style={{ display: 'grid', gap: 24, textAlign: 'left', marginBottom: 48, background: 'var(--bg-raised)', padding: 24, borderRadius: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>TARGET CATEGORY</label>
              <select className="aria-input" value={settings.category} onChange={e=>setSettings({...settings, category: e.target.value})} style={{ width: '100%' }}>
                {['All', 'Behavioral', 'Leadership', 'Technical', 'Culture', 'Situational', 'Weakness', 'Curveball'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>QUESTIONS</label>
                <select className="aria-input" value={settings.count} onChange={e=>setSettings({...settings, count: parseInt(e.target.value, 10)})} style={{ width: '100%' }}>
                  <option value={5}>5 Questions (Sprint)</option>
                  <option value={10}>10 Questions (Standard)</option>
                  <option value={15}>15 Questions (Endurance)</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>TIME LIMIT PER Q</label>
                <select className="aria-input" value={settings.timePerQ} onChange={e=>setSettings({...settings, timePerQ: e.target.value === 'No limit' ? 'No limit' : parseInt(e.target.value, 10)})} style={{ width: '100%' }}>
                  <option value={30}>30s (Brutal)</option>
                  <option value={60}>60s (Standard)</option>
                  <option value={90}>90s (Thorough)</option>
                  <option value="No limit">No limit</option>
                </select>
              </div>
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%', background: 'var(--red)', color: '#fff', padding: 20, fontSize: 18, border: 'none' }} onClick={handleStart} disabled={isGenerating}>
            {isGenerating ? 'Generating Drill Circuit...' : 'COMMENCE DRILL'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'drill') {
    return (
      <div style={{ maxWidth: 800, margin: '20px auto', position: 'relative' }}>
        
        {/* Top Header Row with Timer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{ padding: '8px 16px', background: 'var(--bg-raised)', borderRadius: 20, fontSize: 14, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>Q{currentIndex + 1} OF {questions.length}</span>
            <span style={{ padding: '8px 16px', background: 'var(--bg-raised)', borderRadius: 20, fontSize: 14, color: 'var(--cyan)', fontFamily: 'JetBrains Mono' }}>{settings.category}</span>
          </div>

          {settings.timePerQ !== 'No limit' && !scoreData && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 32, fontWeight: 'bold', fontFamily: 'JetBrains Mono', color: remaining <= 10 ? 'var(--red)' : remaining <= 20 ? 'var(--yellow)' : 'var(--green)' }}>
                00:{remaining.toString().padStart(2, '0')}
              </span>
              <svg width="48" height="48" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border-dim)" strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none" 
                  stroke={remaining <= 10 ? 'var(--red)' : remaining <= 20 ? 'var(--yellow)' : 'var(--green)'} 
                  strokeWidth="4" 
                  strokeDasharray="125.6" 
                  strokeDashoffset={Math.max(0, 125.6 - (remaining / (parseInt(settings.timePerQ)||1)) * 125.6)} 
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease' }}
                />
              </svg>
            </div>
          )}
        </div>

        <div className="aria-card" style={{ marginBottom: 24, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-dim)' }}>
          <h2 style={{ fontSize: 28, textAlign: 'center', lineHeight: 1.5, letterSpacing: -0.5 }}>"{questions[currentIndex]}"</h2>
        </div>

        {scoreData ? (
          <div className="aria-card" style={{ textAlign: 'center', animation: 'fadeSlideUp 0.3s ease', padding: 48, background: 'var(--bg-raised)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
              <ScoreRing score={scoreData.score} size={120} animated={true} />
              <div style={{ fontSize: 18, color: 'var(--text-primary)', fontStyle: 'italic', maxWidth: '80%' }}>"{scoreData.insight}"</div>
              <div style={{ fontSize: 12, color: 'var(--cyan)', marginTop: 16, animation: 'pulseGlow 1s infinite' }}>Loading Next Target...</div>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', animation: 'fadeSlideIn 0.3s ease' }}>
            <textarea 
              className="aria-input" value={currentAnswer} onChange={e=>setCurrentAnswer(e.target.value)}
              placeholder="Type your answer rapidly..." style={{ height: 250, resize: 'none', marginBottom: 24, fontSize: 18, lineHeight: 1.6, width: '100%' }}
              disabled={isScoring}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn-ghost" onClick={() => handleSubmitAnswer(false)} disabled={isScoring} style={{ padding: '12px 24px' }}>Force Skip</button>
              <button className="btn-primary" onClick={() => handleSubmitAnswer(false)} disabled={isScoring || !currentAnswer.trim()} style={{ padding: '12px 32px' }}>
                {isScoring ? 'Scoring...' : 'Submit Answer'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Report Phase
  const avgScore = answers.reduce((a, b) => a + b.score, 0) / (answers.length || 1);
  const weakest = [...answers].sort((a,b) => a.score - b.score)[0];

  return (
    <div style={{ maxWidth: 900, margin: '20px auto', animation: 'fadeSlideUp 0.4s ease forwards' }}>
      <div className="aria-card" style={{ textAlign: 'center', marginBottom: 32, padding: '48px 24px' }}>
        <h1 style={{ fontSize: 36, marginBottom: 32, color: 'var(--cyan)', letterSpacing: 4 }}>DRILL COMPLETE</h1>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 48 }}>
          <ScoreRing score={avgScore.toFixed(1)} size={180} animated={true} label="AVG SCORE" />
        </div>
        
        {weakest && weakest.score < 10 && (
          <div style={{ background: 'var(--red-dim)', border: '1px solid var(--red)', padding: 24, borderRadius: 12, textAlign: 'left', marginBottom: 32, maxWidth: 600, margin: '0 auto' }}>
            <div style={{ color: 'var(--red)', fontSize: 12, fontWeight: 'bold', marginBottom: 12, letterSpacing: 1 }}>CRITICAL WEAKNESS DETECTED</div>
            <div style={{ color: '#fff', fontSize: 16, marginBottom: 12, lineHeight: 1.5 }}>"{weakest.q}"</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, fontStyle: 'italic' }}>AI Insight: {weakest.insight}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32 }}>
          <button className="btn-primary" onClick={() => { setPhase('setup'); setAnswers([]); }}>Execute Another Drill</button>
          {answers.some(a => a.score < 7) && (
            <button className="btn-ghost" onClick={() => {
              const weakQs = answers.filter(a => a.score < 7).map(a => a.q);
              setQuestions(weakQs);
              setAnswers([]);
              setCurrentIndex(0);
              setScoreData(null);
              setPhase('drill');
              if (settings.timePerQ !== 'No limit') startCountdown();
            }}>Retry Weak Questions ({answers.filter(a => a.score < 7).length})</button>
          )}
        </div>
      </div>

      <div className="aria-card">
        <h3 style={{ marginBottom: 24, fontSize: 20 }}>Performance Breakdown</h3>
        <div style={{ display: 'flex', gap: 8, height: 100, alignItems: 'flex-end', marginBottom: 32, paddingBottom: 16, borderBottom: '1px solid var(--border-dim)' }}>
          {answers.map((ans, i) => (
            <div key={`bar-${i}`} style={{ flex: 1, backgroundColor: ans.score >= 8 ? 'var(--green)' : ans.score >= 5 ? 'var(--yellow)' : 'var(--red)', height: `${Math.max(5, (ans.score/10)*100)}%`, transition: 'height 1s ease', borderRadius: '4px 4px 0 0', position: 'relative' }} title={`Q${i+1}: ${ans.score}/10`}>
               <div style={{ position: 'absolute', top: -18, width: '100%', textAlign: 'center', fontSize: 10, color: 'var(--text-secondary)' }}>{ans.score}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {answers.map((ans, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 20, padding: 20, background: 'var(--bg-raised)', borderRadius: 8, borderLeft: `3px solid ${ans.score >= 8 ? 'var(--green)' : ans.score >= 5 ? 'var(--yellow)' : 'var(--red)'}` }}>
              <div style={{ color: ans.score >= 8 ? 'var(--green)' : ans.score >= 5 ? 'var(--yellow)' : 'var(--red)', fontWeight: 'bold', fontSize: 24, minWidth: 60, textAlign: 'center' }}>
                {ans.score}/10
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', marginBottom: 8, fontSize: 16, lineHeight: 1.4 }}>{ans.q}</div>
                {ans.timedOut ? (
                  <div style={{ color: 'var(--red)', fontSize: 13 }}>Failed to answer in time limit.</div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{ans.insight}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default RapidFire;
