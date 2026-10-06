import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useTap } from '../context';
import { TapError } from '../errors';

const DIALOG_CLOSE_EVENT = 'tap:dialog-close';

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * `document.activeElement` is the mount's shadow host whenever focus sits
 * inside the shadow tree, so the trap resolves focus from the dialog's own root.
 */
function activeElementNear(node: Node | null): Element | null {
  const root = node?.getRootNode();
  return root instanceof ShadowRoot
    ? root.activeElement
    : document.activeElement;
}

/** The props `TapDialog` takes. */
export interface TapDialogProps {
  /** The dialog renders nothing while this is `false`. */
  open: boolean;
  /** Rendered in the header, and used as the dialog's accessible name. */
  title: string;
  /** Called by Escape, by a click on the scrim, and by the host's close event. */
  onClose: () => void;
  /** Rendered under a divider at the end, for the dialog's buttons. */
  footer?: ReactNode;
  children: ReactNode;
  /** The id of your own heading, when the accessible name is not the title. */
  labelledBy?: string;
}

/**
 * Renders a modal dialog into the mount's own portal node, so it covers the
 * surface without leaving the extension.
 *
 * @remarks
 * Rendered outside a Tappify mount it throws `TAP_OUTSIDE_HOST`, from the `useTap`
 * above it. Inside a mount whose shadow root has no portal node yet, opening it
 * throws `TapError` with code `TAP_NO_PORTAL`; `renderWithTap` provides that node
 * in tests. While open it traps Tab
 * inside itself, moves focus to the first focusable element and returns focus
 * where it was on close, and answers Escape and a click on the scrim with
 * `onClose`. The scrim follows `--tap-scrim` and the panel `--bg-raised`,
 * `--divider` and `--tap-radius`; the panel is at most 520 pixels wide. The
 * component keeps no open state of its own.
 *
 * @example
 * ```tsx
 * import { TapButton, TapDialog } from '@tappify/extension-sdk';
 * import { useState } from 'react';
 *
 * function ExportDialog() {
 *   const [open, setOpen] = useState(false);
 *   return (
 *     <>
 *       <TapButton onClick={() => setOpen(true)}>Export</TapButton>
 *       <TapDialog
 *         open={open}
 *         title="Export keywords"
 *         onClose={() => setOpen(false)}
 *         footer={<TapButton onClick={() => setOpen(false)}>Done</TapButton>}
 *       >
 *         <span>The report covers the range in the filter bar.</span>
 *       </TapDialog>
 *     </>
 *   );
 * }
 * ```
 */
export function TapDialog({
  open,
  title,
  onClose,
  footer,
  children,
  labelledBy,
}: TapDialogProps): ReactElement | null {
  const tap = useTap();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const focusables = useCallback((): HTMLElement[] => {
    const root = dialogRef.current;
    if (root === null) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE));
  }, []);

  useEffect(() => {
    if (!open) return;

    const previous = activeElementNear(dialogRef.current);
    focusables()[0]?.focus();

    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, focusables]);

  useEffect(() => {
    const portal = tap.__portal;
    if (!open || portal === null) return;

    const close = (): void => {
      onClose();
    };

    portal.addEventListener(DIALOG_CLOSE_EVENT, close);
    return () => {
      portal.removeEventListener(DIALOG_CLOSE_EVENT, close);
    };
  }, [open, tap, onClose]);

  if (!open) return null;

  if (tap.__portal === null) {
    throw new TapError(
      'TAP_NO_PORTAL',
      'TapDialog needs the host portal node, which the mount sets inside its shadow root. Render this dialog from a contribution entry, or use renderWithTap() in tests.',
    );
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key !== 'Tab') return;

    const items = focusables();
    if (items.length === 0) return;

    const first = items[0];
    const last = items[items.length - 1];
    const active = activeElementNear(dialogRef.current);

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="tap-dialog-scrim"
      onKeyDown={onKeyDown}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="tap-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? titleId}
      >
        <header className="tap-dialog__head" id={titleId}>
          {title}
        </header>
        <div className="tap-dialog__body">{children}</div>
        {footer !== undefined && (
          <footer className="tap-dialog__foot">{footer}</footer>
        )}
      </div>
    </div>,
    tap.__portal,
  );
}
