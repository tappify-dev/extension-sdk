import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TapTable } from '../../../src/frontend/components/TapTable';

interface Row {
  id: string;
  name: string;
  email: string;
}

const columns = [
  { key: 'name', header: 'Name' },
  { key: 'email', header: 'Email' },
];

const data: Row[] = [
  { id: '1', name: 'Alice', email: 'alice@test.com' },
  { id: '2', name: 'Bob', email: 'bob@test.com' },
];

describe('TapTable', () => {
  it('renders headers', () => {
    render(<TapTable columns={columns} data={data} keyExtractor={r => r.id} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders rows', () => {
    render(<TapTable columns={columns} data={data} keyExtractor={r => r.id} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
  });

  it('renders empty state message', () => {
    render(
      <TapTable
        columns={columns}
        data={[]}
        keyExtractor={(r: Row) => r.id}
        emptyMessage="Nothing here"
      />,
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders default empty message', () => {
    render(
      <TapTable columns={columns} data={[]} keyExtractor={(r: Row) => r.id} />,
    );
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('supports custom cell rendering', () => {
    const columnsWithRender = [
      {
        key: 'name',
        header: 'Name',
        render: (row: Row) => <strong data-testid="bold">{row.name}</strong>,
      },
    ];

    render(
      <TapTable
        columns={columnsWithRender}
        data={[{ id: '1', name: 'Alice', email: 'alice@test.com' }]}
        keyExtractor={r => r.id}
      />,
    );
    expect(screen.getByTestId('bold')).toHaveTextContent('Alice');
  });
});
