/**
 * Wallet Screen Component - Taste-Skill Compliant
 * Mobile-first, non-scrollable, liquid glass design
 */

'use client';

import { CrownSimple, Wallet, CheckCircle, Spinner, WarningCircle, Question, X } from 'phosphor-react';
import { useWallet } from '../WalletProvider';
import { useState, memo } from 'react';
import { motion } from 'framer-motion';
import './WalletScreen.css';

interface WalletScreenProps {
  onConnected: () => void;
  onClose: () => void;
  entryFee?: number;
}

export const WalletScreen = memo(function WalletScreen({ onConnected, onClose, entryFee }: WalletScreenProps) {
  const { connect, disconnect, publicKey, isConnecting } = useWallet();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleConnect = async () => {
    setConnectionError(null);
    try {
      if (await connect()) {
        onConnected();
      }
    } catch (error: any) {
      console.error('[WalletScreen] Connection failed:', error);
      setConnectionError(error?.message || 'Connection failed. Please try again.');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      setConnectionError(null);
    } catch (error: any) {
      console.error('[WalletScreen] Disconnect failed:', error);
    }
  };

  const walletOptions = [
    {
      name: 'Phantom',
      icon: '👻',
      description: 'Most popular Solana wallet',
      url: 'https://phantom.app/ul/browse/',
      recommended: true,
    },
    {
      name: 'Backpack',
      icon: '🎒',
      description: 'Advanced trading features',
      url: 'https://backpack.app',
      recommended: false,
    },
    {
      name: 'Solflare',
      icon: '☀️',
      description: 'Secure and simple',
      url: 'https://solflare.com',
      recommended: false,
    },
  ];

  const formatEntryFee = (fee?: number) => {
    if (!fee) return null;
    return `$${fee}`;
  };

  return (
    <div className="wallet-screen">
      <motion.div
        className="wallet-container"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      >
        {/* Close button */}
        <motion.button
          className="wallet-close-btn"
          onClick={onClose}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          aria-label="Close"
        >
          <X size={20} weight="bold" />
        </motion.button>

        {/* Icon */}
        <motion.div
          className="wallet-icon-wrapper"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Wallet size={48} weight="duotone" />
        </motion.div>

        {/* Title */}
        <motion.div
          className="wallet-header"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="wallet-title">Connect Wallet</h1>
          <p className="wallet-subtitle">
            Sign in with Solana{entryFee ? ` to join $${entryFee} tournament` : ' to continue'}
          </p>
        </motion.div>

        {/* Connected State */}
        {publicKey ? (
          <motion.div
            className="wallet-connected"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 100, damping: 20 }}
          >
            <div className="connected-icon">
              <CheckCircle size={32} weight="fill" />
            </div>
            <div className="connected-address">
              {publicKey?.slice ? `${publicKey.slice(0, 6)}…${publicKey.slice(-6)}` : 'Connected'}
            </div>
            <div className="connected-label">Wallet Connected</div>
            {entryFee && (
              <div className="connected-tier">Entry: {formatEntryFee(entryFee)}</div>
            )}
            <motion.button
              className="wallet-disconnect-btn"
              onClick={handleDisconnect}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Disconnect
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* Loading State */}
            {isConnecting && (
              <motion.div
                className="wallet-loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Spinner size={32} weight="duotone" className="wallet-spinner" />
                <div className="wallet-loading-text">Connecting to wallet…</div>
                <p className="wallet-loading-hint">Check your wallet app and approve the connection</p>
              </motion.div>
            )}

            {/* Error State */}
            {connectionError && (
              <motion.div
                className="wallet-error"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <WarningCircle size={24} weight="fill" />
                <div className="wallet-error-text">{connectionError}</div>
                <motion.button
                  className="wallet-retry-btn"
                  onClick={handleConnect}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  Try Again
                </motion.button>
              </motion.div>
            )}

            {/* Wallet Options */}
            {!isConnecting && (
              <motion.div
                className="wallet-options"
                initial="hidden"
                animate="visible"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.08
                    }
                  }
                }}
              >
                {walletOptions.map((option) => (
                  <motion.button
                    key={option.name}
                    className="wallet-option"
                    onClick={handleConnect}
                    disabled={isConnecting}
                    variants={{
                      hidden: { opacity: 0, x: -20 },
                      visible: { opacity: 1, x: 0 }
                    }}
                    whileHover={{ scale: 1.02, x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <div className="wallet-option-icon">{option.icon}</div>
                    <div className="wallet-option-info">
                      <div className="wallet-option-name">
                        {option.name}
                        {option.recommended && (
                          <span className="wallet-badge">RECOMMENDED</span>
                        )}
                      </div>
                      <div className="wallet-option-desc">{option.description}</div>
                    </div>
                    <CrownSimple size={16} weight="duotone" />
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Entry fee reminder */}
            {entryFee && !isConnecting && (
              <motion.div
                className="wallet-entry-fee"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <span className="fee-label">Tournament Entry:</span>
                <span className="fee-amount">{formatEntryFee(entryFee)}</span>
              </motion.div>
            )}

            {/* Help button */}
            {!isConnecting && (
              <motion.button
                className="wallet-help-btn"
                onClick={() => setShowHelp(!showHelp)}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                aria-label="What is a wallet?"
              >
                <Question size={20} weight="bold" />
              </motion.button>
            )}

            {/* Help content */}
            {showHelp && !isConnecting && (
              <motion.div
                className="wallet-help-content"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <p><strong>What is a wallet?</strong></p>
                <p>A crypto wallet like Phantom lets you securely store SOL and sign transactions. It's like a digital bank account for cryptocurrency.</p>
                <p><strong>Don't have one?</strong></p>
                <p>We recommend Phantom. Download it from the app store, then return here to connect.</p>
              </motion.div>
            )}

            {/* Security info */}
            {!isConnecting && (
              <motion.div
                className="wallet-info"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="info-icon">🔒</div>
                <div className="info-text">
                  Your wallet is secure. We only request permission to verify your identity.
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.entryFee === nextProps.entryFee;
});

export default WalletScreen;
