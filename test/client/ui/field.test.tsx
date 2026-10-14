import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from '../../../src/ui';

describe('field primitives', () => {
  it('associates the label and combines caller, description, and error IDs', () => {
    render(
      <Field>
        <FieldLabel>Email</FieldLabel>
        <Input id="account-email" aria-describedby="external-help" />
        <FieldDescription>Used for receipts.</FieldDescription>
        <FieldError>Enter a valid email.</FieldError>
      </Field>,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('id', 'account-email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual(
      expect.arrayContaining([
        'external-help',
        screen.getByText('Used for receipts.').id,
        screen.getByText('Enter a valid email.').id,
      ]),
    );
  });

  it('forwards refs, native events, classes, and disabled state', () => {
    const inputRef = createRef<HTMLInputElement>();
    const textareaRef = createRef<HTMLTextAreaElement>();
    const selectRef = createRef<HTMLSelectElement>();
    const onChange = vi.fn();
    render(
      <>
        <Input ref={inputRef} className="custom-input" onChange={onChange} />
        <Textarea ref={textareaRef} onChange={onChange} />
        <Select ref={selectRef} disabled onChange={onChange}>
          <option value="monthly">Monthly</option>
        </Select>
      </>,
    );

    fireEvent.change(inputRef.current!, { target: { value: 'hello' } });
    fireEvent.change(textareaRef.current!, { target: { value: 'details' } });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(inputRef.current).toHaveClass('tap-input', 'custom-input');
    expect(textareaRef.current).toHaveAttribute('data-slot', 'textarea');
    expect(selectRef.current).toBeDisabled();
  });

  it('supports checked and indeterminate checkbox states', () => {
    const ref = createRef<HTMLInputElement>();
    const onChange = vi.fn();
    const { rerender } = render(
      <Checkbox ref={ref} checked={false} indeterminate onChange={onChange} />,
    );
    expect(ref.current?.indeterminate).toBe(true);
    expect(ref.current).toHaveAttribute('data-state', 'indeterminate');

    rerender(<Checkbox ref={ref} checked onChange={onChange} />);
    expect(ref.current?.indeterminate).toBe(false);
    expect(ref.current).toHaveAttribute('data-state', 'checked');
    fireEvent.click(ref.current!);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('allows standalone controls outside Field', () => {
    render(<Input aria-label="Search" aria-describedby="search-help" />);
    const input = screen.getByRole('textbox', { name: 'Search' });
    expect(input).toHaveAttribute('aria-describedby', 'search-help');
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});
