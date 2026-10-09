const bar = (width: string, height: number, marginTop = 0) => ({
  width,
  height,
  marginTop,
  borderRadius: 4,
});

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading administration data">
      <span className="sr-only">Loading administration…</span>
      <div className="section-heading" aria-hidden="true">
        <div className="skeleton" style={bar("min(340px, 75%)", 52)} />
      </div>
      <div className="stat-grid" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="panel" key={index}>
            <div className="skeleton" style={bar("65%", 12)} />
            <div className="skeleton" style={bar("45%", 36, 20)} />
          </div>
        ))}
      </div>
      <section className="panel" style={{ marginTop: 24 }} aria-hidden="true">
        <div className="skeleton" style={bar("30%", 18)} />
        <div className="skeleton" style={bar("100%", 16, 28)} />
        <div className="skeleton" style={bar("92%", 16, 16)} />
        <div className="skeleton" style={bar("75%", 16, 16)} />
      </section>
    </div>
  );
}
