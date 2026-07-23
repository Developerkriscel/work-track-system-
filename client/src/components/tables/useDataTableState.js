import { useMemo, useState } from 'react';

function compareValues(left, right, direction) {
  const leftValue = left ?? '';
  const rightValue = right ?? '';

  if (typeof leftValue === 'number' || typeof rightValue === 'number') {
    const delta = Number(leftValue || 0) - Number(rightValue || 0);
    return direction === 'asc' ? delta : -delta;
  }

  const result = String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true, sensitivity: 'base' });
  return direction === 'asc' ? result : -result;
}

export function useDataTableState(rows, columns, options = {}) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(options.initialPageSize || 10);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(options.initialSortKey || columns.find((column) => column.defaultSort)?.key || columns[0]?.key || null);
  const [sortDirection, setSortDirection] = useState(options.initialSortDirection || 'desc');

  const searchedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) =>
      columns.some((column) => {
        const value = column.searchValue ? column.searchValue(row) : column.sortValue ? column.sortValue(row) : '';
        return String(value || '').toLowerCase().includes(query);
      })
    );
  }, [columns, rows, search]);

  const sortedRows = useMemo(() => {
    if (!sortKey) return searchedRows;
    const column = columns.find((item) => item.key === sortKey);
    if (!column) return searchedRows;
    const getValue = column.sortValue || column.searchValue || ((row) => row?.[sortKey]);
    return [...searchedRows].sort((left, right) => compareValues(getValue(left), getValue(right), sortDirection));
  }, [columns, searchedRows, sortDirection, sortKey]);

  const totalRows = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = totalRows === 0 ? 0 : (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalRows);

  const visibleRows = useMemo(() => sortedRows.slice(startIndex, endIndex), [endIndex, sortedRows, startIndex]);

  const setPageSizeAndReset = (value) => {
    setPageSize(Number(value));
    setPage(1);
  };

  const setSearchAndReset = (value) => {
    setSearch(value);
    setPage(1);
  };

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDirection('asc');
  };

  const pageInfo = {
    start: totalRows === 0 ? 0 : startIndex + 1,
    end: endIndex,
    total: totalRows,
    page: safePage,
    totalPages
  };

  return {
    page: safePage,
    pageInfo,
    pageSize,
    search,
    setPage,
    setPageSize: setPageSizeAndReset,
    setSearch: setSearchAndReset,
    sortDirection,
    sortKey,
    toggleSort,
    visibleRows
  };
}
