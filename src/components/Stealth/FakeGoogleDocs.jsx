// ════════════════════════════════
// FILE: src/components/Stealth/FakeGoogleDocs.jsx
// ════════════════════════════════

import React from 'react';

const FakeGoogleDocs = () => {
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#f8f9fa',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* LAYER 1 - Topbar */}
      <div style={{ height: 40, backgroundColor: '#1a73e8', display: 'flex', alignItems: 'center', padding: '0 16px', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
          <span style={{ fontSize: 18, fontWeight: 500, letterSpacing: -0.5 }}>Docs</span>
        </div>
        
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <input 
              readOnly 
              value="Q3 Strategy & Planning Notes — Working Draft"
              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 18, minWidth: 380, padding: '2px 6px', outline: 'none' }}
            />
            <div style={{ position: 'absolute', top: 2, right: -40, display: 'flex', gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <span style={{ opacity: 0.8 }}>Last edit was seconds ago</span>
          <button style={{ background: '#fff', color: '#1a73e8', border: 'none', padding: '6px 20px', borderRadius: 4, fontWeight: 'bold', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92zM18 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM6 13c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm12 7.02c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
            Share
          </button>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#ff5722', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>C</div>
        </div>
      </div>

      {/* LAYER 2 - Menu Bar */}
      <div style={{ height: 32, backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', padding: '0 12px', gap: 2 }}>
        {['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Extensions', 'Help'].map(item => (
          <div key={item} style={{ padding: '6px 10px', fontSize: 13, color: '#3c4043', cursor: 'default' }}>{item}</div>
        ))}
      </div>

      {/* LAYER 3 - Toolbar */}
      <div style={{ height: 42, backgroundColor: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 16, fontSize: 13, color: '#3c4043' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{color: '#ccc'}}>↩</span> <span style={{color: '#ccc'}}>↪</span> <span>🖨</span> <span>🖌</span>
        </div>
        <div style={{ width: 1, height: 20, background: '#e0e0e0' }}></div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>100% ▾</span>
          <div style={{ width: 1, height: 20, background: '#e0e0e0' }}></div>
          <span>Normal text ▾</span>
          <div style={{ width: 1, height: 20, background: '#e0e0e0' }}></div>
          <span>Arial ▾</span>
          <div style={{ width: 1, height: 20, background: '#e0e0e0' }}></div>
          <span>11 ▾</span>
        </div>
        <div style={{ width: 1, height: 20, background: '#e0e0e0' }}></div>
        <div style={{ display: 'flex', gap: 12, fontWeight: 'bold' }}>
          <span>B</span> <i>I</i> <span style={{textDecoration: 'underline'}}>U</span>
        </div>
      </div>

      {/* LAYER 4 - Ruler (Simplified visual) */}
      <div style={{ height: 24, backgroundColor: '#f3f3f3', borderBottom: '1px solid #e0e0e0', position: 'relative' }}>
         {/* Margin markers */}
         <div style={{ position: 'absolute', left: '15%', top: 0, bottom: 0, width: 20, background: '#fff', borderLeft: '1px solid #ccc', borderRight: '1px solid #ccc' }}></div>
         <div style={{ position: 'absolute', right: '15%', top: 0, bottom: 0, width: 20, background: '#fff', borderLeft: '1px solid #ccc', borderRight: '1px solid #ccc' }}></div>
      </div>

      {/* LAYER 5 - Document Area */}
      <div style={{ flex: 1, backgroundColor: '#e8eaed', overflowY: 'scroll', paddingBottom: 64 }}>
        <div style={{
          width: 816, minHeight: 1056, margin: '24px auto',
          padding: '96px 96px 72px', backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          color: '#000', fontSize: '11pt', lineHeight: 1.5
        }}>
          
          <div style={{ fontSize: '26pt', fontWeight: 400, marginBottom: '12pt' }}>Q3 2026 Strategic Planning — Working Notes</div>
          
          <div style={{ fontSize: '10pt', color: '#666', marginBottom: '24pt' }}>Last updated: {currentDate} | Confidential — Internal Use Only</div>
          
          <div style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '8pt', marginTop: '16pt' }}>Executive Summary</div>
          <p style={{ marginBottom: '14pt' }}>As we transition into Q3, our primary objective is consolidating the recent platform expansions while driving deeper engagement within the core user base. The OKR tracking indicates a healthy trajectory on active user retention, though acquisition costs have marginally increased. By optimizing the funnel and reinforcing cross-functional alignment, we aim to hit the 15M MAU target by quarter's end.</p>
          
          <div style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '8pt', marginTop: '16pt' }}>Key Initiatives</div>
          <ul style={{ marginBottom: '14pt', paddingLeft: '24pt' }}>
            <li><strong>Product Roadmap:</strong> Accelerate deployment of the unified dashboard interface (Project Titan). Target early access for alpha cohort by Aug 15.</li>
            <li><strong>Hiring:</strong> Close 3 critical engineering roles and secure the VP of Growth marketing. Pipeline looks strong but moving slowly.</li>
            <li><strong>Partnerships:</strong> Institutionalize the API integration strategies with 4 key vendors in the fintech space.</li>
            <li><strong>Metrics:</strong> Standardize daily reporting active dashboards to eliminate discrepancy between engineering and marketing data sets.</li>
          </ul>

          <div style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '8pt', marginTop: '16pt' }}>Resource Allocation</div>
          <p style={{ marginBottom: '14pt' }}>We have secured an additional $1.2M in OPEX specifically allocated for the Q3 sprint. Of this, 60% is earmarked for R&D expansion, 25% for aggressive top-of-funnel marketing campaigns, and 15% reserved for contractor overflow. Headcount requests outside of Engineering and Product require immediate re-evaluation.</p>

          <div style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '8pt', marginTop: '16pt' }}>Action Items</div>
          <ol style={{ marginBottom: '14pt', paddingLeft: '24pt' }}>
            <li>Finalize titan scope document (Owner: Sarah K.) — Due Friday</li>
            <li>Review vendor MSA redlines (Owner: David P.) — Due Mon</li>
            <li>Publish updated internal Wiki for Q3 objectives (Owner: Ops Team) — Due Wed</li>
            <li>Schedule cross-departmental alignment sync (Owner: HR) — Due EOD</li>
            <li>Approve Q3 budget allocation (Owner: Finance) — Due EOW</li>
          </ol>

          <div style={{ fontSize: '16pt', fontWeight: 'bold', marginBottom: '8pt', marginTop: '16pt' }}>Notes from Standup — {currentDate}</div>
          <p style={{ marginBottom: '14pt' }}>
            The team highlighted a few blockers regarding the staging environment deployment. Engineering is looking into the CI/CD pipeline bottlenecks. Overall, momentum is
            <span style={{ display: 'inline-block', width: 2, height: 14, background: '#000', animation: 'cursorBlink 0.7s infinite', marginLeft: 2, position: 'relative', top: 2 }}></span>
            increasing and morale seems stable. Marketing needs final copy approval by 3PM.
          </p>

          <p style={{ marginBottom: '14pt' }}>We should likely consider establishing a weekly triage meeting to address these recurring infrastructure delays before they impact the sprint commitments.</p>
          
        </div>
      </div>

      {/* LAYER 6 - Status Bar */}
      <div style={{ height: 22, backgroundColor: '#f1f3f4', borderTop: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', fontSize: 11, color: '#5f6368' }}>
        <div>Page 1 of 2 &nbsp;|&nbsp; Word count: 847</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>100%</span>
          <span>Explore</span>
        </div>
      </div>
      
    </div>
  );
};

export default FakeGoogleDocs;
