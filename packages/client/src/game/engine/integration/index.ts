/**
 * Integration Layer Index
 * Exports all integration utilities for connecting the ECS engine
 */

export * from './InputHandler';
export * from './WsIntegration';

export { InputHandler, createInputHandler, type InputState } from './InputHandler';
export { WsIntegration, createWsIntegration, type RemotePlayer } from './WsIntegration';
