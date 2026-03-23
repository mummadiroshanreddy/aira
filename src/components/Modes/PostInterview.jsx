// ════════════════════════════════
// FILE: src/components/Modes/PostInterview.jsx
// ════════════════════════════════

import React, { useState, useContext } from 'react';
import { callClaude } from '../../api/claude';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const PostInterview = () => {
  const { setupData } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('thankyou'); // thankyou, rejection
  
  // Thank You State
  const [tyNotes, setTyNotes] = useState('');
  const [tyInterviewers, setTyInterviewers] = useState('');
  const [tyDraft, setTyDraft] = useState('');
  const [isGeneratingTy, setIsGeneratingTy] = useState(false);

  // Rejection State
  const [rejFeedback, setRejFeedback] = useState('');
  const [rejPlan, setRejPlan] = useState(null);
  const [isGeneratingRej, setIsGeneratingRej] = useState(false);

  const generateThankYou = async () => {
    setIsGeneratingTy(true);
    const prompt = `Write a high-end, strategic post-interview thank you email.
Company: ${setupData.company}
Role: ${setupData.role}
Interviewers: ${tyInterviewers || 'Hiring Manager'}
Key topics discussed: ${tyNotes}

Requirements:
- Under 150 words.
- Warm but extremely professional and confident (not desperate).
- Highlight ONE specific thing discussed to prove active listening.
- Reiterate ONE brief value prop matching their pain point.
- Output ONLY the subject line and email body. No pleasantries like "Here is the email:".`;

    try {
      const resp = await callClaude(prompt, "Draft email.");
      setTyDraft(resp);
      toast.show('Thank you note drafted', 'success');
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setIsGeneratingTy(false);
    }
  };

  const generateRecovery = async () => {
    setIsGeneratingRej(true);
    setRejPlan(null);
    const prompt = `The candidate (${setupData.level} ${setupData.role}) was rejected from ${setupData.company}.
Feedback provided by recruiter/company: ${rejFeedback || 'Standard generic rejection'}

Create a ruthless Rejection Recovery Plan. Output EXACTLY these sections with exact headers:
🩹 FEEDBACK DECODED
[Translate what their feedback ACTUALLY means in recruiter-speak]

📧 GRACEFUL EXIT EMAIL
Subject: [subject line]
[Draft a classy reply that keeps the door open for future roles — NOT desperate]

📈 SKILL GAP ASSIGNMENT
[If there's a skill gap, what 1-2 projects should they build to fix it]

🚀 NEXT 3 MOVES
[Tactical next steps for their job search this week]`;

    try {
      const resp = await callClaude(prompt, "Analyze rejection.");
      
      const sections = {};
      const parts = resp.split(/(?=🩹|📧|📈|🚀)/g).map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        const headerEnd = p.indexOf('\n');
        const header = headerEnd > -1 ? p.substring(0, headerEnd).trim() : p.trim();
        const content = headerEnd > -1 ? p.substring(headerEnd).trim() : '';
        if(header.includes('🩹')) sections.decoded = content;
        if(header.includes('📧')) sections.email = content;
        if(header.includes('📈')) sections.gap = content;
        if(header.includes('🚀')) sections.moves = content;
      });
      
      setRejPlan(sections);
      toast.show('Recovery plan compiled', 'success');
    } catch (e) {
      toast.show(e.message, 'error');
    } finally {
      setIsGeneratingRej(false);
    }
  };

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      
      <div style={{ display: 'flex', gap: 16, marginBottom: 32, borderBottom: '1px solid var(--border-dim)', paddingBottom: 16 }}>
        <button 
          onClick={() => setActiveTab('thankyou')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', fontSize: 16, cursor: 'pointer',
            color: activeTab === 'thankyou' ? 'var(--cyan)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'thankyou' ? 'bold' : 'normal',
            borderBottom: activeTab === 'thankyou' ? '2px solid var(--cyan)' : '2px solid transparent',
            marginBottom: -17
          }}
        >
          Thank You Engine
        </button>
        <button 
          onClick={() => setActiveTab('rejection')}
          style={{ 
            background: 'none', border: 'none', padding: '8px 16px', fontSize: 16, cursor: 'pointer',
            color: activeTab === 'rejection' ? 'var(--purple)' : 'var(--text-secondary)',
            fontWeight: activeTab === 'rejection' ? 'bold' : 'normal',
            borderBottom: activeTab === 'rejection' ? '2px solid var(--purple)' : '2px solid transparent',
            marginBottom: -17
          }}
        >
          Rejection Recovery
        </button>
      </div>

      {activeTab === 'thankyou' && (
        <div style={{ display: 'flex', gap: 32, animation: 'fadeSlideUp 0.3s ease' }}>
          
          <div className="aria-card" style={{ flex: 1, position: 'sticky', top: 80, height: 'max-content' }}>
            <h2 style={{ fontSize: 18, marginBottom: 24, color: 'var(--cyan)' }}>Data Input</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>INTERVIEWER NAMES/TITLES</label>
                <input className="aria-input" value={tyInterviewers} onChange={e=>setTyInterviewers(e.target.value)} placeholder="e.g. Sarah (VP Eng), John (CTO)" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>KEY MEMORABLE MOMENT / TOPICS</label>
                <textarea className="aria-input" value={tyNotes} onChange={e=>setTyNotes(e.target.value)} rows={4} style={{ width: '100%', resize: 'none' }} placeholder="Discussed the Q3 roadmap, bonded over mutual hate for microservices..." />
              </div>
              <button className="btn-primary" onClick={generateThankYou} disabled={isGeneratingTy || (!tyNotes && !tyInterviewers)} style={{ marginTop: 8 }}>
                {isGeneratingTy ? 'Drafting...' : 'Generate Power Draft'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1.5 }}>
            {!tyDraft && !isGeneratingTy && (
              <div className="aria-card" style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>✉️</div>
                Input interview details to generate a strategic follow-up.
              </div>
            )}

            {isGeneratingTy && (
               <div className="aria-card" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ textAlign: 'center', color: 'var(--cyan)', animation: 'pulseGlow 1.5s infinite' }}>Drafting exact phrasing...</div>
               </div>
            )}

            {tyDraft && !isGeneratingTy && (
              <div className="aria-card" style={{ padding: 32, borderTop: '3px solid var(--cyan)', animation: 'fadeSlideIn 0.3s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginBottom: 16 }}>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => { navigator.clipboard.writeText(tyDraft); toast.show('Copied!', 'success'); }}>📋 Copy Output</button>
                  <a href={`mailto:?subject=Interview Follow Up&body=${encodeURIComponent(tyDraft)}`} target="_blank" rel="noreferrer" className="btn-primary" style={{ padding: '8px 16px', fontSize: 12, textDecoration: 'none' }}>Draft in Mail</a>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 15, color: '#fff' }}>
                  {tyDraft}
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === 'rejection' && (
        <div style={{ display: 'flex', gap: 32, animation: 'fadeSlideUp 0.3s ease' }}>
          
          <div className="aria-card" style={{ flex: 1, position: 'sticky', top: 80, height: 'max-content' }}>
            <h2 style={{ fontSize: 18, marginBottom: 24, color: 'var(--purple)' }}>Rejection Data</h2>
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>FEEDBACK RECEIVED (OR GUESS WHY)</label>
                <textarea className="aria-input" value={rejFeedback} onChange={e=>setRejFeedback(e.target.value)} rows={6} style={{ width: '100%', resize: 'none' }} placeholder="They went with someone with more React Native experience..." />
              </div>
              <button className="btn-primary" onClick={generateRecovery} disabled={isGeneratingRej} style={{ background: 'var(--purple)', color: '#fff', border: 'none', marginTop: 8 }}>
                {isGeneratingRej ? 'Analyzing failure point...' : 'Initiate Recovery Protocol'}
              </button>
            </div>
          </div>

          <div style={{ flex: 1.5 }}>
            {!rejPlan && !isGeneratingRej && (
              <div className="aria-card" style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🩹</div>
                Rejection hurts. Let AI decode the feedback and plot your comeback strategy.
              </div>
            )}

            {isGeneratingRej && (
               <div className="aria-card" style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <div style={{ textAlign: 'center', color: 'var(--purple)', animation: 'pulseGlow 1.5s infinite' }}>Decoding HR speak & calculating next moves...</div>
               </div>
            )}

            {rejPlan && !isGeneratingRej && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeSlideIn 0.3s ease' }}>
                <div className="aria-card" style={{ borderLeft: '3px solid var(--red)' }}>
                  <h3 style={{ fontSize: 13, color: 'var(--red)', marginBottom: 12, letterSpacing: 1 }}>🩹 FEEDBACK DECODED</h3>
                  <div style={{ color: '#fff', lineHeight: 1.6, fontSize: 15 }}>{rejPlan.decoded}</div>
                </div>

                <div className="aria-card" style={{ borderLeft: '3px solid var(--cyan)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 13, color: 'var(--cyan)', letterSpacing: 1 }}>📧 GRACEFUL EXIT EMAIL</h3>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { navigator.clipboard.writeText(rejPlan.email); toast.show('Copied!', 'success'); }}>Copy Email</button>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 14, whiteSpace: 'pre-wrap' }}>{rejPlan.email}</div>
                </div>

                <div className="aria-card" style={{ borderLeft: '3px solid var(--orange)' }}>
                  <h3 style={{ fontSize: 13, color: 'var(--orange)', marginBottom: 12, letterSpacing: 1 }}>📈 SKILL GAP ASSIGNMENT</h3>
                  <div style={{ color: '#fff', lineHeight: 1.6, fontSize: 14, whiteSpace: 'pre-wrap' }}>{rejPlan.gap}</div>
                </div>

                <div className="aria-card" style={{ borderLeft: '3px solid var(--purple)' }}>
                  <h3 style={{ fontSize: 13, color: 'var(--purple)', marginBottom: 12, letterSpacing: 1 }}>🚀 NEXT 3 MOVES</h3>
                  <div style={{ color: '#fff', lineHeight: 1.6, fontSize: 14, whiteSpace: 'pre-wrap' }}>{rejPlan.moves}</div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

export default PostInterview;
