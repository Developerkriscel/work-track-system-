import { StatusPill } from '@/components/common/StatusPill';
import { CustomMultiSelect } from '@/components/common/CustomMultiSelect';
import { formatReportDate } from '@/features/reports/services/reportsPresentation';

export function AttendanceReportSection({
  attendance,
  attendanceUsers,
  attendanceFilters,
  onAttendanceFiltersChange,
  onResetFilters,
  customStart,
  onCustomStartChange,
  customEnd,
  onCustomEndChange
}) {
  const employeeOptions = attendanceUsers.map((user) => ({
    value: user.id || user,
    label: user.name || user.id || user
  }));

  return (
    <>
      <article className="migration-panel migration-panel--full" style={{ position: 'relative', zIndex: 10 }}>
        <div className="approval-filter-grid" style={{ alignItems: 'flex-end' }}>
          <label className="dashboard-control">
            <span>Employees</span>
            <CustomMultiSelect
              value={attendanceFilters.employees}
              onChange={(values) => onAttendanceFiltersChange((current) => ({ ...current, employees: values }))}
              options={employeeOptions}
              defaultLabel="All Employees"
            />
          </label>

          <label className="dashboard-control">
            <span>Starting Date</span>
            <input type="date" value={customStart} onChange={(event) => onCustomStartChange(event.target.value)} />
          </label>
          
          <label className="dashboard-control">
            <span>Ending Date</span>
            <input type="date" value={customEnd} onChange={(event) => onCustomEndChange(event.target.value)} />
          </label>

          <div style={{ paddingBottom: '4px' }}>
            <button type="button" className="attendance-cta attendance-cta--gray" onClick={onResetFilters} style={{ height: '38px', padding: '0 24px', margin: 0 }}>
              Reset
            </button>
          </div>
        </div>
      </article>

      <article className="migration-panel migration-panel--full">
        <div className="migration-panel__row">
          <h2>Attendance Report</h2>
          <StatusPill tone="info">{attendance.length} records</StatusPill>
        </div>

        <div className="dashboard-table-wrap" style={{ marginTop: '16px' }}>
          <table className="dashboard-table reports-premium-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Employee</th>
                <th>Punch In</th>
                <th>Punch Out</th>
                <th>Status</th>
                <th>Departure Status</th>
                <th>Duration</th>
                <th>Admin Remarks</th>
              </tr>
            </thead>
            <tbody>
              {attendance.length ? (
                attendance.map((item) => (
                  <tr key={item.id}>
                    <td data-label="Date">{formatReportDate(item.date) || item.dateLabel || item.date}</td>
                    <td data-label="Employee">
                      <div>
                        <div style={{ fontWeight: 600 }}>{item.employeeName || item.employeeId || '-'}</div>
                        {item.role ? <div style={{ fontSize: '11px', color: '#64748b' }}>{item.role}</div> : null}
                      </div>
                    </td>
                    <td data-label="Punch In">
                      {item.punchInTime ? (
                        <div className="attendance-time-pill attendance-time-pill--in">
                          {item.punchInTime}
                        </div>
                      ) : (
                        <span className="approval-table__empty">-</span>
                      )}
                    </td>
                    <td data-label="Punch Out">
                      {item.punchOutTime ? (
                        <div className="attendance-time-pill attendance-time-pill--out">
                          {item.punchOutTime}
                        </div>
                      ) : (
                        <span className="approval-table__empty">-</span>
                      )}
                    </td>
                    <td data-label="Status">
                      <StatusPill tone={item.status === 'On Time' || item.status === 'Present' || item.status === 'Approved' ? 'success' : item.status === 'Half Day' || item.status === 'Late' ? 'warning' : item.status === 'Absent' ? 'danger' : 'neutral'}>
                        {item.status || '-'}
                      </StatusPill>
                    </td>
                    <td data-label="Departure Status">
                      <StatusPill tone={item.outStatus === 'On Time Departure' ? 'success' : item.outStatus === 'Late Departure' ? 'warning' : item.outStatus === 'Early Departure' ? 'danger' : 'neutral'}>
                        {item.outStatus || '-'}
                      </StatusPill>
                    </td>
                    <td data-label="Duration">{item.duration || '-'}</td>
                    <td data-label="Admin Remarks" className="approval-table__copy">{item.adminRemarks || '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="dashboard-table__empty">No attendance report data found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
