import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TapForm, formFields } from '../../../src/client/ui/TapForm';
import type { JsonSchema } from '../../../src/manifest/types';

const schema: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', title: 'Title', minLength: 3 },
    body: { type: 'string', format: 'textarea', description: 'Markdown' },
    sendAt: { type: 'string', format: 'date', title: 'Send at' },
    audience: { type: 'string', enum: ['all', 'lapsed'], title: 'Audience' },
    limit: { type: 'number', title: 'Limit' },
    silent: { type: 'boolean', title: 'Silent' },
  },
  required: ['title', 'audience'],
};

describe('formFields', () => {
  it('maps every schema field kind the SDK supports', () => {
    expect(formFields(schema)).toEqual([
      { name: 'title', label: 'Title', kind: 'text', required: true },
      {
        name: 'body',
        label: 'Body',
        kind: 'textarea',
        required: false,
        hint: 'Markdown',
      },
      { name: 'sendAt', label: 'Send at', kind: 'date', required: false },
      {
        name: 'audience',
        label: 'Audience',
        kind: 'enum',
        required: true,
        options: [
          { value: 'all', label: 'all' },
          { value: 'lapsed', label: 'lapsed' },
        ],
      },
      { name: 'limit', label: 'Limit', kind: 'number', required: false },
      { name: 'silent', label: 'Silent', kind: 'boolean', required: false },
    ]);
  });
});

describe('TapForm', () => {
  it('renders one control per field with the right element', () => {
    render(<TapForm schema={schema} onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Title').tagName).toBe('INPUT');
    expect(screen.getByLabelText('Body').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Send at')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Audience').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Limit')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Silent')).toHaveAttribute('type', 'checkbox');
  });

  it('blocks submit and shows the schema message when a value is invalid', async () => {
    const onSubmit = vi.fn();
    render(<TapForm schema={schema} onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/expected string to have >=3 characters/i),
    ).toBeInTheDocument();
  });

  it('submits the parsed value with numbers and booleans coerced', async () => {
    const onSubmit = vi.fn();
    render(
      <TapForm
        schema={schema}
        value={{ audience: 'all' }}
        submitLabel="Send"
        onSubmit={onSubmit}
      />,
    );

    await userEvent.type(screen.getByLabelText('Title'), 'Launch');
    await userEvent.type(screen.getByLabelText('Limit'), '25');
    await userEvent.click(screen.getByLabelText('Silent'));
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Launch',
      audience: 'all',
      limit: 25,
      silent: true,
    });
  });

  it('names the field a required value is missing from', async () => {
    const onSubmit = vi.fn();
    render(
      <TapForm
        schema={schema}
        value={{ audience: 'all' }}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Title is required.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Title'), 'L');
    expect(screen.queryByText('Title is required.')).toBeNull();
  });

  it('holds the submit button busy while the vendor saves', () => {
    render(<TapForm schema={schema} busy onSubmit={vi.fn()} />);

    const submit = screen.getByRole('button', { name: 'Submit' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
  });

  it('renders a cancel button only when a handler is given', () => {
    const { rerender } = render(<TapForm schema={schema} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    rerender(<TapForm schema={schema} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });
});
