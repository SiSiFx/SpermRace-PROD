import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

export default class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    try {
      console.error('[AppErrorBoundary] caught', error);
    } catch { }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'radial-gradient(circle at top, rgba(34,211,238,0.10), rgba(0,0,0,0.92))',
          color: '#e5e7eb',
          zIndex: 99999,
          padding: 20,
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div style={{ maxWidth: 520 }}>
          <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Reload needed
          </div>
          <div style={{ marginTop: 10, opacity: 0.85, fontSize: 13, lineHeight: 1.5 }}>
            The UI hit an unexpected error. Reloading fixes it most of the time.
          </div>
          <button
            type="button"
            onClick={() => {
              try { location.reload(); } catch { }
            }}
            style={{
              marginTop: 14,
              borderRadius: 12,
              border: '1px solid rgba(34,211,238,0.35)',
              padding: '10px 14px',
              background: 'rgba(15,23,42,0.9)',
              color: '#e5e7eb',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

