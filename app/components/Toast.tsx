import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faExclamationCircle,
  faInfoCircle,
  faExclamationTriangle,
  faTimes,
} from '@fortawesome/free-solid-svg-icons';
import {
  useToast as useAppToast,
  type ToastMessageData,
  type ToastType,
} from '~/context/ToastContext';

// Configuration for styling based on toast type
const toastConfig: Record<ToastType, {
  icon: any;
  bgClass: string;
  iconColor: string;
  textColor: string;
  progressClass: string;
}> = {
  success: {
    icon: faCheckCircle,
    bgClass: 'bg-green-600',
    iconColor: 'text-green-100',
    textColor: 'text-green-50',
    progressClass: 'bg-green-200',
  },
  error: {
    icon: faExclamationCircle,
    bgClass: 'bg-red-600',
    iconColor: 'text-red-100',
    textColor: 'text-red-50',
    progressClass: 'bg-red-200',
  },
  info: {
    icon: faInfoCircle,
    bgClass: 'bg-blue-600',
    iconColor: 'text-blue-100',
    textColor: 'text-blue-50',
    progressClass: 'bg-blue-200',
  },
  warning: {
    icon: faExclamationTriangle,
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

  return (
    <div
      className={`max-w-sm w-full ${config.bgClass} shadow-lg rounded-lg pointer-events-auto ring-1 ring-black ring-opacity-5 overflow-hidden mb-3 transition-all duration-300 ease-in-out`}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <FontAwesomeIcon icon={config.icon} className={`h-6 w-6 ${config.iconColor}`} aria-hidden="true" />
          </div>
          <div className="ml-3 w-0 flex-1 pt-0.5">
            <p className={`text-sm font-medium ${config.textColor}`}>{toast.title}</p>
            <p className={`mt-1 text-sm ${config.textColor} opacity-90`}>{toast.message}</p>
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onClose(toast.id)}
              className={`inline-flex rounded-md ${config.bgClass} ${config.textColor} opacity-80 hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-${toast.type}-600 focus:ring-white`}
            >
              <span className="sr-only">Fermer</span>
              <FontAwesomeIcon icon={faTimes} className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {/* Optional progress bar */}
      {/* <div className={`h-1 ${config.progressClass} w-full`}></div> */}
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
