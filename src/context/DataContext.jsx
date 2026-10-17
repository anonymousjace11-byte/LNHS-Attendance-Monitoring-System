import { createContext, useContext, useEffect, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import { normalizePhilippinePhone } from '../utils/phone';

const DataContext = createContext(null);
const API_URL = import.meta.env.VITE_API_URL || (() => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:5000';
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000`;
})();

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : { error: (await response.text()).slice(0, 200) };
  if (!response.ok) throw new Error(body.error || `Request failed with status ${response.status}.`);
  return body;
}

export async function staffApiGet(path) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Firebase authentication required.');
  const response = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return readApiResponse(response);
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

export function DataProvider({ children }) {
  const [data, setData] = useState({ students: [], attendance: [], sections: [], teachers: [], parentContacts: [], smsLogs: [], auditLogs: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staffDataError, setStaffDataError] = useState('');

  useEffect(() => {
    let disposeUserData = () => {};
    let authRequestId = 0;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    const currentRequest = ++authRequestId;
    disposeUserData();
    disposeUserData = () => {};
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
        const token = await currentUser.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        const endpoints = [['sections', '/admin/sections'], ['teachers', '/admin/teachers'], ['parentContacts', '/parent-contacts'], ['smsLogs', '/sms-logs'], ['auditLogs', '/admin/audit-logs']];
        const results = await Promise.all(endpoints.map(async ([key, path]) => {
          try {
            const response = await fetch(`${API_URL}${path}`, { headers });
            const record = await readApiResponse(response);
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
    staffRefresh = window.setInterval(loadStaffData, 60000);
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
  }, []);

  async function recordAttendance(student, period) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Firebase authentication required.');
    const response = await fetch(`${API_URL}/attendance/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ qrValue: student.qrValue || student.qrUuid || student.studentCode || student.code || student.id, period }),
    });
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
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Firebase authentication required.');
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
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) throw new Error('Firebase authentication required.');
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

  async function adminRequest(path, method, payload) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Firebase authentication required.');
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const result = await readApiResponse(response);
    return result;
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

  return <DataContext.Provider value={{ ...data, loading, error, staffDataError, today: todayKey(), recordAttendance, recordExcusedAttendance, saveStudent, generateStudentQr, saveSection, saveTeacher, saveParentContact, deleteParentContact, deleteSection, deleteTeacher, saveAttendanceSettings, saveSmsTemplates, saveSmsRuntime }}>{children}</DataContext.Provider>;
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within DataProvider');
  return context;
}