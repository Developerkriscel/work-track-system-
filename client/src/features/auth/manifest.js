import { featureContracts } from '@/architecture/featureContracts';

export const authManifest = {
  feature: 'auth',
  contract: featureContracts.auth,
  plannedModules: [
    'LoginShell',
    'EmployeeLoginForm',
    'AuthErrorBanner',
    'SessionStatusScreen',
    'SessionProvider',
    'PasswordChangeDialog'
  ]
};
