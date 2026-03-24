// ════════════════════════════════
// FILE: src/components/Setup/SetupScreen.jsx
// ════════════════════════════════

import React, { useState, useEffect, useRef } from 'react';
import { callClaude } from '../../api/aiProvider';

const SetupScreen = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [returningUser, setReturningUser] = useState(false);
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [data, setData] = useState({
    name: '', role: '', company: '', level: 'Mid-Level',
    type: 'Behavioral', style: 'Strategic', resume: '', resumeSummary: '', jd: '',
    userId: localStorage.getItem('aria_user_id') || 'anonymous'
  });

  useEffect(() => {
    const cached = localStorage.getItem('aria_setup');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setReturningUser(true);
        setData(prev => ({ ...prev, ...parsed }));
      } catch (_) {}
    }
  }, []);

  const handleChange = (field, val) => setData(prev => ({ ...prev, [field]: val }));

  const generateSummary = async (text) => {
    if (!text || text.length < 50) return "";
    try {
      const prompt = `Please provide a 3-sentence summary of this candidate's background, top skills, and key achievements based on this resume text. Formatting: bullet points. \n\n resume text: ${text.slice(0, 4000)}`;
      const system = "You are an expert technical recruiter summarizing resumes for an interview copilot.";
      const summary = await callClaude(system, prompt);
      return summary;
    } catch (e) {
      console.warn("Summary generation failed:", e);
      return text.slice(0, 500) + "...";
    }
  };

  const handleResumeFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeUploading(true);
    setResumeFileName(file.name);

    let text = "";

    try {
      const formData = new FormData();
      formData.append('resume', file);
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = process.env.REACT_APP_SERVER_URL
        ? `${process.env.REACT_APP_SERVER_URL}/api`
        : isLocal
          ? 'http://localhost:3001/api'
          : `${window.location.protocol}//${window.location.hostname}:3001/api`;

      const res = await fetch(`${apiUrl}/parse-resume`, { method: 'POST', body: formData });
      if (res.ok) {
        const result = await res.json();
        text = result.text || "";
      }
    } catch (_) {}

    // Client-side fallback for .txt if server fails or is txt
    if (!text && (file.type === 'text/plain' || file.name.endsWith('.txt'))) {
      text = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(evt.target.result || '');
        reader.readAsText(file);
      });
    }

    if (text) {
      handleChange('resume', text);
      const summary = await generateSummary(text);
      handleChange('resumeSummary', summary);
    } else if (!text && file.name.match(/\.(pdf|docx)$/i)) {
      handleChange('resume', `[${file.name} uploaded — please paste highlights below]`);
    }
    
    setResumeUploading(false);
  };

  const isStep1Valid = data.name.trim() !== '' && data.role.trim() !== '';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isStep1Valid) return;
    localStorage.setItem('aria_setup', JSON.stringify(data));
    onComplete(data);
  };

  const renderPillGroup = (label, currentVal, options, fieldKey) => (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>{label}</label>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => handleChange(fieldKey, opt)}
            style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
              border: `1px solid ${currentVal === opt ? 'var(--cyan)' : 'var(--border-dim)'}`,
              background: currentVal === opt ? 'rgba(0,240,255,0.1)' : 'transparent',
              color: currentVal === opt ? 'var(--cyan)' : 'var(--text-primary)'
            }}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  if (returningUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 24 }}>
        <div className="aria-card" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Welcome back, {data.name}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Targeting {data.level} {data.role}{data.company ? ` at ${data.company}` : ''}</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setReturningUser(false); setStep(1); }}>Edit Profile</button>
            <button className="btn-primary" style={{ flex: 2 }} onClick={() => onComplete(data)}>Launch Copilot</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--bg-base)' }}>
      <div style={{ flex: 1, padding: '64px 48px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono' }}>ARIA SETUP — STEP {step} OF 2</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 40, height: 4, background: step >= 1 ? 'var(--cyan)' : 'var(--border-dim)', borderRadius: 2, transition: 'background 0.3s' }} />
              <div style={{ width: 40, height: 4, background: step >= 2 ? 'var(--cyan)' : 'var(--border-dim)', borderRadius: 2, transition: 'background 0.3s' }} />
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div>
                <h2 style={{ fontSize: 32, marginBottom: 8 }}>Initialize Profile</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Configure the engine for your specific target.</p>

                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>CANDIDATE NAME *</label>
                    <input className="aria-input" value={data.name} onChange={e => handleChange('name', e.target.value)} placeholder="John Doe" required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>TARGET COMPANY</label>
                    <input className="aria-input" value={data.company} onChange={e => handleChange('company', e.target.value)} placeholder="Google, Stripe..." />
                  </div>
                </div>

                <div style={{ marginBottom: 32 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>TARGET ROLE *</label>
                  <input className="aria-input" value={data.role} onChange={e => handleChange('role', e.target.value)} placeholder="Senior Product Manager" required />
                </div>

                {renderPillGroup("SENIORITY LEVEL", data.level, ["Entry-Level", "Mid-Level", "Senior", "Staff/Principal", "Director+"], "level")}
                {renderPillGroup("INTERVIEW TYPE", data.type, ["Behavioral", "Technical", "Case Study", "System Design"], "type")}
                {renderPillGroup("ARIA STYLE", data.style, ["Strategic (STAR)", "Direct & Concise", "Visionary", "Data-Driven"], "style")}

                <button type="button" className="btn-primary" style={{ width: '100%', marginTop: 24, padding: 16 }} onClick={() => setStep(2)} disabled={!isStep1Valid}>
                  Continue →
                </button>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 style={{ fontSize: 32, marginBottom: 8 }}>Context Mapping</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Seed the engine with your DNA and the objective.</p>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>RESUME / BIO <span style={{ color: 'var(--text-dim)' }}>(OPTIONAL)</span></label>
                  <input ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx" onChange={handleResumeFile} style={{ display: 'none' }} />
                  <div onClick={() => fileInputRef.current?.click()} style={{ border: '1px dashed var(--border-dim)', borderRadius: 8, padding: '12px 16px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, background: resumeFileName ? 'rgba(0,240,255,0.05)' : 'transparent', color: resumeFileName ? 'var(--cyan)' : 'var(--text-dim)', fontSize: 13, fontFamily: 'JetBrains Mono', transition: 'all 0.2s' }}>
                    <span>{resumeUploading ? '⏳' : resumeFileName ? '📄' : '📎'}</span>
                    <span style={{ flex: 1 }}>{resumeUploading ? 'Parsing & Summarizing DNA...' : resumeFileName ? `Source: ${resumeFileName}` : 'Upload resume (.txt, .pdf, .docx)'}</span>
                    {data.resumeSummary && !resumeUploading && <span style={{ fontSize: 9, background: 'rgba(74,222,128,0.1)', color: 'var(--green)', padding: '2px 8px', borderRadius: 10 }}>Summary Generated ✨</span>}
                    {resumeFileName && (
                      <span onClick={e => { e.stopPropagation(); setResumeFileName(''); handleChange('resume', ''); handleChange('resumeSummary', ''); }} style={{ marginLeft: 10, color: 'var(--red)', cursor: 'pointer' }}>✕</span>
                    )}
                  </div>
                  <textarea className="aria-input" value={data.resume} onChange={e => handleChange('resume', e.target.value)} placeholder="Or paste your resume highlights here..." rows={5} style={{ resize: 'vertical' }} />
                </div>

                <div style={{ marginBottom: 40 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>JOB DESCRIPTION <span style={{ color: 'var(--text-dim)' }}>(OPTIONAL)</span></label>
                  <textarea className="aria-input" value={data.jd} onChange={e => handleChange('jd', e.target.value)} placeholder="Paste the JD so ARIA maps answers to their exact needs..." rows={6} style={{ resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <button type="button" className="btn-ghost" style={{ flex: 1, padding: 16 }} onClick={() => setStep(1)}>← Back</button>
                  <button type="submit" className="btn-primary" style={{ flex: 2, padding: 16 }}>BOOT ARIA ENGINE</button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default SetupScreen;
