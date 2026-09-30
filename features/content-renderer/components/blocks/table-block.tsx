import type { TableContentBlock as TableContentBlockType } from '../../types';

export function TableBlock({ block }: { block: TableContentBlockType }) {
  return (
    <div className="content-table-scroll">
      <table className="content-table">
        {block.caption ? <caption>{block.caption}</caption> : null}
        <thead>
          <tr>
            {block.headers.map((header, index) => (
              <th key={index} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {block.headers.map((_, columnIndex) => (
                <td key={columnIndex}>{row[columnIndex] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
