// src/store/toastStore.js
// Beautiful, lightweight custom React Toast Notification Store for HERD

import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  
  showToast: (message, type = 'success') => {
    const now = Date.now();
    const existing = useToastStore.getState().toasts;
    const isDuplicate = existing.some(
      (t) => t.message === message && t.type === type && (now - t.timestamp < 2000)
    );
    if (isDuplicate) return;

    const id = now + Math.random().toString(36).substring(2, 9);
    
    // Add new toast
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, timestamp: now }]
    }));
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id)
      }));
    }, 4000);
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  }
}));

// Shortcut helpers similar to react-hot-toast or legacy showToast
export const toast = {
  success: (msg) => useToastStore.getState().showToast(msg, 'success'),
  error: (msg) => useToastStore.getState().showToast(msg, 'error'),
  info: (msg) => useToastStore.getState().showToast(msg, 'info'),
};

export default useToastStore;
