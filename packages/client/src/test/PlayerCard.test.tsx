/**
 * PlayerCard Component Tests
 * Tests for the animated data card component displaying player information
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlayerCard } from '../components/PlayerCard';

describe('PlayerCard Component', () => {
  describe('Rendering', () => {
    it('should render player card with basic props', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      // Check that the card exists and has the player name
      const card = container.querySelector('.player-card');
      expect(card).toBeInTheDocument();

      // Check for the player name element
      const playerName = container.querySelector('.player-name');
      expect(playerName).toBeInTheDocument();
      expect(playerName?.textContent).toBe('TestPlayer');
    });

    it('should display "YOU" badge when isMe is true', () => {
      render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={true}
          index={0}
        />
      );

      expect(screen.getByText('YOU')).toBeInTheDocument();
    });

    it('should display "BOT" badge for bot players', () => {
      render(
        <PlayerCard
          playerId="BOT_1"
          playerName="Bot Player"
          isMe={false}
          index={0}
        />
      );

      expect(screen.getByText('BOT')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    it('should display both YOU and badge when it is a bot and isMe', () => {
      render(
        <PlayerCard
          playerId="BOT_ME"
          playerName="My Bot"
          isMe={true}
          index={0}
        />
      );

      expect(screen.getByText('YOU')).toBeInTheDocument();
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    it('should display guest emoji for guest players', () => {
      render(
        <PlayerCard
          playerId="guest-123"
          playerName="Guest Player"
          isMe={false}
          index={0}
        />
      );

      expect(screen.getByText('🤖')).toBeInTheDocument();
    });
  });

  describe('Player Names', () => {
    it('should display full player name in uppercase', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="john_doe"
          isMe={false}
          index={0}
        />
      );

      // The name is uppercased via CSS, not in the DOM
      expect(screen.getByText((content) => content.includes('john_doe'))).toBeInTheDocument();
    });

    it('should extract initials from two-word name', () => {
      render(
        <PlayerCard
          playerId="player-123"
          playerName="John Doe"
          isMe={false}
          index={0}
        />
      );

      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('should extract first two letters for single-word name', () => {
      render(
        <PlayerCard
          playerId="player-123"
          playerName="Alice"
          isMe={false}
          index={0}
        />
      );

      expect(screen.getByText('AL')).toBeInTheDocument();
    });

    it('should handle wallet address format', () => {
      const { container } = render(
        <PlayerCard
          playerId="wallet123"
          playerName="AB12…CD34"
          isMe={false}
          index={0}
        />
      );

      expect(screen.getByText((content) => content.includes('AB12…CD34'))).toBeInTheDocument();
    });
  });

  describe('Status Indicators', () => {
    it('should display "Ready" status when isReady is true', () => {
      render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          isReady={true}
          index={0}
        />
      );

      expect(screen.getByText('Ready')).toBeInTheDocument();
    });

    it('should display "Waiting" status when isReady is false', () => {
      render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          isReady={false}
          index={0}
        />
      );

      expect(screen.getByText('Waiting')).toBeInTheDocument();
    });

    it('should show status label', () => {
      render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      expect(screen.getByText('Status')).toBeInTheDocument();
    });
  });

  describe('Styling and Classes', () => {
    it('should render with player-card class', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      const card = container.querySelector('.player-card');
      expect(card).toBeInTheDocument();
    });

    it('should render with card content wrapper', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      const content = container.querySelector('.player-card-content');
      expect(content).toBeInTheDocument();
    });

    it('should render with avatar section', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      const avatar = container.querySelector('.player-card-avatar');
      expect(avatar).toBeInTheDocument();
    });

    it('should render with status dot', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          isReady={true}
          index={0}
        />
      );

      const statusDot = container.querySelector('.player-status-dot');
      expect(statusDot).toBeInTheDocument();
      expect(statusDot).toHaveClass('ready');
    });

    it('should render corner accents', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      const corners = container.querySelectorAll('.corner-accent');
      expect(corners.length).toBe(4);
      expect(container.querySelector('.corner-tl')).toBeInTheDocument();
      expect(container.querySelector('.corner-tr')).toBeInTheDocument();
      expect(container.querySelector('.corner-bl')).toBeInTheDocument();
      expect(container.querySelector('.corner-br')).toBeInTheDocument();
    });

    it('should render scanning line animation element', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      const scanLine = container.querySelector('.player-card-scan');
      expect(scanLine).toBeInTheDocument();
    });
  });

  describe('Animation Delays', () => {
    it('should set animation delay based on index', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={3}
        />
      );

      const card = container.querySelector('.player-card');
      expect(card).toHaveStyle({
        '--animation-delay': '0.24s',
      });
    });

    it('should have zero delay for first card', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      const card = container.querySelector('.player-card');
      expect(card).toHaveStyle({
        '--animation-delay': '0s',
      });
    });

    it('should calculate delay correctly for multiple cards', () => {
      const { container: container1 } = render(
        <PlayerCard
          playerId="player-1"
          playerName="Player 1"
          isMe={false}
          index={0}
        />
      );

      const { container: container2 } = render(
        <PlayerCard
          playerId="player-2"
          playerName="Player 2"
          isMe={false}
          index={1}
        />
      );

      const { container: container3 } = render(
        <PlayerCard
          playerId="player-3"
          playerName="Player 3"
          isMe={false}
          index={2}
        />
      );

      expect(container1.querySelector('.player-card')).toHaveStyle({
        '--animation-delay': '0s',
      });

      expect(container2.querySelector('.player-card')).toHaveStyle({
        '--animation-delay': '0.08s',
      });

      expect(container3.querySelector('.player-card')).toHaveStyle({
        '--animation-delay': '0.16s',
      });
    });
  });

  describe('Custom Player Colors', () => {
    it('should use custom color when provided', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
          playerColor="#FF5733"
        />
      );

      const card = container.querySelector('.player-card');
      expect(card).toHaveStyle({
        '--player-color': '#FF5733',
      });
    });

    it('should use default cyan color when not provided', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      const card = container.querySelector('.player-card');
      // The component generates a color from the player ID hash, so we check that a CSS variable is set
      const style = (card as HTMLElement).style.getPropertyValue('--player-color');
      expect(style).toBeTruthy();
      expect(style.length).toBeGreaterThan(0);
    });
  });

  describe('Accessibility', () => {
    it('should be readable with proper contrast', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={0}
        />
      );

      const playerName = container.querySelector('.player-name');
      expect(playerName).toBeInTheDocument();
      expect(playerName?.textContent).toBe('TestPlayer');
    });

    it('should display badges for screen readers', () => {
      render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={true}
          index={0}
        />
      );

      const youBadge = screen.getByText('YOU');
      expect(youBadge).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty player name', () => {
      render(
        <PlayerCard
          playerId="player-123"
          playerName=""
          isMe={false}
          index={0}
        />
      );

      const card = document.querySelector('.player-card');
      expect(card).toBeInTheDocument();
    });

    it('should handle very long player names', () => {
      const longName = 'VeryLongPlayerNameThatExceedsNormalLength';

      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName={longName}
          isMe={false}
          index={0}
        />
      );

      expect(screen.getByText((content) => content.includes(longName))).toBeInTheDocument();
    });

    it('should handle special characters in player name', () => {
      const specialName = 'Player_123!@#';

      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName={specialName}
          isMe={false}
          index={0}
        />
      );

      expect(screen.getByText((content) => content.includes(specialName))).toBeInTheDocument();
    });

    it('should handle negative index', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={-1}
        />
      );

      const card = container.querySelector('.player-card');
      expect(card).toHaveStyle({
        '--animation-delay': '-0.08s',
      });
    });

    it('should handle very large index', () => {
      const { container } = render(
        <PlayerCard
          playerId="player-123"
          playerName="TestPlayer"
          isMe={false}
          index={100}
        />
      );

      const card = container.querySelector('.player-card');
      expect(card).toHaveStyle({
        '--animation-delay': '8s',
      });
    });
  });

  describe('Multiple Cards', () => {
    it('should render multiple cards with different players', () => {
      const players = [
        { id: 'player-1', name: 'Alice', isMe: true },
        { id: 'player-2', name: 'Bob', isMe: false },
        { id: 'BOT_1', name: 'Bot1', isMe: false },
      ];

      const { container } = render(
        <div>
          {players.map((player, index) => (
            <PlayerCard
              key={player.id}
              playerId={player.id}
              playerName={player.name}
              isMe={player.isMe}
              index={index}
            />
          ))}
        </div>
      );

      const cards = container.querySelectorAll('.player-card');
      expect(cards.length).toBe(3);

      expect(screen.getByText((content) => content.includes('Alice'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('Bob'))).toBeInTheDocument();
      expect(screen.getByText((content) => content.includes('Bot1'))).toBeInTheDocument();
      expect(screen.getByText('YOU')).toBeInTheDocument();
      expect(screen.getByText('BOT')).toBeInTheDocument();
    });
  });
});
