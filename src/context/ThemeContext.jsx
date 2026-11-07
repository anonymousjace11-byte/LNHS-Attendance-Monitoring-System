import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ThemeContext = createContext(null);
const THEME_REF = doc(db, 'settings', 'theme');
const VALID_THEMES = ['light', 'dark'];
const DEFAULT_THEME = 'light';
const LOCAL_THEME_KEY = 'lnhs-theme-preference';

function readLocalTheme() {
  try {
    const savedTheme = window.localStorage.getItem(LOCAL_THEME_KEY);
    return VALID_THEMES.includes(savedTheme) ? savedTheme : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readLocalTheme);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      THEME_REF,
      (snapshot) => {
        const value = snapshot.exists() ? snapshot.data()?.name : null;
        setThemeState(VALID_THEMES.includes(value) ? value : readLocalTheme());
        setReady(true);
      },
      (error) => {
        console.warn('Theme sync failed, keeping local preference:', error?.message);
        setThemeState(readLocalTheme());
        setReady(true);
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (ready) document.documentElement.dataset.theme = theme;
  }, [theme, ready]);

  const setTheme = async (next) => {
    if (!VALID_THEMES.includes(next)) return;

    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(LOCAL_THEME_KEY, next);
    } catch {
      console.warn('Unable to persist the local theme preference.');
    }

    try {
      await setDoc(THEME_REF, { name: next }, { merge: true });
      return true;
    } catch (error) {
      console.warn('Failed to persist theme:', error?.message);
      return false;
    }
  };

  return (
    <ThemeContext.Provider value={{
      theme,
      setTheme,
      ready,
      darkMode: theme === 'dark',
      toggleDarkMode: () => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'dark' : 'light'),
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}