export default function Pagination({ totalItems, currentPage, pageSize, onPageChange, itemLabel = 'items' }) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav className="pagination-bar" aria-label={`${itemLabel} pagination`}>
      <span className="pagination-info">Showing {start} to {end} of {totalItems} {itemLabel}</span>
      <div className="pagination-controls">
        <button className="pagination-btn" type="button" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} aria-label="Previous page">
          Prev
        </button>
        {pages.map((page) => (
          <button
            key={page}
            className="pagination-btn"
            type="button"
            aria-current={page === safePage ? 'page' : undefined}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
        <button className="pagination-btn" type="button" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} aria-label="Next page">
          Next
        </button>
      </div>
    </nav>
  );
}