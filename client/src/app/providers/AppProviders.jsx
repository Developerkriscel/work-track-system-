import { AuthProvider } from '@/features/auth/AuthProvider';
import { ClientAuthProvider } from '@/features/auth/ClientAuthProvider';
import { ThemeProvider } from '@/app/providers/ThemeProvider';

export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ClientAuthProvider>{children}</ClientAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
