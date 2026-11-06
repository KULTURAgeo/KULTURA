export default function Loading() {
  return (
    <div
      className="container page-section"
      role="status"
      aria-label="Loading collection"
    >
      <div className="skeleton skeleton-title" />
      <div className="product-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton-product" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
