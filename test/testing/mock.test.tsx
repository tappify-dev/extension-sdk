import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useTap } from '../../src/client/context';
import { TapError } from '../../src/client/errors';
import {
  installPrefix,
  procedurePrefix,
  useTapQuery,
  useTapStorage,
} from '../../src/client/query';
import { clearTapPortals } from '../../src/testing/environment';
import {
  answerFixtureQuery,
  fixtureKeywords,
  fixtures,
} from '../../src/testing/fixtures';
import { createTapMock } from '../../src/testing/mock';
import { renderWithTap } from '../../src/testing/render';

describe('fixtures', () => {
  it('answers every query kind with sandbox data', () => {
    expect(answerFixtureQuery({ kind: 'project' }).apps).toHaveLength(2);
    expect(
      answerFixtureQuery({
        kind: 'series',
        metric: 'downloads',
        range: { from: '2026-09-01', to: '2026-09-07' },
      }).points,
    ).toHaveLength(7);
    expect(answerFixtureQuery({ kind: 'keywords' }).keywords).toHaveLength(3);
    expect(answerFixtureQuery({ kind: 'listing' }).listings).toHaveLength(1);
    expect(
      answerFixtureQuery({
        kind: 'reviews',
        range: { from: '2026-09-01', to: '2026-09-07' },
      }).reviews,
    ).toHaveLength(3);
    expect(
      answerFixtureQuery({
        kind: 'crashes',
        range: { from: '2026-09-01', to: '2026-09-07' },
      }).crashFreeRate,
    ).toBeCloseTo(99.42);
    expect(
      answerFixtureQuery({
        kind: 'revenue',
        range: { from: '2026-09-01', to: '2026-09-07' },
      }).currency,
    ).toBe('USD');
    expect(fixtures.project.project.name).toBe('Northlight');
  });

  it('hands out a copy so a component cannot mutate the fixture', () => {
    const answered = answerFixtureQuery({ kind: 'keywords' });

    answered.keywords.sort((left, right) =>
      left.term.localeCompare(right.term),
    );
    answered.keywords[0].term = 'rewritten';
    answered.keywords.pop();

    expect(fixtureKeywords).toHaveLength(3);
    expect(fixtureKeywords.map(keyword => keyword.term)).toEqual([
      'photo editor',
      'collage maker',
      'photo editor',
    ]);
  });
});

