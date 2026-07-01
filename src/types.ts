export type EventType = 'clipboard' | 'notification' | 'file' | 'voice';

export interface CaptureEvent {
  id: string;
  eventType: EventType;
  appSource: string;
  content: string;
  fileName?: string;
  timestamp: string;
  synced: boolean;
}

export interface DailySummary {
  date: string;
  summaryMarkdown: string;
  rawEventsCount: number;
}

export interface HealthStatus {
  totalEvents: number;
  eventsBySource: Record<EventType, number>;
  syncSuccessCount: number;
  syncFailureCount: number;
  lastSyncTimestamp: string | null;
  queueBacklog: number;
  devices: Array<{
    deviceId: string;
    deviceName: string;
    lastSeen: string;
    token: string;
  }>;
}

export interface SearchResult {
  eventId?: string;
  date?: string;
  content: string;
  appSource?: string;
  eventType?: EventType;
  score: number; // Cosine similarity
}

export interface SearchQueryResponse {
  query: string;
  results: SearchResult[];
  ragAnswer: string;
}
