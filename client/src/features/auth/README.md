## Auth Feature

This feature owns the employee and client authentication entry points.

Routes owned:

- `/login`
- `/client/login`

Current React ownership:

- `LoginPage.jsx`
- `ClientLoginPage.jsx`
- `AuthProvider.jsx`
- `ClientAuthProvider.jsx`
- `RequireAuth.jsx`
- `RequireClientAuth.jsx`
- `RouteAccessGate.jsx`
- `components/LoginShell.jsx`
- `components/EmployeeLoginForm.jsx`
- `components/ClientLoginForm.jsx`
- `components/AuthErrorBanner.jsx`
- `components/SessionStatusScreen.jsx`
- `services/sessionPersistence.js`
- `services/clientSessionPersistence.js`

Folder intent:

- keep employee and client auth route families separate
- keep session persistence inside React ownership
- keep route guards outside legacy Apps Script control

Remaining parity gaps:

- exact employee login visual parity
- exact client login visual parity
- change-password modal parity
