import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import { listRows, upsertRow } from '../services/legacyStore.service.js';

const safe = (value) => String(value ?? '').trim();
const first = (row, keys, fallback = '') => keys.map((key) => row?.[key]).find((value) => safe(value)) ?? fallback;
const eq = (a, b) => safe(a).toLowerCase() === safe(b).toLowerCase();
const normalizeAssignedUsers = (value) =>
  safe(value)
    .split(',')
    .map((item) => safe(item).toUpperCase())
    .filter((item) => item && item !== 'ALL');
const formPortalIdForSheet = (sheetName) => {
  const cleaned = safe(sheetName).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return cleaned ? `FORM_${cleaned}` : `FORM_${Date.now()}`;
};

const forms = [
  {
    Department: 'All',
    'Sheet name': 'Work_Track_System',
    For: 'Worktrack',
    'Form link': 'https://script.google.com/a/macros/kriscel.com/s/AKfycbxCAUBf24QVIIf5DHoF-gIqPMv1qjw9mj7ciIRNcfa1WXGK9iPsLrFf9NS7F3PoEnq6RQ/exec',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'HR',
    'Sheet name': 'HR panel',
    For: 'HR Panel',
    'Form link': 'https://script.google.com/a/macros/kriscel.com/s/AKfycbzrMN6yapU-FPteOC8XKnD3lPcZ90bnmz25NB6K69I/dev?authuser=0',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Sales',
    'Sheet name': 'Work of Scope',
    For: 'Work of Scope',
    'Form link': 'https://script.google.com/macros/s/AKfycbyfrXIAC_v6u-L0ZW0gDMSDQtY509MQe5wolG3E9jkoOuv1BAf5cmQ-eIcJgJQVf_O-GA/exec',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Development',
    'Sheet name': 'Web-Site Development FMS',
    For: 'For client website creation',
    'Form link': 'https://docs.google.com/forms/d/e/1FAIpQLSeFt11f74nLdJjZsbybcULR1UIxN7zdObQmfj2VWSn0wSTTPA/viewform?usp=sharing&ouid=109270804246701755111',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Digital',
    'Sheet name': 'Clients Digital Social Planning FMS',
    For: 'For Client Social media Post planning',
    'Form link': 'https://docs.google.com/forms/d/e/1FAIpQLSd_hx6O2W9WtVy1sIWXi2GOvM6s_nvOsFByTvkGRWXTtMf_Xg/viewform?usp=header',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Digital',
    'Sheet name': 'Kriscel Digital Social Planning FMS',
    For: 'For kriscel Social media Post planning',
    'Form link': 'https://forms.gle/FK28PJ1yCSGaUkCm7',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Digital',
    'Sheet name': 'Ads & Campaign Tracking FMS',
    For: 'For Client and own Ads tracking',
    'Form link': 'https://docs.google.com/forms/d/e/1FAIpQLSfZKNatlfPKaiQ1H3HKk67H6pEBgjgUverPZ9elenBIO3W7rw/viewform?usp=header',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Development',
    'Sheet name': 'Project wise FMS (Kriscel)',
    For: 'Kriscel project regarding',
    'Form link': 'https://docs.google.com/forms/d/e/1FAIpQLScyv8AiGhq7Vzioe7l7VC-MdlGStbUeP1aPdsmcsTBw8T9eJg/viewform?usp=header',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'CRM',
    'Sheet name': 'CRM FMS',
    For: 'for new client follow-up and meeting',
    'Form link': 'https://docs.google.com/forms/d/e/1FAIpQLSc9BOWL_80Uowz4TFXLdB2NvW1jpyrQEiPx6ZEt-XEu-Ulg7g/viewform?usp=header',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Managment',
    'Sheet name': 'Super Dashboard :- Workspace Master',
    For: 'For tracking kriscel candidate and director work report thorugh dashboard',
    'Form link': 'https://script.google.com/a/macros/kriscel.com/s/AKfycbyffedma-WyPOHoYXmDCtTDszeFbQmVejcigLl42Y4jMBt1hqO5Nx_KEmt-NQal0-ks/exec',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Sales',
    'Sheet name': 'Payment Collection &Follow-up app',
    For: 'for tracking and follow-up to client for payment regarding',
    'Form link': 'https://script.google.com/a/macros/kriscel.com/s/AKfycbzgcBhCEsEF_ntW5yUA3L3bfpvhGrL0IQblMOqPdbQxgRPTGDZdoICJP-Z3eRNIqJ6V/exec',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'HR',
    'Sheet name': 'Petty Cash & Expense tracker',
    For: 'for tracking and update office expense',
    'Form link': 'https://script.google.com/macros/s/AKfycbznBbghWyYxydT1xG5XuvAQhVnA7Jkk-geAoAPjtCfOskJ0x1OfHSrgkS-zaV5T5Zf3sQ/exec',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Managment',
    'Sheet name': 'Profile Kriscel Tech Pvt Ltd',
    For: 'Profile Kriscel Tech Pvt Ltd',
    'Form link': 'https://drive.google.com/file/d/1KA61ZGs2qiDT0tGi_rzYhhAR8i4nz0bR/view?usp=sharing',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'CRM',
    'Sheet name': 'Lead Managment System',
    For: '',
    'Form link': 'https://script.google.com/a/macros/kriscel.com/s/AKfycby37_ifWZ1q4AePyRVMoO3-iL_PyphWCWFpMKm_KDwogJDrGmNghZcrCIRhfFk0_ziE0A/exec',
    'Visibility Type': 'SELECTED_USERS'
  },
  {
    Department: 'Managment',
    'Sheet name': 'Client Onboarding FMS',
    For: 'Onboarding new client details to work with us',
    'Form link': 'https://forms.gle/eLsGFBh6pHHUoZ7E9',
    'Visibility Type': 'SELECTED_USERS'
  }
];

async function main() {
  await connectDatabase();
  const existingForms = await listRows('FormsPortal');
  const trackedSheetNames = new Set(forms.map((form) => safe(form['Sheet name']).toLowerCase()));

  for (const row of existingForms) {
    const sheetName = first(row, ['Sheet name', 'Sheet Name', 'sheetName']);
    const formLink = first(row, ['Form link', 'Form Link', 'formLink', 'Link']);
    if (trackedSheetNames.has(safe(sheetName).toLowerCase())) continue;
    if (/example\.com/i.test(formLink)) {
      await upsertRow('FormsPortal', 'Sheet name', sheetName, {
        ...row,
        Status: 'Inactive'
      });
    }
  }

  for (const form of forms) {
    const existing = existingForms.find((row) => eq(first(row, ['Sheet name', 'Sheet Name', 'sheetName']), form['Sheet name']));
    const existingVisibleUsers = normalizeAssignedUsers(first(existing, ['Visible Users', 'VisibleUsers', 'Viewer', 'viewer'], ''));
    const visibilityType = form['Visibility Type'] === 'ALL'
      ? 'ALL'
      : 'SELECTED_USERS';
    const visibleUsers = visibilityType === 'ALL' ? [] : existingVisibleUsers;

    await upsertRow('FormsPortal', 'Sheet name', form['Sheet name'], {
      ...form,
      'Form ID': first(existing, ['Form ID', 'ID'], formPortalIdForSheet(form['Sheet name'])),
      'Visibility Type': visibilityType,
      'Visible Users': visibilityType === 'ALL' ? '' : visibleUsers.join(', '),
      Viewer: visibilityType === 'ALL' ? 'ALL' : visibleUsers.join(', '),
      Status: 'Active'
    });
  }

  console.log(`Synced ${forms.length} forms into Forms Portal.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
