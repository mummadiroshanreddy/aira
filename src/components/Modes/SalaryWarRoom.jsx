// ════════════════════════════════
// FILE: src/components/Modes/SalaryWarRoom.jsx
// ════════════════════════════════

import React, { useState, useContext } from 'react';
import { callClaude } from '../../api/claude';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const SalaryWarRoom = () => {
  const { setupData } = useContext(AppContext);
  const [data, setData] = useState({
    offer: '', target: '', competing: '', yoe: '', loc: '', wantJob: 5, notes: ''
  });
  const [result, setResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    const prompt = `You are a ruthless salary negotiation strategist.
The candidate wants ${setupData.role} at ${setupData.company || 'the target company'}. They have ${data.yoe} YOE in ${data.loc}.
Initial Offer: $${data.offer}
Target Salary: $${data.target}
Competing Offers: ${data.competing || 'None'}
Desire scale (1-10): ${data.wantJob}
Context: ${data.notes}

Output EXACTLY with these exact section headers:
💰 COUNTER STRATEGY
[Exact number/range to counter with, and the psychological reasoning]

🗣️ CALL SCRIPT
[Word-for-word what to say on the negotiation call — full dialogue]

📧 EMAIL DRAFT
Subject: [subject line]
[Full negotiation email body — professional, confident, strategic]

⏱️ TIMING & SEQUENCE
[When to send, what to say if they push back, when to accept]

🃏 YOUR LEVERAGE
[List of every advantage this candidate holds in this negotiation]

🚫 KILL PHRASES
[5 things to NEVER say that collapse negotiating power — explain why each]

📊 MARKET CONTEXT
[How to reference market data without sounding rehearsed]`;

    try {
      const resp = await callClaude(prompt, "Create negotiation plan.");
      const sections = {};
      const parts = resp.split(/(?=💰|🗣️|📧|⏱️|🃏|🚫|📊)/g).map(s => s.trim()).filter(Boolean);
      parts.forEach(p => {
        const headerEnd = p.indexOf('\n');
        const header = headerEnd > -1 ? p.substring(0, headerEnd).trim() : p.trim();
        const content = headerEnd > -1 ? p.substring(headerEnd).trim() : '';
        if(header.includes('💰')) sections.strategy = content;
        if(header.includes('🗣️')) sections.script = content;
        if(header.includes('📧')) sections.email = content;
        if(header.includes('⏱️')) sections.timing = content;
        if(header.includes('🃏')) sections.leverage = content;
        if(header.includes('🚫')) sections.kill = content;
        if(header.includes('📊')) sections.market = content;
      });
      setResult(sections);
      toast.show('War Plan generated', 'success');
    } catch (err) {
      toast.show(err.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 32 }}>
      
      {/* Inputs */}
      <div className="aria-card" style={{ flex: '0 0 350px', position: 'sticky', top: 80, height: 'max-content' }}>
        <h2 style={{ fontSize: 20, marginBottom: 24, color: 'var(--green)' }}>💰 Data Input</h2>
        
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>INITIAL OFFER ($) *</label>
            <input className="aria-input" type="number" value={data.offer} onChange={e=>setData({...data,offer:e.target.value})} placeholder="e.g. 150000" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>YOUR TARGET ($) *</label>
            <input className="aria-input" type="number" value={data.target} onChange={e=>setData({...data,target:e.target.value})} placeholder="e.g. 180000" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>COMPETING OFFERS</label>
            <input className="aria-input" value={data.competing} onChange={e=>setData({...data,competing:e.target.value})} placeholder="e.g. Meta $170k, Google Pk" />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>YOE</label>
              <input className="aria-input" type="number" value={data.yoe} onChange={e=>setData({...data,yoe:e.target.value})} placeholder="8" />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>LOCATION</label>
              <input className="aria-input" value={data.loc} onChange={e=>setData({...data,loc:e.target.value})} placeholder="Remote/NY" />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>DESIRE FOR ROLE (1-10): {data.wantJob}</label>
            <input type="range" min="1" max="10" value={data.wantJob} onChange={e=>setData({...data,wantJob:e.target.value})} style={{ width: '100%', accentColor: 'var(--green)' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>NOTES / CONTEXT</label>
            <textarea className="aria-input" value={data.notes} onChange={e=>setData({...data,notes:e.target.value})} rows={3} style={{ resize: 'none' }} placeholder="Any other leverage or constraints..." />
          </div>
        </div>

        <button className="btn-primary" style={{ width: '100%', marginTop: 24, background: 'var(--green)', color: '#000' }} onClick={handleGenerate} disabled={isGenerating || !data.offer || !data.target}>
          {isGenerating ? 'Calculating Matrix...' : 'Generate Strategy'}
        </button>
      </div>

      {/* Output */}
      <div style={{ flex: 1 }}>
        {!result && !isGenerating && (
          <div className="aria-card" style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>💰</div>
            Enter your offer details to generate a highly effective negotiation playbook.
          </div>
        )}
        
        {isGenerating && (
           <div className="aria-card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <div style={{ textAlign: 'center', color: 'var(--green)', animation: 'pulseGlow 1.5s infinite', padding: 20, borderRadius: '50%' }}>
               <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
               Running game theory matrix...
             </div>
           </div>
        )}

        {result && !isGenerating && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeSlideUp 0.3s ease forwards' }}>
            
            <div className="aria-card" style={{ borderLeft: '3px solid var(--green)' }}>
              <h3 style={{ color: 'var(--green)', fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>COUNTER STRATEGY</h3>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result.strategy}</div>
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
              <div className="aria-card" style={{ flex: 1, borderLeft: '3px solid var(--cyan)' }}>
                <h3 style={{ color: 'var(--cyan)', fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>CALL SCRIPT</h3>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>{result.script}</div>
              </div>
              
              <div className="aria-card" style={{ flex: 1, borderLeft: '3px solid var(--purple)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <h3 style={{ color: 'var(--purple)', fontSize: 14, letterSpacing: 1 }}>EMAIL DRAFT</h3>
                  <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => { navigator.clipboard.writeText(result.email); toast.show('Copied', 'success'); }}>Copy Email</button>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>{result.email}</div>
                <a href={`mailto:?subject=Offer Update&body=${encodeURIComponent(result.email)}`} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 16, color: 'var(--purple)', textDecoration: 'none', fontSize: 13, background: 'rgba(128,0,255,0.1)', padding: 12, textAlign: 'center', borderRadius: 4 }}>
                  Open in Mail App →
                </a>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="aria-card" style={{ borderLeft: '3px solid var(--orange)' }}>
                <h3 style={{ color: 'var(--orange)', fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>TIMING & SEQUENCE</h3>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>{result.timing}</div>
              </div>
              <div className="aria-card" style={{ borderLeft: '3px solid var(--yellow)' }}>
                <h3 style={{ color: 'var(--yellow)', fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>YOUR LEVERAGE</h3>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>{result.leverage}</div>
              </div>
            </div>
            
            <div className="aria-card" style={{ borderLeft: '3px solid var(--cyan)' }}>
                <h3 style={{ color: 'var(--cyan)', fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>MARKET CONTEXT</h3>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14 }}>{result.market}</div>
            </div>

            <div className="aria-card" style={{ border: '1px solid var(--red-dim)', background: 'var(--red-dim)' }}>
              <h3 style={{ color: 'var(--red)', fontSize: 14, marginBottom: 12, letterSpacing: 1 }}>🚫 KILL PHRASES (NEVER SAY)</h3>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, fontSize: 14, textDecoration: 'line-through opacity-50' }}>{result.kill}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalaryWarRoom;
