import { StatusPill } from '@/components/common/StatusPill';

export function MigrationChecklist({ items = [], priority = 'medium' }) {
  return (
    <article className="migration-panel">
      <div className="migration-panel__row">
        <h2>Module checklist</h2>
        <StatusPill tone={priority === 'high' ? 'warning' : 'info'}>
          {priority === 'high' ? 'High priority' : 'In scope'}
        </StatusPill>
      </div>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item} className="checklist__item">
            <span className="checklist__dot" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
