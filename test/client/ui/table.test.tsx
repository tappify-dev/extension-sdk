import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../src/ui';

describe('Table', () => {
  it('renders semantic compound slots and row variants', () => {
    render(
      <Table className="custom-table" aria-label="Releases">
        <TableHeader>
          <TableRow variant="header">
            <TableHead>Version</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow variant="body">
            <TableCell>2.4.0</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const table = screen.getByRole('table', { name: 'Releases' });
    expect(table).toHaveClass('tap-ui-table', 'custom-table');
    expect(table.parentElement).toHaveAttribute('data-slot', 'table-container');
    expect(screen.getAllByRole('rowgroup')[0]).toHaveAttribute(
      'data-slot',
      'table-header',
    );
    expect(screen.getAllByRole('row')[0]).toHaveAttribute(
      'data-variant',
      'header',
    );
    expect(screen.getAllByRole('row')[1]).toHaveAttribute(
      'data-variant',
      'body',
    );
    expect(screen.getByRole('columnheader')).toHaveAttribute(
      'data-slot',
      'table-head',
    );
    expect(screen.getByRole('cell')).toHaveAttribute('data-slot', 'table-cell');
  });

  it('forwards native events and custom classes', () => {
    const onClick = vi.fn();
    render(
      <Table>
        <TableBody>
          <TableRow onClick={onClick} className="clickable">
            <TableCell>Open</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    fireEvent.click(screen.getByRole('row'));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('row')).toHaveClass('tap-table__row', 'clickable');
  });
});
