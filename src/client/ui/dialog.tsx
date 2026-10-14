import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { useTap } from '../context';
import { TapError } from '../errors';
import { Button } from './button';
import { cn } from './cn';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function activeElementNear(node: Node | null): Element | null {
  const root = node?.getRootNode();
  return root instanceof ShadowRoot
    ? root.activeElement
    : document.activeElement;
}

interface DialogContextValue {
  close: () => void;
  contentRef: RefObject<HTMLDivElement | null>;
  descriptionId: string;
  titleId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogPart(): DialogContextValue {
  const value = useContext(DialogContext);
  if (!value)
    throw new Error('Dialog compound parts must be rendered inside Dialog.');
  return value;
}

/** Props for the controlled dialog root. */
export interface DialogProps {
  children: ReactNode;
  /** Called when the dialog requests an open-state change. */
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/** Coordinates a controlled, host-portaled modal dialog. */
export function Dialog({
  children,
  onOpenChange,
  open,
}: DialogProps): ReactElement | null {
  const tap = useTap();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const close = useCallback(() => onOpenChange(false), [onOpenChange]);
  const focusables = useCallback(
    () =>
      Array.from(
        contentRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ),
    [],
  );

  useEffect(() => {
    if (!open) return;
    const previous = activeElementNear(contentRef.current);
    focusables()[0]?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [focusables, open]);

  useEffect(() => {
    if (!open || !tap.__portal) return;
    tap.__portal.addEventListener('tap:dialog-close', close);
    return () => tap.__portal?.removeEventListener('tap:dialog-close', close);
  }, [close, open, tap]);

  if (!open) return null;
  if (!tap.__portal) {
    throw new TapError(
      'TAP_NO_PORTAL',
      'Dialog needs the host portal node inside the extension shadow root.',
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items.at(-1)!;
    const active = activeElementNear(contentRef.current);
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <DialogContext.Provider
      value={{ close, contentRef, descriptionId, titleId }}
    >
      <div
        className="tap-ui-dialog-overlay"
        data-slot="dialog-overlay"
        onKeyDown={onKeyDown}
        onMouseDown={event => {
          if (event.target === event.currentTarget) close();
        }}
      >
        {children}
      </div>
    </DialogContext.Provider>,
    tap.__portal,
  );
}

/** Supported dialog widths and purpose-built layouts. */
export type DialogSize =
  | 'compact'
  | 'default'
  | 'medium'
  | 'confirmation'
  | 'large'
  | 'wide';

/** Props for the modal surface rendered inside {@link Dialog}. */
export interface DialogContentProps extends ComponentPropsWithoutRef<'div'> {
  size?: DialogSize;
  surface?: 'paper' | 'canvas';
}

/** Renders the accessible dialog surface and focus-trap boundary. */
export function DialogContent({
  className,
  size = 'default',
  surface = 'paper',
  ...props
}: DialogContentProps) {
  const dialog = useDialogPart();
  return (
    <div
      {...props}
      aria-describedby={props['aria-describedby'] ?? dialog.descriptionId}
      aria-labelledby={props['aria-labelledby'] ?? dialog.titleId}
      aria-modal="true"
      className={cn('tap-ui-dialog', className)}
      data-size={size}
      data-slot="dialog-content"
      data-surface={surface}
      ref={dialog.contentRef}
      role="dialog"
    />
  );
}

/** Wraps a dialog title and description. */
export function DialogHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<'header'>) {
  return (
    <header
      {...props}
      className={cn('tap-dialog__header', className)}
      data-slot="dialog-header"
    />
  );
}

/** Labels the containing dialog. */
export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<'h2'>) {
  const dialog = useDialogPart();
  return (
    <h2
      {...props}
      className={cn('tap-dialog__title', className)}
      data-slot="dialog-title"
      id={props.id ?? dialog.titleId}
    />
  );
}

/** Describes the containing dialog for assistive technology. */
export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  const dialog = useDialogPart();
  return (
    <div
      {...props}
      className={cn('tap-dialog__description', className)}
      data-slot="dialog-description"
      id={props.id ?? dialog.descriptionId}
    />
  );
}

/** Wraps the main dialog content. */
export function DialogBody({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('tap-dialog__body', className)}
      data-slot="dialog-body"
    />
  );
}

/** Wraps dialog actions. */
export function DialogFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<'footer'>) {
  return (
    <footer
      {...props}
      className={cn('tap-dialog__footer', className)}
      data-slot="dialog-footer"
    />
  );
}

/** Renders a button that requests closure of the containing dialog. */
export function DialogClose({
  children = '×',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const dialog = useDialogPart();
  return (
    <Button
      {...props}
      aria-label={props['aria-label'] ?? 'Close dialog'}
      data-slot="dialog-close"
      onClick={event => {
        props.onClick?.(event);
        if (!event.defaultPrevented) dialog.close();
      }}
      size="icon-sm"
      variant="tertiary"
    >
      {children}
    </Button>
  );
}
