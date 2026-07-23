export function ClientPortalHeader({ title, statusLabel, controls = null }) {
  return (
    <div className="page-card__header">
      <div>
        <p className="page-card__eyebrow">Client Portal</p>
        <h1 className="page-card__title">{title}</h1>
      </div>
      {controls || <div className="page-card__status">{statusLabel}</div>}
    </div>
  );
}
