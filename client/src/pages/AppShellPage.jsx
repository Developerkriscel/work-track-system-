import { BackendStatusCard } from '@/components/common/BackendStatusCard';
import { MigrationChecklist } from '@/components/common/MigrationChecklist';
import { ModuleOverviewGrid } from '@/components/common/ModuleOverviewGrid';
import { StatusPill } from '@/components/common/StatusPill';

function toneForStatus(status) {
  if (status === 'active') return 'success';
  return 'warning';
}

function labelForStatus(status) {
  if (status === 'active') return 'Available';
  return 'Planned';
}

export function AppShellPage({ title, eyebrow, description, deliverables = [], status = 'queued', priority = 'medium' }) {
  const isDashboardLanding = title === 'Dashboard';

  return (
    <section className="page-card">
      <div className="page-card__header">
        <div>
          <p className="page-card__eyebrow">{eyebrow}</p>
          <h1 className="page-card__title">{title}</h1>
        </div>
        <StatusPill tone={toneForStatus(status)}>{labelForStatus(status)}</StatusPill>
      </div>

      <div className="migration-grid">
        <article className="migration-panel">
          <div className="migration-panel__row">
            <h2>What this workspace provides</h2>
            <StatusPill tone="info">MERN-owned workspace</StatusPill>
          </div>
          <ul>
            <li>React routing and layout for this workspace</li>
            <li>Shared WorkTrack theme tokens and reusable UI components</li>
            <li>Feature folders for module-specific screens and data hooks</li>
            <li>Frontend code maintained fully inside `client/src`</li>
          </ul>
        </article>

        <BackendStatusCard />
      </div>

      <div className="migration-grid">
        <MigrationChecklist items={deliverables} priority={priority} />

        <article className="migration-panel">
          <h2>Workspace focus</h2>
          <p>{description}</p>
        </article>
      </div>

      <article className="migration-panel migration-panel--full">
        <h2>Frontend notes</h2>
        <p>
          This workspace runs from the React frontend under `client/src` and connects to the MERN backend.
          It is structured so each module can keep evolving without depending on `appscript` HTML files for rendering.
        </p>
      </article>

      {isDashboardLanding ? <ModuleOverviewGrid /> : null}
    </section>
  );
}