describe('createTapMock', () => {
  it('records navigation, toasts, chats, actions and telemetry', async () => {
    const mock = createTapMock();

    mock.tap.nav.push('/projects/prj_north/analytics');
    mock.tap.ui.toast('Saved', 'success');
    mock.tap.nav.openChat('Why did installs fall?');
    await mock.tap.actions.run('send_push', { audience: 'all' });
    mock.tap.telemetry.event('summary_viewed', { size: 'slot' });

    expect(mock.calls.navigations).toEqual(['/projects/prj_north/analytics']);
    expect(mock.calls.toasts).toEqual([{ message: 'Saved', tone: 'success' }]);
    expect(mock.calls.chats[0].prompt).toBe('Why did installs fall?');
    expect(mock.calls.actions).toEqual([
      { actionId: 'send_push', input: { audience: 'all' } },
    ]);
    expect(mock.calls.telemetry[0].name).toBe('summary_viewed');
  });

  it('refuses a query whose scope was not granted', async () => {
    const mock = createTapMock({ scopes: ['ui:render'] });

    await expect(mock.tap.data.query({ kind: 'keywords' })).rejects.toSatisfy(
      (error: unknown) =>
        TapError.is(error) && error.code === 'TAP_SCOPE_MISSING',
    );
  });

  it('refuses a storage write when storage:write was not granted', async () => {
    const mock = createTapMock({ scopes: ['ui:render'] });
    const preferences = mock.tap.storage.preferences;

    if (!('patch' in preferences))
      throw new Error('expected a singleton handle');
    await expect(preferences.patch({ compact: true })).rejects.toSatisfy(
      (error: unknown) =>
        TapError.is(error) &&
        error.code === 'TAP_SCOPE_MISSING' &&
        /has not granted storage:write/.test(error.message),
    );
  });

  it('stores documents in memory and reads them back', async () => {
    const mock = createTapMock();
    const preferences = mock.tap.storage.preferences;

    if (!('patch' in preferences))
      throw new Error('expected a singleton handle');
    await preferences.patch({ compact: true });

    expect(mock.documents('preferences')).toEqual([{ compact: true }]);
    expect(mock.documents('preferences', 'singleton')).toHaveLength(1);
    expect(mock.documents('preferences', 'missing')).toEqual([]);
  });

  it('hands back the same storage handle for a collection', () => {
    const mock = createTapMock();

    expect(mock.tap.storage.preferences).toBe(mock.tap.storage.preferences);
    expect(mock.tap.storage.preferences).not.toBe(mock.tap.storage.drafts);
  });

  it('answers framework probe keys with undefined instead of a handle', async () => {
    const mock = createTapMock({ storage: { preferences: 'singleton' } });
    const probe: Record<string, unknown> = mock.tap.storage;

    expect(probe.then).toBeUndefined();
    expect(probe.toJSON).toBeUndefined();
    expect(probe.$$typeof).toBeUndefined();
    expect(probe.constructor).toBeUndefined();
    expect(probe.asymmetricMatch).toBeUndefined();
    expect(Reflect.get(mock.tap.storage, Symbol.toStringTag)).toBeUndefined();
    expect(JSON.stringify({ storage: mock.tap.storage })).toBe(
      '{"storage":{}}',
    );
    await expect(Promise.resolve(mock.tap.storage)).resolves.toBe(
      mock.tap.storage,
    );
    expect(mock.tap.storage.preferences).toBeDefined();

    const undeclared: Record<string, unknown> = createTapMock().tap.storage;
    expect(undeclared.then).toBeUndefined();
    expect(undeclared.toJSON).toBeUndefined();
  });

  it('names only the collections the storage option declares', () => {
    const mock = createTapMock({ storage: { preferences: 'singleton' } });

    expect(() => mock.tap.storage.drafts).toThrow(
      /no storage collection called "drafts"/,
    );
    expect(() => mock.tap.storage.drafts).toThrowError(
      expect.objectContaining({ code: 'TAP_UNKNOWN_COLLECTION' }),
    );
  });

  it('exposes a singleton surface and an id-keyed surface per declared kind', async () => {
    const mock = createTapMock({
      storage: { preferences: 'singleton', notes: 'collection' },
    });
    const preferences = mock.tap.storage.preferences;
    const notes = mock.tap.storage.notes;

    expect(Object.keys(preferences).sort()).toEqual(['get', 'patch', 'set']);
    expect(Object.keys(notes).sort()).toEqual(['delete', 'get', 'list', 'put']);

    if (!('patch' in preferences)) {
      throw new Error('expected a singleton handle');
    }
    if (!('put' in notes)) throw new Error('expected a collection handle');

    await preferences.patch({ compact: true });
    await notes.put('note-1', { body: 'written' });

    expect(mock.documents('preferences')).toEqual([{ compact: true }]);
    await expect(notes.list()).resolves.toEqual({
      items: [{ body: 'written', id: 'note-1' }],
    });
  });

  it('lets useTapStorage report an id-keyed collection as the wrong kind', () => {
    function Probe(): ReactElement {
      useTapStorage('notes');
      return <span data-testid="notes">unreachable</span>;
    }

    let thrown: unknown;
    try {
      renderWithTap(<Probe />, { storage: { notes: 'collection' } });
    } catch (error) {
      thrown = error;
    }

    expect(TapError.is(thrown)).toBe(true);
    if (!TapError.is(thrown)) throw new Error('unreachable');
    expect(thrown.code).toBe('TAP_UNKNOWN_COLLECTION');
    expect(thrown.message).toMatch(/reads a singleton collection/);
  });

  it('routes tap.server.<name> to a local implementation', async () => {
    const mock = createTapMock({
      server: { getSummary: input => ({ echoed: input }) },
    });

    await expect(mock.tap.server.getSummary({ days: 7 })).resolves.toEqual({
      echoed: { days: 7 },
    });
  });

  it('explains that no procedure is registered', async () => {
    const mock = createTapMock();

    await expect(mock.tap.server.getSummary({})).rejects.toSatisfy(
      (error: unknown) =>
        TapError.is(error) && error.code === 'TAP_UNKNOWN_PROCEDURE',
    );
  });

  it('delivers a host event to tap.data.subscribe', () => {
    const mock = createTapMock();
    const seen: unknown[] = [];

    mock.tap.data.subscribe('release.shipped', payload => seen.push(payload));
    mock.emit('release.shipped', { version: '4.2.0', build: '118' });

    expect(seen).toEqual([{ version: '4.2.0', build: '118' }]);
  });

  it('replaces the slice a setter changes and then notifies its listeners', () => {
    const mock = createTapMock();
    const before = mock.tap.filters;
    let notified = 0;

    mock.tap.__subscribe('filters', () => {
      notified += 1;
    });
    mock.setFilters({
      range: { from: '2026-08-01', to: '2026-08-31', preset: '30d' },
      platform: 'ios',
      country: 'US',
    });

    expect(notified).toBe(1);
    expect(mock.tap.filters).not.toBe(before);
    expect(mock.tap.filters.platform).toBe('ios');
  });
});

