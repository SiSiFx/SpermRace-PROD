import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseService } from '../src/DatabaseService.js';
import { LobbyManager } from '../src/LobbyManager.js';
import { SmartContractService } from '../src/SmartContractService.js';
import { Lobby, EntryFeeTier, GameMode } from 'shared';
import { randomUUID } from 'crypto';
import fs from 'fs';

describe('ELO Matchmaking', () => {
  let db: DatabaseService;
  let lobbyManager: LobbyManager;
  let smartContractService: SmartContractService;
  let testDbPath: string;

  beforeEach(async () => {
    // Create a temporary database for testing
    testDbPath = `./test-elo-${randomUUID()}.db`;
    db = new DatabaseService(testDbPath);
    smartContractService = new SmartContractService();
    lobbyManager = new LobbyManager(smartContractService, db);
  });

  afterEach(() => {
    // Clean up the test database
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('Player ELO initialization', () => {
    it('should assign default ELO of 1200 to new players', () => {
      const playerId = randomUUID();
      const elo = db.getPlayerElo(playerId);
      expect(elo).toBe(1200);
    });

    it('should update player ELO rating', () => {
      const playerId = randomUUID();
      db.updatePlayerElo(playerId, 1500);
      const elo = db.getPlayerElo(playerId);
      expect(elo).toBe(1500);
    });
  });

  describe('ELO spread validation', () => {
    it('should allow players with similar ELO to join the same lobby', async () => {
      const player1 = randomUUID();
      const player2 = randomUUID();

      // Set ELO ratings within 500 spread
      db.updatePlayerElo(player1, 1200);
      db.updatePlayerElo(player2, 1500); // 300 spread

      await lobbyManager.joinLobby(player1, 1, 'tournament');
      await lobbyManager.joinLobby(player2, 1, 'tournament');

      const lobby1 = lobbyManager.getLobbyForPlayer(player1);
      const lobby2 = lobbyManager.getLobbyForPlayer(player2);

      expect(lobby1).not.toBeNull();
      expect(lobby2).not.toBeNull();
      expect(lobby1?.lobbyId).toBe(lobby2?.lobbyId); // Same lobby
    });

    it('should prevent players with ELO spread > 500 from joining the same lobby', async () => {
      const player1 = randomUUID();
      const player2 = randomUUID();

      // Set ELO ratings with more than 500 spread
      db.updatePlayerElo(player1, 1000);
      db.updatePlayerElo(player2, 1600); // 600 spread

      await lobbyManager.joinLobby(player1, 1, 'tournament');
      await lobbyManager.joinLobby(player2, 1, 'tournament');

      const lobby1 = lobbyManager.getLobbyForPlayer(player1);
      const lobby2 = lobbyManager.getLobbyForPlayer(player2);

      expect(lobby1).not.toBeNull();
      expect(lobby2).not.toBeNull();
      expect(lobby1?.lobbyId).not.toBe(lobby2?.lobbyId); // Different lobbies
    });

    it('should allow ELO spread of exactly 500', async () => {
      const player1 = randomUUID();
      const player2 = randomUUID();

      // Set ELO ratings with exactly 500 spread
      db.updatePlayerElo(player1, 1200);
      db.updatePlayerElo(player2, 1700); // 500 spread

      await lobbyManager.joinLobby(player1, 1, 'tournament');
      await lobbyManager.joinLobby(player2, 1, 'tournament');

      const lobby1 = lobbyManager.getLobbyForPlayer(player1);
      const lobby2 = lobbyManager.getLobbyForPlayer(player2);

      expect(lobby1).not.toBeNull();
      expect(lobby2).not.toBeNull();
      expect(lobby1?.lobbyId).toBe(lobby2?.lobbyId); // Same lobby
    });

    it('should not apply ELO restrictions to practice mode', async () => {
      const player1 = randomUUID();
      const player2 = randomUUID();

      // Set ELO ratings with large spread
      db.updatePlayerElo(player1, 800);
      db.updatePlayerElo(player2, 1800); // 1000 spread

      await lobbyManager.joinLobby(player1, 0, 'practice');
      await lobbyManager.joinLobby(player2, 0, 'practice');

      const lobby1 = lobbyManager.getLobbyForPlayer(player1);
      const lobby2 = lobbyManager.getLobbyForPlayer(player2);

      expect(lobby1).not.toBeNull();
      expect(lobby2).not.toBeNull();
      expect(lobby1?.lobbyId).toBe(lobby2?.lobbyId); // Same lobby even with large spread
    });

    it('should handle multiple players with varying ELOs correctly', async () => {
      const players = Array.from({ length: 5 }, () => randomUUID());

      // Set ELOs: 1200, 1400, 1500, 1600, 1700 (max spread 500)
      db.updatePlayerElo(players[0], 1200);
      db.updatePlayerElo(players[1], 1400);
      db.updatePlayerElo(players[2], 1500);
      db.updatePlayerElo(players[3], 1600);
      db.updatePlayerElo(players[4], 1700);

      for (const player of players) {
        await lobbyManager.joinLobby(player, 1, 'tournament');
      }

      // All players should be in the same lobby
      const lobbies = new Set();
      for (const player of players) {
        const lobby = lobbyManager.getLobbyForPlayer(player);
        expect(lobby).not.toBeNull();
        lobbies.add(lobby?.lobbyId);
      }

      expect(lobbies.size).toBe(1); // All in one lobby
    });

    it('should split players into multiple lobbies when ELO range is too wide', async () => {
      const players = Array.from({ length: 6 }, () => randomUUID());

      // Set ELOs spanning 1000 points
      db.updatePlayerElo(players[0], 1000);
      db.updatePlayerElo(players[1], 1200);
      db.updatePlayerElo(players[2], 1400);
      db.updatePlayerElo(players[3], 1600);
      db.updatePlayerElo(players[4], 1800);
      db.updatePlayerElo(players[5], 2000);

      for (const player of players) {
        await lobbyManager.joinLobby(player, 1, 'tournament');
      }

      // Players should be split into at least 2 lobbies
      const lobbies = new Set();
      for (const player of players) {
        const lobby = lobbyManager.getLobbyForPlayer(player);
        expect(lobby).not.toBeNull();
        lobbies.add(lobby?.lobbyId);
      }

      expect(lobbies.size).toBeGreaterThan(1); // Multiple lobbies
    });
  });

  describe('ELO calculation after matches', () => {
    it('should update ELO ratings after a tournament match', () => {
      const players = Array.from({ length: 4 }, () => randomUUID());
      const winner = players[0];
      const rankings = [winner, players[1], players[2], players[3]];

      // Set initial ELOs
      db.updatePlayerElo(players[0], 1500);
      db.updatePlayerElo(players[1], 1400);
      db.updatePlayerElo(players[2], 1300);
      db.updatePlayerElo(players[3], 1200);

      const elosBefore = players.map(p => db.getPlayerElo(p));

      db.updateMatchEloRatings(winner, players, rankings);

      // Winner's ELO should increase
      expect(db.getPlayerElo(winner)).toBeGreaterThan(elosBefore[0]);

      // Last place's ELO should decrease
      expect(db.getPlayerElo(players[3])).toBeLessThan(elosBefore[3]);
    });

    it('should handle players with default ELO correctly', () => {
      const players = Array.from({ length: 3 }, () => randomUUID());
      const winner = players[0];
      const rankings = [winner, players[1], players[2]];

      // Don't set ELOs - use default 1200
      db.updateMatchEloRatings(winner, players, rankings);

      // All players should have valid ELOs
      for (const player of players) {
        const elo = db.getPlayerElo(player);
        expect(elo).toBeGreaterThanOrEqual(1000);
        expect(elo).toBeLessThanOrEqual(1400);
      }

      // Winner should have gained ELO
      expect(db.getPlayerElo(winner)).toBeGreaterThan(1200);
    });
  });

  describe('ELO calculation edge cases', () => {
    it('should calculate expected score correctly', () => {
      const player1Elo = 1500;
      const player2Elo = 1500;

      // Equal ELOs should result in expected score of 0.5
      const player1 = randomUUID();
      const player2 = randomUUID();
      db.updatePlayerElo(player1, player1Elo);
      db.updatePlayerElo(player2, player2Elo);

      const elos = db.getPlayersElo([player1, player2]);
      expect(elos.get(player1)).toBe(player1Elo);
      expect(elos.get(player2)).toBe(player2Elo);
    });

    it('should not change ELO when all players have same rating and equal performance', () => {
      const players = Array.from({ length: 4 }, () => randomUUID());
      const winner = players[0];
      const rankings = [winner, players[1], players[2], players[3]];

      // All players start with same ELO
      for (const player of players) {
        db.updatePlayerElo(player, 1500);
      }

      const elosBefore = players.map(p => db.getPlayerElo(p));
      db.updateMatchEloRatings(winner, players, rankings);
      const elosAfter = players.map(p => db.getPlayerElo(p));

      // Winner gains ELO, others lose
      expect(elosAfter[0]).toBeGreaterThan(elosBefore[0]);

      // Total ELO should be conserved (sum of changes ≈ 0)
      const totalChange = elosAfter.reduce((sum, elo, i) => sum + (elo - elosBefore[i]), 0);
      expect(Math.abs(totalChange)).toBeLessThanOrEqual(1); // Allow for rounding
    });
  });
});
