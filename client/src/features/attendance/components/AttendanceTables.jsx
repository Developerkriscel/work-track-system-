import { useEffect, useRef, useState } from 'react';
import { StatusPill } from '@/components/common/StatusPill';
import { formatPunchTime, toneForAttendanceStatus } from '@/features/attendance/services/attendancePresentation';

function dateParts(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return { weekday: '-', day: '-', month: '-' };
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    day: date.getDate(),
    month: date.toLocaleDateString('en-US', { month: 'short' })
  };
}

function AttendanceEvent({ row, action }) {
  const event = action === 'in' ? row.punchIn : row.punchOut;
  const value = event?.[action === 'in' ? 'Punch In' : 'Punch Out'];
  if (!event || !value) return <span className="attendance-empty-time">{action === 'in' && row.isPendingToday ? 'Not Punched Yet' : '-- : --'}</span>;
  const hasLocation = Boolean((event.Latitude || event.Lattitude) && event.Longitude);
  const hasPhoto = Boolean(event.Photo || event['Photo Url'] || event['Photo URL']);
  return (
    <div className="attendance-event">
      <strong>{formatPunchTime(value)}</strong>
      <div className="attendance-event__meta">
        <span className={hasLocation ? 'attendance-meta-chip attendance-meta-chip--location' : 'attendance-meta-chip'} title="Location capture">Location</span>
        <span className={hasPhoto ? 'attendance-meta-chip attendance-meta-chip--photo' : 'attendance-meta-chip'} title="Photo capture">Photo</span>
      </div>
    </div>
  );
}

export function AttendanceHistoryTable({ rows }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Status</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.date}>
                <td>
                  <div className="attendance-date-card">
                    <span>{dateParts(row.date).weekday}</span>
                    <strong>{dateParts(row.date).day}</strong>
                    <small>{dateParts(row.date).month}</small>
                  </div>
                </td>
                <td><AttendanceEvent row={row} action="in" /></td>
                <td><AttendanceEvent row={row} action="out" /></td>
                <td>
                  <StatusPill tone={toneForAttendanceStatus(row.status)}>{row.status}</StatusPill>
                </td>
                <td>{row.duration}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="dashboard-table__empty">
                No attendance records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, '0'));
const TIME_MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'));
const TIME_PERIODS = ['am', 'pm'];

function pickTimeValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const raw = String(value).trim();
    if (raw) return raw;
  }
  return '';
}

function formatTimePreview(value) {
  if (!value) return '-';
  const parsed = parseLegacyTime(value);
  if (parsed.hour && parsed.minute && parsed.period) {
    return `${parsed.hour}:${parsed.minute} ${parsed.period}`;
  }
  return String(value).trim();
}

function parseLegacyTime(value) {
  if (!value || typeof value !== 'string') {
    return { hour: '', minute: '', period: 'am' };
  }
  const raw = value.trim();
  const legacyMatch = raw.toLowerCase().match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)$/);
  if (legacyMatch) {
    return {
      hour: String(Number(legacyMatch[1])).padStart(2, '0'),
      minute: legacyMatch[2],
      period: legacyMatch[3]
    };
  }

  const shortTimeMatch = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (shortTimeMatch) {
    const hour24 = Number(shortTimeMatch[1]);
    const minute = shortTimeMatch[2];
    if (!Number.isNaN(hour24) && hour24 >= 0 && hour24 <= 23) {
      const period = hour24 >= 12 ? 'pm' : 'am';
      const hour12 = hour24 % 12 || 12;
      return {
        hour: String(hour12).padStart(2, '0'),
        minute,
        period
      };
    }
  }

  const parsedDate = /T|GMT|UTC|\d{4}-\d{2}-\d{2}/i.test(raw) ? new Date(raw) : null;
  if (parsedDate && !Number.isNaN(parsedDate.getTime())) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).formatToParts(parsedDate);
    const values = Object.fromEntries(parts.map(({ type, value: partValue }) => [type, partValue]));
    return {
      hour: values.hour || '',
      minute: values.minute || '',
      period: (values.dayPeriod || 'am').toLowerCase()
    };
  }

  return { hour: '', minute: '', period: 'am' };
}

