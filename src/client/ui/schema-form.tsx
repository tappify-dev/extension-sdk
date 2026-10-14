import {
  useMemo,
  useState,
  type ReactElement,
  type SubmitEventHandler,
} from 'react';
import { z } from 'zod';
import type { JsonSchema } from '../../manifest/types';
import { Button } from './button';
import {
  Checkbox,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Input,
  Select,
  Textarea,
} from './field';
import { Inline } from './layout';

export type SchemaFieldKind =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'boolean'
  | 'enum';

export interface SchemaField {
  name: string;
  label: string;
  kind: SchemaFieldKind;
  required: boolean;
  description?: string;
  options?: { value: string; label: string }[];
}

function text(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  return typeof source[key] === 'string' ? source[key] : undefined;
}

function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function fieldKind(property: Record<string, unknown>): SchemaFieldKind {
  if (Array.isArray(property.enum)) return 'enum';
  if (property.type === 'boolean') return 'boolean';
  if (property.type === 'number' || property.type === 'integer')
    return 'number';
  if (property.format === 'textarea') return 'textarea';
  if (property.format === 'date') return 'date';
  return 'text';
}

export function schemaFields(schema: JsonSchema): SchemaField[] {
  if (typeof schema.properties !== 'object' || schema.properties === null)
    return [];
  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter(
          (name): name is string => typeof name === 'string',
        )
      : [],
  );

  return Object.entries(schema.properties).flatMap(([name, raw]) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const property: Record<string, unknown> = { ...raw };
    const kind = fieldKind(property);
    const field: SchemaField = {
      name,
      label: text(property, 'title') ?? humanize(name),
      kind,
      required: required.has(name),
    };
    const description = text(property, 'description');
    if (description) field.description = description;
    if (kind === 'enum' && Array.isArray(property.enum)) {
      field.options = property.enum
        .filter((option): option is string => typeof option === 'string')
        .map(option => ({ value: option, label: option }));
    }
    return [field];
  });
}

type Values = Record<string, unknown>;

function compile(schema: JsonSchema): z.ZodType | null {
  try {
    return z.fromJSONSchema(schema);
  } catch {
    return null;
  }
}

function clean(fields: SchemaField[], values: Values): Values {
  return Object.fromEntries(
    fields.flatMap(field => {
      const value = values[field.name];
      return value === undefined || value === '' ? [] : [[field.name, value]];
    }),
  );
}

function validate(
  fields: SchemaField[],
  compiled: z.ZodType | null,
  values: Values,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (
      field.required &&
      (values[field.name] === undefined || values[field.name] === '')
    ) {
      errors[field.name] = `${field.label} is required.`;
    }
  }
  if (!compiled) return errors;
  const result = compiled.safeParse(values);
  if (result.success) return errors;
  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && errors[key] === undefined)
      errors[key] = issue.message;
  }
  return errors;
}

export interface SchemaFormProps<T> {
  schema: JsonSchema;
  value?: Partial<T>;
  submitLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onSubmit: (value: T) => void | Promise<void>;
  onCancel?: () => void;
}

export function SchemaForm<T>({
  schema,
  value,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  busy = false,
  onSubmit,
  onCancel,
}: SchemaFormProps<T>): ReactElement {
  const fields = useMemo(() => schemaFields(schema), [schema]);
  const compiled = useMemo(() => compile(schema), [schema]);
  const [values, setValues] = useState<Values>(() => ({ ...value }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: string, next: unknown) => {
    setValues(current => ({ ...current, [name]: next }));
    setErrors(current => {
      if (current[name] === undefined) return current;
      const { [name]: _removed, ...rest } = current;
      return rest;
    });
  };

  const submit: SubmitEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    const candidate = clean(fields, values);
    const found = validate(fields, compiled, candidate);
    setErrors(found);
    if (Object.keys(found).length === 0) void onSubmit(candidate as T);
  };

  return (
    <form
      className="tap-schema-form"
      data-slot="schema-form"
      noValidate
      onSubmit={submit}
    >
      {fields.map(field => {
        const raw = values[field.name];
        const description = field.description ? (
          <FieldDescription>{field.description}</FieldDescription>
        ) : null;
        const error = errors[field.name] ? (
          <FieldError>{errors[field.name]}</FieldError>
        ) : null;

        if (field.kind === 'boolean') {
          return (
            <Field className="tap-field--checkbox" key={field.name}>
              <FieldLabel className="tap-checkbox-row">
                <Checkbox
                  checked={raw === true}
                  onChange={event => set(field.name, event.target.checked)}
                />
                <span>{field.label}</span>
              </FieldLabel>
              {description}
              {error}
            </Field>
          );
        }

        return (
          <Field key={field.name}>
            <FieldLabel>{field.label}</FieldLabel>
            {field.kind === 'enum' ? (
              <Select
                required={field.required}
                value={typeof raw === 'string' ? raw : ''}
                onChange={event => set(field.name, event.target.value)}
              >
                <option value="">Choose one</option>
                {field.options?.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ) : field.kind === 'textarea' ? (
              <Textarea
                required={field.required}
                value={typeof raw === 'string' ? raw : ''}
                onChange={event => set(field.name, event.target.value)}
              />
            ) : (
              <Input
                required={field.required}
                type={
                  field.kind === 'number'
                    ? 'number'
                    : field.kind === 'date'
                      ? 'date'
                      : 'text'
                }
                value={
                  typeof raw === 'string' || typeof raw === 'number'
                    ? String(raw)
                    : ''
                }
                onChange={event =>
                  set(
                    field.name,
                    field.kind === 'number'
                      ? event.target.value === ''
                        ? ''
                        : Number(event.target.value)
                      : event.target.value,
                  )
                }
              />
            )}
            {description}
            {error}
          </Field>
        );
      })}

      <Inline
        className="tap-schema-form__actions"
        data-slot="form-actions"
        justify="end"
      >
        {onCancel ? (
          <Button variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
        ) : null}
        <Button loading={busy} type="submit">
          {submitLabel}
        </Button>
      </Inline>
    </form>
  );
}
