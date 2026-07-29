import { create } from 'zustand';

const useConfirmStore = create((set, get) => ({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Ya',
  cancelText: 'Batal',
  isDanger: false,
  resolve: null,
  ask: ({ title, message, confirmText = 'Ya', cancelText = 'Batal', isDanger = false }) => {
    return new Promise((resolve) => {
      set({ isOpen: true, title, message, confirmText, cancelText, isDanger, resolve });
    });
  },
  confirm: () => {
    const { resolve } = get();
    if (resolve) resolve(true);
    set({ isOpen: false, resolve: null });
  },
  cancel: () => {
    const { resolve } = get();
    if (resolve) resolve(false);
    set({ isOpen: false, resolve: null });
  }
}));

export default useConfirmStore;
