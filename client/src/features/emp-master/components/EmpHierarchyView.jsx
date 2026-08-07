import React, { useMemo, useState } from 'react';

export function EmpHierarchyView({ data }) {
  const { tree, count } = useMemo(() => {
    if (!data || !data.length) return { tree: [], count: 0 };
    
    const nodeMap = new Map();
    let rootNodes = [];
    let validCount = 0;
    
    // First pass: create node objects
    data.forEach((row) => {
      const id = first(row, ['EMP Code', 'Employee ID', 'User ID']);
      if (!id) return;
      
      const node = {
        id,
        name: first(row, ['Name', 'Employee Name'], 'Unknown'),
        role: first(row, ['Role', 'Designation'], 'User'),
        status: row.Status || 'Active',
        managerId: first(row, ['Manager ID', 'Manager']),
        children: [],
        row
      };
      
      nodeMap.set(id, node);
      validCount++;
    });
    
    // Second pass: build tree
    nodeMap.forEach((node) => {
      const managerId = node.managerId;
      if (managerId && nodeMap.has(managerId) && managerId !== node.id) {
        nodeMap.get(managerId).children.push(node);
      } else {
        rootNodes.push(node);
      }
    });
    // Filter out root nodes that don't have any children (orphans)
    const activeRootNodes = rootNodes.filter(node => node.children.length > 0);
    
    return { tree: activeRootNodes, count: validCount };
  }, [data]);

  if (!tree.length) {
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
      <div className="hierarchy-tree">
        {tree.map((node) => (
          <HierarchyNode key={node.id} node={node} />
        ))}
      </div>
    </div>
  );
}

function HierarchyNode({ node }) {
  const [expanded, setExpanded] = useState(true);
  const isInactive = (node.status || '').toLowerCase() !== 'active';
  const hasChildren = node.children && node.children.length > 0;
  
  return (
    <div className="hierarchy-node">
      <div className={`hierarchy-card ${isInactive ? 'hierarchy-card--inactive' : ''}`}>
        <div className="hierarchy-card__name">{node.name}</div>
        <div className="hierarchy-card__role">{node.role}</div>
        <div className="hierarchy-card__id">{node.id}</div>
        {hasChildren && (
          <button 
            type="button"
            className="hierarchy-card__toggle" 
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? '−' : '+'}
          </button>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="hierarchy-children">
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} />
          ))}
        </div>
      )}
    </div>
  );
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
