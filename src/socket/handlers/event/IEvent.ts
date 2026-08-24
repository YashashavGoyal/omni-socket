export type EventTargetType = 'room' | 'user' | 'socket' | 'application';

export interface EmitEventPayload {
  targetType: EventTargetType;
  targetId: string;
  eventName: string;
  payload: unknown;
  includeSelf?: boolean;
}

export interface RoutedEventMessage {
  event: string;
  payload: unknown;
  sender: {
    socketId: string;
    applicationId: string;
    userId?: string;
  };
  timestamp: string;
}
