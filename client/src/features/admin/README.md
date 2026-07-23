## Admin Feature

This feature owns the admin workspace rendered at `/admin`.

Legacy Apps Script sources:

- `#emp-master-view`
- `#emp-master-table`
- `#users-view`
- `#users-table`
- `#user-management-form`
- emp master editor and upload flows in `appscript/index.html`

Current React ownership:

- `AdminPage.jsx`: route-level page assembly
- `useAdminData.js`: state, filters, editor state, and live mutations
- `api.js`: backend adapters
- `components/AdminHeader.jsx`
- `components/AdminTabsAndFilters.jsx`
- `components/AdminSummaryCards.jsx`
- `components/AdminUsersTable.jsx`
- `components/AdminEmpMasterTable.jsx`
- `components/AdminEditor.jsx`
- `services/adminPresentation.js`

Folder intent:

- keep Users and EMP Master inside one admin-owned feature boundary
- keep shared table rendering inside React ownership
- keep editor state and role/access management inside React ownership

Remaining parity gaps:

- exact user editor parity
- exact EMP master upload/edit parity
- final action-level table audit
