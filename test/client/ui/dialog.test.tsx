import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TapError } from '../../../src/client/errors';
import { TapHostProvider } from '../../../src/host/provider';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../src/ui';
import { createStubTap } from '../../support/tap';

function mount(ui: ReactElement, portal: HTMLElement | null) {
  const { tap } = createStubTap({ __portal: portal });
  return render(<TapHostProvider tap={tap}>{ui}</TapHostProvider>);
}

function example(open: boolean, onOpenChange = vi.fn()) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="custom-dialog" size="large" surface="canvas">
        <DialogHeader>
          <DialogTitle>Confirm</DialogTitle>
          <DialogDescription>This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <button type="button">First</button>
        </DialogBody>
        <DialogFooter>
          <button type="button">Save</button>
          <DialogClose />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('renders compound slots into the host portal with an accessible name', () => {
    const portal = document.createElement('div');
    document.body.append(portal);
    mount(example(true), portal);

    const dialog = screen.getByRole('dialog', { name: 'Confirm' });
    expect(portal).toContainElement(dialog);
    expect(dialog).toHaveClass('tap-ui-dialog', 'custom-dialog');
    expect(dialog).toHaveAttribute('data-size', 'large');
    expect(dialog).toHaveAttribute('data-surface', 'canvas');
    for (const slot of [
      'dialog-content',
      'dialog-header',
      'dialog-title',
      'dialog-description',
      'dialog-body',
      'dialog-footer',
      'dialog-close',
    ]) {
      expect(portal.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }
  });

  it('renders nothing while closed and throws TAP_NO_PORTAL when opened without a portal', () => {
    const portal = document.createElement('div');
    document.body.append(portal);
    const view = mount(example(false), portal);
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();

    let thrown: unknown;
    try {
      mount(example(true), null);
    } catch (error) {
      thrown = error;
    }
    expect(TapError.is(thrown)).toBe(true);
    if (TapError.is(thrown)) expect(thrown.code).toBe('TAP_NO_PORTAL');
  });

  it('closes from Escape, the scrim, the close button, and the host event', async () => {
    const portal = document.createElement('div');
    document.body.append(portal);
    const onOpenChange = vi.fn();
    mount(example(true, onOpenChange), portal);

    await userEvent.keyboard('{Escape}');
    fireEvent.mouseDown(portal.querySelector('[data-slot="dialog-overlay"]')!);
    await userEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    portal.dispatchEvent(new CustomEvent('tap:dialog-close'));
    expect(onOpenChange).toHaveBeenNthCalledWith(1, false);
    expect(onOpenChange).toHaveBeenCalledTimes(4);
  });

  it('traps forward and reverse Tab and restores shadow-root focus', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const opener = document.createElement('button');
    const portal = document.createElement('div');
    const container = document.createElement('div');
    shadow.append(opener, portal, container);
    opener.focus();

    const { tap } = createStubTap({ __portal: portal });
    const { unmount } = render(
      <TapHostProvider tap={tap}>{example(true)}</TapHostProvider>,
      { container },
    );
    const buttons = [...portal.querySelectorAll('button')];
    const first = buttons[0];
    const last = buttons.at(-1)!;
    expect(shadow.activeElement).toBe(first);
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(shadow.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(shadow.activeElement).toBe(last);
    unmount();
    expect(shadow.activeElement).toBe(opener);
  });
});
