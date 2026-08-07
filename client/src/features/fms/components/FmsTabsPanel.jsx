import { StatusPill } from '@/components/common/StatusPill';
import { fmsTabs, showFmsTeamTabs } from '@/features/fms/services/fmsPresentation';

export function FmsTabsPanel({ role, tab, tabCounts, teamTabsVisible, onTabChange }) {
  const allowTeamTabs = showFmsTeamTabs(role) && teamTabsVisible;

  return (
    <article className="migration-panel migration-panel--full">
      <div className="fms-tabs-row">
        {fmsTabs
          .filter((item) => !item.teamOnly || allowTeamTabs)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              className={`attendance-tab${tab === item.id ? ' attendance-tab--active' : ''}`}
              onClick={() => onTabChange(item.id)}
            >
              {item.label} <span className="fms-tab-count">{tabCounts[item.id] || 0}</span>
            </button>
          ))}
      </div>
    </article>
  );
}
