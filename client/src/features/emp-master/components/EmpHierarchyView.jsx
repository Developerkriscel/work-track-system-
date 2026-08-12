import React, { useMemo } from 'react';

export function EmpHierarchyView({ data, allData }) {
  const hierarchy = useMemo(() => buildHierarchy(data, allData), [data, allData]);

  if (!hierarchy.peopleCount) {
    return (
      <div className="dashboard-table-wrap">
        <table className="dashboard-table emp-master-table">
          <tbody>
            <tr>
              <td className="dashboard-table__empty">No hierarchy data available.</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="hierarchy-container">
      <div className="hierarchy-summary">
        <span>{hierarchy.peopleShown} people shown</span>
        <span>{hierarchy.managerGroups.length} manager groups</span>
        <span>{hierarchy.reportingLinks} reporting links</span>
      </div>

      <section className="hierarchy-section">
        <div className="hierarchy-section__header">
          <div>
            <h3>Leadership</h3>
            <p>Top-level users from MongoDB users data.</p>
          </div>
          <span>{hierarchy.leaders.length}</span>
        </div>
        <div className="hierarchy-leaders">
          {hierarchy.leaders.map((node) => (
            <PersonCard key={node.id} node={node} />
          ))}
        </div>
      </section>

      <section className="hierarchy-section">
        <div className="hierarchy-section__header">
          <div>
            <h3>Reporting Groups</h3>
            <p>Employees are grouped under every manager listed in their Manager ID.</p>
          </div>
          <span>{hierarchy.managerGroups.length}</span>
        </div>
        <div className="hierarchy-manager-grid">
          {hierarchy.managerGroups.map((group) => (
            <article key={group.manager.id} className="hierarchy-manager-card">
              <div className="hierarchy-manager-card__head">
                <PersonCard node={group.manager} compact />
                <span>{group.members.length} members</span>
              </div>
              <div className="hierarchy-member-list">
                {group.members.map((member) => (
                  <PersonCard key={`${group.manager.id}-${member.id}`} node={member} compact muted={member.visible === false} />
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {hierarchy.unassigned.length ? (
        <section className="hierarchy-section">
          <div className="hierarchy-section__header">
            <div>
              <h3>Unassigned</h3>
              <p>Users with no valid manager in current MongoDB data.</p>
            </div>
            <span>{hierarchy.unassigned.length}</span>
          </div>
          <div className="hierarchy-leaders">
            {hierarchy.unassigned.map((node) => (
              <PersonCard key={node.id} node={node} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function PersonCard({ node, compact = false, muted = false }) {
  return (
    <div className={`hierarchy-card ${compact ? 'hierarchy-card--compact' : ''} ${muted ? 'hierarchy-card--context' : ''}`}>
      <div className="hierarchy-card__name">{node.name}</div>
      <div className="hierarchy-card__role">{node.role}</div>
      <div className="hierarchy-card__id">{node.id}</div>
      {node.department ? <div className="hierarchy-card__department">{node.department}</div> : null}
    </div>
  );
}

function buildHierarchy(data = [], allData = []) {
  const sourceRows = Array.isArray(allData) && allData.length ? allData : data;
  const visibleIds = new Set((data || []).map((row) => safe(identityFor(row)).toLowerCase()).filter(Boolean));
  const hasFilter = visibleIds.size > 0 && visibleIds.size !== sourceRows.length;
  const nodes = sourceRows.map(normalizeNode).filter((node) => node.id && isActive(node));
  const nodeById = new Map(nodes.map((node) => [node.id.toLowerCase(), node]));

  nodes.forEach((node) => {
    node.validManagerIds = node.managerIds.filter((managerId) => nodeById.has(managerId.toLowerCase()) && managerId.toLowerCase() !== node.id.toLowerCase());
    node.visible = !hasFilter || visibleIds.has(node.id.toLowerCase());
  });

  const referencedManagerIds = new Set(nodes.flatMap((node) => node.validManagerIds.map((id) => id.toLowerCase())));
  const managerNodes = nodes
    .filter((node) => canManage(node) || referencedManagerIds.has(node.id.toLowerCase()))
    .filter((manager) => {
      if (!hasFilter) return true;
      return manager.visible || nodes.some((node) => node.visible && node.validManagerIds.some((id) => id.toLowerCase() === manager.id.toLowerCase()));
    })
    .sort(compareNodes);

  const managerGroups = managerNodes
    .map((manager) => {
      const members = nodes
        .filter((node) => node.validManagerIds.some((managerId) => managerId.toLowerCase() === manager.id.toLowerCase()))
        .filter((node) => !hasFilter || node.visible)
        .sort(compareNodes);
      return { manager, members };
    })
    .filter((group) => group.members.length);

  const leaders = nodes
    .filter((node) => canManage(node) && !node.validManagerIds.length)
    .filter((node) => !hasFilter || node.visible || managerGroups.some((group) => group.manager.id === node.id))
    .sort(compareNodes);

  const unassigned = nodes
    .filter((node) => !canManage(node) && !node.validManagerIds.length)
    .filter((node) => !hasFilter || node.visible)
    .sort(compareNodes);

  return {
    peopleCount: nodes.length,
    peopleShown: hasFilter ? new Set([...leaders, ...unassigned, ...managerGroups.flatMap((group) => [group.manager, ...group.members])].map((node) => node.id)).size : nodes.length,
    leaders,
    managerGroups,
    unassigned,
    reportingLinks: nodes.reduce((total, node) => total + node.validManagerIds.length, 0)
  };
}

function normalizeNode(row = {}) {
  const id = identityFor(row);
  return {
    id,
    name: first(row, ['Name', 'Employee Name'], id || 'Unknown'),
    role: first(row, ['Role', 'Designation'], 'User'),
    status: first(row, ['Status', 'status'], 'Active'),
    department: first(row, ['Department', 'department'], ''),
    managerIds: managerIdsFor(row),
    validManagerIds: [],
    visible: true
  };
}

function safe(value = '') {
  return String(value ?? '').trim();
}

function first(row = {}, keys = [], fallback = '') {
  for (const key of keys) {
    const value = row?.[key];
    if (safe(value)) return value;
  }
  return fallback;
}

function identityFor(row = {}) {
  return first(row, ['EMP Code', 'Employee ID', 'User ID', 'employeeId', 'EmpID']);
}

function managerIdsFor(row = {}) {
  return first(row, ['Manager ID', 'Manager', 'Reporting Manager', 'managerId'], '')
    .split(/[,;|]/)
    .map((managerId) => safe(managerId))
    .filter(Boolean);
}

function isActive(node = {}) {
  return safe(node.status || 'Active').toLowerCase() === 'active';
}

function canManage(node = {}) {
  return ['super admin', 'admin', 'hr', 'manager'].includes(safe(node.role).toLowerCase());
}

function roleRank(role = '') {
  const normalized = safe(role).toLowerCase();
  if (normalized === 'super admin') return 0;
  if (normalized === 'admin') return 1;
  if (normalized === 'hr') return 2;
  if (normalized === 'manager') return 3;
  return 4;
}

function compareNodes(left, right) {
  const roleDiff = roleRank(left.role) - roleRank(right.role);
  if (roleDiff) return roleDiff;
  return safe(left.name || left.id).localeCompare(safe(right.name || right.id));
}
