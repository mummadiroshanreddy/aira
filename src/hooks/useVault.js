// ════════════════════════════════
// FILE: src/hooks/useVault.js
// ════════════════════════════════

import { useState, useEffect } from 'react';

const VAULT_KEY = 'aria_vault_v2';

export const useVault = () => {
  const [answers, setAnswers] = useState([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(VAULT_KEY);
        if (stored) setAnswers(JSON.parse(stored));
      } catch (e) {
        console.warn('localStorage access denied or failed', e);
      }
    }
  }, []);

  const _syncStore = (newAnswers) => {
    setAnswers(newAnswers);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VAULT_KEY, JSON.stringify(newAnswers));
      } catch (e) {
        console.warn('Failed to save to localStorage', e);
      }
    }
  };

  const saveAnswer = ({ question, ariaResponse, score, category = 'General', tags = [] }) => {
    const newEntry = {
      id: `ans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      question,
      ariaResponse,
      score,
      category,
      tags,
      savedAt: new Date().toISOString(),
      isStarred: false
    };
    
    _syncStore([newEntry, ...answers]);
    return newEntry;
  };

  const getAll = () => {
    return answers;
  };

  const deleteAnswer = (id) => {
    const filtered = answers.filter(a => a.id !== id);
    _syncStore(filtered);
  };

  const updateAnswer = (id, changes) => {
    const updated = answers.map(a => 
      a.id === id ? { ...a, ...changes } : a
    );
    _syncStore(updated);
  };

  const searchAnswers = (query) => {
    if (!query) return answers;
    const lowerQ = query.toLowerCase();
    return answers.filter(a => 
      (a.question && a.question.toLowerCase().includes(lowerQ)) ||
      (a.ariaResponse && a.ariaResponse.toLowerCase().includes(lowerQ)) ||
      (a.category && a.category.toLowerCase().includes(lowerQ))
    );
  };

  const filterByTag = (tag) => {
    return answers.filter(a => a.tags && a.tags.includes(tag));
  };

  const getByCategory = (category) => {
    return answers.filter(a => a.category === category);
  };

  const starAnswer = (id) => {
    const target = answers.find(a => a.id === id);
    if (target) {
      updateAnswer(id, { isStarred: !target.isStarred });
    }
  };

  const exportAll = () => {
    if (answers.length === 0) return;
    
    let content = "ARIA ANSWER VAULT EXPORT\n";
    content += `Date: ${new Date().toLocaleDateString()}\n`;
    content += "====================================================\n\n";

    answers.forEach((ans, index) => {
      content += `[ANSWER ${index + 1}]\n`;
      content += `Question: ${ans.question}\n`;
      content += `Category: ${ans.category}\n`;
      if (ans.score) content += `Score: ${ans.score}/10\n`;
      if (ans.tags && ans.tags.length > 0) content += `Tags: ${ans.tags.join(', ')}\n`;
      content += `Saved: ${new Date(ans.savedAt).toLocaleString()}\n`;
      content += `\nCopilot Response/Strategy:\n${ans.ariaResponse}\n`;
      content += "\n----------------------------------------------------\n\n";
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ARIA-Vault-Export-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  const scoredAnswers = answers.filter(a => a.score);
  const averageScore = scoredAnswers.length > 0 
    ? (scoredAnswers.reduce((sum, a) => sum + Number(a.score), 0) / scoredAnswers.length).toFixed(1)
    : null;

  return {
    answers,
    saveAnswer,
    getAll,
    deleteAnswer,
    updateAnswer,
    searchAnswers,
    filterByTag,
    getByCategory,
    starAnswer,
    exportAll,
    totalCount: answers.length,
    averageScore,
    starredCount: answers.filter(a => a.isStarred).length
  };
};
