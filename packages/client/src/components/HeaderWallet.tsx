import { useWallet } from '../WalletProvider';
import { isMobileDevice } from '../deviceDetection';

interface HeaderWalletProps {
  screen: string;
  status?: string;
  solPrice?: number | null;
  onPractice?: () => void;
  onTournament?: () => void;
  onLeaderboard?: () => void;
  onShowHowTo?: () => void;
}

export function HeaderWallet({ 
  screen, 
  status,
  solPrice,
  onPractice,
  onTournament,
  onLeaderboard,
  onShowHowTo,
}: HeaderWalletProps) {
  const { publicKey, disconnect } = useWallet() as any;
  const isMobile = isMobileDevice();

  // Mobile header - compact
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 'calc(44px + env(safe-area-inset-top, 0px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'rgba(3, 7, 18, 0.9)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        zIndex: 50,
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 700,
          color: '#00f5ff',
          fontFamily: 'Orbitron, system-ui',
          letterSpacing: 2,
        }}>
          SR
        </div>
        {publicKey ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 10px',
            background: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.3)',
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 11, color: '#22d3ee', fontFamily: 'monospace' }}>
              {publicKey.slice(0,4)}…{publicKey.slice(-4)}
            </span>
            <button 
              onClick={() => disconnect?.()}
              style={{
                padding: '2px 6px',
                fontSize: 10,
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: 4,
                color: '#fff',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
            {status || 'Not Connected'}
          </div>
        )}
      </div>
    );
  }

  // Desktop header - full navigation
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: 72,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 40px',
      background: 'rgba(3, 7, 18, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      zIndex: 50,
    }}>
      {/* Left: Brand */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}>
        <div style={{
          fontSize: 20,
          fontWeight: 800,
          color: '#00f5ff',
          fontFamily: 'Orbitron, system-ui',
          letterSpacing: 4,
        }}>
          SPERMRACE
        </div>
        
        {/* Navigation */}
        <nav style={{ display: 'flex', gap: 16 }}>
          {onPractice && (
            <button
              onClick={onPractice}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                color: screen === 'practice' ? '#22d3ee' : 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Practice
            </button>
          )}
          {onTournament && (
            <button
              onClick={onTournament}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                color: screen === 'modes' ? '#22d3ee' : 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Tournament
            </button>
          )}
          {onLeaderboard && (
            <button
              onClick={onLeaderboard}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Leaderboard
            </button>
          )}
          {onShowHowTo && (
            <button
              onClick={onShowHowTo}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              How to Play
            </button>
          )}
        </nav>
      </div>

      {/* Right: SOL price + Wallet */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {typeof solPrice === 'number' && (
          <div style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            fontSize: 12,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: '"JetBrains Mono", monospace',
          }}>
            SOL ${solPrice.toFixed(2)}
          </div>
        )}
        
        {publicKey ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'rgba(34,211,238,0.1)',
            border: '1px solid rgba(34,211,238,0.3)',
            borderRadius: 8,
          }}>
            <span style={{ fontSize: 12, color: '#22d3ee', fontFamily: 'monospace' }}>
              {publicKey.slice(0,4)}…{publicKey.slice(-4)}
            </span>
            <button 
              onClick={() => disconnect?.()}
              className="btn-secondary"
              style={{ padding: '2px 8px', fontSize: 11 }}
            >
              Logout
            </button>
          </div>
        ) : (
          <div style={{
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            fontSize: 12,
            color: 'rgba(255,255,255,0.5)',
          }}>
            {status || (screen === 'game' ? 'Simulation mode' : 'Not Connected')}
          </div>
        )}
      </div>
    </div>
  );
}

export default HeaderWallet;
