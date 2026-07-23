import { Link } from 'react-router-dom';
import { appRoutes } from '@/app/router/routes';
import { StatusPill } from '@/components/common/StatusPill';

function toneForStatus(status) {
  if (status === 'active') return 'success';
  return 'warning';
}

function labelForStatus(status) {
  if (status === 'active') return 'Available';
  return 'Planned';
}

export function ModuleOverviewGrid() {
  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Workspace modules</h2>
        <StatusPill tone="info">{appRoutes.length} modules</StatusPill>
      </div>

      <div className="module-grid">
        {appRoutes.map((route) => {
          const Icon = route.icon;
          const { status, deliverables = [] } = route.page;

          return (
            <section key={route.key} className="module-card">
              <div className="module-card__header">
                <div className="module-card__title-wrap">
                  <span className="module-card__icon">
                    <Icon className="module-card__icon-svg" />
                  </span>
                  <div>
                    <h3>{route.title}</h3>
                    <p>{deliverables.length} key areas</p>
                  </div>
                </div>
                <StatusPill tone={toneForStatus(status)}>{labelForStatus(status)}</StatusPill>
              </div>

              <div className="module-card__actions">
                <Link className="inline-action" to={route.path}>
                  Open workspace
                </Link>
                <StatusPill tone="info">React + API</StatusPill>
              </div>
            </section>
          );
        })}
      </div>
    </article>
  );
}
