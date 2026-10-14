import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { JsonSchema } from '../../../src/manifest/types';
import { SchemaForm, schemaFields } from '../../../src/ui';

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

describe('schemaFields', () => {
  it('maps every supported field kind in schema order', () => {
    expect(schemaFields(schema)).toEqual([
      { name: 'title', label: 'Title', kind: 'text', required: true },
      {
        name: 'body',
        label: 'Body',
        kind: 'textarea',
        required: false,
        description: 'Markdown',
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

describe('SchemaForm', () => {
  it('renders native controls and rejects invalid values', async () => {
    const onSubmit = vi.fn();
    render(<SchemaForm schema={schema} onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Body').tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText('Send at')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Audience').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Limit')).toHaveAttribute('type', 'number');
    expect(screen.getByLabelText('Silent')).toHaveAttribute('type', 'checkbox');
    await userEvent.type(screen.getByLabelText('Title'), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/expected string to have >=3 characters/i),
    ).toBeVisible();
  });

  it('cleans blanks and submits coerced numbers and booleans', async () => {
    const onSubmit = vi.fn();
    render(
      <SchemaForm
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

  it('keeps required validation when Zod cannot compile the schema', async () => {
    const onSubmit = vi.fn();
    render(
      <SchemaForm
        schema={{
          type: 'object',
          properties: {
            reviewFocus: { type: 'string', title: 'Review Focus' },
          },
          required: ['reviewFocus'],
          $ref: '#/missing',
        }}
        onSubmit={onSubmit}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Review Focus is required.')).toBeVisible();
  });

  it('supports busy and optional cancel actions in the narrow-stack slot', async () => {
    const onCancel = vi.fn();
    render(
      <SchemaForm
        schema={schema}
        busy
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.parentElement).toHaveAttribute('data-slot', 'form-actions');
    expect(cancel.parentElement).toHaveClass('tap-inline');
    await userEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
