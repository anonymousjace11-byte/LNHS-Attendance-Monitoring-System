const STORAGE_PREFIX = 'lnhs-attendance:offline:v1:';
export const OFFLINE_ATTENDANCE_QUEUE_EVENT = 'school-app:offline-attendance-queue';
export const OFFLINE_ATTENDANCE_SYNCED_EVENT = 'school-app:offline-attendance-synced';
const VALID_PERIODS = new Set(['AM-1', 'AM-2', 'PM-1', 'PM-2']);

function storageKey(uid) {
  if (!uid) throw new Error('An authenticated user is required for offline attendance.');
  return `${STORAGE_PREFIX}${uid}`;
}

function notifyQueueChanged(uid, count) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(OFFLINE_ATTENDANCE_QUEUE_EVENT, { detail: { uid, count } }));
  }
}

export function readOfflineAttendance(uid) {
  if (!uid || typeof window === 'undefined') return [];
  try {
    const stored = window.localStorage.getItem(storageKey(uid));
    const parsed = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item
      && typeof item.eventId === 'string'
      && typeof item.studentId === 'string'
      && VALID_PERIODS.has(item.period)
      && typeof item.date === 'string'
      && typeof item.time === 'string'
      && typeof item.scannedAt === 'string'
      && !Number.isNaN(Date.parse(item.scannedAt)));
  } catch {
    return [];
  }
}

export function enqueueOfflineAttendance(uid, event) {
  const queue = readOfflineAttendance(uid);
  const existing = queue.find((item) => item.eventId === event.eventId);
  if (existing) return queue;

  const nextQueue = [...queue, event];
  window.localStorage.setItem(storageKey(uid), JSON.stringify(nextQueue));
  notifyQueueChanged(uid, nextQueue.length);
  return nextQueue;
}

export function removeOfflineAttendance(uid, eventId) {
  const nextQueue = readOfflineAttendance(uid).filter((item) => item.eventId !== eventId);
  window.localStorage.setItem(storageKey(uid), JSON.stringify(nextQueue));
  notifyQueueChanged(uid, nextQueue.length);
  return nextQueue;
}