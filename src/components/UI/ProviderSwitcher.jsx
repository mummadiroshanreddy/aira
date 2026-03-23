import { useState } from 'react';
import { useProvider } from '../../context/ProviderContext';

export default function ProviderSwitcher() {
  const {
    activeProvider,
    availableProviders,
    switchProvider,
    getActiveProviderMeta,
    PROVIDER_META
  } = useProvider();

  const [open, setOpen] = useState(false);
  const activeMeta = getActiveProviderMeta();

  // Inline styles for the switcher
  const styles = {
    wrapper: {
      position: 'relative',
      display: 'inline-block',
      fontFamily: "'JetBrains Mono', monospace"
    },
    trigger: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 12px',
      background: '#0e0e1e',
      border: `1px solid ${activeMeta.color}40`,
      borderRadius: 20,
      cursor: 'pointer',
      transition: 'all 0.15s',
      userSelect: 'none'
    },
    badge: {
      fontSize: 14
    },
    providerName: {
      fontSize: 11,
      fontWeight: 700,
      color: activeMeta.color,
      letterSpacing: 1,
      textTransform: 'uppercase'
    },
    modelName: {
      fontSize: 9,
      color: '#444',
      letterSpacing: 0.5
    },
    chevron: {
      fontSize: 9,
      color: '#444',
      transition: 'transform 0.15s',
      transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
    },
    dropdown: {
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      background: '#0c0c18',
      border: '1px solid #1a1a2e',
      borderRadius: 12,
      padding: 8,
      minWidth: 220,
      zIndex: 1000,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
    },
    dropdownHeader: {
      fontSize: 9,
      color: '#333',
      letterSpacing: 3,
      textTransform: 'uppercase',
      padding: '4px 8px 8px',
      borderBottom: '1px solid #1a1a2e',
      marginBottom: 8
    },
    providerOption: (isActive, meta) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 12px',
      borderRadius: 8,
      cursor: 'pointer',
      background: isActive ? `${meta.color}15` : 'transparent',
      border: isActive ? `1px solid ${meta.color}40` : '1px solid transparent',
      transition: 'all 0.15s',
      marginBottom: 4
    }),
    optionBadge: {
      fontSize: 18,
      width: 32,
      textAlign: 'center'
    },
    optionInfo: {
      flex: 1
    },
    optionName: (meta) => ({
      fontSize: 12,
      fontWeight: 700,
      color: meta.color,
      letterSpacing: 0.5
    }),
    optionModel: {
      fontSize: 10,
      color: '#444',
      marginTop: 1
    },
    optionDesc: {
      fontSize: 10,
      color: '#333',
      marginTop: 2
    },
    optionSpeed: (meta) => ({
      fontSize: 9,
      color: meta.color,
      background: `${meta.color}15`,
      padding: '2px 6px',
      borderRadius: 8,
      letterSpacing: 0.5
    }),
    activeCheck: (meta) => ({
      fontSize: 12,
      color: meta.color
    }),
    freeTag: {
      fontSize: 8,
      color: '#39ff8f',
      background: '#39ff8f15',
      padding: '2px 6px',
      borderRadius: 8,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: 4,
      display: 'inline-block'
    },
    divider: {
      height: 1,
      background: '#1a1a2e',
      margin: '8px 0'
    },
    bothFreeNote: {
      fontSize: 9,
      color: '#2a2a4a',
      textAlign: 'center',
      padding: '4px 8px 0',
      letterSpacing: 0.5
    }
  };

  const providers = Object.values(PROVIDER_META);

  return (
    <div style={styles.wrapper}>
      {/* Trigger pill */}
      <div
        style={styles.trigger}
        onClick={() => setOpen(p => !p)}
      >
        <span style={styles.badge}>{activeMeta.badge}</span>
        <div>
          <div style={styles.providerName}>{activeMeta.name}</div>
          <div style={styles.modelName}>{activeMeta.model}</div>
        </div>
        <span style={styles.chevron}>▼</span>
      </div>

      {/* Dropdown */}
      {open && (
        <div style={styles.dropdown}>
          <div style={styles.dropdownHeader}>AI Provider</div>

          {providers.map(meta => {
            const isActive = activeProvider === meta.id;
            const isAvailable = availableProviders.find(p => p.id === meta.id);

            return (
              <div
                key={meta.id}
                style={{
                  ...styles.providerOption(isActive, meta),
                  opacity: isAvailable ? 1 : 0.4
                }}
                onClick={() => {
                  if (isAvailable) {
                    switchProvider(meta.id);
                    setOpen(false);
                  }
                }}
              >
                <div style={styles.optionBadge}>{meta.badge}</div>
                <div style={styles.optionInfo}>
                  <div style={styles.optionName(meta)}>{meta.name}</div>
                  <div style={styles.optionModel}>{meta.model}</div>
                  <div style={styles.optionDesc}>{meta.description}</div>
                  <span style={styles.freeTag}>FREE</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <span style={styles.optionSpeed(meta)}>{meta.speed}</span>
                  {isActive && <span style={styles.activeCheck(meta)}>✓ Active</span>}
                  {!isAvailable && <span style={{ fontSize: 9, color: '#ff4060' }}>No Key</span>}
                </div>
              </div>
            );
          })}

          <div style={styles.divider} />
          <div style={styles.bothFreeNote}>
            Both providers are 100% free
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999
          }}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
