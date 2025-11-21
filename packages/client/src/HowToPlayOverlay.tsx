import { useEffect } from 'react';

type OverlayMode = 'pc' | 'mobile';

interface HowToPlayOverlayProps {
  mode: OverlayMode;
  onClose: () => void;
}

export function HowToPlayOverlay({ mode, onClose }: HowToPlayOverlayProps) {
  const isMobile = mode === 'mobile';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.86)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        zIndex: 10002,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '16px' : '24px'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: isMobile ? 420 : 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: isMobile ? 18 : 20,
          border: '1px solid rgba(255,255,255,0.18)',
          background:
            'radial-gradient(circle at top, rgba(34,211,238,0.18), rgba(15,23,42,0.96))',
          boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
          padding: isMobile ? '18px 16px 16px' : '24px 24px 20px',
          color: '#e5e7eb',
          fontSize: isMobile ? 13 : 14,
          lineHeight: 1.5
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: isMobile ? 12 : 16
          }}
        >
          <div>
            <div
              style={{
                fontSize: isMobile ? 18 : 20,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}
            >
              How to win SpermRace
            </div>
            <div
              style={{
                fontSize: isMobile ? 11 : 12,
                opacity: 0.8,
                marginTop: 4
              }}
            >
              60–90 seconds. One arena. One winner takes the prize pool.
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(248,113,113,0.8)',
              padding: isMobile ? '6px 12px' : '6px 14px',
              background: 'rgba(15,23,42,0.95)',
              color: '#fee2e2',
              cursor: 'pointer',
              fontSize: isMobile ? 12 : 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontWeight: 600
            }}
          >
            <span style={{ fontSize: 14 }}>✕</span>
            <span>Close</span>
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1.1fr 0.9fr',
            gap: isMobile ? 12 : 18
          }}
        >
          <section
            style={{
              padding: isMobile ? '10px 10px 12px' : '12px 12px 14px',
              borderRadius: 14,
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(148,163,184,0.45)'
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 6,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#93c5fd'
              }}
            >
              Objective
            </div>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Survive longer than everyone else – last sperm alive wins the round.</li>
              <li>
                In tournaments, the&nbsp;
                <strong>winner takes ~85% of the entry fee pool</strong> (shown in the lobby).
              </li>
              <li>Practice mode is free and uses bots – perfect for learning.</li>
            </ul>
          </section>

          <section
            style={{
              padding: isMobile ? '10px 10px 12px' : '12px 12px 14px',
              borderRadius: 14,
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(148,163,184,0.35)'
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                marginBottom: 6,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#a5b4fc'
              }}
            >
              Controls
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 8
              }}
            >
              <div
                style={{
                  opacity: isMobile ? 0.55 : 0.95
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>PC</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                  <li>Aim with the mouse cursor</li>
                  <li>Move with <strong>WASD</strong></li>
                  <li>Boost with <strong>Space</strong> or <strong>B</strong></li>
                  <li>Press <strong>ESC</strong> to go back to menus</li>
                </ul>
              </div>
              <div
                style={{
                  opacity: isMobile ? 0.95 : 0.7
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Mobile</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12 }}>
                  <li>Drag the left side of the screen to steer</li>
                  <li>Tap the <strong>BOOST</strong> button to dash</li>
                  <li>A short on-field countdown appears before you can move</li>
                </ul>
              </div>
            </div>
          </section>
        </div>

        <section
          style={{
            marginTop: isMobile ? 10 : 14,
            padding: isMobile ? '10px 10px 12px' : '12px 12px 14px',
            borderRadius: 14,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(248,250,252,0.06)'
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 6,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#fcd34d'
            }}
          >
            Hazards & Powerups
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>
              Your glowing <strong>trail kills on contact</strong> – including you after a short spawn grace.
              Don&apos;t cross your own tail once the round is underway.
            </li>
            <li>
              Other players&apos; trails are deadly too – try to cut them off while staying safe yourself.
            </li>
            <li>
              The arena <strong>shrinks and slices in</strong> over time. Stay inside the safe area as the walls
              close or you&apos;ll quickly be eliminated.
            </li>
            <li>
              Small energy orbs refill your boost meter. Grab them to keep dashing.
            </li>
            <li>
              When an <strong>Overdrive hotspot</strong> appears, race to it: you&apos;ll get a massive temporary
              boost but become easier to track.
            </li>
          </ul>
        </section>

        <section
          style={{
            marginTop: isMobile ? 8 : 10,
            fontSize: 11,
            opacity: 0.8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center'
          }}
        >
          <span>Tip:</span>
          <span>
            Use <strong>Practice</strong> to learn movement and trails, then jump into a tournament when
            you can consistently survive to the final 3.
          </span>
        </section>
      </div>
    </div>
  );
}

export default HowToPlayOverlay;
