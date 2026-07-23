import { useNavigate } from 'react-router-dom';

function timeAgo(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

const TYPE_COLORS = {
  Leave:      { bg: '#fef3c7', text: '#b45309', dot: '#f59e0b' },
  FMS:        { bg: '#e0f2fe', text: '#0369a1', dot: '#0ea5e9' },
  Intimation: { bg: '#ede9fe', text: '#6d28d9', dot: '#8b5cf6' },
  Expense:    { bg: '#dcfce7', text: '#15803d', dot: '#22c55e' },
  Approval:   { bg: '#fee2e2', text: '#b91c1c', dot: '#ef4444' },
  Ticket:     { bg: '#e0e7ff', text: '#3730a3', dot: '#6366f1' },
  Attendance: { bg: '#fff7ed', text: '#c2410c', dot: '#f97316' },
  Todo:       { bg: '#f0fdf4', text: '#15803d', dot: '#4ade80' },
};

// Map notification type → app route
const TYPE_ROUTES = {
  Leave:      '/leaves',
  FMS:        '/fms',
  Intimation: '/intimations',
  Expense:    '/expenses',
  Approval:   '/approvals',
  Ticket:     '/tickets',
  Attendance: '/attendance',
  Todo:       '/todo',
};

function getTypeStyle(type = '') {
  return TYPE_COLORS[type] || { bg: '#f1f5f9', text: '#475569', dot: '#94a3b8' };
}

function getRoute(type = '') {
  return TYPE_ROUTES[type] || null;
}

// Arrow icon shown on cards that are clickable
function ArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function NotificationPanel({ title = 'Notifications', items = [], loading = false, error = '', onRefresh }) {
  const navigate = useNavigate();

  return (
    <div className="notification-panel">
      <div className="notification-panel__header">
        <div className="notification-panel__header-left">
          <div className="notification-panel__live">
            <span className="notification-panel__live-dot" />
            Live
          </div>
          <h3 className="notification-panel__title">{title}</h3>
        </div>
        <button className="notification-panel__refresh" onClick={onRefresh} type="button">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /><polyline points="21 3 21 9 15 9" /></svg>
          Refresh
        </button>
      </div>

      <div className="notification-panel__body">
        {loading ? (
          <div className="notification-panel__empty">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            Loading notifications...
          </div>
        ) : null}
        {!loading && error ? <div className="notification-panel__error">{error}</div> : null}
        {!loading && !error && !items.length ? (
          <div className="notification-panel__empty">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
            <span>You're all caught up!</span>
          </div>
        ) : null}

        {!loading && !error
          ? items.map((item, index) => {
              const typeStyle = getTypeStyle(item.type);
              const route = getRoute(item.type);
              const isClickable = Boolean(route);

              return (
                <article
                  key={`${item.id || item.Message || 'notification'}-${index}`}
                  className={`notification-card${isClickable ? ' notification-card--clickable' : ''}`}
                  onClick={isClickable ? () => navigate(route) : undefined}
                  title={isClickable ? `Go to ${item.type}` : undefined}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={isClickable ? (e) => e.key === 'Enter' && navigate(route) : undefined}
                >
                  <div className="notification-card__accent" style={{ background: typeStyle.dot }} />
                  <div className="notification-card__inner">
                    <div className="notification-card__top">
                      <span
                        className="notification-card__type"
                        style={{ background: typeStyle.bg, color: typeStyle.text }}
                      >
                        <span className="notification-card__type-dot" style={{ background: typeStyle.dot }} />
                        {item.type || 'Update'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="notification-card__status">{item.Status || 'Updated'}</span>
                        {isClickable && (
                          <span className="notification-card__go-arrow" style={{ color: typeStyle.dot }}>
                            <ArrowIcon />
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="notification-card__message">{item.Message || 'New activity available.'}</p>
                    <div className="notification-card__footer">
                      {item.Owner ? (
                        <span className="notification-card__owner">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                          {item.Owner}
                        </span>
                      ) : <span />}
                      <span className="notification-card__time">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {timeAgo(item.Timestamp || item['Last Update Date'])}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })
          : null}
      </div>
    </div>
  );
}
