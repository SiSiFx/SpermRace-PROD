import { useState, useRef, useEffect } from 'react';
import { Robot, GlobeHemisphereWest, User, X } from 'phosphor-react';
import { useWs } from './WsProvider';
import { useWallet } from '@solana/wallet-adapter-react';

interface PracticeModeSelectionProps {
    onSelectSolo: () => void;
    onBack: () => void;
    onNotify?: (msg: string) => void;
}

export function PracticeModeSelection({ onSelectSolo, onBack, onNotify }: PracticeModeSelectionProps) {
    const { connectAndJoin, state: wsState } = useWs();
    const { publicKey } = useWallet();
    const [isJoining, setIsJoining] = useState(false);
    const [showNameInput, setShowNameInput] = useState(false);
    const [guestName, setGuestName] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [inviteBusy, setInviteBusy] = useState(false);

    useEffect(() => {
        try {
            const stored = localStorage.getItem('sr_guest_name');
            if (stored && stored.trim()) setGuestName(stored.trim());
        } catch { }
    }, []);

    // Focus input when modal opens
    useEffect(() => {
        if (showNameInput) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [showNameInput]);

    // Prevent multiple join attempts
    const isDisabled = isJoining || wsState.phase === 'connecting' || wsState.phase === 'authenticating';

    const joinLobby = async (asGuest: boolean, nameOverride?: string) => {
        setIsJoining(true);
        try {
            const resolvedName = asGuest ? ((nameOverride ?? guestName).trim() || 'Guest') : undefined;
            // Join online lobby with tier: 0 (Free)
            // If guest, pass guestName
            await connectAndJoin({
                entryFeeTier: 0 as any,
                mode: 'practice' as any, // Schema requires 'practice' or 'tournament'
                guestName: resolvedName
            });
            try {
                const nameToStore = (resolvedName || '').trim();
                if (nameToStore) localStorage.setItem('sr_guest_name', nameToStore);
            } catch { }
            // Note: App routing will switch screen to 'lobby' based on wsState.phase
        } catch (e) {
            console.error('Failed to join free lobby', e);
            setIsJoining(false);
            setShowNameInput(false);
            onNotify?.('Failed to join server');
        }
    };

    const handleJoinOnlineClick = () => {
        if (isDisabled) return;

        // For practice, always use guest flow to avoid signature requests
        const walletDerivedName = publicKey ? (publicKey.toBase58().slice(0, 4) + '…' + publicKey.toBase58().slice(-4)) : '';
        const defaultName = (guestName && guestName.trim()) ? guestName.trim() : walletDerivedName;
        if (!guestName && walletDerivedName) setGuestName(walletDerivedName);

        // If we already have a name (from localStorage or wallet), let "Multiplayer" be one-tap join.
        if (!defaultName) {
            setShowNameInput(true);
            return;
        }
        joinLobby(true, defaultName);
    };

    const handleGuestSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!guestName.trim()) return;
        joinLobby(true, guestName.trim());
    };

    // Responsive check
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const [hovered, setHovered] = useState<string | null>(null);

    const inviteLink = (() => {
        try {
            const u = new URL(window.location.href);
            u.searchParams.set('practice', '1');
            u.searchParams.delete('tournament');
            return u.toString();
        } catch {
            return '';
        }
    })();

    const copyInviteLink = async () => {
        if (!inviteLink) return;
        if (inviteBusy) return;
        setInviteBusy(true);
        try {
            const navAny: any = navigator as any;
            if (navAny?.share) {
                await navAny.share({ title: 'SpermRace Practice Multiplayer', text: 'Join my free practice match', url: inviteLink });
                onNotify?.('Invite sent');
                return;
            }
            try {
                await navigator.clipboard.writeText(inviteLink);
                onNotify?.('Invite link copied');
                return;
            } catch { }
            const ta = document.createElement('textarea');
            ta.value = inviteLink;
            ta.setAttribute('readonly', 'true');
            ta.style.position = 'fixed';
            ta.style.top = '-1000px';
            ta.style.left = '-1000px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            onNotify?.('Invite link copied');
        } catch {
            onNotify?.('Failed to copy invite link');
        } finally {
            setInviteBusy(false);
        }
    };

    return (
        <div className="practice-mode-overlay" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(3, 7, 18, 0.95)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: isMobile ? 'flex-start' : 'center', // Top alignment on mobile for scroll
            justifyContent: 'center',
            padding: isMobile ? '40px 16px' : '20px',
            animation: 'fadeIn 0.3s ease-out',
            overflowY: 'auto', // Allow overlay to scroll
            overscrollBehavior: 'none',
            touchAction: 'pan-y',
            WebkitOverflowScrolling: 'touch'
        }}>
            <div className="mode-selection-card" style={{
                width: '100%',
                maxWidth: 900,
                background: 'rgba(10, 20, 35, 0.6)',
                border: '1px solid rgba(0, 245, 255, 0.15)',
                borderRadius: 24,
                padding: isMobile ? '24px' : '40px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 0 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(0, 245, 255, 0.05)',
                position: 'relative',
                height: 'auto',
                margin: isMobile ? 'auto 0' : '0' // Center vertically if space allows
            }}>

                {/* Close/Back Button (Top Right) */}
                <button
                    onClick={onBack}
                    style={{
                        position: 'absolute',
                        top: isMobile ? 16 : 24,
                        right: isMobile ? 16 : 24,
                        background: 'rgba(255,255,255,0.05)',
                        border: 'none',
                        color: 'rgba(255,255,255,0.6)',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: '50%',
                        width: 36,
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s'
                    }}
                >
                    <X size={20} />
                </button>

                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: isMobile ? 32 : 48, marginTop: isMobile ? 8 : 0 }}>
                    <div style={{
                        fontSize: isMobile ? 10 : 12,
                        letterSpacing: '0.4em',
                        color: '#00f5ff',
                        marginBottom: 12,
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        textShadow: '0 0 10px rgba(0, 245, 255, 0.4)'
                    }}>
                        TRAINING GROUNDS
                    </div>
                    <h1 style={{
                        fontFamily: 'Orbitron, sans-serif',
                        fontSize: isMobile ? 28 : 42,
                        fontWeight: 800,
                        color: '#fff',
                        margin: 0,
                        letterSpacing: '0.05em',
                        background: 'linear-gradient(180deg, #fff 0%, #a5f3fc 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        filter: 'drop-shadow(0 0 20px rgba(0, 245, 255, 0.3))'
                    }}>
                        SELECT MODE
                    </h1>
                    <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {!!inviteLink && (
                            <button
                                type="button"
                                onClick={copyInviteLink}
                                disabled={inviteBusy}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    padding: isMobile ? '10px 14px' : '10px 16px',
                                    borderRadius: 999,
                                    border: '1px solid rgba(0, 245, 255, 0.24)',
                                    background: 'rgba(0, 245, 255, 0.06)',
                                    color: 'rgba(255,255,255,0.9)',
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    cursor: inviteBusy ? 'wait' : 'pointer'
                                }}
                            >
                                <span style={{ fontSize: 12 }}>{inviteBusy ? 'SENDING…' : 'INVITE FRIEND'}</span>
                            </button>
                        )}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.55)', maxWidth: 560 }}>
                        Practice multiplayer is free. Bots may fill empty slots so you can fight instantly.
                    </div>
                </div>

                {/* Options Grid/Flex */}
                <div style={{
                    display: isMobile ? 'flex' : 'grid',
                    flexDirection: 'column',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    gap: 16, // Tighter gap on mobile
                    width: '100%',
                    marginBottom: 32
                }}>

                    {/* Left: SOLO */}
                    <button
                        onClick={onSelectSolo}
                        onMouseEnter={() => setHovered('solo')}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'row' : 'column',
                            alignItems: 'center',
                            textAlign: isMobile ? 'left' : 'center',
                            padding: isMobile ? '20px' : '40px 24px',
                            gap: isMobile ? 16 : 0, // Gap between icon and text
                            borderRadius: 20,
                            border: '1px solid',
                            borderColor: hovered === 'solo' ? 'rgba(34, 211, 238, 0.6)' : 'rgba(255,255,255,0.08)',
                            background: hovered === 'solo'
                                ? 'linear-gradient(145deg, rgba(34, 211, 238, 0.1) 0%, rgba(34, 211, 238, 0.02) 100%)'
                                : 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: !isMobile && hovered === 'solo' ? 'translateY(-4px)' : 'none',
                            boxShadow: !isMobile && hovered === 'solo' ? '0 10px 30px -10px rgba(34, 211, 238, 0.3)' : 'none',
                            minHeight: isMobile ? 0 : 300 // Ensure PC cards have height
                        }}
                    >
                        <div style={{
                            width: isMobile ? 48 : 80,
                            height: isMobile ? 48 : 80,
                            borderRadius: isMobile ? 12 : '50%',
                            background: 'rgba(34, 211, 238, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: isMobile ? 0 : 24,
                            border: '1px solid rgba(34, 211, 238, 0.3)',
                            flexShrink: 0
                        }}>
                            <Robot size={isMobile ? 24 : 40} weight="duotone" color="#22d3ee" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, color: '#fff', margin: '0 0 4px 0', fontFamily: 'Orbitron, sans-serif' }}>SOLO BOTS</h3>
                            <p style={{ fontSize: isMobile ? 13 : 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, margin: 0 }}>
                                {isMobile ? "Practice offline against AI opponents." : "Offline practice against AI. Perfect for learning controls and mechanics without pressure."}
                            </p>
                        </div>
                    </button>

                    {/* Right: MULTIPLAYER */}
                    <button
                        onClick={handleJoinOnlineClick}
                        disabled={isDisabled}
                        onMouseEnter={() => setHovered('multi')}
                        onMouseLeave={() => setHovered(null)}
                        style={{
                            display: 'flex',
                            flexDirection: isMobile ? 'row' : 'column',
                            alignItems: 'center',
                            textAlign: isMobile ? 'left' : 'center',
                            padding: isMobile ? '20px' : '40px 24px',
                            gap: isMobile ? 16 : 0,
                            borderRadius: 20,
                            border: '1px solid',
                            borderColor: isDisabled ? 'rgba(255,255,255,0.05)' : (hovered === 'multi' ? '#00ff88' : 'rgba(0, 255, 136, 0.3)'),
                            background: isDisabled
                                ? 'rgba(0,0,0,0.2)'
                                : (hovered === 'multi'
                                    ? 'linear-gradient(145deg, rgba(0, 255, 136, 0.1) 0%, rgba(0, 255, 136, 0.02) 100%)'
                                    : 'linear-gradient(145deg, rgba(0, 255, 136, 0.05) 0%, rgba(0, 255, 136, 0.01) 100%)'),
                            cursor: isDisabled ? 'wait' : 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transform: !isDisabled && !isMobile && hovered === 'multi' ? 'translateY(-4px)' : 'none',
                            opacity: isDisabled ? 0.6 : 1,
                            position: 'relative',
                            boxShadow: !isDisabled && !isMobile && hovered === 'multi' ? '0 10px 30px -10px rgba(0, 255, 136, 0.3)' : 'none',
                            minHeight: isMobile ? 0 : 300
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: isMobile ? 12 : 16,
                            right: 16,
                            background: '#00ff88',
                            color: '#001a0f',
                            fontSize: 10,
                            fontWeight: 800,
                            padding: '4px 8px',
                            borderRadius: 8,
                            letterSpacing: '0.05em'
                        }}>
                            FREE
                        </div>

                        <div style={{
                            width: isMobile ? 48 : 80,
                            height: isMobile ? 48 : 80,
                            borderRadius: isMobile ? 12 : '50%',
                            background: 'rgba(0, 255, 136, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginBottom: isMobile ? 0 : 24,
                            border: '1px solid rgba(0, 255, 136, 0.3)',
                            flexShrink: 0
                        }}>
                            <GlobeHemisphereWest size={isMobile ? 24 : 40} weight="duotone" color="#00ff88" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: isMobile ? 18 : 24, fontWeight: 700, color: '#fff', margin: '0 0 4px 0', fontFamily: 'Orbitron, sans-serif' }}>MULTIPLAYER</h3>
                            <p style={{ fontSize: isMobile ? 13 : 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, margin: 0 }}>
                                {isMobile ? "Compete online with others." : "Compete online with other players in a free lobby. Test your skills live!"}
                            </p>
                        </div>
                    </button>

                </div>

                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 20 }}>
                    Select a mode to begin your training
                </div>

                {/* GUEST NAME INPUT MODAL */}
                {showNameInput && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 200,
                        background: 'rgba(0,0,0,0.85)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20
                    }}>
                        <div style={{
                            background: '#111827', // Solid dark for better readability
                            border: '1px solid rgba(0, 245, 255, 0.3)',
                            borderRadius: 24,
                            padding: 40,
                            width: '100%',
                            maxWidth: 400,
                            boxShadow: '0 0 50px rgba(0, 245, 255, 0.15)',
                            position: 'relative',
                            animation: 'scaleIn 0.2s ease-out'
                        }}>
                            <button
                                onClick={() => setShowNameInput(false)}
                                style={{
                                    position: 'absolute',
                                    top: 16,
                                    right: 16,
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255,255,255,0.4)',
                                    cursor: 'pointer',
                                    padding: 8
                                }}
                            >
                                <X size={20} />
                            </button>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                                <div style={{
                                    width: 72,
                                    height: 72,
                                    borderRadius: '50%',
                                    background: 'rgba(0, 245, 255, 0.1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    border: '1px solid rgba(0, 245, 255, 0.3)',
                                    boxShadow: '0 0 20px rgba(0, 245, 255, 0.2)'
                                }}>
                                    <User size={36} color="#00f5ff" weight="duotone" />
                                </div>

                                <div style={{ textAlign: 'center' }}>
                                    <h3 style={{ fontSize: 24, color: '#fff', margin: '0 0 8px 0', fontFamily: 'Orbitron, sans-serif' }}>IDENTITY</h3>
                                    <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', margin: 0 }}>
                                        Enter a nickname for this session.
                                    </p>
                                </div>

                                <form onSubmit={handleGuestSubmit} style={{ width: '100%' }}>
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        placeholder="Enter Nickname"
                                        value={guestName}
                                        onChange={e => setGuestName(e.target.value)}
                                        maxLength={15}
                                        style={{
                                            width: '100%',
                                            padding: '16px',
                                            borderRadius: 12,
                                            background: 'rgba(0,0,0,0.3)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            color: '#fff',
                                            fontSize: 18,
                                            textAlign: 'center',
                                            marginBottom: 20,
                                            outline: 'none',
                                            fontFamily: 'monospace',
                                            transition: 'border-color 0.2s'
                                        }}
                                        onFocus={e => e.target.style.borderColor = '#00f5ff'}
                                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                                        autoFocus
                                    />
                                    <button
                                        type="submit"
                                        disabled={isJoining || !guestName.trim()}
                                        style={{
                                            width: '100%',
                                            padding: '18px',
                                            borderRadius: 12,
                                            background: (!guestName.trim() || isJoining)
                                                ? 'rgba(255,255,255,0.1)'
                                                : 'linear-gradient(135deg, #00f5ff 0%, #00ff88 100%)',
                                            color: (!guestName.trim() || isJoining) ? 'rgba(255,255,255,0.3)' : '#001a0f',
                                            border: 'none',
                                            fontSize: 16,
                                            fontWeight: 800,
                                            letterSpacing: '0.05em',
                                            cursor: (!guestName.trim() || isJoining) ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s',
                                            boxShadow: (!guestName.trim() || isJoining) ? 'none' : '0 0 20px rgba(0, 245, 255, 0.3)'
                                        }}
                                    >
                                        {isJoining ? 'JOINING...' : 'ENTER ARENA'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
