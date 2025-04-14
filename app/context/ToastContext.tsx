import React, {
  createContext,
  useState,
  useContext,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import {
  type Toast,
  type ToastMessageData,
  type ToastType,
} from '~/components/Toast';

type ToastInput =
  | string
  | {
      type?: ToastType;
      message: string;
      title?: string;
    };

interface ToastContextProps {
  toasts: ToastMessageData[];
  addToast: (toastData: ToastInput) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastMessageData[]>([]);
  const toastIdCounter = useRef(0);

  const addToast = useCallback((toastData: ToastInput) => {
    const id = (toastIdCounter.current++).toString();
    let message = '';
    let type: ToastType = 'info';
    let title: string | undefined = undefined;

    if (typeof toastData === 'string') {
      message = toastData;
    } else if (toastData?.message) {
      message = toastData.message;
      title = toastData.title;
      type = toastData.type || 'info';
    } else {
      console.warn('Toast data invalide:', toastData);
      message = 'Notification sans message';
      type = 'warning';
    }

    const newToast: ToastMessageData = {
      id,
      message,
      type,
      ...(title && { title }),
    };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextProps => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
