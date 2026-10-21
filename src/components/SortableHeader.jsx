import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export function sortRows(rows, sortColumn, sortDirection, getSortValue = (row, column) => row[column]) {
  if (!sortColumn) return [...rows];
  const direction = sortDirection === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sortColumn);
    const rightValue = getSortValue(right, sortColumn);
    if (leftValue == null && rightValue == null) return 0;
    if (leftValue == null) return 1 * direction;
    if (rightValue == null) return -1 * direction;

    let comparison;
    if (leftValue instanceof Date && rightValue instanceof Date) {
      comparison = leftValue.getTime() - rightValue.getTime();
    } else if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      comparison = leftValue - rightValue;
    } else if (typeof leftValue === 'boolean' && typeof rightValue === 'boolean') {
      comparison = Number(leftValue) - Number(rightValue);
    } else {
      comparison = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
    }
    return comparison * direction;
  });
}

export default function SortableHeader({ label, column, sortColumn, sortDirection, onSort }) {
  const active = sortColumn === column;
  const Icon = active ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  const ariaSort = active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none';

  return (
    <th className={`sortable${active ? ' is-sorted' : ''}`} aria-sort={ariaSort}>
      <button
        className="table-sort-button"
        type="button"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}${active ? `, ${sortDirection}ending` : ''}`}
      >
        <span>{label}</span>
        <Icon className="sort-icon" size={13} aria-hidden="true" />
      </button>
    </th>
  );
}