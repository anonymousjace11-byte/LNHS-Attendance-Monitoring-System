import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { EmailAuthProvider, onAuthStateChanged, reauthenticateWithCredential, signInWithEmailAndPassword, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [role, setRole] = useState('');
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    let requestId = 0;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const currentRequest = ++requestId;
      setUser(firebaseUser);
      setRoleLoading(true);
      if (!firebaseUser) {
        setRole('');
        setRoleLoading(false);
        return;
      }

      try {
        const token = await firebaseUser.getIdTokenResult();
        const profileSnapshot = await getDoc(doc(db, 'users', firebaseUser.uid));
        const profileRole = profileSnapshot.exists() ? profileSnapshot.data()?.role : '';
        const claimsRole = token.claims.admin ? 'admin' : token.claims.teacher ? 'teacher' : 'student';
        if (currentRequest === requestId) {
          setRole(['admin', 'teacher', 'student'].includes(profileRole) ? profileRole : claimsRole);
        }
      } catch (error) {
        console.warn('Failed to read role claims:', error);
        try {
          const token = await firebaseUser.getIdTokenResult();
          if (currentRequest === requestId) {
            setRole(token.claims.admin ? 'admin' : token.claims.teacher ? 'teacher' : 'student');
          }
        } catch {
          if (currentRequest === requestId) setRole('student');
        }
      } finally {
        if (currentRequest === requestId) setRoleLoading(false);
      }
    });

    return () => {
      requestId += 1;
      unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const startedAt = performance.now();
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { ok: true, user: result.user, durationMs: performance.now() - startedAt };
    } catch (error) {
      return { ok: false, code: error.code, message: 'Unable to sign in with those credentials.', durationMs: performance.now() - startedAt };
    }
  }, []);

  const logout = useCallback(() => {
    return signOut(auth);
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!auth.currentUser?.email) throw new Error('No authenticated admin account is available.');
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  }, []);

  const isAdmin = role === 'admin';
  const isTeacher = role === 'teacher';

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword, isAdmin, isTeacher, role, loading: user === undefined || roleLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
