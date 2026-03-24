import React, { useState, useEffect, useRef, useContext } from 'react';
import { AppContext } from '../../App';

const SetupScreen = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [returningUser, setReturningUser] = useState(false);
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const { setupData } = useContext(AppContext);
  const [data, setData] = useState({
    name: '',
    role: '',
    company: '',
    level: 'Mid-Level',
    type: 'Behavioral',
    style: 'Strategic',
    resume: '',
    jd: '',
    userId: setupData?.userId || 'anonymous'
  });

  useEffect(() => {
    if (setupData?.name) {
      setReturningUser(true);
      setData(prev => ({ ...prev, ...setupData }));
    }
  }, [setupData]);

  const handleChange = (field, val) => {
    setData(prev => ({ ...prev, [field]: val }));
  };

  const handleResumeFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeUploading(true);
    setResumeFileName(file.name);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      formData.append('userId', data.userId);

      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const apiUrl = isLocal 
        ? 'http://localhost:3001/api' 
        : `${window.location.protocol}//${window.location.hostname}:3001/api`;

      const res = await fetch(`${apiUrl}/parse-resume`, { method: 'POST', body: formData });

      if (res.ok) {
        const result = await res.json();
        // We store the summary returned by the backend
        handleChange('resume', result.summary || result.text);
        setResumeUploading(false);
        return;
      }
    } catch (_) {
      console.warn("Upload failed, falling back to local reading if possible.");
    }

    // Basic.txt fallback
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        handleChange('resume', evt.target.result || '');
        setResumeUploading(false);
      };
      reader.readAsText(file);
    } else {
      handleChange('resume', `[File: ${file.name} uploaded - parsing handled by server]`);
      setResumeUploading(false);
    }
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
              transition: 'all 0.2s'
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
        <div className="aria-card" style={{ maxWidth: 500, width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>Welcome back, {data.name}</h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Targeting {data.level} {data.role}</p>
          <div style={{ display: 'flex', gap: 16 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => { setReturningUser(false); setStep(1); }}>Edit Profile</button>
            <button className="btn-primary" style={{ flex: 2 }} onClick={() => onComplete(data)}>Launch Copilot</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: 'var(--bg-base)', padding: 48 }}>
      <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 32, marginBottom: 8 }}>{step === 1 ? 'Initialize Profile' : 'Context Mapping'}</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Step {step} of 2</p>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>CANDIDATE NAME *</label>
                <input className="aria-input" value={data.name} onChange={e=>handleChange('name', e.target.value)} required />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>TARGET ROLE *</label>
                <input className="aria-input" value={data.role} onChange={e=>handleChange('role', e.target.value)} required />
              </div>
              {renderPillGroup("SENIORITY LEVEL", data.level, ["Entry-Level", "Mid-Level", "Senior", "Director+"], "level")}
              <button type="button" className="btn-primary" style={{ width: '100%', padding: 16 }} onClick={() => setStep(2)} disabled={!isStep1Valid}>Next Step</button>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>UPLOAD RESUME (.PDF, .DOCX, .TXT)</label>
                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt" onChange={handleResumeFile} style={{ display: 'none' }} />
                <div onClick={() => fileInputRef.current.click()} style={{ border: '1px dashed var(--border-dim)', padding: 20, textAlign: 'center', cursor: 'pointer', borderRadius: 8 }}>
                  {resumeUploading ? 'Summarizing...' : resumeFileName || 'Click to upload resume'}
                </div>
              </div>
              <div style={{ marginBottom: 32 }}>
                <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>TARGET JOB DESCRIPTION (OPTIONAL)</label>
                <textarea className="aria-input" value={data.jd} onChange={e=>handleChange('jd', e.target.value)} rows={6} />
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <button type="button" className="btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>Back</button>
                <button type="submit" className="btn-primary" style={{ flex: 2 }}>Launch ARIA</button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default SetupScreen;
