// ════════════════════════════════
// FILE: src/components/Modes/RapidFire.jsx
// ════════════════════════════════

import React, { useState, useEffect, useContext, useRef } from 'react';
import { streamClaude } from '../../api/claude';
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
  const [liveStreamText, setLiveStreamText] = useState('');

  const { remaining, isExpired, startCountdown, pauseCountdown } = useCountdown(settings.timePerQ);

  const handleStart = async () => {
    setIsGenerating(true);
    setLiveStreamText('');
    const prompt = `Generate exactly ${settings.count} interview questions for a ${setupData.level} ${setupData.role} candidate.
    Category: ${settings.category}. Output only the questions, one per line. No numbers.`;

    try {
      await streamClaude(
        prompt,
        "Start drill circuit.",
        [],
        setupData.userId,
        (chunk) => { setLiveStreamText(prev => prev + chunk); },
        (fullText) => {
          const qs = fullText.split('\n').map(q => q.trim()).filter(Boolean).slice(0, settings.count);
          setQuestions(qs);
          setAnswers([]);
          setCurrentIndex(0);
          setScoreData(null);
          setPhase('drill');
          if (settings.timePerQ !== 'No limit') startCountdown();
          setIsGenerating(false);
        },
        (err) => {
          toast.show(err.message, 'error');
          setIsGenerating(false);
        }
      );
    } catch (e) {
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
    setLiveStreamText('');

    const prompt = `Score this interview answer for a ${setupData.level} ${setupData.role} position.
    Question: ${questions[currentIndex]}
    Answer: ${finalAns}
    Format: SCORE: [1-10] | INSIGHT: [max 15 words]`;

    try {
      if (finalAns === '(Skipped)' || finalAns === '(Ran out of time)') {
        const resObj = { q: questions[currentIndex], a: finalAns, score: 0, insight: 'No answer provided.', timedOut };
        finishScoring(resObj);
        return;
      }

      await streamClaude(
        prompt,
        "Score my response.",
        [],
        setupData.userId,
        (chunk) => { setLiveStreamText(prev => prev + chunk); },
        (fullText) => {
          const scoreMatch = fullText.match(/SCORE:\s*(\d+)/i);
          const insightMatch = fullText.match(/INSIGHT:\s*(.*)/i);
          const score = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
          const insight = insightMatch ? insightMatch[1].trim() : "Improve focus.";
          
          const resObj = { q: questions[currentIndex], a: finalAns, score, insight, timedOut };
          finishScoring(resObj);
        },
        (err) => {
          toast.show(err.message, 'error');
          setIsScoring(false);
        }
      );
    } catch (e) {
      setIsScoring(false);
    }
  };

  const finishScoring = (resObj) => {
    setScoreData(resObj);
    setAnswers(prev => [...prev, resObj]);
    setIsScoring(false);

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
  };

  if (phase === 'setup') {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto' }}>
        <div className="aria-card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--red)' }}>🔥</div>
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>RAPID FIRE DRILL</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Build muscle memory under extreme time pressure.</p>
          
          <div style={{ display: 'grid', gap: 16, textAlign: 'left', marginBottom: 32, padding: 20, background: 'var(--bg-raised)', borderRadius: 12 }}>
            <select className="aria-input" value={settings.category} onChange={e=>setSettings({...settings, category: e.target.value})}>
              {['All', 'Behavioral', 'Technical', 'Situational'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 12 }}>
              <select className="aria-input" value={settings.count} onChange={e=>setSettings({...settings, count: parseInt(e.target.value, 10)})} style={{ flex: 1 }}>
                {[5, 10, 15].map(n => <option key={n} value={n}>{n} Questions</option>)}
              </select>
              <select className="aria-input" value={settings.timePerQ} onChange={e=>setSettings({...settings, timePerQ: e.target.value === 'No limit' ? 'No limit' : parseInt(e.target.value, 10)})} style={{ flex: 1 }}>
                {[30, 60, 90].map(s => <option key={s} value={s}>{s}s Limit</option>)}
                <option value="No limit">No limit</option>
              </select>
            </div>
          </div>

          <button className="btn-primary" style={{ width: '100%', padding: 18 }} onClick={handleStart} disabled={isGenerating}>
            {isGenerating ? 'Priming Drill...' : 'START DRILL'}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'drill') {
    return (
      <div style={{ maxWidth: 800, margin: '20px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>Q{currentIndex + 1} / {questions.length}</div>
          {settings.timePerQ !== 'No limit' && !scoreData && (
             <div style={{ color: remaining < 10 ? 'var(--red)' : 'var(--green)', fontWeight: 'bold' }}>T-MINUS {remaining}s</div>
          )}
        </div>

        <div className="aria-card" style={{ padding: 40, textAlign: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 28 }}>"{questions[currentIndex]}"</h2>
        </div>

        {scoreData ? (
          <div className="aria-card" style={{ textAlign: 'center', padding: 32, animation: 'fadeIn 0.3s' }}>
            <ScoreRing score={scoreData.score} size={80} />
            <div style={{ fontSize: 16, marginTop: 16 }}>{scoreData.insight}</div>
          </div>
        ) : (
          <div>
            <textarea className="aria-input" value={currentAnswer} onChange={e=>setCurrentAnswer(e.target.value)} placeholder="Type now..." style={{ height: 200, marginBottom: 16 }} disabled={isScoring} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn-ghost" onClick={() => handleSubmitAnswer(false)} disabled={isScoring}>Skip</button>
              <button className="btn-primary" onClick={() => handleSubmitAnswer(false)} disabled={isScoring || !currentAnswer.trim()}>
                {isScoring ? 'Analysing...' : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto' }}>
      <div className="aria-card" style={{ textAlign: 'center', padding: 40 }}>
        <h2 style={{ fontSize: 32, color: 'var(--cyan)' }}>CIRCUIT COMPLETE</h2>
        <div style={{ padding: 40 }}><ScoreRing score={(answers.reduce((a,b)=>a+b.score, 0) / answers.length).toFixed(1)} size={150} label="AVG" /></div>
        <button className="btn-primary" onClick={() => setPhase('setup')}>Try Again</button>
      </div>
    </div>
  );
};

export default RapidFire;
