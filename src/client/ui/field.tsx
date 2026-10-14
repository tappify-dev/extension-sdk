import {
  Children,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  type ComponentPropsWithoutRef,
  type InputHTMLAttributes,
} from 'react';
import { cn } from './cn';

interface FieldContextValue {
  controlId: string;
  descriptionId?: string;
  errorId?: string;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export function Field({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  const generatedId = useId();
  const items = Children.toArray(children);
  const control = items.find(
    child =>
      isValidElement(child) &&
      (child.type === Input ||
        child.type === Textarea ||
        child.type === Checkbox ||
        child.type === Select),
  );
  const customId =
    isValidElement<{ id?: string }>(control) &&
    typeof control.props.id === 'string'
      ? control.props.id
      : undefined;
  const hasDescription = items.some(
    child => isValidElement(child) && child.type === FieldDescription,
  );
  const hasError = items.some(
    child => isValidElement(child) && child.type === FieldError,
  );
  const baseId = `tap-ui-field-${generatedId.replace(/:/g, '')}`;
  const value: FieldContextValue = {
    controlId: customId ?? `${baseId}-control`,
    descriptionId: hasDescription ? `${baseId}-description` : undefined,
    errorId: hasError ? `${baseId}-error` : undefined,
  };

  return (
    <FieldContext.Provider value={value}>
      <div
        {...props}
        className={cn('tap-ui-field', className)}
        data-invalid={hasError || undefined}
        data-slot="field"
      >
        {children}
      </div>
    </FieldContext.Provider>
  );
}

export function FieldLabel({
  className,
  ...props
}: ComponentPropsWithoutRef<'label'>) {
  const field = useContext(FieldContext);
  return (
    <label
      {...props}
      className={cn('tap-field__label', className)}
      data-slot="field-label"
      htmlFor={props.htmlFor ?? field?.controlId}
    />
  );
}

export function FieldDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  const field = useContext(FieldContext);
  return (
    <div
      {...props}
      className={cn('tap-field__description', className)}
      data-slot="field-description"
      id={props.id ?? field?.descriptionId}
    />
  );
}

export function FieldError({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  const field = useContext(FieldContext);
  return (
    <div
      {...props}
      className={cn('tap-field__error', className)}
      data-slot="field-error"
      id={props.id ?? field?.errorId}
      role={props.role ?? 'alert'}
    />
  );
}

function joinIds(...ids: Array<string | undefined>): string | undefined {
  const unique = [
    ...new Set(ids.flatMap(id => id?.split(/\s+/) ?? []).filter(Boolean)),
  ];
  return unique.length > 0 ? unique.join(' ') : undefined;
}

function fieldControlProps(
  field: FieldContextValue | null,
  id: string | undefined,
  describedBy: string | undefined,
  invalid: boolean | 'true' | 'false' | 'grammar' | 'spelling' | undefined,
) {
  return {
    'aria-describedby': joinIds(
      describedBy,
      field?.descriptionId,
      field?.errorId,
    ),
    'aria-invalid': field?.errorId ? true : invalid,
    id: id ?? field?.controlId,
  } as const;
}

export const Input = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<'input'>
>(function Input(
  {
    className,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
    ...props
  },
  ref,
) {
  const field = useContext(FieldContext);
  return (
    <input
      {...props}
      {...fieldControlProps(field, id, describedBy, invalid)}
      className={cn('tap-ui-control tap-input', className)}
      data-slot="input"
      ref={ref}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithoutRef<'textarea'>
>(function Textarea(
  {
    className,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
    ...props
  },
  ref,
) {
  const field = useContext(FieldContext);
  return (
    <textarea
      {...props}
      {...fieldControlProps(field, id, describedBy, invalid)}
      className={cn('tap-ui-control tap-textarea', className)}
      data-slot="textarea"
      ref={ref}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  ComponentPropsWithoutRef<'select'>
>(function Select(
  {
    className,
    id,
    'aria-describedby': describedBy,
    'aria-invalid': invalid,
    ...props
  },
  ref,
) {
  const field = useContext(FieldContext);
  return (
    <select
      {...props}
      {...fieldControlProps(field, id, describedBy, invalid)}
      className={cn('tap-ui-control tap-select', className)}
      data-slot="select"
      ref={ref}
    />
  );
});

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  indeterminate?: boolean;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    {
      checked,
      className,
      id,
      indeterminate = false,
      'aria-describedby': describedBy,
      'aria-invalid': invalid,
      ...props
    },
    forwardedRef,
  ) {
    const field = useContext(FieldContext);
    const innerRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
      if (innerRef.current) innerRef.current.indeterminate = indeterminate;
    }, [indeterminate]);

    const setRef = (element: HTMLInputElement | null) => {
      innerRef.current = element;
      if (typeof forwardedRef === 'function') forwardedRef(element);
      else if (forwardedRef) forwardedRef.current = element;
    };

    return (
      <input
        {...props}
        {...fieldControlProps(field, id, describedBy, invalid)}
        checked={checked}
        className={cn('tap-checkbox', className)}
        data-slot="checkbox"
        data-state={
          indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked'
        }
        ref={setRef}
        type="checkbox"
      />
    );
  },
);