function buildLegacyTime(parts) {
  if (!parts?.hour || !parts?.minute || !parts?.period) {
    return '';
  }
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}

function ChoiceDropdownField({ value, placeholder, options, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div className="attendance-choice" ref={rootRef}>
      <button
        type="button"
        className="attendance-choice__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected?.label || placeholder}</span>
        <span className="attendance-choice__caret">⌄</span>
      </button>
      {open ? (
        <div className="attendance-choice__menu" role="listbox" aria-label={placeholder}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`attendance-choice__option${option.value === value ? ' attendance-choice__option--selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TimeTextField({ label, value, onChange }) {
  const parsed = parseLegacyTime(value);
  const [draft, setDraft] = useState(parsed);

  useEffect(() => {
    setDraft(parsed);
  }, [value]);

  const commit = (nextDraft) => {
    setDraft(nextDraft);
    onChange(buildLegacyTime(nextDraft));
  };

  const normalizeHour = (nextValue) => {
    return String(nextValue || '').replace(/[^\d]/g, '').slice(0, 2);
  };

  const normalizeMinute = (nextValue) => {
    return String(nextValue || '').replace(/[^\d]/g, '').slice(0, 2);
  };

  const updateHour = (nextValue) => {
    setDraft((current) => ({ ...current, hour: normalizeHour(nextValue) }));
  };

  const updateMinute = (nextValue) => {
    setDraft((current) => ({ ...current, minute: normalizeMinute(nextValue) }));
  };

  const commitHour = (nextValue) => {
    const digits = normalizeHour(nextValue);
    if (!digits) {
      commit({ ...draft, hour: '' });
      return;
    }
    const num = Math.min(12, Math.max(1, Number(digits) || 1));
    commit({ ...draft, hour: String(num).padStart(2, '0') });
  };

  const commitMinute = (nextValue) => {
    const digits = normalizeMinute(nextValue);
    if (!digits) {
      commit({ ...draft, minute: '' });
      return;
    }
    const num = Math.min(59, Math.max(0, Number(digits) || 0));
    commit({ ...draft, minute: String(num).padStart(2, '0') });
  };

  return (
    <label className="dashboard-control">
      <span>{label}</span>
      <div className="attendance-time-picker__value">{formatTimePreview(buildLegacyTime(draft) || value)}</div>
      <div className="attendance-time-split-row">
        <input
          type="text"
          value={draft.hour}
          onChange={(event) => updateHour(event.target.value)}
          onBlur={(event) => commitHour(event.target.value)}
          placeholder="HH"
          inputMode="numeric"
          maxLength={2}
          autoComplete="off"
          spellCheck={false}
          aria-label={`${label} hour`}
          className="attendance-time-split-row__part"
        />
        <span className="attendance-time-split-row__colon">:</span>
        <input
          type="text"
          value={draft.minute}
          onChange={(event) => updateMinute(event.target.value)}
          onBlur={(event) => commitMinute(event.target.value)}
          placeholder="MM"
          inputMode="numeric"
          maxLength={2}
          autoComplete="off"
          spellCheck={false}
          aria-label={`${label} minute`}
          className="attendance-time-split-row__part"
        />
        <select
          value={draft.period}
          onChange={(event) => commit({ ...draft, period: event.target.value === 'pm' ? 'pm' : 'am' })}
          aria-label={`${label} am or pm`}
          className="attendance-time-split-row__period"
        >
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </select>
        <button
          type="button"
          className="attendance-cta attendance-cta--gray attendance-time-split-row__clear"
          onClick={() => {
            setDraft({ hour: '', minute: '', period: 'am' });
            onChange('');
          }}
        >
          Clear
        </button>
      </div>
    </label>
  );
}

export function LeaveHistoryTable({ rows = [] }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Duration</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row['Leave ID'] || row.LeaveID || row.Timestamp}>
                <td>
                  <strong>{row['Leave Type']}</strong>
                  <br />
                  <small>{row['Day Type']}</small>
                </td>
                <td>
                  {formatDate(row['Start Date'])}
                  {row['Start Date'] !== row['End Date'] && ` to ${formatDate(row['End Date'])}`}
                </td>
                <td>{row.Reason}</td>
                <td>
                  <StatusPill tone={/approved/i.test(row.Status) ? 'success' : /pending/i.test(row.Status) ? 'warning' : 'danger'}>
                    {row.Status}
                  </StatusPill>
                </td>
                <td>{row['Admin Remarks'] || '-'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="dashboard-table__empty">
                No leave records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function IntimationHistoryTable({ rows = [] }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row['Intimation ID'] || row.IntimationID || row.Timestamp}>
                <td>{formatDate(row['Intimation Date'])}</td>
                <td><strong>{row['Intimation Type']}</strong></td>
                <td>{row.Reason}</td>
                <td>
                  <StatusPill tone={/approved/i.test(row.Status) ? 'success' : /submitted/i.test(row.Status) ? 'warning' : 'danger'}>
                    {row.Status}
                  </StatusPill>
                </td>
                <td>{row['Admin Remarks'] || '-'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="dashboard-table__empty">
                No intimation records found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TeamAttendanceTable({ rows = [], onEdit }) {
  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table attendance-team-table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Date</th>
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <div className="attendance-team-user">
                    <strong>{row.employeeName || row.employeeId}</strong>
                    <span>{[row.employeeId, row.role, row.department].filter(Boolean).join(' | ')}</span>
                  </div>
                </td>
                <td>
                  <div className="attendance-date-card">
                    <span>{dateParts(row.date).weekday}</span>
                    <strong>{dateParts(row.date).day}</strong>
                    <small>{dateParts(row.date).month}</small>
                  </div>
                </td>
                <td><AttendanceEvent row={row} action="in" /></td>
                <td><AttendanceEvent row={row} action="out" /></td>
                <td><StatusPill tone={toneForAttendanceStatus(row.status)}>{row.status}</StatusPill></td>
                <td>{row.duration || '-'}</td>
                <td>
                  <button type="button" className="attendance-cta attendance-cta--blue attendance-team-table__edit" onClick={() => onEdit(row)}>
                    Edit Times
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="dashboard-table__empty">
                No team attendance records found for this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TeamAttendanceEditDialog({
  row,
  form,
  saving,
  onChange,
  onClose,
  onSubmit
}) {
  if (!row) return null;
  const resolvedPunchIn = pickTimeValue(
    form.punchInTime,
    row.punchInTime,
    row.punchIn?.Time,
    row.punchIn?.['Punch In'],
    row['Punch In'],
    row['Punch In Time']
  );
  const resolvedPunchOut = pickTimeValue(
    form.punchOutTime,
    row.punchOutTime,
    row.punchOut?.Time,
    row.punchOut?.['Punch Out'],
    row['Punch Out'],
    row['Punch Out Time']
  );

  return (
    <div className="app-modal-layer" role="presentation">
      <button type="button" className="app-modal-layer__backdrop" aria-label="Close attendance editor" onClick={onClose} />
      <section className="app-modal attendance-team-modal" role="dialog" aria-modal="true" aria-label="Edit team attendance">
        <header className="app-modal__header">
          <div>
            <div className="login-card__eyebrow">Team Attendance</div>
            <div className="app-modal__title">Edit Punch Time</div>
            <p className="attendance-team-modal__meta">
              {row.employeeName || row.employeeId} {row.employeeId ? `| ${row.employeeId}` : ''} {row.date ? `| ${row.date}` : ''}
            </p>
          </div>
          <button type="button" className="app-modal__close" onClick={onClose}>X</button>
        </header>
        <div className="app-modal__body">
          <div className="attendance-team-modal__grid">
            <TimeTextField
              label="Punch In Time"
              value={resolvedPunchIn}
              onChange={(value) => onChange('punchInTime', value)}
            />
            <TimeTextField
              label="Punch Out Time"
              value={resolvedPunchOut}
              onChange={(value) => onChange('punchOutTime', value)}
            />
          </div>
          <div className="client-ticket-details__actions attendance-team-modal__actions">
            <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className="attendance-cta attendance-cta--green" onClick={onSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
