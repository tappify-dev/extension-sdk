/** How urgent a notification is. */
export type ChatSeverity = 'info' | 'success' | 'warning' | 'critical';

/** One labelled value shown beside a notification's body. */
export interface ChatFact {
  label: string;
  value: string;
}

/** One Tappify notification, as a chat extension posts it to one channel. */
export interface ChatMessage {
  /** Stable per notification and channel: a retry of the same delivery carries the same id. */
  id: string;
  /** The notification's slug. */
  type: string;
  /** Plain text, at most 200 characters. */
  title: string;
  /** Plain text, at most 1000 characters. */
  body: string;
  /** An https link into Tappify. */
  url: string;
  /** How urgent the notification is, for the extension to style it by. */
  severity: ChatSeverity;
  /** The project the notification is about, or `null` for a workspace one. */
  project: { id: string; name: string } | null;
  /** Labelled values to show beside the body, at most 6. */
  facts: ChatFact[];
  /** An ISO 8601 instant. */
  occurredAt: string;
}

/** One place in the chat tool that receives a project's notifications. */
export interface ChatDestination {
  /**
   * The chat tool's own id for the place, such as `"<workspace>:<channel>"`;
   * unique per extension; at most 255 characters.
   */
  externalId: string;
  /** The name the owner sees for the place, such as `#releases`; at most 200 characters. */
  label: string;
  /** A link that opens the place in the chat tool; at most 2048 characters. */
  url?: string;
  /**
   * Opaque to Tappify, stored encrypted with the install's credentials; under
   * 16384 bytes as JSON.
   */
  config: Record<string, unknown>;
}

/** One channel the owner can pick from. */
export interface ChatDestinationOption {
  /** The chat tool's own id for the channel. */
  id: string;
  /** The name the owner sees for the channel. */
  label: string;
  /** A heading to list the channel under, such as its workspace. */
  group?: string;
}

/** What the connect call carries once the owner has signed in. */
export interface ChatConnectRequest {
  /** The provider's full token response, unchanged. */
  tokens: Record<string, unknown>;
  /** Present only for destination `picked`: the option the owner chose. */
  option?: ChatDestinationOption;
}

/** The channel the connect call set up. */
export interface ChatConnectResponse {
  /** Stored by Tappify and sent back with every message for this channel. */
  destination: ChatDestination;
}

/** What the destinations call carries to list the owner's channels. */
export interface ChatDestinationsRequest {
  /** The provider's full token response, unchanged. */
  tokens: Record<string, unknown>;
}

/** The channels the owner can pick from. */
export interface ChatDestinationsResponse {
  /** Each channel once, at most 500, empty when the owner can post to none. */
  options: ChatDestinationOption[];
}

/** One notification and the channel to post it to. */
export interface ChatMessageRequest {
  /** The notification to post. */
  message: ChatMessage;
  /** The channel, as the connect call answered it. */
  destination: ChatDestination;
}

/** The answer to a message the chat tool accepted. */
export interface ChatMessageResponse {
  /** Always `true`; answer an error instead when the message was not posted. */
  delivered: true;
  /** The chat tool's own id for the posted message, at most 255 characters. */
  reference?: string;
}

/** The channel the owner removed. */
export interface ChatDisconnectRequest {
  /** The channel, as the connect call answered it. */
  destination: ChatDestination;
}

/** The answer once the extension has let go of the channel. */
export interface ChatDisconnectResponse {
  /** Always `true`. */
  ok: true;
}

/** Host-to-extension chat operations. */
export interface ChatOperationMap {
  /** `POST /tappify/chat/connect`: once, after the owner signs in. */
  connect: { input: ChatConnectRequest; output: ChatConnectResponse };
  /** `POST /tappify/chat/destinations`: the channels the owner can pick from, for `picked` only. */
  destinations: {
    input: ChatDestinationsRequest;
    output: ChatDestinationsResponse;
  };
  /** `POST /tappify/chat/messages`: one notification for one channel. */
  messages: { input: ChatMessageRequest; output: ChatMessageResponse };
  /** `POST /tappify/chat/disconnect`: the owner removed the channel or uninstalled the extension. */
  disconnect: { input: ChatDisconnectRequest; output: ChatDisconnectResponse };
}

/**
 * The codes a chat extension answers with when a channel can no longer receive
 * messages.
 *
 * @remarks
 * Answer either with status 422 through `TapServerError`: `DESTINATION_GONE`
 * when the channel was deleted, the app removed or the webhook revoked, and
 * `PROVIDER_CREDENTIALS_REJECTED` when the chat tool refused the credentials.
 * Tappify does not retry either; it marks the channel disconnected and asks the
 * owner to reconnect. A 429, a 5xx or a timeout is retried. A `TapServerError`
 * thrown without a status is answered as 400, which Tappify treats as a refusal:
 * it does not retry and does not mark the channel disconnected, so pass 422.
 */
export const CHAT_ERROR_CODES = {
  DESTINATION_GONE: 'DESTINATION_GONE',
  PROVIDER_CREDENTIALS_REJECTED: 'PROVIDER_CREDENTIALS_REJECTED',
} as const;

/** Either chat error code, as a union of its values. */
export type ChatErrorCode =
  (typeof CHAT_ERROR_CODES)[keyof typeof CHAT_ERROR_CODES];
