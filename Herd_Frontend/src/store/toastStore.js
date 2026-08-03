// src/store/toastStore.js
// Beautiful, lightweight custom React Toast Notification Store for HERD
// Now wrapping Sonner to provide drop-in replacement across the app

import { toast as sonnerToast } from "sonner";
import { create } from 'zustand';

// Kept for backwards compatibility with any component that calls useToastStore()
const useToastStore = create(() => ({
  toasts: [],
  showToast: (message, type = 'success') => {
    if (type === 'success') sonnerToast.success(message);
    else if (type === 'error') sonnerToast.error(message);
    else if (type === 'info') sonnerToast.info(message);
    else if (type === 'warning') sonnerToast.warning(message);
    else sonnerToast(message);
  },
  removeToast: (id) => {}
}));

// Provide direct access to sonner's toast
export const toast = sonnerToast;

export default useToastStore;
