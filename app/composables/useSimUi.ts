// Custom confirm-dialog + toast notification system for the Simulasi Lab.
// One instance is created by the page (index.vue) and provided to child
// components via SIM_UI_KEY — same shared state semantics as before.

import { reactive, inject, type InjectionKey } from 'vue';

export interface SimUi {
  confirmModal: {
    open: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  };
  notificationModal: {
    open: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  };
  notify: (message: string, type?: 'success' | 'error' | 'info', title?: string) => void;
  showConfirm: (options: { title: string; message: string; confirmText?: string; cancelText?: string; type?: 'danger' | 'warning' | 'info'; onConfirm: () => void }) => void;
  handleConfirmModal: () => void;
  handleCancelModal: () => void;
}

let notifTimer: ReturnType<typeof setTimeout> | null = null;

export function createSimUi(): SimUi {
  const confirmModal = reactive({
    open: false,
    title: '',
    message: '',
    confirmText: 'Ya, Lanjutkan',
    cancelText: 'Batal',
    type: 'danger' as 'danger' | 'warning' | 'info',
    onConfirm: () => {}
  });

  const notificationModal = reactive({
    open: false,
    title: '',
    message: '',
    type: 'info' as 'success' | 'error' | 'info'
  });

  function notify(message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) {
    notificationModal.message = message;
    notificationModal.type = type;
    notificationModal.title = title || (type === 'error' ? '⚠️ PERINGATAN' : type === 'success' ? '✨ SUKSES' : 'ℹ️ INFORMASI');
    notificationModal.open = true;

    if (notifTimer) clearTimeout(notifTimer);
    notifTimer = setTimeout(() => {
      notificationModal.open = false;
    }, 4500);
  }

  function showConfirm(options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
  }) {
    confirmModal.title = options.title;
    confirmModal.message = options.message;
    confirmModal.confirmText = options.confirmText || 'Ya, Lanjutkan';
    confirmModal.cancelText = options.cancelText || 'Batal';
    confirmModal.type = options.type || 'danger';
    confirmModal.onConfirm = options.onConfirm;
    confirmModal.open = true;
  }

  function handleConfirmModal() {
    confirmModal.open = false;
    confirmModal.onConfirm();
  }

  function handleCancelModal() {
    confirmModal.open = false;
  }

  return { confirmModal, notificationModal, notify, showConfirm, handleConfirmModal, handleCancelModal };
}

export const SIM_UI_KEY: InjectionKey<SimUi> = Symbol('sim-ui');

/** Inject the page-level UI system inside simulasi components. */
export function useSimUi(): SimUi {
  const ui = inject(SIM_UI_KEY);
  if (!ui) throw new Error('useSimUi must be used inside /simulasi page (SIM_UI_KEY missing)');
  return ui;
}
