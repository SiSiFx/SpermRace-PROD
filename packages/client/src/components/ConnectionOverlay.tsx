import { CreditCard } from 'phosphor-react';

interface ConnectionOverlayProps {
  wsState: {
    phase: string;
    lastError?: string | null;
    entryFee: { pending: boolean };
  };
  publicKey: string | null;
  loadProg: number;
  signAuthentication?: () => void;
  leave?: () => void;
  onBack: () => void;
  variant?: 'default' | 'mobile' | 'pc';
}

export function ConnectionOverlay({
  wsState,
  publicKey,
  loadProg,
  signAuthentication,
  leave,
  onBack,
  variant = 'default',
}: ConnectionOverlayProps) {
  const isMobile = variant === 'mobile';
  const isPC = variant === 'pc';

  const handleBuySol = () => {
    if (publicKey && (window as any).phantom?.solana?.isPhantom) {
      window.open('https://phantom.app/buy', '_blank');
    } else if (publicKey) {
      window.open('https://www.coinbase.com/buy-solana', '_blank');
    } else {
      window.open('https://www.moonpay.com/buy/sol', '_blank');
    }
  };

  // Error overlay
  if (wsState.lastError) {
    const isInsufficientFunds = wsState.lastError.toLowerCase().includes('insufficient');

    return (
      <div
        className={`loading-overlay ${isMobile ? 'mobile-overlay' : ''}`}
        style={{
          display: 'flex',
          background: isMobile ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.92)',
          backdropFilter: isMobile ? undefined : 'blur(8px)',
          zIndex: 10000,
        }}
      >
        <div
          className={`modal-card ${isMobile ? 'mobile-modal' : isPC ? 'pc-modal' : ''}`}
          style={{
            padding: isMobile ? '20px 18px' : '28px 24px',
            maxWidth: isMobile ? '92vw' : '440px',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(251,146,60,0.12) 100%)',
            border: '2px solid rgba(239,68,68,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <div
              className="modal-title"
              style={{ fontSize: isMobile ? '22px' : '26px', fontWeight: 800 }}
            >
              {isInsufficientFunds ? 'Insufficient Funds' : 'Something Went Wrong'}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(0,0,0,0.3)',
              padding: isMobile ? '12px 14px' : '14px 16px',
              borderRadius: '12px',
              marginBottom: '16px',
              fontSize: isMobile ? '13px' : '14px',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.5,
            }}
          >
            {wsState.lastError}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: isMobile ? 'wrap' : 'nowrap',
            }}
          >
            {isInsufficientFunds ? (
              <>
                <button
                  className="btn-primary"
                  style={{
                    flex: isMobile ? '1 1 100%' : '1.2',
                    minWidth: '120px',
                    padding: isMobile ? '12px 16px' : '14px 20px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: 700,
                    background: '#00F0FF',
                    boxShadow: '0 8px 26px rgba(0,240,255,0.45)',
                  }}
                  onClick={handleBuySol}
                >
                  <CreditCard size={18} weight="fill" style={{ marginRight: 8 }} />
                  Buy SOL
                </button>
                <button
                  className="btn-secondary"
                  style={{
                    flex: isMobile ? '1 1 100%' : '0.8',
                    minWidth: '100px',
                    padding: isMobile ? '12px 16px' : '14px 20px',
                    fontSize: isMobile ? '14px' : '15px',
                    fontWeight: 600,
                  }}
                  onClick={() => location.reload()}
                >
                  Reload
                </button>
              </>
            ) : (
              <button
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: isMobile ? '12px 16px' : '14px 20px',
                  fontSize: isMobile ? '14px' : '15px',
                  fontWeight: 700,
                }}
                onClick={() => location.reload()}
              >
                Reload App
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading overlay (connecting, authenticating, payment)
  if (
    wsState.phase === 'connecting' ||
    wsState.phase === 'authenticating' ||
    wsState.entryFee.pending
  ) {
    const loadingText = wsState.entryFee.pending
      ? 'Processing entry fee…'
      : wsState.phase === 'authenticating'
      ? isMobile
        ? 'Please approve the wallet prompt…'
        : 'Please approve the wallet prompt to continue…'
      : 'Connecting…';

    return (
      <div
        className={`loading-overlay ${isMobile ? 'mobile-overlay' : ''}`}
        style={{ display: 'flex', zIndex: 9999 }}
      >
        <div className={`loading-spinner ${isMobile ? 'mobile-spinner' : ''}`} />
        <div className={`loading-text ${isMobile ? 'mobile-loading-text' : ''}`}>
          {loadingText}
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: isMobile ? 220 : 280,
            height: 8,
            borderRadius: 6,
            overflow: 'hidden',
            marginTop: 10,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <div
            style={{
              width: `${loadProg}%`,
              height: '100%',
              background: '#00F0FF',
              transition: 'width 100ms linear',
            }}
          />
        </div>

        {/* Auth buttons (only during auth phase, not payment) */}
        {wsState.phase === 'authenticating' && !wsState.entryFee.pending && (
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="btn-primary" onClick={() => signAuthentication?.()}>
              Sign again
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                leave?.();
                onBack();
              }}
            >
              Back
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default ConnectionOverlay;
