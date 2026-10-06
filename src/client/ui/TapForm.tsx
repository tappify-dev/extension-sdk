import {
  useMemo,
  useState,
  type ReactElement,
  type SubmitEventHandler,
} from 'react';
import { z } from 'zod';
import type { JsonSchema } from '../../manifest/types';
import { TapButton, TapInput, TapSelect } from './primitives';

/** The control a schema property maps to. */
export type TapFormFieldKind =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'boolean'
  | 'enum';

/** One control `TapForm` renders, as `formFields` reads it off a schema. */
export interface TapFormField {
  /** The property name in the schema, and the key in the submitted value. */
  name: string;
  /** The property's `title`, or the name spaced and capitalised. */
  label: string;
  kind: TapFormFieldKind;
  /** Whether the schema lists the property under `required`. */
  required: boolean;
  /** The property's `description`. */
  hint?: string;
  /** Set for an `enum` property: one option per string value. */
  options?: { value: string; label: string }[];
}

function humanise(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function readString(
  source: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function kindOf(property: Record<string, unknown>): TapFormFieldKind {
  if (Array.isArray(property.enum)) return 'enum';

  const type = readString(property, 'type');
  if (type === 'boolean') return 'boolean';
  if (type === 'number' || type === 'integer') return 'number';

  const format = readString(property, 'format');
  if (format === 'textarea') return 'textarea';
  if (format === 'date') return 'date';
  return 'text';
}

/**
 * Reads a JSON Schema object and returns the list of controls `TapForm` renders
 * from it.
 *
 * @remarks
 * One field per declared property, in the order the schema lists them; a schema
 * with no `properties` object returns an empty list, and a property that is not an
 * object is skipped. An `enum` becomes a select and keeps only its string values;
 * otherwise the kind comes from `type` — `boolean`, `number` and `integer` — and
 * then from `format`, where `textarea` and `date` are recognised and anything else
 * falls back to a single-line text control. Nested objects and arrays get a text
 * control, so render those yourself. Call it when you want the fields without the
 * form.
 *
 * @example
 * ```ts
 * import { formFields } from '@tappify/extension-sdk';
 *
 * const fields = formFields({
 *   type: 'object',
 *   properties: { refreshMinutes: { type: 'integer', title: 'Refresh minutes' } },
 *   required: ['refreshMinutes'],
 * });
 * const names = fields.map(field => field.name);
 * ```
 */
export function formFields(schema: JsonSchema): TapFormField[] {
  const properties = schema.properties;
  if (typeof properties !== 'object' || properties === null) return [];

  const required = new Set(
    Array.isArray(schema.required)
      ? schema.required.filter(
          (name): name is string => typeof name === 'string',
        )
      : [],
  );

  return Object.entries(properties).flatMap(([name, raw]) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const property: Record<string, unknown> = { ...raw };
    const kind = kindOf(property);

    const field: TapFormField = {
      name,
      label: readString(property, 'title') ?? humanise(name),
      kind,
      required: required.has(name),
    };

    const hint = readString(property, 'description');
    if (hint !== undefined) field.hint = hint;

    if (kind === 'enum' && Array.isArray(property.enum)) {
      field.options = property.enum
        .filter((option): option is string => typeof option === 'string')
        .map(option => ({ value: option, label: option }));
    }

    return [field];
  });
}

type Values = Record<string, unknown>;

function requiredErrors(
  fields: TapFormField[],
  values: Values,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const value = values[field.name];
    if (field.required && (value === undefined || value === '')) {
      errors[field.name] = `${field.label} is required.`;
    }
  }
  return errors;
}

function compile(schema: JsonSchema): z.ZodType | null {
  try {
    return z.fromJSONSchema(schema);
  } catch {
    return null;
  }
}

