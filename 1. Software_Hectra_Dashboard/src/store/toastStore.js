// src/store/toastStore.js
// Beautiful, lightweight custom React Toast Notification Store for HERD

import { create } from 'zustand';

const useToastStore = create((set) => ({
  toasts: [],
  
  showToast: (message, type = 'success') => {
    // Disabled as requested by user
    return;
  },
  
  removeToast: (id) => {
    // Disabled
  }
}));

// Shortcut helpers similar to react-hot-toast or legacy showToast
export const toast = {
  success: (msg) => useToastStore.getState().showToast(msg, 'success'),
  error: (msg) => useToastStore.getState().showToast(msg, 'error'),
  info: (msg) => useToastStore.getState().showToast(msg, 'info'),
};

export default useToastStore;
