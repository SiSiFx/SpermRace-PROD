import { Trophy, GameController, Atom } from 'phosphor-react';
import { AnimatedCounter } from '../AnimatedCounter';
import { isMobileDevice } from '../../deviceDetection';

interface LandingProps {
  solPrice: number | null;
  onPractice: () => void;
  onTournament: () => void;
  onWallet?: () => void;
  onLeaderboard?: () => void;
  onShowLoading?: (callback: () => void) => void;
}

export function Landing({
  solPrice,
  onPractice,
  onTournament,
  onWallet,
  onLeaderboard,
  onShowLoading,
}: LandingProps) {
  const isMobile = isMobileDevice();

  const getPlayerStats = () => {
    try {
      const stored = localStorage.getItem('spermrace_stats');
      if (stored) return JSON.parse(stored) as { totalGames?: number; wins?: number; totalKills?: number };
    } catch {}
    return { totalGames: 0, wins: 0, totalKills: 0 };
  };

  const stats = getPlayerStats();
  const totalGames = stats.totalGames || 0;
  const totalKills = stats.totalKills || 0;
  const winRate = totalGames > 0 ? ((stats.wins || 0) / totalGames * 100).toFixed(1) : '0.0';

  const handleTournament = () => {
    if (onShowLoading && onTournament) {
      onShowLoading(onTournament);
    } else {
      onTournament();
    }
  };

  const handlePractice = () => {
    if (onShowLoading) {
      onShowLoading(onPractice);
    } else {
      onPractice();
    }
  };

  return (
    <div className={`screen active ${isMobile ? 'mobile-landing' : ''}`} id="landing-screen">
      <div
        className={isMobile ? 'mobile-landing-container' : 'landing-container'}
        style={{
          maxWidth: isMobile ? 960 : 1200,
          margin: '0 auto',
          minHeight: isMobile ? '100dvh' : '100vh',
          padding: isMobile ? '0 20px' : '140px 40px 64px',
          paddingBottom: isMobile ? 'max(40px, env(safe-area-inset-bottom))' : '64px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: isMobile ? 20 : 48,
        }}
      >
        <header style={{ textAlign: 'center', width: '100%' }}>
          <div style={{ marginBottom: isMobile ? 16 : 20 }}>
            <Atom 
              size={isMobile ? 56 : 72} 
              weight="duotone" 
              color="#00f5ff"
              style={{ filter: 'drop-shadow(0 0 16px rgba(0, 245, 255, 0.7))' }} 
            />
          </div>
          <div
            style={{
              fontFamily: 'Orbitron, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
              letterSpacing: isMobile ? '0.3em' : '0.35em',
              fontSize: isMobile ? 9 : 13,
              textTransform: 'uppercase',
              color: '#00f5ff',
              marginBottom: isMobile ? 12 : 24,
              textShadow: '0 0 15px rgba(0, 245, 255, 0.6)',
            }}
          >
            BATTLE ROYALE STARTS AT BIRTH
          </div>
          <h1
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'baseline',
              gap: isMobile ? 10 : 24,
              fontSize: isMobile ? 42 : 96,
              lineHeight: 1,
              marginBottom: isMobile ? 0 : 28,
              textShadow: '0 0 40px rgba(0, 245, 255, 0.4), 0 0 80px rgba(0, 245, 255, 0.2)',
            }}
          >
            <span style={{ color: '#fff', fontWeight: 800 }}>SPERM</span>
            <span
              style={{
                fontWeight: 800,
                background: 'linear-gradient(135deg, #00f5ff, #00ff88)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 12px rgba(0, 245, 255, 0.7))',
              }}
            >
              RACE
            </span>
          </h1>
          <p
            style={{
              marginTop: 10,
              fontSize: isMobile ? 10 : 15,
              letterSpacing: isMobile ? '0.12em' : '0.18em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            SURVIVE. ELIMINATE. WIN CRYPTO.
          </p>
          {isMobile && (
            <div
              style={{
                marginTop: 6,
                fontSize: 10,
                color: 'rgba(148,163,184,0.78)',
                fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              SOL: {solPrice != null ? `$${solPrice.toFixed(2)}` : '--.--'}
            </div>
          )}

          {/* Stats Display */}
          {totalGames > 0 && (
            <div style={{ marginTop: isMobile ? 10 : 32 }}>
              <div
                className={isMobile ? '' : 'pc-stats-grid'}
                style={isMobile ? {
                  display: 'flex',
                  justifyContent: 'center',
                } : undefined}
              >
                {isMobile ? (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'rgba(15,23,42,0.9)',
                      border: '1px solid rgba(148,163,184,0.45)',
                      display: 'flex',
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <div className="mobile-stat">
                      <div className="label">Practice Games</div>
                      <div className="value"><AnimatedCounter value={totalGames} duration={1000} /></div>
                    </div>
                    <div className="mobile-stat">
                      <div className="label">Practice Win%</div>
                      <div className="value"><AnimatedCounter value={parseFloat(winRate)} duration={1200} decimals={1} suffix="%" /></div>
                    </div>
                    <div className="mobile-stat">
                      <div className="label">Practice Kills</div>
                      <div className="value"><AnimatedCounter value={totalKills} duration={1400} /></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="pc-stat-card">
                      <div className="stat-label">Practice Games</div>
                      <div className="stat-value"><AnimatedCounter value={totalGames} duration={1000} /></div>
                    </div>
                    <div className="pc-stat-card highlight">
                      <div className="stat-label">Practice Win%</div>
                      <div className="stat-value"><AnimatedCounter value={parseFloat(winRate)} duration={1200} decimals={1} suffix="%" /></div>
                    </div>
                    <div className="pc-stat-card">
                      <div className="stat-label">Practice Kills</div>
                      <div className="stat-value"><AnimatedCounter value={totalKills} duration={1400} /></div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        <main>
          <section
            style={{
              width: '100%',
              maxWidth: isMobile ? '400px' : undefined,
              marginTop: isMobile ? '32px' : 0,
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'center',
              alignItems: isMobile ? undefined : 'stretch',
              gap: isMobile ? '16px' : '20px',
              flexWrap: isMobile ? undefined : 'wrap',
            }}
          >
            <button
              type="button"
              className={`btn-primary ${isMobile ? '' : 'pc-btn-large'}`}
              onClick={handleTournament}
              style={{
                width: isMobile ? '100%' : undefined,
                maxWidth: isMobile ? '400px' : undefined,
                minWidth: isMobile ? undefined : 320,
                padding: isMobile ? '18px 28px' : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
              }}
              onTouchStart={isMobile ? (e) => { e.currentTarget.style.transform = 'scale(0.98)'; } : undefined}
              onTouchEnd={isMobile ? (e) => { e.currentTarget.style.transform = 'scale(1)'; } : undefined}
            >
              <Trophy size={22} weight="fill" />
              <span>Enter Tournament</span>
            </button>

            <button
              type="button"
              className={`btn-secondary ${isMobile ? '' : 'pc-btn-large pc-btn-secondary'}`}
              onClick={handlePractice}
              style={{
                width: isMobile ? '100%' : undefined,
                maxWidth: isMobile ? '400px' : undefined,
                minWidth: isMobile ? undefined : 280,
                padding: isMobile ? '14px 24px' : undefined,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
              }}
              onTouchStart={isMobile ? (e) => { e.currentTarget.style.transform = 'scale(0.98)'; } : undefined}
              onTouchEnd={isMobile ? (e) => { e.currentTarget.style.transform = 'scale(1)'; } : undefined}
            >
              <GameController size={20} weight="fill" />
              <span>Practice Mode (Free)</span>
            </button>
          </section>

          <div
            style={{
              marginTop: isMobile ? 8 : 12,
              fontSize: isMobile ? 10 : 12,
              textAlign: 'center',
              color: isMobile ? 'rgba(0, 245, 255, 0.6)' : 'rgba(148,163,184,0.7)',
              letterSpacing: '0.1em',
            }}
          >
            {isMobile ? 'TOURNAMENTS FROM $1 • WINNER TAKES ALL' : 'Tournament entry from $1 • Instant crypto payouts'}
          </div>
        </main>

        <footer
          style={{
            width: '100%',
            maxWidth: isMobile ? '400px' : undefined,
            marginTop: isMobile ? '32px' : '16px',
            display: 'flex',
            justifyContent: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          {onLeaderboard && (
            <button
              type="button"
              className="btn-secondary"
              onClick={onLeaderboard}
              style={isMobile ? { flex: '1', minWidth: '140px', padding: '12px 20px' } : { background: 'transparent', border: 'none', padding: 0 }}
              onTouchStart={isMobile ? (e) => { e.currentTarget.style.transform = 'scale(0.98)'; } : undefined}
              onTouchEnd={isMobile ? (e) => { e.currentTarget.style.transform = 'scale(1)'; } : undefined}
            >
              {isMobile ? 'Ranks' : 'Leaderboard'}
            </button>
          )}
          {onWallet && !isMobile && (
            <button
              type="button"
              className="btn-secondary"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
              onClick={onWallet}
            >
              Wallet
            </button>
          )}
          {!isMobile && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, width: '100%', textAlign: 'center' }}>
              SOL: {solPrice != null ? `$${solPrice.toFixed(2)}` : '--'}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

export default Landing;
