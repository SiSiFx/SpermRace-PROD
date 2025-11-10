import { z } from 'zod';
export declare const vector2Schema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
}, {
    x: number;
    y: number;
}>;
export declare const playerInputSchema: z.ZodObject<{
    target: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>;
    accelerate: z.ZodBoolean;
    boost: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    target: {
        x: number;
        y: number;
    };
    accelerate: boolean;
    boost?: boolean | undefined;
}, {
    target: {
        x: number;
        y: number;
    };
    accelerate: boolean;
    boost?: boolean | undefined;
}>;
export declare const entryFeeTierSchema: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<5>, z.ZodLiteral<25>, z.ZodLiteral<100>]>;
export declare const gameModeSchema: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"practice">, z.ZodLiteral<"tournament">]>>;
export declare const authenticateMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"authenticate">;
    payload: z.ZodObject<{
        publicKey: z.ZodString;
        signedMessage: z.ZodString;
        nonce: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        publicKey: string;
        signedMessage: string;
        nonce: string;
    }, {
        publicKey: string;
        signedMessage: string;
        nonce: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "authenticate";
    payload: {
        publicKey: string;
        signedMessage: string;
        nonce: string;
    };
}, {
    type: "authenticate";
    payload: {
        publicKey: string;
        signedMessage: string;
        nonce: string;
    };
}>;
export declare const joinLobbyMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"joinLobby">;
    payload: z.ZodObject<{
        entryFeeTier: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<5>, z.ZodLiteral<25>, z.ZodLiteral<100>]>;
        mode: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"practice">, z.ZodLiteral<"tournament">]>>;
    }, "strip", z.ZodTypeAny, {
        entryFeeTier: 100 | 1 | 5 | 25;
        mode?: "practice" | "tournament" | undefined;
    }, {
        entryFeeTier: 100 | 1 | 5 | 25;
        mode?: "practice" | "tournament" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "joinLobby";
    payload: {
        entryFeeTier: 100 | 1 | 5 | 25;
        mode?: "practice" | "tournament" | undefined;
    };
}, {
    type: "joinLobby";
    payload: {
        entryFeeTier: 100 | 1 | 5 | 25;
        mode?: "practice" | "tournament" | undefined;
    };
}>;
export declare const leaveLobbyMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"leaveLobby">;
    payload: z.ZodObject<{}, "strict", z.ZodTypeAny, {}, {}>;
}, "strip", z.ZodTypeAny, {
    type: "leaveLobby";
    payload: {};
}, {
    type: "leaveLobby";
    payload: {};
}>;
export declare const playerInputMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"playerInput">;
    payload: z.ZodObject<{
        target: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
        accelerate: z.ZodBoolean;
        boost: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        target: {
            x: number;
            y: number;
        };
        accelerate: boolean;
        boost?: boolean | undefined;
    }, {
        target: {
            x: number;
            y: number;
        };
        accelerate: boolean;
        boost?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "playerInput";
    payload: {
        target: {
            x: number;
            y: number;
        };
        accelerate: boolean;
        boost?: boolean | undefined;
    };
}, {
    type: "playerInput";
    payload: {
        target: {
            x: number;
            y: number;
        };
        accelerate: boolean;
        boost?: boolean | undefined;
    };
}>;
export declare const entryFeeSignatureMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"entryFeeSignature">;
    payload: z.ZodObject<{
        signature: z.ZodString;
        paymentId: z.ZodOptional<z.ZodString>;
        sessionNonce: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        signature: string;
        paymentId?: string | undefined;
        sessionNonce?: string | undefined;
    }, {
        signature: string;
        paymentId?: string | undefined;
        sessionNonce?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "entryFeeSignature";
    payload: {
        signature: string;
        paymentId?: string | undefined;
        sessionNonce?: string | undefined;
    };
}, {
    type: "entryFeeSignature";
    payload: {
        signature: string;
        paymentId?: string | undefined;
        sessionNonce?: string | undefined;
    };
}>;
export declare const clientToServerMessageSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"authenticate">;
    payload: z.ZodObject<{
        publicKey: z.ZodString;
        signedMessage: z.ZodString;
        nonce: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        publicKey: string;
        signedMessage: string;
        nonce: string;
    }, {
        publicKey: string;
        signedMessage: string;
        nonce: string;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "authenticate";
    payload: {
        publicKey: string;
        signedMessage: string;
        nonce: string;
    };
}, {
    type: "authenticate";
    payload: {
        publicKey: string;
        signedMessage: string;
        nonce: string;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"joinLobby">;
    payload: z.ZodObject<{
        entryFeeTier: z.ZodUnion<[z.ZodLiteral<1>, z.ZodLiteral<5>, z.ZodLiteral<25>, z.ZodLiteral<100>]>;
        mode: z.ZodOptional<z.ZodUnion<[z.ZodLiteral<"practice">, z.ZodLiteral<"tournament">]>>;
    }, "strip", z.ZodTypeAny, {
        entryFeeTier: 100 | 1 | 5 | 25;
        mode?: "practice" | "tournament" | undefined;
    }, {
        entryFeeTier: 100 | 1 | 5 | 25;
        mode?: "practice" | "tournament" | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "joinLobby";
    payload: {
        entryFeeTier: 100 | 1 | 5 | 25;
        mode?: "practice" | "tournament" | undefined;
    };
}, {
    type: "joinLobby";
    payload: {
        entryFeeTier: 100 | 1 | 5 | 25;
        mode?: "practice" | "tournament" | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"leaveLobby">;
    payload: z.ZodObject<{}, "strict", z.ZodTypeAny, {}, {}>;
}, "strip", z.ZodTypeAny, {
    type: "leaveLobby";
    payload: {};
}, {
    type: "leaveLobby";
    payload: {};
}>, z.ZodObject<{
    type: z.ZodLiteral<"playerInput">;
    payload: z.ZodObject<{
        target: z.ZodObject<{
            x: z.ZodNumber;
            y: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            x: number;
            y: number;
        }, {
            x: number;
            y: number;
        }>;
        accelerate: z.ZodBoolean;
        boost: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        target: {
            x: number;
            y: number;
        };
        accelerate: boolean;
        boost?: boolean | undefined;
    }, {
        target: {
            x: number;
            y: number;
        };
        accelerate: boolean;
        boost?: boolean | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "playerInput";
    payload: {
        target: {
            x: number;
            y: number;
        };
        accelerate: boolean;
        boost?: boolean | undefined;
    };
}, {
    type: "playerInput";
    payload: {
        target: {
            x: number;
            y: number;
        };
        accelerate: boolean;
        boost?: boolean | undefined;
    };
}>, z.ZodObject<{
    type: z.ZodLiteral<"entryFeeSignature">;
    payload: z.ZodObject<{
        signature: z.ZodString;
        paymentId: z.ZodOptional<z.ZodString>;
        sessionNonce: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        signature: string;
        paymentId?: string | undefined;
        sessionNonce?: string | undefined;
    }, {
        signature: string;
        paymentId?: string | undefined;
        sessionNonce?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    type: "entryFeeSignature";
    payload: {
        signature: string;
        paymentId?: string | undefined;
        sessionNonce?: string | undefined;
    };
}, {
    type: "entryFeeSignature";
    payload: {
        signature: string;
        paymentId?: string | undefined;
        sessionNonce?: string | undefined;
    };
}>]>;
export type ClientToServerMessage = z.infer<typeof clientToServerMessageSchema>;
