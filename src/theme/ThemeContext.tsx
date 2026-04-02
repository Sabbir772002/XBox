import React, { createContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

const THEME_STORAGE_KEY = '@app_theme_mode';

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from storage
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        const savedMode = (await AsyncStorage.getItem(THEME_STORAGE_KEY)) as ThemeMode | null;
        if (savedMode) {
          setModeState(savedMode);
          updateDarkMode(savedMode);
        }
        console.log('✓ Theme initialized:', savedMode || 'light');
      } catch (error) {
        console.error('Error initializing theme:', error);
      }
    };

    initializeTheme();
  }, []);

  const updateDarkMode = useCallback((themeMode: ThemeMode) => {
    if (themeMode === 'dark') {
      setIsDark(true);
    } else if (themeMode === 'light') {
      setIsDark(false);
    } else if (themeMode === 'auto') {
      // Auto mode can be determined by device settings
      // For now, we'll use light as default
      setIsDark(false);
    }
  }, []);

  const setMode = useCallback((newMode: ThemeMode) => {
    try {
      setModeState(newMode);
      updateDarkMode(newMode);
      console.log('✓ Theme changed to:', newMode);
      
      // Save to storage asynchronously (don't await in UI thread)
      AsyncStorage.setItem(THEME_STORAGE_KEY, newMode).catch((error) => {
        console.error('Error saving theme to storage:', error);
      });
    } catch (error) {
      console.error('Error setting theme:', error);
    }
  }, [updateDarkMode]);

  const toggleTheme = useCallback(() => {
    const newMode: ThemeMode = isDark ? 'light' : 'dark';
    setMode(newMode);
  }, [isDark, setMode]);

  const value: ThemeContextType = {
    mode,
    isDark,
    setMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = React.useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default ThemeContext;
