export type AuditAction =
  | 'message.sent'
  | 'message.edited'
  | 'message.deleted'
  | 'message.replied'
  | 'message.reaction.added'
  | 'message.reaction.removed'
  | 'message.seen'
  | 'room.created'
  | 'room.direct.created'
  | 'room.group.created'
  | 'room.user.removed'
  | 'rate.limit.triggered'
  | 'realtime.reconnect'
  | 'realtime.ack.timeout'
  | 'presence.changed';

export interface ChatFeatures {
  emailVerification: boolean;
  loginAlerts: boolean;
  securityAttempts: boolean;
  rateLimit: boolean;
  auditLogs: boolean;
  twoFactor: boolean;
  csrf: boolean;
  antiSpam: boolean;
  realtime: boolean;
}

export interface RealtimeTransportAdapter {
  emit?(event: string, payload: Record<string, unknown>): void;
  joinChannel?(channelId: string, context: Record<string, unknown>): void;
  leaveChannel?(channelId: string, context: Record<string, unknown>): void;
}

export interface PersistenceAdapter {
  createRoom(roomId: string, members?: string[], options?: { type?: 'channel' | 'group' | 'direct'; name?: string | null; metadata?: Record<string, unknown> }): Promise<any> | any;
  softDeleteRoom(roomId: string): Promise<boolean> | boolean;
  removeMember(roomId: string, userId: string): Promise<boolean> | boolean;
  addMessage(payload: ChatMessage): Promise<ChatMessage> | ChatMessage;
  editMessage(roomId: string, messageId: string, text: string): Promise<ChatMessage> | ChatMessage;
  deleteMessage(roomId: string, messageId: string): Promise<boolean> | boolean;
  listMessages(payload: ReadMessagesPayload): Promise<{ items: ChatMessage[]; nextCursor: string | null; prevCursor: string | null; total: number }> | { items: ChatMessage[]; nextCursor: string | null; prevCursor: string | null; total: number };
  unreadCount(roomId: string, userId: string): Promise<number> | number;
  addReaction(roomId: string, messageId: string, userId: string, reaction: string): Promise<ChatMessage> | ChatMessage;
  removeReaction(roomId: string, messageId: string, userId: string, reaction: string): Promise<ChatMessage> | ChatMessage;
  markSeen(roomId: string, messageId: string, userId: string, seenAt?: number): Promise<ChatMessage> | ChatMessage;
}

export interface ChatConfigInput {
  emailVerification?: boolean;
  loginAlerts?: boolean;
  enableCSRF?: boolean;
  features?: Partial<ChatFeatures>;
  limits?: {
    maxMessageLength?: number;
    pageSize?: number;
    rateLimit?: {
      maxEvents?: number;
      windowMs?: number;
    };
  };
  routes?: {
    verifyEmail?: string;
    login?: string;
  };
  policy?: {
    redactKeys?: string[];
  };
  realtime?: {
    enabled?: boolean;
    ackTimeoutMs?: number;
  };
  logger?: {
    enabled?: boolean;
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
  optional?: {
    persistenceAdapter?: PersistenceAdapter | null;
    customLogger?: {
      log(line: string): void;
    } | null;
    realtimeAdapter?: RealtimeTransportAdapter | null;
  };
}

export interface NormalizedConfigResult {
  config: ChatConfigInput & {
    features: ChatFeatures;
  };
  warnings: string[];
}

export interface SendMessagePayload {
  roomId: string;
  userId: string;
  text: string;
  metadata?: Record<string, unknown>;
  id?: string;
  dedupeKey?: string;
  replyTo?: string | null;
}

export interface ReadMessagesPayload {
  roomId: string;
  limit?: number;
  cursor?: string | null;
  direction?: 'forward' | 'backward';
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  text: string;
  metadata: Record<string, unknown>;
  replyTo?: string | null;
  reactions?: Record<string, string[]>;
  seenBy?: Record<string, number>;
  createdAt: number;
  editedAt?: number | null;
}

export interface PresencePayload {
  userId: string;
  status: 'online' | 'offline';
  lastSeenAt: number | null;
  context: Record<string, unknown>;
}

export interface ChannelPayload {
  roomId: string;
  members: string[];
  type: 'channel' | 'group' | 'direct';
  name?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ChatInstance {
  sendMessage(payload: SendMessagePayload): Promise<ChatMessage>;
  readMessages(payload: ReadMessagesPayload): Promise<{
    items: ChatMessage[];
    nextCursor: string | null;
    prevCursor: string | null;
    total: number;
  }>;
  editMessage(payload: { roomId: string; messageId: string; text: string }): Promise<ChatMessage>;
  deleteMessage(payload: { roomId: string; messageId: string }): Promise<boolean>;
  createRoom(roomId: string, members?: string[], options?: { type?: 'channel' | 'group' | 'direct'; name?: string | null; metadata?: Record<string, unknown> }): Promise<ChannelPayload>;
  createDirectChannel(payload: { userA: string; userB: string; roomId?: string; name?: string; metadata?: Record<string, unknown> }): Promise<ChannelPayload>;
  createGroupChannel(payload: { roomId: string; name?: string; members?: string[]; metadata?: Record<string, unknown> }): Promise<ChannelPayload>;
  removeUserFromRoom(roomId: string, userId: string): Promise<boolean>;
  softDeleteRoom(roomId: string): Promise<boolean>;
  unreadCount(roomId: string, userId: string): Promise<number>;
  addReaction(payload: { roomId: string; messageId: string; userId: string; reaction: string }): Promise<ChatMessage>;
  removeReaction(payload: { roomId: string; messageId: string; userId: string; reaction: string }): Promise<ChatMessage>;
  markSeen(payload: { roomId: string; messageId: string; userId: string; seenAt?: number }): Promise<ChatMessage>;
  setUserOnline(payload: { userId: string; roomId?: string; sessionId?: string; meta?: Record<string, unknown> }): PresencePayload;
  setUserOffline(payload: { userId: string; roomId?: string; sessionId?: string; meta?: Record<string, unknown> }): PresencePayload;
  getUserStatus(userId: string): PresencePayload;
  joinChannel(channelId: string, userContext?: Record<string, unknown>): { joined: boolean; reason?: string };
  leaveChannel(channelId: string, userContext?: Record<string, unknown>): { left: boolean; reason?: string };
  acknowledge(messageId: string): boolean;
  reconnect(sessionId: string, missedMessages: ChatMessage[]): ChatMessage[];
  on(event: string, handler: (...args: any[]) => void): () => void;
  close(): void;
  getConfig(): any;
  getWarnings(): string[];
  getAuditLogs(): Array<{ action: AuditAction; timestamp: number; context: Record<string, unknown> }>;
}

export declare const DEFAULT_CONFIG: any;
export declare const AUDIT_ACTIONS: Record<string, AuditAction>;

export declare class ApiError extends Error {
  statusCode: number;
  code: string;
  constructor(message: string, statusCode?: number, code?: string);
}

export declare function normalizeConfig(inputConfig?: ChatConfigInput): NormalizedConfigResult;
export declare function chat(inputConfig?: ChatConfigInput): ChatInstance;
export declare function createMongoPersistenceAdapter(input: { rooms: any; messages: any }): PersistenceAdapter;
