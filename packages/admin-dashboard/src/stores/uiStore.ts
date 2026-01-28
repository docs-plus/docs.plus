import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Theme
  theme: 'docsplus' | 'docsplus-dark';
  toggleTheme: () => void;
  setTheme: (theme: 'docsplus' | 'docsplus-dark') => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // Sidebar state
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      // Theme state
      theme: 'docsplus',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'docsplus' ? 'docsplus-dark' : 'docsplus',
        })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'admin-ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
      }),
    }
  )
);
