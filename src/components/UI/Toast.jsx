import React, { useState, useEffect } from 'react';

let toastId = 0;
export const toast = {
  events: new EventTarget(),
  show: (message, type = 'info') => {
    toast.events.dispatchEvent(new CustomEvent('add_toast', { detail: { id: ++toastId, message, type }}));
  }
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleAdd = (e) => {
      const newToast = e.detail;
      setToasts(prev => [...prev, newToast].slice(-3));
      
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newToast.id));
      }, 2500);
    };

    toast.events.addEventListener('add_toast', handleAdd);
    return () => toast.events.removeEventListener('add_toast', handleAdd);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column-reverse', gap: 8
    }}>
      {toasts.map(t => {
        let color = 'var(--cyan)';
        if (t.type === 'success') color = 'var(--green)';
        if (t.type === 'error') color = 'var(--red)';
        if (t.type === 'warning') color = 'var(--yellow)';

        return (
          <div key={t.id} style={{
            background: 'var(--bg-overlay)',
            borderLeft: `4px solid ${color}`,
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            animation: 'fadeSlideIn 0.2s ease-out forwards',
            color: '#fff',
            fontFamily: 'JetBrains Mono',
            fontSize: '13px'
          }}>
            {t.message}
          </div>
        );
      })}
    </div>
  );
};
export default ToastContainer;
