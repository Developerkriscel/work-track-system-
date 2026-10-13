import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  fetchAssetsOverview,
  createAssetRecord,
  updateAssetRecord,
  assignAssetRecord,
  returnAssetRecord,
  submitAssetRequestRecord,
  approveAssetRequestRecord
} from './api';

export function useAssetsData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const [assets, setAssets] = useState([]);
  const [myAssets, setMyAssets] = useState([]);
  const [requests, setRequests] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    assigned: 0,
    available: 0,
    inRepair: 0,
    pendingRequests: 0
  });
  const [canManage, setCanManage] = useState(false);

  // Filter states
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedAssetForAssign, setSelectedAssetForAssign] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [selectedAssetForReturn, setSelectedAssetForReturn] = useState(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [showModalOpen, setShowModalOpen] = useState(false);
  const [selectedAssetForShow, setSelectedAssetForShow] = useState(null);

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAssetsOverview();
      if (res && res.success !== false) {
        const rawList = res.assets || [];
        setAssets(rawList);
        const currentUid = String(res.currentUserId || '').toLowerCase();
        const computedMyAssets = (Array.isArray(res.myAssets) && res.myAssets.length > 0)
          ? res.myAssets
          : (!res.canManage
              ? rawList
              : rawList.filter((a) => {
                  const toId = String(a['Assigned To ID'] || a.assignedToId || a['Employee ID'] || '').trim().toLowerCase();
                  return Boolean(currentUid && toId && toId === currentUid);
                }));
        setMyAssets(computedMyAssets);
        setRequests(res.requests || []);
        setEmployees(res.employees || []);
        setStats(res.stats || { total: 0, assigned: 0, available: 0, inRepair: 0, pendingRequests: 0 });
        setCanManage(Boolean(res.canManage));
      } else {
        setError(res?.message || 'Failed to load asset data.');
      }
    } catch (err) {
      setError(err?.message || 'Network error while loading assets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Assets list
  const filteredAssets = useMemo(() => {
    return assets.filter((item) => {
      const name = String(item['Asset Name'] || item.name || '').toLowerCase();
      const serial = String(item['Serial Number'] || item.serialNumber || '').toLowerCase();
      const id = String(item.AssetID || item['Asset ID'] || '').toLowerCase();
      const assignedTo = String(item['Assigned To Name'] || '').toLowerCase();
      const cat = String(item.Category || item.category || '');
      const st = String(item.Status || item.status || '');

      const query = search.trim().toLowerCase();
      const matchesSearch = !query || name.includes(query) || serial.includes(query) || id.includes(query) || assignedTo.includes(query);
      const matchesCategory = categoryFilter === 'All' || cat.toLowerCase() === categoryFilter.toLowerCase();
      const matchesStatus = statusFilter === 'All' || st.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [assets, search, categoryFilter, statusFilter]);

  // Action handlers
  const handleCreateAsset = async (payload) => {
    setActionLoading(true);
    try {
      const res = await createAssetRecord(payload);
      if (res?.success) {
        showToast(res.message || 'Asset added to inventory.');
        setCreateModalOpen(false);
        await loadData();
        return true;
      }
      showToast(res?.message || 'Failed to add asset.', 'error');
      return false;
    } catch (err) {
      showToast(err.message || 'Error creating asset.', 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignAsset = async (payload) => {
    setActionLoading(true);
    try {
      const res = await assignAssetRecord(payload);
      if (res?.success) {
        showToast(res.message || 'Asset successfully assigned.');
        setAssignModalOpen(false);
        setSelectedAssetForAssign(null);
        await loadData();
        return true;
      }
      showToast(res?.message || 'Failed to assign asset.', 'error');
      return false;
    } catch (err) {
      showToast(err.message || 'Error assigning asset.', 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleReturnAsset = async (payload) => {
    setActionLoading(true);
    try {
      const res = await returnAssetRecord(payload);
      if (res?.success) {
        showToast(res.message || 'Asset returned to inventory.');
        setReturnModalOpen(false);
        setSelectedAssetForReturn(null);
        await loadData();
        return true;
      }
      showToast(res?.message || 'Failed to return asset.', 'error');
      return false;
    } catch (err) {
      showToast(err.message || 'Error returning asset.', 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestAsset = async (payload) => {
    setActionLoading(true);
    try {
      const res = await submitAssetRequestRecord(payload);
      if (res?.success) {
        showToast(res.message || 'Asset request submitted.');
        setRequestModalOpen(false);
        await loadData();
        return true;
      }
      showToast(res?.message || 'Failed to submit request.', 'error');
      return false;
    } catch (err) {
      showToast(err.message || 'Error submitting request.', 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveRequest = async (requestId, action, remarks) => {
    setActionLoading(true);
    try {
      const res = await approveAssetRequestRecord({ requestId, action, remarks });
      if (res?.success) {
        showToast(res.message || `Request ${action.toLowerCase()} successfully.`);
        await loadData();
        return true;
      }
      showToast(res?.message || 'Failed to process request.', 'error');
      return false;
    } catch (err) {
      showToast(err.message || 'Error processing approval.', 'error');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  return {
    loading,
    error,
    actionLoading,
    toast,
    canManage,
    assets: filteredAssets,
    rawAssets: assets,
    myAssets,
    requests,
    employees,
    stats,
    filters: {
      search,
      setSearch,
      categoryFilter,
      setCategoryFilter,
      statusFilter,
      setStatusFilter
    },
    modals: {
      createModalOpen,
      setCreateModalOpen,
      assignModalOpen,
      setAssignModalOpen,
      selectedAssetForAssign,
      setSelectedAssetForAssign,
      returnModalOpen,
      setReturnModalOpen,
      selectedAssetForReturn,
      setSelectedAssetForReturn,
      requestModalOpen,
      setRequestModalOpen,
      showModalOpen,
      setShowModalOpen,
      selectedAssetForShow,
      setSelectedAssetForShow
    },
    actions: {
      createAsset: handleCreateAsset,
      handleCreateAsset,
      assignAsset: handleAssignAsset,
      handleAssignAsset,
      returnAsset: handleReturnAsset,
      handleReturnAsset,
      requestAsset: handleRequestAsset,
      handleRequestAsset,
      approveRequest: handleApproveRequest,
      handleApproveRequest,
      reload: loadData
    }
  };
}
