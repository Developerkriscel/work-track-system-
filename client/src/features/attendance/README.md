## Attendance Feature

This feature owns the attendance workspace rendered at `/attendance`.

Legacy Apps Script sources:

- `#attendance-view`
- `#attendance-history-table`
- `#my-requests-view`
- leave request and intimation forms
- camera capture and punch workflow in `appscript/index.html`

Current React ownership:

- `AttendancePage.jsx`
- `useAttendanceData.js`
- `api.js`
- `components/AttendanceHeader.jsx`
- `components/AttendanceActionRow.jsx`
- `components/AttendanceEntryPanel.jsx`
- `components/AttendanceRangeToolbar.jsx`
- `components/AttendanceSummaryStats.jsx`
- `components/AttendanceTables.jsx`
- `services/attendancePresentation.js`

Folder intent:

- keep punch, leave, intimation, attendance history, and request history inside one feature boundary
- keep camera/session/timer state in React
- keep attendance table rendering inside React ownership

Remaining parity gaps:

- exact secure camera workflow parity
- exact request-history parity decisions
- final attendance table micro-layout audit
