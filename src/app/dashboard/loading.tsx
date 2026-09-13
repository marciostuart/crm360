function Skeleton({ className }: { className: string }) {
  return <span className={`dashboard-skeleton ${className}`} aria-hidden="true" />;
}

export default function DashboardLoading() {
  return (
    <div className="dashboard-loading" aria-label="Carregando dashboard" role="status">
      <header className="page-header loading-header">
        <div><Skeleton className="skeleton-title" /><Skeleton className="skeleton-subtitle" /></div>
        <Skeleton className="skeleton-filters" />
      </header>
      <section className="dashboard-hero-cards">
        {[1, 2, 3, 4].map((item) => <Skeleton className="skeleton-hero" key={item} />)}
      </section>
      <section className="bento-grid">
        <Skeleton className="skeleton-panel" />
        <Skeleton className="skeleton-panel" />
      </section>
      <section className="bento-grid">
        <Skeleton className="skeleton-panel" />
        <Skeleton className="skeleton-panel" />
      </section>
    </div>
  );
}
