import React, { useRef, useEffect } from 'react';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: 'left' | 'right'; // 'left' by default
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  children,
  side = 'left',
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    } else {
      document.removeEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleOverlayClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const sideClass = side === 'right' ? 'right-0' : 'left-0';
  const transformClass = isOpen
    ? 'translate-x-0'
    : side === 'right'
    ? 'translate-x-full'
    : '-translate-x-full';

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300 ease-in-out"
          onClick={handleOverlayClick}
        ></div>
      )}

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 bottom-0 w-64 bg-jdc-card shadow-lg z-50 transform transition-transform duration-300 ease-in-out ${sideClass} ${transformClass}`}
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        tabIndex={isOpen ? 0 : -1}
      >
        <div className="p-4">
          <button
            onClick={onClose}
            className="absolute top-2 right-2 text-jdc-gray-400 hover:text-jdc-yellow text-xl"
            aria-label="Close drawer"
          >
            &times;
          </button>
          {children}
        </div>
      </div>
    </>
  );
};
