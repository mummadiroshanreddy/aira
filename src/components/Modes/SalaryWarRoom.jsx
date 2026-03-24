// ════════════════════════════════
// FILE: src/components/Modes/SalaryWarRoom.jsx
// ════════════════════════════════

import React, { useState, useContext, useRef } from 'react';
import { streamClaude } from '../../api/aiProvider';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const SalaryWarRoom = () => {
  const { setupData } = useContext(AppContext);
  const [data, setData] = useState({
    offer: '', target: '', competing: '', yoe: '', loc: '', wantJob: 5, notes: ''
  });
  const [result, setResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [activeProvider, setActiveProvider] = useState('');

  const scrollRef = useRef(null);

  const parseSections = (resp) => {
    const sections = {};
    const parts = resp.split(/(?=\s*[💰🗣️📧⏱️🃏🚫📊])/g).map(s => s.trim()).filter(Boolean);
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
    return sections;
  };

  const handleGenerate = async () => {
    if (!data.offer || !data.target) return;
    setIsGenerating(true);
    setResult(null);
    setLiveText('');

    const prompt = `You are a ruthless salary negotiation strategist.
    Target: ${setupData.role} at ${setupData.company}.
    Initial Offer: $${data.offer} | Target: $${data.target}
    YOE: ${data.yoe} | Loc: ${data.loc} | Competing: ${data.competing || 'None'}
    
    Output exactly these sections:
    💰 COUNTER STRATEGY
    🗣️ CALL SCRIPT
    📧 EMAIL DRAFT
    ⏱️ TIMING & SEQUENCE
    🃏 YOUR LEVERAGE
    📊 MARKET CONTEXT
    🚫 KILL PHRASES`;

    try {
      await streamClaude(
        prompt,
        "Calculate my negotiation strategy.",
        [],
        setupData.userId,
        (chunk) => {
          setLiveText(prev => prev + chunk);
          scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        },
        (full) => {
          setResult(parseSections(full));
          setIsGenerating(false);
          toast.show('Strategy Matrix Finalized', 'success');
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

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 32 }}>
      
      {/* Inputs */}
      <div className="aria-card" style={{ flex: '0 0 350px', position: 'sticky', top: 40, height: 'max-content' }}>
        <h2 style={{ fontSize: 20, marginBottom: 24, color: 'var(--green)' }}>💰 Data Input</h2>
        <div style={{ display: 'grid', gap: 16 }}>
          <input className="aria-input" type="number" placeholder="Offer ($)" value={data.offer} onChange={e=>setData({...data,offer:e.target.value})} />
          <input className="aria-input" type="number" placeholder="Target ($)" value={data.target} onChange={e=>setData({...data,target:e.target.value})} />
          <input className="aria-input" placeholder="Competing Offers" value={data.competing} onChange={e=>setData({...data,competing:e.target.value})} />
          <div style={{ display: 'flex', gap: 12 }}>
            <input className="aria-input" placeholder="YOE" value={data.yoe} onChange={e=>setData({...data,yoe:e.target.value})} style={{ flex: 1 }} />
            <input className="aria-input" placeholder="Loc" value={data.loc} onChange={e=>setData({...data,loc:e.target.value})} style={{ flex: 1 }} />
          </div>
          <textarea className="aria-input" placeholder="Notes..." value={data.notes} onChange={e=>setData({...data,notes:e.target.value})} rows={4} />
          <button className="btn-primary" style={{ background: 'var(--green)', color: '#000', padding: 16 }} onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? `Matrixing via ${activeProvider || 'AI'}...` : 'Generate Strategy'}
          </button>
        </div>
      </div>

      {/* Output */}
      <div style={{ flex: 1 }}>
        {isGenerating && !result && (
           <div className="aria-card" style={{ padding: 24, minHeight: 400, fontSize: 13, background: 'var(--bg-base)', border: '1px dashed var(--green)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
             {liveText}
             <div ref={scrollRef} />
           </div>
        )}

        {!isGenerating && !result && (
          <div className="aria-card" style={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
            Awaiting transmission...
          </div>
        )}

        {result && (
          <div style={{ display: 'grid', gap: 24, animation: 'fadeIn 0.5s' }}>
            <div className="aria-card" style={{ borderLeft: '3px solid var(--green)' }}>
              <h3 style={{ color: 'var(--green)', fontSize: 13, marginBottom: 12 }}>COUNTER STRATEGY</h3>
              <div style={{ fontSize: 14 }}>{result.strategy}</div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="aria-card" style={{ borderLeft: '3px solid var(--cyan)' }}>
                <h3 style={{ color: 'var(--cyan)', fontSize: 11, marginBottom: 8 }}>CALL SCRIPT</h3>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.script}</div>
              </div>
              <div className="aria-card" style={{ borderLeft: '3px solid var(--purple)' }}>
                <h3 style={{ color: 'var(--purple)', fontSize: 11, marginBottom: 8 }}>EMAIL DRAFT</h3>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{result.email}</div>
              </div>
            </div>

            <div className="aria-card" style={{ background: 'var(--red-dim)', border: '1px solid var(--red)' }}>
              <h3 style={{ color: 'var(--red)', fontSize: 11, marginBottom: 8 }}>🚫 KILL PHRASES</h3>
              <div style={{ fontSize: 13, textDecoration: 'line-through opacity-70' }}>{result.kill}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalaryWarRoom;
