import React from 'react';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Override the overlay's z-index utility class (e.g. when nesting inside another modal). Defaults to 'z-50'. */
  overlayClassName?: string;
}

export default function Modal({ onClose, children, overlayClassName = 'z-50' }: ModalProps) {
  return (
    <div
      className={`fixed inset-0 ${overlayClassName} flex items-center justify-center p-4`}
      style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-muted)] transition-colors text-[var(--color-muted-foreground)] text-lg"
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}