function validate(
  fields: TapFormField[],
  compiled: z.ZodType | null,
  values: Values,
): Record<string, string> {
  const errors = requiredErrors(fields, values);
  if (compiled === null) return errors;

  const result = compiled.safeParse(values);
  if (result.success) return errors;

  for (const issue of result.error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && errors[key] === undefined) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

function clean(fields: TapFormField[], values: Values): Values {
  const output: Values = {};
  for (const field of fields) {
    const value = values[field.name];
    if (value === undefined || value === '') continue;
    output[field.name] = value;
  }
  return output;
}

/** The props `TapForm` takes. */
export interface TapFormProps<T> {
  /** The object schema to render, one control per declared property. */
  schema: JsonSchema;
  /** The value the fields start at; later changes to it do not reset the form. */
  value?: Partial<T>;
  /** Defaults to `Submit`. */
  submitLabel?: string;
  /** Defaults to `Cancel`. */
  cancelLabel?: string;
  /** Marks the submit button busy and disables it while a submit is in flight. */
  busy?: boolean;
  /** Called with the cleaned value once validation passes. */
  onSubmit: (value: T) => void | Promise<void>;
  /** Renders a cancel button next to submit, and is called by it. */
  onCancel?: () => void;
}

/**
 * Renders a JSON Schema as a form in the host's styling, validates it on submit
 * and hands back the value.
 *
 * @remarks
 * Point it at the same schema file the manifest references, so the form and the
 * handler change together. Submit drops the fields left blank, then checks what
 * remains against the whole schema, so a `minimum`, `pattern` or `maxLength`
 * lands under the control it belongs to; a required field left empty is reported
 * without reaching the schema. A schema this SDK's Zod version cannot compile
 * still renders and still enforces required fields. `onSubmit` runs only when
 * nothing failed, and the form holds its own values, so a change to `value` after
 * the first render does not reset it. A form with no `value` has nothing to infer
 * `T` from, so annotate the handler's parameter.
 *
 * @example
 * ```tsx
 * import { TapForm, type TapSettingsProps } from '@tappify/extension-sdk';
 *
 * const schema = {
 *   type: 'object',
 *   properties: { refreshMinutes: { type: 'integer', title: 'Refresh minutes' } },
 *   required: ['refreshMinutes'],
 * };
 *
 * function Settings({ values, onChange }: TapSettingsProps) {
 *   return (
 *     <TapForm
 *       schema={schema}
 *       value={values}
 *       submitLabel="Save"
 *       onSubmit={next => onChange(next)}
 *     />
 *   );
 * }
 * ```
 */
export function TapForm<T>({
  schema,
  value,
  submitLabel = 'Submit',
  cancelLabel = 'Cancel',
  busy = false,
  onSubmit,
  onCancel,
}: TapFormProps<T>): ReactElement {
  const fields = useMemo(() => formFields(schema), [schema]);
  const compiled = useMemo(() => compile(schema), [schema]);
  const [values, setValues] = useState<Values>(() => ({ ...value }));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (name: string, next: unknown): void => {
    setValues(current => ({ ...current, [name]: next }));
    setErrors(current => {
      if (current[name] === undefined) return current;
      const { [name]: _cleared, ...rest } = current;
      return rest;
    });
  };

  const submit: SubmitEventHandler<HTMLFormElement> = event => {
    event.preventDefault();
    const candidate = clean(fields, values);
    const found = validate(fields, compiled, candidate);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    void onSubmit(candidate as T);
  };

  return (
    <form className="tap-form" onSubmit={submit} noValidate>
      {fields.map(field => {
        const raw = values[field.name];

        if (field.kind === 'enum') {
          return (
            <TapSelect
              key={field.name}
              label={field.label}
              hint={field.hint}
              error={errors[field.name]}
              required={field.required}
              value={typeof raw === 'string' ? raw : ''}
              options={[
                { value: '', label: 'Choose one' },
                ...(field.options ?? []),
              ]}
              onChange={event => {
                set(field.name, event.target.value);
              }}
            />
          );
        }

        if (field.kind === 'boolean') {
          return (
            <TapInput
              key={field.name}
              type="checkbox"
              label={field.label}
              hint={field.hint}
              error={errors[field.name]}
              className="tap-control--checkbox"
              checked={raw === true}
              onChange={event => {
                set(field.name, event.target.checked);
              }}
            />
          );
        }

        if (field.kind === 'textarea') {
          return (
            <TapInput
              key={field.name}
              multiline
              label={field.label}
              hint={field.hint}
              error={errors[field.name]}
              required={field.required}
              value={typeof raw === 'string' ? raw : ''}
              onChange={event => {
                set(field.name, event.target.value);
              }}
            />
          );
        }

        return (
          <TapInput
            key={field.name}
            type={
              field.kind === 'number'
                ? 'number'
                : field.kind === 'date'
                  ? 'date'
                  : 'text'
            }
            label={field.label}
            hint={field.hint}
            error={errors[field.name]}
            required={field.required}
            value={
              typeof raw === 'string' || typeof raw === 'number'
                ? String(raw)
                : ''
            }
            onChange={event => {
              set(
                field.name,
                field.kind === 'number'
                  ? event.target.value === ''
                    ? ''
                    : Number(event.target.value)
                  : event.target.value,
              );
            }}
          />
        );
      })}

      <div className="tap-form__actions">
        {onCancel !== undefined && (
          <TapButton variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </TapButton>
        )}
        <TapButton type="submit" loading={busy}>
          {submitLabel}
        </TapButton>
      </div>
    </form>
  );
}
