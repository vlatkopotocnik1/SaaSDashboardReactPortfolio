import type { ReactNode } from 'react';

type TableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

type TableProps<T> = {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
};

export function Table<T>({ columns, data, emptyMessage = 'No data available.' }: TableProps<T>) {
  if (data.length === 0) {
    return <div className="ui-emptystate">{emptyMessage}</div>;
  }

  return (
    <table className="ui-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
