// ════════════════════════════════
// FILE: src/components/Setup/SetupScreen.jsx
// ════════════════════════════════

import React, { useState, useEffect } from 'react';

const SetupScreen = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [returningUser, setReturningUser] = useState(false);
  const [data, setData] = useState({
    name: '',
    role: '',
    company: '',
    level: 'Mid-Level',
    type: 'Behavioral',
    style: 'Strategic',
    resume: '',
    jd: ''
  });

  useEffect(() => {
    const cached = localStorage.getItem('aria_setup');
    if (cached) {
      setReturningUser(true);
      setData(JSON.parse(cached));
    }
  }, []);

  const handleChange = (field, val) => {
    setData(prev => ({ ...prev, [field]: val }));
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
      <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>{label}</label>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => handleChange(fieldKey, opt)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 14,
              border: `1px solid ${currentVal === opt ? 'var(--cyan)' : 'var(--border-dim)'}`,
              background: currentVal === opt ? 'rgba(0, 240, 255, 0.1)' : 'transparent',
              color: currentVal === opt ? 'var(--cyan)' : 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontFamily: 'JetBrains Mono'
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  if (returningUser) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-base)', padding: 24 }}>
        <div className="aria-card" style={{ maxWidth: 500, width: '100%', textAlign: 'center', animation: 'fadeSlideUp 0.4s ease forwards' }}>
          <svg style={{ width: 48, height: 48, fill: 'var(--cyan)', marginBottom: 24 }} viewBox="0 0 24 24">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/>
          </svg>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Welcome back, {data.name}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Targeting {data.level} {data.role} {data.company ? `at ${data.company}` : ''}</p>
          
          <div style={{ display: 'flex', gap: 16 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setReturningUser(false); setStep(1); }}>
              Edit Profile
            </button>
            <button className="btn-primary" style={{ flex: 2 }} onClick={() => onComplete(data)}>
              Launch Copilot
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-base)' }}>
      {/* Left Panel - Visuals */}
      <div style={{ flex: 1, borderRight: '1px solid var(--border-dim)', position: 'relative', overflow: 'hidden', display: 'none' }} className="setup-visuals">
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(circle at 50% 50%, rgba(0, 240, 255, 0.05) 0%, transparent 70%)' }}></div>
        {/* CSS Radar sweep animation representation */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', width: 600, height: 600, transform: 'translate(-50%, -50%)', border: '1px solid rgba(0,240,255,0.1)', borderRadius: '50%' }}>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 400, height: 400, transform: 'translate(-50%, -50%)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 200, height: 200, transform: 'translate(-50%, -50%)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '50%' }}></div>
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: '50%', height: 2, background: 'linear-gradient(90deg, transparent, var(--cyan))', transformOrigin: 'left center', animation: 'radarSweep 4s linear infinite' }}></div>
        </div>
        <div style={{ position: 'absolute', bottom: 48, left: 48 }}>
          <svg style={{ width: 40, height: 40, fill: 'var(--cyan)' }} viewBox="0 0 24 24">
            <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/>
          </svg>
          <h1 style={{ fontSize: 48, letterSpacing: -1, marginTop: 16 }}>ARIA</h1>
          <p style={{ color: 'var(--cyan)', letterSpacing: 4, fontSize: 13 }}>TACTICAL INTERVIEW ENGINE</p>
        </div>
      </div>
      
      {/* Dynamic inline styles for responsive layout */}
      <style>{`
        @media(min-width: 900px) {
          .setup-visuals { display: block !important; }
        }
      `}</style>

      {/* Right Panel - Form */}
      <div style={{ flex: 1.2, padding: '48px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', animation: 'fadeSlideUp 0.4s ease forwards' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'JetBrains Mono' }}>STEP {step} OF 2</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 40, height: 4, background: step >= 1 ? 'var(--cyan)' : 'var(--border-dim)', borderRadius: 2, transition: 'background 0.3s' }}></div>
              <div style={{ width: 40, height: 4, background: step >= 2 ? 'var(--cyan)' : 'var(--border-dim)', borderRadius: 2, transition: 'background 0.3s' }}></div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div style={{ animation: 'fadeSlideIn 0.3s ease' }}>
                <h2 style={{ fontSize: 32, marginBottom: 8, letterSpacing: -0.5 }}>Initialize Profile</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Configure the engine for your specific target.</p>
                
                <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>CANDIDATE NAME *</label>
                    <input className="aria-input" value={data.name} onChange={e=>handleChange('name', e.target.value)} placeholder="John Doe" required />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>TARGET ORGANIZATION</label>
                    <input className="aria-input" value={data.company} onChange={e=>handleChange('company', e.target.value)} placeholder="Stripe, Google, etc." />
                  </div>
                </div>

                <div style={{ marginBottom: 32 }}>
                  <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>TARGET ROLE *</label>
                  <input className="aria-input" value={data.role} onChange={e=>handleChange('role', e.target.value)} placeholder="Senior Product Manager" required />
                </div>

                {renderPillGroup("SENIORITY LEVEL", data.level, ["Entry-Level", "Mid-Level", "Senior", "Staff/Principal", "Director+"], "level")}
                {renderPillGroup("INTERVIEW TACTIC (DEFAULT)", data.type, ["Behavioral", "Technical", "Case Study", "System Design"], "type")}
                {renderPillGroup("ARIA RESPONSE STYLE", data.style, ["Strategic (STAR)", "Direct & Concise", "Visionary", "Data-Driven"], "style")}

                <button type="button" className="btn-primary" style={{ width: '100%', marginTop: 24, padding: 16 }} onClick={() => setStep(2)} disabled={!isStep1Valid}>
                  Continue to Context Map →
                </button>
              </div>
            )}

            {step === 2 && (
              <div style={{ animation: 'fadeSlideIn 0.3s ease' }}>
                <h2 style={{ fontSize: 32, marginBottom: 8, letterSpacing: -0.5 }}>Context Mapping</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 40 }}>Seed the engine with your DNA and the objective.</p>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>YOUR RESUME / BIO</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>OPTIONAL</span>
                  </label>
                  <textarea className="aria-input" value={data.resume} onChange={e=>handleChange('resume', e.target.value)} placeholder="Paste your resume text here to allow ARIA to draw from your actual experience..." rows={8} style={{ resize: 'vertical' }} />
                </div>

                <div style={{ marginBottom: 40 }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>TARGET JOB DESCRIPTION</span>
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>OPTIONAL</span>
                  </label>
                  <textarea className="aria-input" value={data.jd} onChange={e=>handleChange('jd', e.target.value)} placeholder="Paste the job description so ARIA can map answers to their exact needs..." rows={8} style={{ resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 16 }}>
                  <button type="button" className="btn-ghost" style={{ flex: 1, padding: 16 }} onClick={() => setStep(1)}>
                    ← Back
                  </button>
                  <button type="submit" className="btn-primary" style={{ flex: 2, padding: 16 }}>
                    BOOT ARIA ENGINE
                  </button>
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
