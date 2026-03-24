// ════════════════════════════════
// FILE: src/components/Modes/CompanyIntel.jsx
// ════════════════════════════════

import React, { useState, useContext, useRef } from 'react';
import { streamClaude } from '../../api/aiProvider';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const CompanyIntel = () => {
  const { setupData } = useContext(AppContext);
  const [jd, setJd] = useState(setupData?.jd || '');
  const [company, setCompany] = useState(setupData?.company || '');
  const [role, setRole] = useState(setupData?.role || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [intelText, setIntelText] = useState('');
  const [activeProvider, setActiveProvider] = useState('');

  const scrollRef = useRef(null);

  const handleGenerate = async () => {
    if (!jd || !company) return toast.show('Company and JD are required', 'warning');
    setIsGenerating(true);
    setIntelText('');

    const prompt = `You are a pre-interview intelligence analyst preparing a classified briefing for ${role} at ${company}.
    Job Description: ${jd}
    
    Output exactly these sections:
    🏢 COMPANY DNA
    🎯 HIDDEN PRIORITY
    🔑 POWER KEYWORDS
    📊 STYLE PREDICTIONS
    ⚡ YOUR EDGE
    🚩 RED FLAGS
    📝 PREP LIST`;

    try {
      await streamClaude(
        prompt,
        "Analyze this JD.",
        [],
        setupData.userId,
        (chunk) => {
          setIntelText(prev => prev + chunk);
          scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        },
        (full) => {
          setIsGenerating(false);
          toast.show('Intelligence Profile Ready', 'success');
        },
        (err) => {
          toast.show(err.message, 'error');
          setIsGenerating(false);
        },
        (name) => setActiveProvider(name)
      );
    } catch (err) {
      setIsGenerating(false);
    }
  };

  const sections = intelText.split(/(?=\s*[🏢🎯🔑📊⚡🚩📝])/g).map(s => s.trim()).filter(Boolean);

  const getColor = (char) => {
    const m = { '🏢': 'var(--cyan)', '🎯': 'var(--orange)', '🔑': 'var(--yellow)', '📊': 'var(--purple)', '⚡': 'var(--cyan)', '🚩': 'var(--red)', '📝': 'var(--green)' };
    return m[char] || 'var(--border-dim)';
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      <div className="aria-card" style={{ flex: 1, position: 'sticky', top: 40 }}>
        <h2 style={{ fontSize: 20, marginBottom: 24 }}>Target Parameters</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <input className="aria-input" value={company} onChange={e=>setCompany(e.target.value)} placeholder="Company" />
          <input className="aria-input" value={role} onChange={e=>setRole(e.target.value)} placeholder="Role" />
          <textarea className="aria-input" value={jd} onChange={e=>setJd(e.target.value)} placeholder="Paste JD..." rows={8} />
          <button className="btn-primary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? `Intelligence via ${activeProvider || 'AI'}...` : 'Generate Intel Brief'}
          </button>
        </div>
      </div>

      <div style={{ flex: 2 }}>
        {!intelText && !isGenerating && (
          <div className="aria-card" style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-dim)' }}>🔍 Awaiting Transmission...</div>
        )}
        
        {intelText && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Intel Briefing: {company}</h2>
            {sections.map((sec, i) => {
              const lines = sec.split('\n');
              const header = lines[0];
              const content = lines.slice(1).join('\n').trim();
              const color = getColor(header[0]);
              return (
                <div key={i} className="aria-card" style={{ borderLeft: `3px solid ${color}`, padding: 20, animation: 'fadeIn 0.3s' }}>
                  <h3 style={{ color, fontSize: 13, marginBottom: 10 }}>{header}</h3>
                  <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{content}</div>
                </div>
              );
            })}
            <div ref={scrollRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyIntel;
