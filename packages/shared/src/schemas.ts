import { z } from 'zod';

// Primitives
export const vector2Schema = z.object({ x: z.number(), y: z.number() });

export const playerInputSchema = z.object({
  target: vector2Schema,
  accelerate: z.boolean(),
  boost: z.boolean().optional(),
  drift: z.boolean().optional(),
});

export const entryFeeTierSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(5),
  z.literal(25),
  z.literal(100),
]);

export const gameModeSchema = z.union([z.literal('practice'), z.literal('tournament')]).optional();

// Client -> Server messages
export const authenticateMessageSchema = z.object({
  type: z.literal('authenticate'),
  payload: z.object({
    publicKey: z.string(),
    signedMessage: z.string(),
    nonce: z.string(),
  }),
});

export const guestLoginMessageSchema = z.object({
  type: z.literal('guestLogin'),
  payload: z.object({
    guestName: z.string().min(1).max(20),
  }),
});

export const joinLobbyMessageSchema = z.object({
  type: z.literal('joinLobby'),
  payload: z.object({
    entryFeeTier: entryFeeTierSchema,
    mode: gameModeSchema,
  }),
});

export const leaveLobbyMessageSchema = z.object({
  type: z.literal('leaveLobby'),
  payload: z.object({}).strict(),
});

export const playerInputMessageSchema = z.object({
  type: z.literal('playerInput'),
  payload: playerInputSchema,
});

export const entryFeeSignatureMessageSchema = z.object({
  type: z.literal('entryFeeSignature'),
  payload: z.object({
    signature: z.string(),
    paymentId: z.string().optional(),
    sessionNonce: z.string().optional(),
  }),
});

export const clientHelloMessageSchema = z.object({
  type: z.literal('clientHello'),
  payload: z
    .object({
      trailDelta: z.boolean().optional(),
    })
    .optional(),
});

export const clientToServerMessageSchema = z.union([
  authenticateMessageSchema,
  guestLoginMessageSchema,
  joinLobbyMessageSchema,
  leaveLobbyMessageSchema,
  playerInputMessageSchema,
  entryFeeSignatureMessageSchema,
  clientHelloMessageSchema,
]);

export type ClientToServerMessage = z.infer<typeof clientToServerMessageSchema>;


















