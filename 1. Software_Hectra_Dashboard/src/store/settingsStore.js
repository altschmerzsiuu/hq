// src/store/settingsStore.js
// Global UI Settings Store — HERD

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSettingsStore = create(
  persist(
    (set) => ({
      lang:  'id',    // Default: Bahasa Indonesia
      theme: 'light',  // Default: Light mode

      setLang: (lang) => set({ lang }),

      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },

      toggleTheme: () => set((state) => {
        const next = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        return { theme: next };
      }),
    }),
    {
      name: 'herd-settings',
      onRehydrateStorage: () => (state) => {
        // Re-apply theme from persisted storage on hydration
        if (state?.theme) {
          document.documentElement.setAttribute('data-theme', state.theme);
        } else {
          document.documentElement.setAttribute('data-theme', 'dark');
        }
      },
    }
  )
);

export default useSettingsStore;
