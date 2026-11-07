import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { normalizePhilippinePhone } from '../utils/phone';
import {
  enqueueOfflineAttendance as addOfflineAttendance,
  OFFLINE_ATTENDANCE_QUEUE_EVENT,
  OFFLINE_ATTENDANCE_SYNCED_EVENT,
  readOfflineAttendance,
  removeOfflineAttendance,
} from '../utils/offlineAttendance';

const DataContext = createContext(null);
const resolveApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)
      || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(hostname);

    if (isLocalHost) return 'http://127.0.0.1:5000';
  }

  return (import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');
};
const API_URL = resolveApiBaseUrl();
const STAFF_DATA_REFRESH_MS = 15 * 60 * 1000;
const OFFLINE_SYNC_RETRY_MS = 60 * 1000;

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : { error: (await response.text()).slice(0, 200) };
  if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}.`);
  return body;
}

async function fetchWithAuth(path, options = {}, { forceRefresh = false } = {}) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Firebase authentication required.');

  const token = await currentUser.getIdToken(forceRefresh);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorMessage = (await response.clone().text()).slice(0, 200);
    const parsed = (() => {
      try {
        return JSON.parse(errorMessage);
      } catch {
        return null;
      }
    })();
    const serverError = parsed?.error || errorMessage || 'Request failed.';

    if ((response.status === 401 || response.status === 403) && !forceRefresh && /Invalid Firebase authentication token|Admin access required|Firebase authentication required/i.test(serverError)) {
      return fetchWithAuth(path, options, { forceRefresh: true });
    }

    throw new Error(serverError);
  }

  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : { ok: true };
}

export async function staffApiGet(path) {
  return fetchWithAuth(path);
}

function normalizeRecord(snapshot) {
  const record = { id: snapshot.id, ...snapshot.data() };
  for (const key of ['date', 'time', 'createdAt']) {
    const value = record[key];
    if (value && typeof value.toDate === 'function') record[key] = value.toDate();
    if (record[key] instanceof Date) {
      record[key] = key === 'date'
        ? record[key].toISOString().slice(0, 10)
        : key === 'time'
          ? record[key].toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' })
          : record[key].toISOString();
    }
  }
  return record;
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}

function makeOfflineAttendanceEvent(student, period, scanInfo = {}) {
  const scannedDate = new Date(scanInfo.scannedAt || Date.now());
  if (Number.isNaN(scannedDate.getTime())) throw new Error('Invalid offline scan time.');
  const eventId = scanInfo.eventId || globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    eventId,
    studentId: student.id,
    period,
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(scannedDate),
    time: new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila',
    }).format(scannedDate),
    scannedAt: scannedDate.toISOString(),
  };
}

export function DataProvider({ children }) {
  const [data, setData] = useState({ students: [], attendance: [], sections: [], teachers: [], parentContacts: [], smsLogs: [], auditLogs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffDataError, setStaffDataError] = useState('');
  const [offlineAttendance, setOfflineAttendance] = useState([]);
  const [offlineSyncError, setOfflineSyncError] = useState('');
  const offlineSyncInProgress = useRef(false);

  const refreshOfflineAttendance = useCallback((uid = auth.currentUser?.uid) => {
    const queued = uid ? readOfflineAttendance(uid) : [];
    setOfflineAttendance(queued);
    return queued;
  }, []);

  const queueOfflineAttendance = useCallback((event) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Firebase authentication required.');
    const queued = addOfflineAttendance(currentUser.uid, event);
    setOfflineAttendance(queued);
    setOfflineSyncError('');
    return queued;
  }, []);

  const syncOfflineAttendance = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !navigator.onLine || offlineSyncInProgress.current) return;
    const uid = currentUser.uid;
    const queued = readOfflineAttendance(uid);
    setOfflineAttendance(queued);
    if (!queued.length) {
      setOfflineSyncError('');
      return;
    }

    offlineSyncInProgress.current = true;
    try {
      for (const event of queued) {
        if (!navigator.onLine || auth.currentUser?.uid !== uid) break;
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_URL}/attendance/record`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            studentId: event.studentId,
            period: event.period,
            scannedAt: event.scannedAt,
            offlineEventId: event.eventId,
          }),
        });
        const result = await response.json().catch(() => ({}));

        if (response.status === 409 && result.duplicate === true) {
          const remaining = removeOfflineAttendance(uid, event.eventId);
          setOfflineAttendance(remaining);
          setOfflineSyncError('');
          window.dispatchEvent(new CustomEvent(OFFLINE_ATTENDANCE_SYNCED_EVENT, {
            detail: { eventId: event.eventId, duplicate: true },
          }));
          continue;
        }
        if (!response.ok || !result.recorded) {
          throw new Error(result.error || `Offline sync failed (${response.status}).`);
        }

        const attendanceRecord = {
          ...result,
          status: result.arrivalStatus || result.status,
          sectionId: result.sectionId || '',
        };
        setData((current) => ({
          ...current,
          attendance: [
            ...current.attendance.filter((record) => record.id !== attendanceRecord.id),
            attendanceRecord,
          ],
        }));
        const remaining = removeOfflineAttendance(uid, event.eventId);
        setOfflineAttendance(remaining);
        setOfflineSyncError('');
        window.dispatchEvent(new CustomEvent(OFFLINE_ATTENDANCE_SYNCED_EVENT, {
          detail: { eventId: event.eventId, record: attendanceRecord },
        }));
      }
    } catch (syncError) {
      setOfflineSyncError(syncError.message || 'Attendance sync is waiting to retry.');
    } finally {
      offlineSyncInProgress.current = false;
    }
  }, []);

  useEffect(() => {
    const handleQueueChange = (event) => {
      if (event.detail?.uid === auth.currentUser?.uid) refreshOfflineAttendance(event.detail.uid);
    };
    const handleStorageChange = () => refreshOfflineAttendance();
    window.addEventListener(OFFLINE_ATTENDANCE_QUEUE_EVENT, handleQueueChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(OFFLINE_ATTENDANCE_QUEUE_EVENT, handleQueueChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [refreshOfflineAttendance]);

  useEffect(() => {
    const handleOnline = () => syncOfflineAttendance();
    window.addEventListener('online', handleOnline);
    const retryTimer = window.setInterval(syncOfflineAttendance, OFFLINE_SYNC_RETRY_MS);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.clearInterval(retryTimer);
    };
  }, [syncOfflineAttendance]);

  useEffect(() => {
    let disposeUserData = () => {};
    let authRequestId = 0;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    const currentRequest = ++authRequestId;
    disposeUserData();
    disposeUserData = () => {};
    refreshOfflineAttendance(currentUser?.uid);
    setOfflineSyncError('');
    if (!currentUser) {
      setData({ students: [], attendance: [], sections: [], teachers: [], parentContacts: [], smsLogs: [], auditLogs: [] });
      setLoading(false);
      setError('');
      setStaffDataError('');
      return;
    }

    try {
      const tokenResult = await currentUser.getIdTokenResult();
      if (currentRequest !== authRequestId) return;
      let profileRole = '';
      try {
        const profileSnapshot = await getDoc(doc(db, 'users', currentUser.uid));
        profileRole = profileSnapshot.exists() ? profileSnapshot.data()?.role || '' : '';
      } catch {
        profileRole = '';
      }
      if (currentRequest !== authRequestId) return;
      const isAdmin = tokenResult.claims.admin === true || profileRole === 'admin';
      const isTeacher = tokenResult.claims.teacher === true || profileRole === 'teacher';
      if (isAdmin || isTeacher) syncOfflineAttendance();
      if (isTeacher && !isAdmin) {
        setData({ students: [], attendance: [], sections: [], teachers: [], parentContacts: [], smsLogs: [], auditLogs: [] });
        setError('');
        setStaffDataError('');
        let cancelled = false;
        const loadTeacherData = async () => {
          try {
            const [studentResult, attendanceResult] = await Promise.all([
              staffApiGet('/students'),
              staffApiGet('/attendance'),
            ]);
            if (cancelled) return;
            setData((current) => ({
              ...current,
              students: studentResult.students || [],
              attendance: attendanceResult.attendance || [],
            }));
            setError('');
          } catch (requestError) {
            if (!cancelled) setError(requestError.message || 'Unable to load assigned-section records.');
          } finally {
            if (!cancelled) setLoading(false);
          }
        };
        loadTeacherData();
        const refreshTimer = window.setInterval(loadTeacherData, 60000);
        disposeUserData = () => {
          cancelled = true;
          window.clearInterval(refreshTimer);
        };
        return;
      }
      if (!isAdmin) {
        setData({ students: [], attendance: [], sections: [], teachers: [], parentContacts: [], smsLogs: [], auditLogs: [] });
        setLoading(false);
        setError('');
        setStaffDataError('');
        return;
      }
    } catch (tokenError) {
      if (currentRequest !== authRequestId) return;
      setError(tokenError.message || 'Unable to verify account role.');
      setLoading(false);
      return;
    }

    let students = [];
    let attendance = [];
    let cancelled = false;
    const update = () => {
      if (!cancelled) setData((current) => ({ ...current, students, attendance }));
    };
    const handleError = (snapshotError) => {
      if (cancelled) return;
      setError(snapshotError.message || 'Unable to load live attendance data.');
      setLoading(false);
    };
    const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      students = snapshot.docs.map(normalizeRecord);
      update();
      setLoading(false);
    }, handleError);
    const unsubscribeAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      attendance = snapshot.docs.map(normalizeRecord);
      update();
    }, handleError);

    let staffRefresh;
    async function loadStaffData() {
      try {
        const tokenResult = await currentUser.getIdTokenResult();
        if (tokenResult.claims.admin !== true) return;
        const endpoints = [['sections', '/admin/sections'], ['teachers', '/admin/teachers'], ['parentContacts', '/parent-contacts'], ['smsLogs', '/sms-logs'], ['auditLogs', '/admin/audit-logs']];
        const results = await Promise.all(endpoints.map(async ([key, path]) => {
          try {
            const record = await fetchWithAuth(path, {}, { forceRefresh: false });
            return { key, value: record[key] || record.contacts || record.logs || [] };
          } catch (requestError) {
            const reason = requestError?.name === 'TypeError'
              ? 'network/CORS failure'
              : requestError?.message || 'request failed';
            return { key, error: reason };
          }
        }));
        if (cancelled) return;

        const successfulResults = results.filter((result) => 'value' in result);
        if (successfulResults.length) {
          setData((current) => ({
            ...current,
            ...Object.fromEntries(successfulResults.map(({ key, value }) => [key, value])),
          }));
        }

        const failedResults = results.filter((result) => result.error);
        setStaffDataError(failedResults.length
          ? failedResults.map(({ key, error: reason }) => `${key}: ${reason}`).join('; ')
          : '');
      } catch (requestError) {
        if (!cancelled) {
          setStaffDataError(requestError?.name === 'TypeError'
            ? 'Unable to retrieve the Firebase sign-in token.'
            : requestError.message || 'Unable to load administrative data.');
        }
      }
    }
    loadStaffData();
    staffRefresh = window.setInterval(loadStaffData, STAFF_DATA_REFRESH_MS);
    disposeUserData = () => {
      cancelled = true;
      if (staffRefresh) window.clearInterval(staffRefresh);
      unsubscribeStudents();
      unsubscribeAttendance();
    };
    });
    return () => {
      authRequestId += 1;
      disposeUserData();
      unsubscribe();
    };
  }, [refreshOfflineAttendance, syncOfflineAttendance]);

  async function recordAttendance(student, period, scanInfo = {}) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Firebase authentication required.');
    const offlineEvent = makeOfflineAttendanceEvent(student, period, scanInfo);
    const queueForSync = () => {
      queueOfflineAttendance(offlineEvent);
      return { pendingSync: true, offlineEventId: offlineEvent.eventId, studentId: student.id, period };
    };
    if (!navigator.onLine) return queueForSync();

    let response;
    try {
      const token = await currentUser.getIdToken();
      response = await fetch(`${API_URL}/attendance/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ qrValue: student.qrValue || student.qrUuid || student.studentCode || student.code || student.id, period }),
      });
    } catch (requestError) {
      if (requestError.name === 'TypeError') return queueForSync();
      throw requestError;
    }
    if (!response.ok && (response.status === 408 || response.status === 429 || response.status >= 500)) return queueForSync();
    const result = await readApiResponse(response);
    if (result.recorded) {
      const attendanceRecord = {
        ...result,
        status: result.arrivalStatus || result.status,
        sectionId: result.sectionId || student.sectionId || student.section || '',
      };
      setData((current) => ({
        ...current,
        attendance: [
          ...current.attendance.filter((record) => record.id !== attendanceRecord.id),
          attendanceRecord,
        ],
      }));
    }
    return result;
  }

  async function recordExcusedAttendance(studentId, period, reason = '') {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Firebase authentication required.');
    const token = await currentUser.getIdToken();
    const response = await fetch(`${API_URL}/attendance/excuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studentId, period, reason }),
    });
    const result = await readApiResponse(response);
    if (result.recorded) {
      setData((current) => ({
        ...current,
        attendance: [
          ...current.attendance.filter((record) => record.id !== result.id),
          result,
        ],
      }));
    }
    return result;
  }

  async function uploadStudentPhoto(studentId, photoFile) {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Firebase authentication required.');
    const token = await currentUser.getIdToken(true);
    const imageBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(photoFile);
    });
    const response = await fetch(`${API_URL}/admin/upload-student-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ studentId, imageBase64, contentType: photoFile.type }),
    });
    const result = await readApiResponse(response);
    return result.photoUrl;
  }

  async function uploadAccountPhoto(photoFile) {
    if (!(photoFile instanceof File)) throw new Error('Choose a profile photo first.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photoFile.type)) {
      throw new Error('Choose a JPG, PNG, or WebP image.');
    }
    if (photoFile.size > 7 * 1024 * 1024) throw new Error('Profile photos must be smaller than 7 MB.');

    const imageBase64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(photoFile);
    });
    const result = await adminRequest('/admin/upload-profile-photo', 'POST', {
      imageBase64,
      contentType: photoFile.type,
    });
    return result.photoUrl;
  }

  async function adminRequest(path, method, payload) {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Firebase authentication required.');
      const token = await currentUser.getIdToken();
      const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: payload ? JSON.stringify(payload) : undefined,
      });
      return await readApiResponse(response);
    } catch (requestError) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('school-app:notification', {
          detail: {
            type: 'error',
            title: 'Changes not saved',
            message: 'We could not complete that request. Please try again.',
            details: requestError?.message || '',
          },
        }));
      }
      throw requestError;
    }
  }

  async function saveStudent(student, photoFile) {
    const photoUrl = photoFile ? await uploadStudentPhoto(student.id, photoFile) : student.photoUrl;
    let updatedStudent = { ...student, ...(photoUrl ? { photoUrl } : {}) };
    const existingStudent = data.students.find((record) => record.id === updatedStudent.id);
    const existingParentContact = data.parentContacts.find((contact) => contact.studentId === updatedStudent.id);
    if (!updatedStudent.qrValue && !updatedStudent.qrUuid) {
      await setDoc(doc(db, 'students', updatedStudent.id), updatedStudent, { merge: true });
      const qr = await adminRequest('/qr/generate', 'POST', {
        studentId: updatedStudent.id,
        studentCode: updatedStudent.studentCode || updatedStudent.code || updatedStudent.id,
        sectionId: updatedStudent.sectionId || updatedStudent.section || '',
      });
      updatedStudent = { ...updatedStudent, qrValue: qr.qrContent, qrUuid: qr.qrUuid };
    }
    await setDoc(doc(db, 'students', updatedStudent.id), updatedStudent, { merge: true });
    const previousParentName = existingParentContact?.parentName || existingStudent?.parentName || '';
    const previousParentPhone = normalizePhilippinePhone(existingParentContact?.parentPhone || existingStudent?.parentPhone || '');
    const nextParentName = updatedStudent.parentName?.trim() || '';
    const nextParentPhone = normalizePhilippinePhone(updatedStudent.parentPhone || '');
    const parentContactChanged = !existingStudent
      || nextParentName !== previousParentName.trim()
      || nextParentPhone !== previousParentPhone;
    if (parentContactChanged && nextParentName && nextParentPhone) {
      await adminRequest('/parent-contacts', 'POST', { studentId: updatedStudent.id, parentName: updatedStudent.parentName, parentPhone: updatedStudent.parentPhone });
    }
    return updatedStudent;
  }

  const deleteStudent = async (id) => {
    const result = await adminRequest(`/admin/students/${encodeURIComponent(id)}`, 'DELETE');
    setData((current) => ({
      ...current,
      students: current.students.filter((student) => student.id !== id),
      parentContacts: current.parentContacts.filter((contact) => contact.studentId !== id),
    }));
    return result;
  };

  const saveSection = async (section) => {
    const result = await adminRequest('/admin/sections', 'POST', { action: 'save', ...section });
    if (result.section) setData((current) => ({ ...current, sections: [...current.sections.filter((item) => item.id !== (result.sectionId || section.id)), { id: result.sectionId || section.id, ...result.section }] }));
    return result;
  };
  const saveTeacher = async (teacher) => {
    const payload = { action: 'save', ...teacher };
    if (!teacher.id && !teacher.uid) payload.uid = crypto.randomUUID();
    const result = await adminRequest('/admin/teachers', 'POST', payload);
    if (result.teacher) {
      const savedTeacher = { ...result.teacher, id: result.teacher.id || teacher.id || result.teacher.uid };
      setData((current) => ({
        ...current,
        teachers: [...current.teachers.filter((item) => item.id !== savedTeacher.id), savedTeacher],
      }));
    }
    return result;
  };
  const saveParentContact = async (contact) => {
    const result = await adminRequest('/parent-contacts', 'POST', contact);
    if (result.contact) setData((current) => ({ ...current, parentContacts: [...current.parentContacts.filter((item) => item.id !== result.contactId), { id: result.contactId, ...result.contact }] }));
    return result;
  };
  const deleteParentContact = async (contactId) => {
    const result = await adminRequest(`/parent-contacts/${contactId}`, 'DELETE');
    setData((current) => ({ ...current, parentContacts: current.parentContacts.filter((item) => item.id !== contactId) }));
    return result;
  };
  const deleteSection = async (id) => {
    const result = await adminRequest(`/admin/sections/${encodeURIComponent(id)}`, 'DELETE');
    setData((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== id) }));
    return result;
  };
  const deleteTeacher = async (id) => {
    const result = await adminRequest(`/admin/teachers/${encodeURIComponent(id)}`, 'DELETE');
    setData((current) => ({
      ...current,
      teachers: current.teachers.filter((teacher) => teacher.id !== id && teacher.uid !== id),
    }));
    return result;
  };
  const retrySmsLog = async (logId) => {
    const sourceLog = data.smsLogs.find((log) => log.id === logId);
    const result = await adminRequest(`/admin/sms-logs/${encodeURIComponent(logId)}/retry`, 'POST', {});
    const retryLog = {
      id: result.retryLogId,
      retryOf: logId,
      studentId: sourceLog?.studentId || '',
      attendanceId: sourceLog?.attendanceId || '',
      period: sourceLog?.period || '',
      phone: sourceLog?.phone || '',
      message: sourceLog?.message || '',
      status: result.status || 'failed',
      provider: sourceLog?.provider || '',
      mode: result.mode || '',
      reason: result.reason || '',
      createdAt: new Date().toISOString(),
      manual: sourceLog?.manual === true,
    };
    setData((current) => ({ ...current, smsLogs: [retryLog, ...current.smsLogs] }));
    return result;
  };
  const saveAttendanceSettings = (cutoff) => adminRequest('/admin/settings/attendance', 'POST', { cutoff });
  const saveSmsTemplates = async ({ present, late, absent }) => adminRequest('/admin/settings/sms-templates', 'POST', { present, late, absent });
  const saveSmsRuntime = async ({ mode, disabled, dailyCapPerStudent }) => adminRequest('/admin/settings/sms-runtime', 'POST', { mode, disabled, dailyCapPerStudent });
  async function generateStudentQr(student) {
    const result = await adminRequest('/qr/generate', 'POST', {
      studentId: student.id,
      studentCode: student.studentCode || student.code || student.id,
      sectionId: student.sectionId || student.section || '',
    });
    const updated = { ...student, qrValue: result.qrContent, qrUuid: result.qrUuid };
    await setDoc(doc(db, 'students', student.id), updated, { merge: true });
    return updated;
  }

  return <DataContext.Provider value={{ ...data, loading, error, staffDataError, pendingAttendanceCount: offlineAttendance.length, offlineSyncError, today: todayKey(), recordAttendance, recordExcusedAttendance, saveStudent, deleteStudent, uploadAccountPhoto, generateStudentQr, saveSection, saveTeacher, saveParentContact, deleteParentContact, deleteSection, deleteTeacher, retrySmsLog, saveAttendanceSettings, saveSmsTemplates, saveSmsRuntime }}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}