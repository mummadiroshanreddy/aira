// ════════════════════════════════
// FILE: src/components/Modes/AnswerVault.jsx
// ════════════════════════════════

import React, { useState, useContext } from 'react';
import { useVault } from '../../hooks/useVault';
import { AppContext } from '../../App';
import { toast } from '../UI/Toast';

const AnswerVault = () => {
  const { savedAnswers, deleteAnswer, updateAnswer, searchAnswers, filterByCategory, toggleStar, exportVaultData } = useVault();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest');
  
  const [practiceItem, setPracticeItem] = useState(null);
  
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ question: '', ariaResponse: '', tags: [] });

  const categories = ['All', 'Live', 'Behavioral', 'Technical', 'Leadership', 'Failures'];

  const getFiltered = () => {
    const safeAnswers = Array.isArray(savedAnswers) ? savedAnswers : [];
    let result = [...safeAnswers];
    
    if (searchQuery) {
      result = searchAnswers(searchQuery);
    }
    if (categoryFilter !== 'All') {
      result = filterByCategory(categoryFilter, result);
    }
    
    // Non-mutating Sort
    if (sortOrder === 'newest') {
      result.sort((a,b) => new Date(b.savedAt) - new Date(a.savedAt));
    } else if (sortOrder === 'score_high') {
      result.sort((a,b) => (b.score || 0) - (a.score || 0));
    } else if (sortOrder === 'score_low') {
      result.sort((a,b) => (a.score || 0) - (b.score || 0));
    }

    return result;
  };

  const displayedAnswers = getFiltered();

  const handleEdit = (ans) => {
    setEditingId(ans.id);
    setEditForm({ question: ans.question, ariaResponse: ans.ariaResponse, tags: ans.tags || [] });
  };

  const handleSaveEdit = () => {
    updateAnswer(editingId, editForm);
    setEditingId(null);
  };

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', gap: 32 }}>
      
      {practiceItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="aria-card" style={{ maxWidth: 600, width: '100%', padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--cyan)' }}>PRACTICE MODE ACTIVE</div>
              <h2 style={{ fontSize: 24, margin: '24px 0', lineHeight: 1.5 }}>"{practiceItem.question}"</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Pretend you are answering this aloud right now. Formulate your strategy, structured response, and proof points.</p>
              <button className="btn-primary" onClick={() => setPracticeItem(null)}>Reveal AI Strategy To Compare</button>
           </div>
        </div>
      )}

      {/* Sidebar Filters */}
      <div style={{ flex: '0 0 250px', position: 'sticky', top: 80, height: 'max-content' }}>
        <h2 style={{ fontSize: 24, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/></svg>
          Vault
        </h2>

        <div style={{ marginBottom: 24 }}>
          <input 
            className="aria-input" 
            type="text" 
            placeholder="Search answers..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingLeft: 36, background: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="%23666"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>') no-repeat 12px center`, backgroundSize: '16px' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 8, fontFamily: 'JetBrains Mono' }}>SORTING</div>
          <select className="aria-input" value={sortOrder} onChange={e=>setSortOrder(e.target.value)} style={{ width: '100%', cursor: 'pointer' }}>
            <option value="newest">Newest First</option>
            <option value="score_high">Highest Score</option>
            <option value="score_low">Lowest Score</option>
          </select>
        </div>

        <div style={{ display: 'grid', gap: 8, marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, marginBottom: 8, fontFamily: 'JetBrains Mono' }}>CATEGORIES</div>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              style={{
                textAlign: 'left',
                padding: '10px 16px',
                borderRadius: 6,
                background: categoryFilter === cat ? 'var(--cyan-dim)' : 'transparent',
                color: categoryFilter === cat ? 'var(--cyan)' : 'var(--text-secondary)',
                border: `1px solid ${categoryFilter === cat ? 'var(--cyan)' : 'transparent'}`,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                justifyContent: 'space-between'
              }}
            >
              {cat}
              <span style={{ opacity: 0.5, fontSize: 12 }}>
                {cat === 'All' ? (Array.isArray(savedAnswers) ? savedAnswers.length : 0) : (Array.isArray(savedAnswers) ? savedAnswers.filter(a => a.category === cat).length : 0)}
              </span>
            </button>
          ))}
        </div>

        <button className="btn-ghost" onClick={exportVaultData} style={{ width: '100%', padding: 12, fontSize: 13, border: '1px dashed var(--border-dim)' }}>
          📥 Export Data (JSON)
        </button>
      </div>

      {/* Main List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
        {displayedAnswers.length === 0 ? (
          <div className="aria-card" style={{ textAlign: 'center', padding: '100px 20px', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🗄️</div>
            No saved answers found in this sector.
          </div>
        ) : (
          displayedAnswers.map((ans, i) => (
            <div key={ans.id} className="aria-card" style={{ padding: 24, animation: `fadeSlideUp 0.3s ease ${i*0.05}s forwards`, opacity: 0 }}>
              
              {editingId === ans.id ? (
                /* EDIT MODE */
                <div style={{ display: 'grid', gap: 16 }}>
                  <input className="aria-input" value={editForm.question} onChange={e=>setEditForm({...editForm, question: e.target.value})} />
                  <textarea className="aria-input" value={editForm.ariaResponse} rows={8} style={{ resize: 'vertical' }} onChange={e=>setEditForm({...editForm, ariaResponse: e.target.value})} />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                    <button className="btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="btn-primary" onClick={handleSaveEdit}>Save Changes</button>
                  </div>
                </div>
              ) : (
                /* VIEW MODE */
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                        {ans.tags?.map(t => (
                          <span key={t} style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg-base)', border: '1px solid var(--cyan)', color: 'var(--cyan)', borderRadius: 12, fontFamily: 'JetBrains Mono' }}>
                            {t}
                          </span>
                        ))}
                        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                          {new Date(ans.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 style={{ fontSize: 18, color: '#fff', lineHeight: 1.4 }}>{ans.question}</h3>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={(e) => { e.stopPropagation(); toggleStar(ans.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: ans.starred ? 'var(--yellow)' : 'var(--text-dim)' }}>
                        {ans.starred ? '★' : '☆'}
                      </button>
                      <button onClick={() => { navigator.clipboard.writeText(ans.ariaResponse); toast.show('Copied','success'); }} title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>📋</button>
                      <button onClick={() => {
                        window.dispatchEvent(new CustomEvent('nav_mode', { detail: 2 }));
                        setTimeout(() => window.dispatchEvent(new CustomEvent('score_answer', { detail: ans })), 100);
                        toast.show('Sent to Confidence Scorer', 'info');
                      }} title="Re-score" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--cyan)' }}>📊</button>
                      <button onClick={() => handleEdit(ans)} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)' }}>✏️</button>
                      <button onClick={() => { if(window.confirm('Delete this saved answer?')) deleteAnswer(ans.id); }} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)' }}>🗑️</button>
                    </div>
                  </div>

                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6, color: 'var(--text-secondary)', fontSize: 15, background: 'rgba(255,255,255,0.02)', padding: 16, borderRadius: 8, borderLeft: '2px solid var(--cyan)' }}>
                    {ans.ariaResponse}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
                    <button className="btn-ghost" style={{ fontSize: 12, color: 'var(--cyan)' }} onClick={() => setPracticeItem(ans)}>
                      🎯 Practice Overlay
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default AnswerVault;
