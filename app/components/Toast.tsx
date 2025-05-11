import React from 'react';
import { 
  FaCheckCircle,
  FaExclamationCircle,
  FaInfoCircle,
  FaExclamationTriangle,
  FaTimes
} from 'react-icons/fa';
import {
  useToast as useAppToast,
  type ToastMessageData,
  type ToastType,
} from '~/context/ToastContext';

// Configuration for styling based on toast type
const toastConfig: Record<ToastType, {
    icon: React.ComponentType<{className?: string}>;
  bgClass: string;
  iconColor: string;
  textColor: string;
  progressClass: string;
}> = {
  success: {
    icon: FaCheckCircle,
    bgClass: 'bg-green-600',
    iconColor: 'text-green-100',
    textColor: 'text-green-50',
    progressClass: 'bg-green-200',
  },
  error: {
    icon: FaExclamationCircle,
    bgClass: 'bg-red-600',
    iconColor: 'text-red-100',
    textColor: 'text-red-50',
    progressClass: 'bg-red-200',
  },
  info: {
    icon: FaInfoCircle,
    bgClass: 'bg-blue-600',
    iconColor: 'text-blue-100',
    textColor: 'text-blue-50',
    progressClass: 'bg-blue-200',
  },
  warning: {
    icon: FaExclamationTriangle,
    bgClass: 'bg-yellow-500',
    iconColor: 'text-yellow-100',
    textColor: 'text-yellow-50',
    progressClass: 'bg-yellow-200',
  },
};

// ✅ Toast (Message) Component
interface ToastProps {
  toast: ToastMessageData;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  const config = toastConfig[toast.type];
  const shadowColor = {
    success: 'shadow-green-400/30',
    error: 'shadow-red-400/30',
    info: 'shadow-blue-400/30',
    warning: 'shadow-yellow-400/30',
  }[toast.type];
  return (
    <div
      className={`max-w-sm w-full backdrop-blur-md bg-white/10 border border-white/20 ${config.bgClass} ${shadowColor} shadow-2xl rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden mb-3 animate-fade-in-up transition-all duration-300 ease-in-out`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="p-4 flex items-start gap-3">
        <div className="flex-shrink-0 relative">
          <config.icon className={`h-6 w-6 ${config.iconColor}`} aria-hidden="true" />
          {(toast.type === 'warning' || toast.type === 'error') && (
            <span className="absolute -top-2 -right-2 animate-ping inline-flex h-3 w-3 rounded-full bg-red-500 opacity-75"></span>
          )}
        </div>
        <div className="ml-1 w-0 flex-1 pt-0.5">
          <p className={`text-sm font-bold ${config.textColor}`}>{toast.title}</p>
          <p className={`mt-1 text-sm ${config.textColor} opacity-90`}>{toast.message}</p>
        </div>
        <div className="ml-4 flex-shrink-0 flex">
          <button
            onClick={() => onClose(toast.id)}
            className={`inline-flex rounded-md ${config.bgClass} ${config.textColor} opacity-80 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-${toast.type}-600 focus:ring-white scale-100 hover:scale-110 transition-transform`}
            aria-label="Fermer"
          >
            <FaTimes className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ✅ Toast Container
const ToastContainerComponent: React.FC = () => {
  const { toasts, removeToast } = useAppToast();

  if (!toasts.length) return null;

  return (
    <div className="fixed inset-0 flex flex-col items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-end z-50 space-y-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onClose={removeToast} />
      ))}
    </div>
  );
};

// ✅ Exportation
export { ToastContainerComponent as ToastContainer };
export default ToastContainerComponent;
