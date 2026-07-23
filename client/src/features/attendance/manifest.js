import { featureContracts } from '@/architecture/featureContracts';

export const attendanceManifest = {
  feature: 'attendance',
  contract: featureContracts.attendance,
  plannedModules: [
    'AttendanceHeader',
    'AttendanceRangeControl',
    'PunchCapturePanel',
    'LeaveRequestForm',
    'IntimationForm',
    'AttendanceHistoryTable'
  ]
};
