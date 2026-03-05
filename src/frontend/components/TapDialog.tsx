import React, { useEffect, useRef } from 'react';
import { cn } from '../utils/cn';

export interface TapDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function TapDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: TapDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className={cn(
        'w-full max-w-lg rounded-xl border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/50',
        className,
      )}
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
