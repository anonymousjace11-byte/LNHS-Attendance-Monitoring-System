import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ThemeContext = createContext(null);
const THEME_REF = doc(db, 'settings', 'theme');
const VALID_THEMES = ['light', 'dark'];
const DEFAULT_THEME = 'light';

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      THEME_REF,
      (snapshot) => {
        const value = snapshot.exists() ? snapshot.data()?.name : null;
        setThemeState(VALID_THEMES.includes(value) ? value : DEFAULT_THEME);
        setReady(true);
      },
      (error) => {
        console.warn('Theme sync failed, using default:', error?.message);
        setThemeState(DEFAULT_THEME);
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
      await setDoc(THEME_REF, { name: next }, { merge: true });
    } catch (error) {
      console.warn('Failed to persist theme:', error?.message);
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