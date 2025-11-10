# 🏗️ Nouvelle Architecture Modulaire - @cryptogame.io\skidr.io

## 📁 Structure des Packages

```
packages/
├── server/                  # 🎮 SERVEUR DE JEU (temps réel)
│   ├── src/
│   │   ├── game/           # 🎯 LOGIQUE DE JEU (actuellement ici)
│   │   │   ├── car.ts      # Entité voiture
│   │   │   ├── world.ts    # Moteur de jeu
│   │   │   ├── boost-system.ts # Système de boost
│   │   │   ├── collision/  # Système de collision
│   │   │   └── physics/    # Physique du jeu
│   │   ├── environments/   # 🎭 ENVIRONNEMENTS SÉPARÉS
│   │   │   ├── demo/       # Auto-respawn + Bots + Crypto mock
│   │   │   ├── dev/        # Debug + Monitoring
│   │   │   └── prod/       # Optimisé + Sécurité
│   │   └── infrastructure/
│   │       ├── networking/ # WebSocket, connexions
│   │       ├── monitoring/ # Performance, debug
│   │       └── security/   # Sécurité, validation
│   └── package.json        # depends on "shared"
│
├── backend/                 # 🗄️ API BACKEND (business logic)
│   ├── src/
│   │   ├── environments/
│   │   │   ├── demo/       # Mock DB + Fake crypto
│   │   │   ├── dev/        # Test DB + Sandbox
│   │   │   └── prod/       # Real DB + Live crypto
│   │   └── api.ts          # Routes REST
│   └── package.json
│
├── client/                  # 🖥️ CLIENT DE JEU
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── crypto/         # Crypto/wallet integration
│   │   ├── render/         # Canvas, rendu
│   │   └── input/          # Input handling
│   └── package.json
│
├── frontend/                # 🌐 INTERFACE WEB (Next.js)
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── tournaments/ # 🏆 SYSTÈME DE TOURNOIS
│   │   │   │   ├── TournamentCard.tsx
│   │   │   │   ├── TournamentSelector.tsx
│   │   │   │   └── TournamentLobby.tsx
│   │   │   └── ModernWalletButton.tsx
│   │   ├── contexts/       # Auth, Wallet contexts
│   │   ├── pages/          # Next.js pages
│   │   │   ├── tournaments.tsx # 💰 PAGE TOURNOIS
│   │   │   ├── index.tsx   # Page d'accueil
│   │   │   └── play.tsx    # Mode practice
│   │   ├── types/          # Types TypeScript
│   │   │   └── tournament.ts # Types des tournois
│   │   ├── config/         # Configuration
│   │   │   └── tournaments.ts # Config des 4 tiers
│   │   ├── hooks/          # React hooks
│   │   │   └── usePriceFeed.ts # Prix SOL/USD
│   │   └── styles/         # CSS/Tailwind
│   └── package.json
│
└── shared/                  # 📦 TYPES PARTAGÉS (actif)
    ├── src/
    │   ├── types/          # Types TypeScript communs
    │   │   ├── boost-types.ts
    │   │   ├── game-events.ts
    │   │   └── index.ts
    │   └── index.ts
    └── package.json        # "shared"
```

## 🚀 Commandes Mises à Jour

### Développement
```bash
pnpm dev        # Lance tout en mode dev
pnpm demo       # Lance tout en mode demo 
pnpm prod       # Lance tout en mode production
```

### Par Environnement
```bash
# Serveur de jeu uniquement
pnpm --filter server dev    # Mode développement
pnpm --filter server demo   # Mode demo avec bots
pnpm --filter server prod   # Mode production

# Backend API uniquement  
pnpm --filter backend dev   # API avec debug
pnpm --filter backend demo  # API avec mock
pnpm --filter backend prod  # API production
```

## 🎯 Séparation des Responsabilités

### **Server** - Logique de jeu + Réseau
- ✅ WebSocket temps réel
- ✅ Gestion des connexions
- ✅ **Logique de jeu intégrée** (car.ts, world.ts, collision)
- ✅ Environnements demo/dev/prod
- ✅ Bots et auto-respawn
- ✅ Utilise `shared` pour les types

### **Backend** - API Business
- ✅ API REST (auth, stats, transactions)
- ✅ Base de données
- ✅ Crypto/blockchain
- ✅ Environnements séparés

### **Shared** - Types Communs
- ✅ Types TypeScript partagés
- ✅ boost-types, game-events
- ✅ Interface commune server ↔ client
- ❌ Aucune logique métier

## 🔄 Flux de Données

```
Frontend ↔ Backend API    (auth, profils, stats persistantes)
    ↓
Client ↔ Game Server      (gameplay temps réel via WebSocket)
    ↓
Game Server → Shared      (types communs, événements)
    ↓
Game Server → Backend     (sauvegarde stats, transactions)
```

## ✅ Avantages

1. **Logique Centralisée** : Toute la logique de jeu dans server/src/game
2. **Types Partagés** : shared assure la cohérence client/server
3. **Environnements Séparés** : Demo/dev/prod complètement isolés
4. **Architecture Modulaire** : Chaque package a sa responsabilité
5. **Développement Rapide** : Configuration prête pour collaboration

## 🎯 Architecture Finalisée

### ✅ **IMPLÉMENTATION COMPLÈTE**
- ✅ Environnements séparés dans server (demo/dev/prod)
- ✅ Infrastructure organisée (networking, monitoring, security)
- ✅ Logique de jeu centralisée dans server/src/game
- ✅ Types partagés dans shared (boost-types, game-events)
- ✅ Package.json et dépendances configurés
- ✅ Scripts de démarrage par environnement
- ✅ Architecture modulaire fonctionnelle
- ✅ **SYSTÈME DE TOURNOIS COMPLET** (nouveau !)

### 🏆 **SYSTÈME DE TOURNOIS - NOUVELLE FONCTIONNALITÉ**

#### **Fonctionnalités Implémentées**
- ✅ **4 Tiers de Tournois** : $1, $5, $25, $100 USD (Business Plan)
- ✅ **Conversion SOL/USD** : Prix en temps réel (CoinGecko + Binance)
- ✅ **Interface Utilisateur** : Sélection, lobby, countdown
- ✅ **Mode Demo** : Tous les tournois gratuits pour tester
- ✅ **Mode Production** : Transactions SOL réelles
- ✅ **Intégration Wallet** : Support Phantom, Solflare, Backpack, etc.

#### **Architecture Tournois**
```
frontend/src/
├── types/tournament.ts          # Types de données
├── config/tournaments.ts        # Configuration des 4 tiers
├── hooks/usePriceFeed.ts       # Prix SOL/USD temps réel
├── components/tournaments/     # UI Components
│   ├── TournamentCard.tsx      # Affichage tournoi
│   ├── TournamentSelector.tsx  # Sélection des tiers
│   └── TournamentLobby.tsx     # Lobbly joueurs
└── pages/tournaments.tsx       # Page principale
```

#### **Modèle Économique Implémenté**
- 🥉 **Bronze** : $1 → $13.60 au gagnant (16 joueurs max)
- 🥈 **Silver** : $5 → $136.00 au gagnant (32 joueurs max)
- 🥇 **Gold** : $25 → $680.00 au gagnant (32 joueurs max)
- 💎 **Diamond** : $100 → $1,360.00 au gagnant (16 joueurs max)
- **Commission** : 15% pour la plateforme sur chaque tournoi

**Cette architecture est FINALE et prête pour le développement collaboratif + MONÉTISATION !**