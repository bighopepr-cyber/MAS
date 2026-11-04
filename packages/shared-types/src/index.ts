export const ACCOUNT_TYPES = ["SYSTEM", "MILITARY", "PERSIT"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const PROFILE_TYPES = ["MILITARY", "PERSIT"] as const;
export type ProfileType = (typeof PROFILE_TYPES)[number];

export const ATTENDANCE_EVENT_TYPES = ["EXIT", "RETURN"] as const;
export type AttendanceEventType = (typeof ATTENDANCE_EVENT_TYPES)[number];

export const PRESENCE_STATUSES = ["INSIDE", "OUTSIDE", "OVERDUE"] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

export interface ApiSuccess<T> {
  success: true;
  message: string;
  data: T;
  meta: Record<string, unknown> | null;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  error: {
    code: string;
    details: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
  requestId: string;
}

export interface AttendanceScanRequest {
  qrToken: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  deviceId?: string;
  idempotencyKey: string;
}

export interface AttendanceScanResult {
  eventId: string;
  sessionId: string;
  eventType: AttendanceEventType;
  profileType: ProfileType;
  presenceStatus: PresenceStatus;
  recordedAt: string;
  checkpoint: {
    id: string;
    code: string;
    name: string;
  };
  locationValidation: {
    valid: boolean;
    distanceMeter: number;
    accuracy: number;
  };
}