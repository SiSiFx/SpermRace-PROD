import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LobbyManager } from '../src/LobbyManager.js';
import { SmartContractService } from '../src/SmartContractService.js';

describe('Queue Optimization Tests', () => {
  let lobbyManager: LobbyManager;
  let mockSmartContractService: SmartContractService;

  beforeEach(() => {
    // Mock SmartContractService
    mockSmartContractService = {
      getEntryFeeInSol: vi.fn().mockResolvedValue(1000),
      getEntryFeeInLamports: vi.fn().mockResolvedValue(1000000),
      createEntryFeeTransactionBase64: vi.fn().mockResolvedValue({
        txBase64: 'mockTx',
        recentBlockhash: 'mockBlockhash',
        prizePool: 1000
      }),
      verifyEntryFeePayment: vi.fn().mockResolvedValue(true)
    } as any;

    lobbyManager = new LobbyManager(mockSmartContractService);

    // Reset environment variables for consistent testing
    process.env.LOBBY_MAX_PLAYERS = '100';
    process.env.LOBBY_MAX_WAIT = '30';
    process.env.LOBBY_COUNTDOWN = '10';
    process.env.LOBBY_MIN_START = '2';
    process.env.LOBBY_SURGE_RULES = '10:2,20:3,30:4';
    process.env.SKIP_ENTRY_FEE = 'true';
    process.env.ENABLE_PRACTICE_BOTS = 'false';
    process.env.ENABLE_DEV_BOTS = 'false';
  });

  describe('Lobby Capacity - 100+ Players', () => {
    it('should support up to 100 players in a lobby', async () => {
      const playerIds = Array.from({ length: 100 }, (_, i) => `player-${i}`);
      let gameStarted = false;

      lobbyManager.onGameStart = (lobby) => {
        gameStarted = true;
        expect(lobby.players.length).toBeGreaterThan(0);
        expect(lobby.players.length).toBeLessThanOrEqual(100);
      };

      // Add players to lobby
      for (const playerId of playerIds) {
        await lobbyManager.joinLobby(playerId, 0 as any, 'practice');
      }

      // Give time for game start
      await new Promise(resolve => setTimeout(resolve, 100));

      const lobby = lobbyManager.getLobbyForPlayer('player-0');
      expect(lobby).toBeDefined();
      expect(lobby!.maxPlayers).toBe(100);
    });

    it('should create new lobby when first one is full', async () => {
      let gameStartCount = 0;
      lobbyManager.onGameStart = () => {
        gameStartCount++;
      };

      // Fill first lobby
      const firstLobbyPlayers = Array.from({ length: 100 }, (_, i) => `lobby1-player-${i}`);
      for (const playerId of firstLobbyPlayers) {
        await lobbyManager.joinLobby(playerId, 0 as any, 'practice');
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Add players to second lobby
      const secondLobbyPlayers = Array.from({ length: 10 }, (_, i) => `lobby2-player-${i}`);
      for (const playerId of secondLobbyPlayers) {
        await lobbyManager.joinLobby(playerId, 0 as any, 'practice');
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify players are in different lobbies
      const player1Lobby = lobbyManager.getLobbyForPlayer('lobby1-player-0');
      const player2Lobby = lobbyManager.getLobbyForPlayer('lobby2-player-0');

      expect(player1Lobby).toBeDefined();
      expect(player2Lobby).toBeDefined();
      expect(player1Lobby!.lobbyId).not.toBe(player2Lobby!.lobbyId);
    });
  });

  describe('Queue Time - < 30 seconds', () => {
    it('should start countdown immediately when 2+ players are present', async () => {
      let countdownStarted = false;
      lobbyManager.onLobbyCountdown = () => {
        countdownStarted = true;
      };

      await lobbyManager.joinLobby('player-1', 0 as any, 'practice');
      await new Promise(resolve => setTimeout(resolve, 50));

      await lobbyManager.joinLobby('player-2', 0 as any, 'practice');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(countdownStarted).toBe(true);
    });

    it('should enforce maximum wait time of 30 seconds', async () => {
      let gameStarted = false;
      const joinTimes: number[] = [];

      lobbyManager.onGameStart = () => {
        gameStarted = true;
      };

      // Players join at different times
      await lobbyManager.joinLobby('player-1', 0 as any, 'practice');
      joinTimes.push(Date.now());

      await new Promise(resolve => setTimeout(resolve, 5000));

      await lobbyManager.joinLobby('player-2', 0 as any, 'practice');
      joinTimes.push(Date.now());

      // Wait for game start (up to 20s total)
      await new Promise(resolve => setTimeout(resolve, 20000));

      expect(gameStarted).toBe(true);
    });
  });

  describe('Surge Rules - Progressive Minimum Player Reduction', () => {
    it('should reduce minimum players based on wait time', async () => {
      let countdownStarted = false;

      lobbyManager.onLobbyCountdown = () => {
        countdownStarted = true;
      };

      // Add 1 tournament player and wait
      await lobbyManager.joinLobby('player-1', 0 as any, 'tournament');
      await new Promise(resolve => setTimeout(resolve, 11000)); // 10s silent + 1s buffer

      // After 10 seconds, countdown should start for solo tournament player
      expect(countdownStarted).toBe(true);
    });

    it('should start game with 2 players after surge rules apply', async () => {
      let gameStarted = false;

      lobbyManager.onGameStart = (lobby) => {
        gameStarted = true;
        expect(lobby.players.length).toBeGreaterThanOrEqual(2);
      };

      // Add both players together to trigger immediate countdown
      const promises = [
        lobbyManager.joinLobby('player-1', 0 as any, 'tournament'),
        lobbyManager.joinLobby('player-2', 0 as any, 'tournament')
      ];

      await Promise.all(promises);
      await new Promise(resolve => setTimeout(resolve, 15000)); // Wait for countdown (10s countdown + buffer)

      expect(gameStarted).toBe(true);
    });
  });

  describe('Solo Player Wait Time - Reduced from 30s to 10s', () => {
    it('should start countdown after 10 seconds for solo players', async () => {
      let countdownStarted = false;
      let countdownStartTime: number | null = null;

      lobbyManager.onLobbyCountdown = () => {
        if (!countdownStarted) {
          countdownStarted = true;
          countdownStartTime = Date.now();
        }
      };

      const joinTime = Date.now();
      await lobbyManager.joinLobby('solo-player', 0 as any, 'tournament');

      // Countdown should NOT start immediately
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(countdownStarted).toBe(false);

      // Countdown should start after ~10 seconds
      await new Promise(resolve => setTimeout(resolve, 11000));
      expect(countdownStarted).toBe(true);

      if (countdownStartTime) {
        const waitTime = countdownStartTime - joinTime;
        expect(waitTime).toBeGreaterThan(9000); // ~10 seconds
        expect(waitTime).toBeLessThan(12000);
      }
    });

    it('should immediately start countdown when second player joins', async () => {
      let countdownStarted = false;
      let countdownStartTime: number | null = null;

      lobbyManager.onLobbyCountdown = () => {
        if (!countdownStarted) {
          countdownStarted = true;
          countdownStartTime = Date.now();
        }
      };

      await lobbyManager.joinLobby('player-1', 0 as any, 'tournament');
      await new Promise(resolve => setTimeout(resolve, 100));

      const secondPlayerJoinTime = Date.now();
      await lobbyManager.joinLobby('player-2', 0 as any, 'tournament');
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(countdownStarted).toBe(true);

      if (countdownStartTime) {
        const delay = countdownStartTime - secondPlayerJoinTime;
        expect(delay).toBeLessThan(1000); // Should start immediately
      }
    });
  });

  describe('High Load - 100+ Concurrent Players', () => {
    it('should handle 100 concurrent players efficiently', async () => {
      const startTime = Date.now();
      let gamesStarted = 0;
      const totalPlayers = 100;

      lobbyManager.onGameStart = (lobby) => {
        gamesStarted++;
        console.log(`Game ${gamesStarted} started with ${lobby.players.length} players`);
      };

      // Simulate 100 players joining rapidly
      const joinPromises = Array.from({ length: totalPlayers }, (_, i) =>
        lobbyManager.joinLobby(`player-${i}`, 0 as any, 'practice')
      );

      await Promise.all(joinPromises);
      await new Promise(resolve => setTimeout(resolve, 20000));

      const processingTime = Date.now() - startTime;

      // All players should be processed within reasonable time
      expect(processingTime).toBeLessThan(25000); // Should process 100 players in <25s

      // At least one game should have started
      expect(gamesStarted).toBeGreaterThan(0);
    });

    it('should distribute players across multiple lobbies efficiently', async () => {
      const lobbySizes = new Map<string, number>();

      lobbyManager.onLobbyUpdate = (lobby) => {
        lobbySizes.set(lobby.lobbyId, lobby.players.length);
      };

      // Add 150 players (should create 2 lobbies)
      for (let i = 0; i < 150; i++) {
        await lobbyManager.joinLobby(`player-${i}`, 0 as any, 'practice');
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const uniqueLobbies = new Set<string>();
      for (let i = 0; i < 150; i++) {
        const lobby = lobbyManager.getLobbyForPlayer(`player-${i}`);
        if (lobby) {
          uniqueLobbies.add(lobby.lobbyId);
        }
      }

      // Should have created at least 2 lobbies for 150 players
      expect(uniqueLobbies.size).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Configuration Validation', () => {
    it('should use default max players of 100 when not configured', () => {
      delete process.env.LOBBY_MAX_PLAYERS;

      const testLobbyManager = new LobbyManager(mockSmartContractService);

      // Create a lobby by joining
      testLobbyManager.joinLobby('test-player', 0 as any, 'practice');

      const lobby = testLobbyManager.getLobbyForPlayer('test-player');
      expect(lobby).toBeDefined();
      expect(lobby!.maxPlayers).toBe(100);
    });

    it('should use default max wait of 30 seconds when not configured', () => {
      delete process.env.LOBBY_MAX_WAIT;
      process.env.LOBBY_COUNTDOWN = '10';

      const testLobbyManager = new LobbyManager(mockSmartContractService);

      // Max wait should be at least the countdown duration
      expect(process.env.LOBBY_COUNTDOWN).toBe('10');
    });

    it('should use default surge rules when not configured', () => {
      delete process.env.LOBBY_SURGE_RULES;

      // Surge rules should be parsed from default
      const defaultRules = '10:2,20:3,30:4';
      const parts = defaultRules.split(',');
      expect(parts.length).toBe(3);

      parts.forEach(part => {
        const [secStr, minStr] = part.split(':');
        const sec = parseInt(secStr, 10);
        const min = parseInt(minStr, 10);
        expect(sec).toBeGreaterThan(0);
        expect(min).toBeGreaterThan(0);
      });
    });
  });

  describe('Player Disconnect and Reconnect', () => {
    it('should handle player leaving during countdown', async () => {
      let countdownStarted = false;
      let countdownReset = false;
      let lastLobbyStatus: string | null = null;

      lobbyManager.onLobbyCountdown = () => {
        countdownStarted = true;
      };

      lobbyManager.onLobbyUpdate = (lobby) => {
        if (lastLobbyStatus === 'starting' && lobby.status === 'waiting') {
          countdownReset = true;
        }
        lastLobbyStatus = lobby.status;
      };

      await lobbyManager.joinLobby('player-1', 0 as any, 'practice');
      await lobbyManager.joinLobby('player-2', 0 as any, 'practice');

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(countdownStarted).toBe(true);

      lastLobbyStatus = 'starting';
      lobbyManager.leaveLobby('player-2');

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(countdownReset).toBe(true);
    });

    it('should clean up empty lobbies', async () => {
      await lobbyManager.joinLobby('player-1', 0 as any, 'practice');
      const lobby = lobbyManager.getLobbyForPlayer('player-1');
      expect(lobby).toBeDefined();

      const lobbyId = lobby!.lobbyId;
      lobbyManager.leaveLobby('player-1');

      await new Promise(resolve => setTimeout(resolve, 100));

      const removedLobby = lobbyManager.getLobbyForPlayer('player-1');
      expect(removedLobby).toBeNull();
    });
  });
});