describe('renderWithTap', () => {
  function Widget(): ReactElement {
    const tap = useTap();
    const keywords = useTapQuery({ kind: 'keywords' });
    const preferences = useTapStorage('preferences');

    return (
      <div>
        <span data-testid="size">{tap.ui.size}</span>
        <span data-testid="count">{keywords.data?.keywords.length ?? 0}</span>
        <button
          type="button"
          onClick={() => void preferences.save({ compact: true })}
        >
          compact
        </button>
      </div>
    );
  }

  it('mounts a component against the mock bridge at the requested size', async () => {
    const { mock } = renderWithTap(<Widget />, { size: 'panel' });

    expect(screen.getByTestId('size')).toHaveTextContent('panel');
    await waitFor(() =>
      expect(screen.getByTestId('count')).toHaveTextContent('3'),
    );

    await userEvent.click(screen.getByRole('button', { name: 'compact' }));
    await waitFor(() =>
      expect(mock.documents('preferences')).toEqual([{ compact: true }]),
    );
  });

  it('rereads a collection the host broadcasts a write for', async () => {
    function Preferences(): ReactElement {
      const stored = useTapStorage('preferences');
      return (
        <span data-testid="compact">
          {typeof stored.data === 'object' &&
          stored.data !== null &&
          'compact' in stored.data
            ? String(stored.data.compact)
            : 'unset'}
        </span>
      );
    }

    const { mock } = renderWithTap(<Preferences />);

    await waitFor(() =>
      expect(screen.getByTestId('compact')).toHaveTextContent('unset'),
    );

    const preferences = mock.tap.storage.preferences;
    if (!('set' in preferences)) throw new Error('expected a singleton handle');
    await preferences.set({ compact: true });

    await waitFor(() =>
      expect(screen.getByTestId('compact')).toHaveTextContent('true'),
    );
  });

  it('attaches the portal node so TapDialog has somewhere to render', () => {
    const { mock, baseElement } = renderWithTap(<Widget />);

    expect(baseElement.contains(mock.portal)).toBe(true);

    clearTapPortals();

    expect(baseElement.contains(mock.portal)).toBe(false);
  });

  it('wires tap.invalidate() to the install and procedure prefixes', () => {
    const { tap, queryClient } = renderWithTap(<Widget />);
    const installId = tap.extension.installId;
    const invalidate = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined);

    tap.invalidate();
    tap.invalidate('getSummary');

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      [installPrefix(installId), procedurePrefix(installId, 'getSummary')],
    );
  });
});
