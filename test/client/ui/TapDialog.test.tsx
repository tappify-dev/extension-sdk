import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TapError } from '../../../src/client/errors';
import { TapDialog } from '../../../src/client/ui/TapDialog';
import { TapHostProvider } from '../../../src/host/provider';
import { createStubTap } from '../../support/tap';

function mount(ui: ReactElement, portal: HTMLElement | null): void {
  const { tap } = createStubTap({ __portal: portal });
  render(<TapHostProvider tap={tap}>{ui}</TapHostProvider>);
}

describe('TapDialog', () => {
  it('renders into the host portal node, not the document body', () => {
    const portal = document.createElement('div');
    portal.id = 'portal';
    document.body.append(portal);

    mount(
      <TapDialog open title="Confirm" onClose={vi.fn()}>
        <p>Body</p>
      </TapDialog>,
      portal,
    );

    expect(portal.querySelector('[role="dialog"]')).not.toBeNull();
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Confirm');
  });

  it('renders nothing when closed', () => {
    const portal = document.createElement('div');
    document.body.append(portal);

    mount(
      <TapDialog open={false} title="Confirm" onClose={vi.fn()}>
        <p>Body</p>
      </TapDialog>,
      portal,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('throws TAP_NO_PORTAL when the mount has no portal node', () => {
    let thrown: unknown;
    try {
      mount(
        <TapDialog open title="Confirm" onClose={vi.fn()}>
          <p>Body</p>
        </TapDialog>,
        null,
      );
    } catch (error) {
      thrown = error;
    }

    expect(TapError.is(thrown)).toBe(true);
    if (!TapError.is(thrown)) throw new Error('unreachable');
    expect(thrown.code).toBe('TAP_NO_PORTAL');
  });

  it('names the dialog from labelledBy when the vendor renders its own title', () => {
    const portal = document.createElement('div');
    document.body.append(portal);

    mount(
      <TapDialog
        open
        title="Confirm"
        onClose={vi.fn()}
        labelledBy="vendor-heading"
      >
        <h3 id="vendor-heading">Archive this release</h3>
      </TapDialog>,
      portal,
    );

    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      'Archive this release',
    );
  });

  it('closes on Escape and traps Tab inside the dialog', async () => {
    const portal = document.createElement('div');
    document.body.append(portal);
    const onClose = vi.fn();

    mount(
      <TapDialog
        open
        title="Confirm"
        onClose={onClose}
        footer={<button type="button">Save</button>}
      >
        <button type="button">First</button>
      </TapDialog>,
      portal,
    );

    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the mount dispatches tap:dialog-close on the portal node', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });

    const portal = document.createElement('div');
    const container = document.createElement('div');
    shadow.append(portal, container);
    const onClose = vi.fn();

    const { tap } = createStubTap({ __portal: portal });
    const { unmount } = render(
      <TapHostProvider tap={tap}>
        <TapDialog open title="Confirm" onClose={onClose}>
          <p>Body</p>
        </TapDialog>
      </TapHostProvider>,
      { container },
    );

    portal.dispatchEvent(new CustomEvent('tap:dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    portal.dispatchEvent(new CustomEvent('tap:dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab and restores the opener inside the mount shadow root', () => {
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
      <TapHostProvider tap={tap}>
        <TapDialog
          open
          title="Confirm"
          onClose={vi.fn()}
          footer={<button type="button">Save</button>}
        >
          <button type="button">First</button>
        </TapDialog>
      </TapHostProvider>,
      { container },
    );

    const [first, save] = [...portal.querySelectorAll('button')];
    expect(shadow.activeElement).toBe(first);

    save.focus();
    fireEvent.keyDown(save, { key: 'Tab' });
    expect(shadow.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(shadow.activeElement).toBe(save);

    unmount();
    expect(shadow.activeElement).toBe(opener);
  });
});
