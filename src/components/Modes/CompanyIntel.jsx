// ════════════════════════════════
// FILE: src/components/Modes/CompanyIntel.jsx
// ════════════════════════════════

import React, { useState, useContext } from 'react';
import { callClaude } from '../../api/claude';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const CompanyIntel = () => {
  const { setupData } = useContext(AppContext);
  const [jd, setJd] = useState(setupData?.jd || '');
  const [company, setCompany] = useState(setupData?.company || '');
  const [role, setRole] = useState(setupData?.role || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [intel, setIntel] = useState('');

  const handleGenerate = async () => {
    if (!jd) return toast.show('Job description is required', 'warning');
    if (!company) return toast.show('Company name is required', 'warning');
    setIsGenerating(true);

    const prompt = `You are a pre-interview intelligence analyst preparing a classified briefing for a candidate applying for ${role} at ${company}.
Analyze this job description:
${jd}

Output EXACTLY with these sections exactly as named:
🏢 COMPANY DNA
[3 specific culture signals extracted from JD language and requirements]

🎯 HIDDEN PRIORITY  
[What they ACTUALLY want vs what the JD says — the real #1 need]

🔑 POWER KEYWORDS
[5 exact phrases from JD to weave into answers — list them]

📊 INTERVIEW STYLE PREDICTION
[Based on JD language, predict: format, who's in the room, what they'll prioritize, likely red flags they're screening for]

⚡ YOUR EDGE ANGLES
[2 specific differentiator framings for a strong candidate in this role]

🚩 RED FLAGS
[Any signals in the JD suggesting: unrealistic expectations, toxic culture, high turnover role, or budget constraints]

📝 PREP PRIORITY LIST
[Top 5 topics to study before this interview, ranked by importance]`;

    try {
      const resp = await callClaude(prompt, "Generate brief.");
      setIntel(resp);
      toast.show('Intelligence profile generated', 'success');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const sections = intel ? intel.split(/(?=🏢|🎯|🔑|📊|⚡|🚩|📝)/g).map(s => s.trim()).filter(Boolean) : [];

  const getColor = (char) => {
    const m = { '🏢': 'var(--cyan)', '🎯': 'var(--orange)', '🔑': 'var(--yellow)', '📊': 'var(--purple)', '⚡': 'var(--cyan)', '🚩': 'var(--red)', '📝': 'var(--green)' };
    return m[char] || 'var(--border-dim)';
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      
      {/* Input Target Params */}
      <div className="aria-card" style={{ flex: 1, position: 'sticky', top: 80 }}>
        <h2 style={{ fontSize: 20, marginBottom: 24 }}>Target Parameters</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
             <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>COMPANY NAME</label>
             <input className="aria-input" value={company} onChange={e=>setCompany(e.target.value)} placeholder="e.g. Acme Corp" />
          </div>
          <div>
             <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>TARGET ROLE</label>
             <input className="aria-input" value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Senior Engineer" />
          </div>
          <div>
             <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>FULL JOB DESCRIPTION</label>
             <textarea className="aria-input" value={jd} onChange={e=>setJd(e.target.value)} placeholder="Paste full Job Description here..." rows={8} style={{ resize: 'none' }} />
          </div>
          
          <button className="btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={handleGenerate} disabled={isGenerating || !jd}>
            {isGenerating ? 'Compiling Intel...' : 'Generate Intel Brief'}
          </button>
        </div>

        {intel && (
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <button className="btn-ghost" style={{ flex: 1, padding: 8, fontSize: 12 }} onClick={() => { navigator.clipboard.writeText(intel); toast.show('Brief Copied', 'success'); }}>Copy Full</button>
            <button className="btn-ghost" style={{ flex: 1, padding: 8, fontSize: 12, color: 'var(--cyan)' }} onClick={() => {
              window.dispatchEvent(new CustomEvent('aria_submit', { detail: `Keep these exact keywords in mind for our answers: \n\n${intel.split('🔑 POWER KEYWORDS')[1]?.split('📊')[0] || intel}` }));
              toast.show('Keywords injected into Live Memory', 'success');
            }}>Inject Keywords</button>
          </div>
        )}
      </div>

      {/* Brief View */}
      <div style={{ flex: 2 }}>
        {!intel && !isGenerating && (
          <div className="aria-card" style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🔍</div>
            Paste a Job Description to generate a classified intelligence briefing.
          </div>
        )}
        
        {isGenerating && (
          <div className="aria-card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: 'var(--cyan)', animation: 'pulseGlow 1.5s infinite', padding: 20, borderRadius: '50%' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>🧬</div>
              Scanning JD DNA...
            </div>
          </div>
        )}
        
        {intel && !isGenerating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={{ color: 'var(--text-primary)', marginBottom: 8, fontSize: 24 }}>Classified Briefing: {company}</h2>
            {sections.map((sec, i) => {
              const lines = sec.split('\n');
              const header = lines[0];
              const content = lines.slice(1).join('\n').trim();
              const color = getColor(header[0]);
              return (
                <div key={i} className="aria-card" style={{ padding: '20px', borderLeft: `3px solid ${color}`, animation: `fadeSlideUp 0.3s ease ${i*0.05}s forwards`, opacity: 0 }}>
                  <h3 style={{ color, fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>{header}</h3>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14, color: 'var(--text-secondary)' }}>{content}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CompanyIntel;
