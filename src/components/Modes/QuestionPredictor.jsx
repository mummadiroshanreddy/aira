// ════════════════════════════════
// FILE: src/components/Modes/QuestionPredictor.jsx
// ════════════════════════════════

import React, { useState, useContext } from 'react';
import { callClaude } from '../../api/claude';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const QuestionPredictor = () => {
  const { setupData } = useContext(AppContext);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [mustPrep, setMustPrep] = useState([]);
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const handlePredict = async () => {
    setIsGenerating(true);
    setQuestions([]);
    setMustPrep([]);

    const prompt = `You are an expert interviewer who has conducted 10,000+ interviews at top companies. 
Based on this job description and candidate background, predict exactly what they'll be asked.

Candidate DNA: ${setupData.resume}
Target Role: ${setupData.role} at ${setupData.company || 'a top tier company'}
Job Description: ${setupData.jd || 'General best practices apply'}

Output EXACTLY 15 questions in this format:
Q1|[question text]|[Behavioral/Technical/Culture/Situational/Curveball/Trap]|[Easy/Medium/Hard/Trap]|[probability 1-100]|[why they ask this]
Q2|...
...Q15

Then on a new line:
MUSTPREP: Q2,Q5,Q9
(the 3 question numbers most critical to nail)`;

    try {
      const resp = await callClaude(prompt, "Predict questions.");
      
      const lines = resp.split('\n').map(l => l.trim()).filter(Boolean);
      const qList = [];
      let mPrep = [];

      lines.forEach(line => {
        if (line.startsWith('MUSTPREP:')) {
          mPrep = line.replace('MUSTPREP:', '').split(',').map(s => s.trim());
        } else if (line.match(/^Q\d+\|/)) {
          const parts = line.split('|');
          if (parts.length >= 6) {
            qList.push({
              id: parts[0].trim(),
              text: parts[1].trim(),
              category: parts[2].trim(),
              difficulty: parts[3].trim(),
              probability: parseInt(parts[4], 10) || 50,
              why: parts[5].trim(),
              practiced: false
            });
          }
        }
      });
      
      setQuestions(qList);
      setMustPrep(mPrep);
      toast.show('15 high-probability questions generated', 'success');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePractice = (id, e) => {
    e.stopPropagation(); // prevent expansion
    setQuestions(q => q.map(item => item.id === id ? { ...item, practiced: !item.practiced } : item));
  };

  const filtered = questions.filter(q => {
    if (filter === 'All') return true;
    if (filter === 'Trap' && (q.category === 'Trap' || q.category === 'Curveball' || q.difficulty === 'Trap')) return true;
    return q.category.includes(filter);
  });

  const practicedCount = questions.filter(q => q.practiced).length;
  
  const getDiffColor = (d) => {
    if (d === 'Easy') return 'var(--green)';
    if (d === 'Hard') return 'var(--red)';
    if (d === 'Trap') return 'var(--purple)';
    return 'var(--yellow)';
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, marginBottom: 8 }}>Question Predictor</h2>
          <div style={{ color: 'var(--text-secondary)' }}>Predicts the exact questions you will face based on JD and DNA.</div>
        </div>
        
        <button className="btn-primary" onClick={handlePredict} disabled={isGenerating}>
          {isGenerating ? 'Running Prediction Model...' : (questions.length > 0 ? 'Regenerate Predictions' : 'Predict My Interview')}
        </button>
      </div>

      {questions.length > 0 && (
        <div style={{ marginBottom: 24, padding: 24, background: 'var(--bg-raised)', borderRadius: 12, border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 12, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>
            <span>PREP COMPLETION PROGRESS</span>
            <span style={{ color: 'var(--cyan)' }}>{Math.round((practicedCount/questions.length)*100)}% ({practicedCount} / {questions.length})</span>
          </div>
          <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${(practicedCount/questions.length)*100}%`, height: '100%', background: 'linear-gradient(90deg, #00f0ff, #0088ff)', borderRadius: 4, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {questions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {['All', 'Behavioral', 'Technical', 'Culture', 'Situational', 'Trap'].map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--cyan)' : 'transparent',
                color: filter === f ? '#000' : 'var(--text-secondary)',
                border: `1px solid ${filter === f ? 'var(--cyan)' : 'var(--border-dim)'}`,
                padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontFamily: 'JetBrains Mono',
                transition: 'all 0.2s'
              }}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {isGenerating && (
        <div className="aria-card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--cyan)', animation: 'pulseGlow 1.5s infinite', padding: 20, borderRadius: '50%' }}>
             <div style={{ fontSize: 40, marginBottom: 16 }}>🔮</div>
             Analyzing JD patterns against millions of interview data points...
          </div>
        </div>
      )}

      {!isGenerating && questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((q, i) => {
            const isMust = mustPrep.includes(q.id);
            const isExpanded = expandedId === q.id;
            return (
              <div 
                key={q.id} 
                className="aria-card" 
                onClick={() => setExpandedId(isExpanded ? null : q.id)}
                style={{ 
                   padding: 20, 
                   borderLeft: isMust ? '3px solid var(--yellow)' : '1px solid var(--border-dim)', 
                   opacity: q.practiced ? 0.6 : 1, 
                   transition: 'all 0.2s', 
                   animation: `fadeSlideUp 0.3s ease ${i*0.05}s forwards`,
                   cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <input type="checkbox" checked={q.practiced} onChange={(e) => togglePractice(q.id, e)} style={{ marginTop: 4, width: 18, height: 18, accentColor: 'var(--cyan)', cursor: 'pointer' }} />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 16, color: '#fff', flex: 1, paddingRight: 16, lineHeight: 1.4 }}>
                        {isMust && <span style={{ color: 'var(--yellow)', marginRight: 8 }} title="Must Prep">⭐</span>}
                        {q.text}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-raised)', borderRadius: 4, color: 'var(--text-secondary)' }}>
                          {q.category}
                        </div>
                        <div style={{ fontSize: 11, padding: '4px 8px', background: 'var(--bg-raised)', borderRadius: 4, color: getDiffColor(q.difficulty) }}>
                          {q.difficulty}
                        </div>
                        <div style={{ width: 60 }}>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2, textAlign: 'right', fontFamily: 'JetBrains Mono' }}>{q.probability}% PROB</div>
                          <div style={{ width: '100%', height: 3, background: 'var(--bg-raised)', borderRadius: 2 }}>
                            <div style={{ width: `${q.probability}%`, height: '100%', background: q.probability > 75 ? 'var(--red)' : 'var(--cyan)', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border-dim)', animation: 'fadeSlideIn 0.2s ease' }} onClick={e=>e.stopPropagation()}>
                        <div style={{ fontSize: 12, color: 'var(--purple)', fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 }}>WHY THEY ASK THIS:</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, fontStyle: 'italic', background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8 }}>
                          "{q.why}"
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button className="btn-primary" style={{ padding: '8px 24px', fontSize: 12 }} onClick={() => {
                            window.dispatchEvent(new CustomEvent('aria_submit', { detail: q.text }));
                            toast.show('Question injected into Live Copilot for practice', 'info');
                          }}>
                            🎯 Practice in Live Copilot
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>No questions match this filter.</div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionPredictor;
