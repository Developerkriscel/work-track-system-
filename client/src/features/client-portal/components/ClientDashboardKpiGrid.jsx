import { useNavigate } from 'react-router-dom';
import { Tickets } from '@/components/common/icons';
export function ClientDashboardKpiGrid({ items = [] }) {
  const navigate = useNavigate();

  return (
    <div className="client-dashboard-kpi-grid">
      {items.map((item) => {
        const Icon = item.Icon || Tickets;
        return (
          <button
            type="button"
            key={item.key || item.label}
            className={`client-dashboard-kpi-card client-dashboard-kpi-card--${item.accent || 'blue'}`}
            style={{ cursor: item.path ? 'pointer' : 'default', border: 'none', textAlign: 'left', width: '100%' }}
            onClick={() => item.path && navigate(item.path)}
          >
            <div className={`client-dashboard-kpi-card__icon client-dashboard-kpi-card__icon--${item.accent || 'blue'}`}>
              <Icon className="dashboard-kpi-card__icon-svg" />
            </div>
            <div className="client-dashboard-kpi-card__body">
              <p className="client-dashboard-kpi-card__label">{item.label}</p>
              <p className="client-dashboard-kpi-card__value">{item.value}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
