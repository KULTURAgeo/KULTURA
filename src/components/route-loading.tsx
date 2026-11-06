/** Minimal branded route fallback. Decorative visuals never masquerade as products. */
export function RouteLoading() {
  return (
    <div className="kultura-route-loading" role="status" aria-live="polite" aria-label="Loading page" aria-busy="true">
      <div className="kultura-route-loading__inner">
        <p className="kultura-route-loading__wordmark" aria-hidden="true">KULTURA</p>
        <span className="kultura-route-loading__caption" aria-hidden="true">STEP INTO KULTURA</span>
        <span className="kultura-route-loading__track" aria-hidden="true" />
        <span className="sr-only">Loading page…</span>
      </div>
    </div>
  );
}
