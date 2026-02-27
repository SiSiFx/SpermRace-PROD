/**
 * Integration Layer Index
 * Exports all integration utilities for connecting the ECS engine
 */

export * from './GameAdapter';
export * from './InputHandler';
export * from './WsIntegration';

export { GameAdapter, createGameAdapter } from './GameAdapter';
export { InputHandler, createInputHandler, type InputState } from './InputHandler';
export { WsIntegration, createWsIntegration, type RemotePlayer } from './WsIntegration';
