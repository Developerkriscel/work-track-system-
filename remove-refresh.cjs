const fs = require('fs');
const files = [
  "client/src/features/todo/components/TodoHeader.jsx",
  "client/src/features/reports/components/ReportsHeader.jsx",
  "client/src/features/my-approval-status/components/MyApprovalStatusHeader.jsx",
  "client/src/features/management-dashboard/components/ManagementDashboardHeader.jsx",
  "client/src/features/forms-portal/components/FormsPortalHeader.jsx",
  "client/src/features/emp-master/EmpMasterPage.jsx",
  "client/src/features/expenses/components/ExpensesHeader.jsx",
  "client/src/features/clients-portal/components/ClientsPortalHeader.jsx",
  "client/src/features/client-social/components/ClientSocialHeader.jsx",
  "client/src/features/admin/components/AdminHeader.jsx",
  "client/src/features/approvals/components/ApprovalsHeader.jsx"
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Remove standard onRefresh button
    content = content.replace(/(\s*)<button[^>]*onClick=\{onRefresh\}[^>]*>[\s\S]*?<\/button>/, '');
    // Remove load(category) button for EmpMasterPage
    content = content.replace(/(\s*)<button[^>]*onClick=\{\(\) => load\(category\)\}[^>]*>[\s\S]*?<\/button>/, '');
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
