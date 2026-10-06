import { describe, expect, it } from 'vitest';
import { registerTapMatchers, tapMatchers } from '../../src/testing/matchers';
import { createTapMock } from '../../src/testing/mock';

registerTapMatchers(expect);

describe('matchers', () => {
  it('reports navigation, toasts, actions and stored documents', async () => {
    const mock = createTapMock();

    mock.tap.nav.push('/projects/prj_north/analytics');
    mock.tap.ui.toast('Preferences saved', 'success');
    await mock.tap.actions.run('send_push', { audience: 'all', quiet: false });
    const preferences = mock.tap.storage.preferences;
    if (!('set' in preferences)) throw new Error('expected a singleton handle');
    await preferences.set({ compact: true, density: 'tight' });

    expect(mock).toHaveNavigatedTo('/projects/prj_north/analytics');
    expect(mock).toHaveToasted('Preferences saved');
    expect(mock).toHaveToasted(/saved/i);
    expect(mock).toHaveRunAction('send_push');
    expect(mock).toHaveRunAction('send_push', {
      quiet: false,
      audience: 'all',
    });
    expect(mock).toHaveStored('preferences', {
      density: 'tight',
      compact: true,
    });
  });

  it('explains what was recorded when a matcher fails', () => {
    const mock = createTapMock();
    mock.tap.nav.push('/projects/prj_north/overview');

    const result = tapMatchers.toHaveNavigatedTo(
      mock,
      '/projects/prj_north/analytics',
    );

    expect(result.pass).toBe(false);
    expect(result.message()).toContain('/projects/prj_north/overview');
  });

  it('names what was shown when no toast matches', () => {
    const mock = createTapMock();
    mock.tap.ui.toast('Nothing to export');

    const missed = tapMatchers.toHaveToasted(mock, /saved/i);
    const empty = tapMatchers.toHaveToasted(createTapMock(), 'Saved');

    expect(missed.pass).toBe(false);
    expect(missed.message()).toContain('Nothing to export');
    expect(empty.message()).toContain('none');
  });

  it('lists the runs and the documents a failed matcher looked at', async () => {
    const mock = createTapMock();
    await mock.tap.actions.run('send_push', { audience: 'all' });

    const preferences = mock.tap.storage.preferences;
    if (!('set' in preferences)) throw new Error('expected a singleton handle');
    await preferences.set({ compact: false });

    const wrongInput = tapMatchers.toHaveRunAction(mock, 'send_push', {
      audience: 'beta',
    });
    const wrongDocument = tapMatchers.toHaveStored(mock, 'preferences', {
      compact: true,
    });

    expect(wrongInput.pass).toBe(false);
    expect(wrongInput.message()).toContain('"audience":"all"');
    expect(wrongDocument.pass).toBe(false);
    expect(wrongDocument.message()).toContain('"compact":false');
  });

  it('tells two dates apart instead of comparing their own keys', async () => {
    const mock = createTapMock();
    const preferences = mock.tap.storage.preferences;
    if (!('set' in preferences)) throw new Error('expected a singleton handle');
    await preferences.set({ savedAt: new Date(0) });

    expect(
      tapMatchers.toHaveStored(mock, 'preferences', {
        savedAt: new Date(86_400_000),
      }).pass,
    ).toBe(false);
    expect(
      tapMatchers.toHaveStored(mock, 'preferences', { savedAt: new Date(0) })
        .pass,
    ).toBe(true);
  });

  it('refuses a received value that is not a mock', () => {
    expect(() => tapMatchers.toHaveToasted({}, 'x')).toThrow(
      /takes the mock renderWithTap\(\) returned/,
    );
  });
});
