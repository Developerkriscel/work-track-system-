import React, { useState } from 'react';
import { useAssetsData } from './useAssetsData';
import { AssetStatsCards } from './components/AssetStatsCards';
import { AssetInventoryTable } from './components/AssetInventoryTable';
import { MyAssetsSection } from './components/MyAssetsSection';
import { AssetRequestsTable } from './components/AssetRequestsTable';
import {
  CreateAssetModal,
  AssignAssetModal,
  ReturnAssetModal,
  RequestAssetModal,
  ShowAssetModal
} from './components/AssetModals';
import './assets.css';

export function AssetsPage() {
  const {
    loading,
    error,
    actionLoading,
    toast,
    canManage,
    assets,
    rawAssets,
    myAssets,
    requests,
    employees,
    stats,
    filters,
    modals,
    actions
  } = useAssetsData();

  // Initial active tab: Super Admin / Admin / HR default to 'inventory', employees default to 'my-assets'
  const [activeTab, setActiveTab] = useState(canManage ? 'inventory' : 'my-assets');

  // Sync active tab if canManage loads asynchronously
  React.useEffect(() => {
    if (canManage && activeTab === 'my-assets' && rawAssets.length > 0) {
      setActiveTab('inventory');
    }
  }, [canManage]);

  return (
    <div className="assets-page-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`assets-toast ${toast.type}`}>
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="assets-page-header">
        <div className="assets-page-title">
          <h1>Asset Management</h1>
        </div>
        <div className="assets-header-actions">
          {canManage ? (
            <button
              className="btn-primary-action"
              onClick={() => modals.setCreateModalOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add New Asset
            </button>
          ) : (
            <button
              className="btn-primary-action"
              onClick={() => modals.setRequestModalOpen(true)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Request Asset
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Summary */}
      <AssetStatsCards stats={stats} canManage={canManage} />

      {/* Modern Navigation Tabs */}
      <div className="assets-tabs-wrapper">
        <div className="assets-tabs-pill-container">
          {canManage && (
            <button
              className={`assets-pill-tab ${activeTab === 'inventory' ? 'active' : ''}`}
              onClick={() => setActiveTab('inventory')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
              <span>Inventory</span>
              <span className="tab-chip-counter">{stats.total}</span>
            </button>
          )}

          <button
            className={`assets-pill-tab ${activeTab === 'my-assets' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-assets')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            <span>My Assigned Assets</span>
            <span className="tab-chip-counter">
              {myAssets.length}
            </span>
          </button>

          <button
            className={`assets-pill-tab ${activeTab === 'requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('requests')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>Requisitions & Approvals</span>
            {stats.pendingRequests > 0 ? (
              <span className="tab-chip-counter chip-alert">
                {stats.pendingRequests}
              </span>
            ) : (
              <span className="tab-chip-counter">0</span>
            )}
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <div className="assets-table-container loading-placeholder">
          <div className="spinner-orbit"></div>
          <p>Loading asset records...</p>
        </div>
      ) : error ? (
        <div className="assets-table-container error-placeholder">
          <p>{error}</p>
          <button className="btn-secondary-action" onClick={actions.reload}>
            Retry
          </button>
        </div>
      ) : (
        <>
          {activeTab === 'inventory' && canManage && (
            <AssetInventoryTable
              assets={assets}
              filters={filters}
              canManage={canManage}
              onOpenCreate={() => modals.setCreateModalOpen(true)}
              onOpenAssign={(asset) => {
                modals.setSelectedAssetForAssign(asset);
                modals.setAssignModalOpen(true);
              }}
              onOpenReturn={(asset) => {
                modals.setSelectedAssetForReturn(asset);
                modals.setReturnModalOpen(true);
              }}
              onOpenShow={(asset) => {
                modals.setSelectedAssetForShow(asset);
                modals.setShowModalOpen(true);
              }}
            />
          )}

          {activeTab === 'my-assets' && (
            <MyAssetsSection
              assets={myAssets}
              onOpenRequest={() => modals.setRequestModalOpen(true)}
              onOpenShow={(asset) => {
                modals.setSelectedAssetForShow(asset);
                modals.setShowModalOpen(true);
              }}
            />
          )}

          {activeTab === 'requests' && (
            <AssetRequestsTable
              requests={requests}
              canManage={canManage}
              onApproveRequest={actions.handleApproveRequest}
              onOpenRequest={() => modals.setRequestModalOpen(true)}
            />
          )}
        </>
      )}

      {/* Modals */}
      {canManage && modals.createModalOpen && (
        <CreateAssetModal
          isOpen={modals.createModalOpen}
          onClose={() => modals.setCreateModalOpen(false)}
          onSubmit={actions.handleCreateAsset}
          loading={actionLoading}
        />
      )}

      {canManage && modals.assignModalOpen && (
        <AssignAssetModal
          isOpen={modals.assignModalOpen}
          asset={modals.selectedAssetForAssign}
          employees={employees}
          onClose={() => {
            modals.setAssignModalOpen(false);
            modals.setSelectedAssetForAssign(null);
          }}
          onSubmit={actions.handleAssignAsset}
          loading={actionLoading}
        />
      )}

      {canManage && modals.returnModalOpen && (
        <ReturnAssetModal
          isOpen={modals.returnModalOpen}
          asset={modals.selectedAssetForReturn}
          onClose={() => {
            modals.setReturnModalOpen(false);
            modals.setSelectedAssetForReturn(null);
          }}
          onSubmit={actions.handleReturnAsset}
          loading={actionLoading}
        />
      )}

      {modals.requestModalOpen && (
        <RequestAssetModal
          isOpen={modals.requestModalOpen}
          onClose={() => modals.setRequestModalOpen(false)}
          onSubmit={actions.handleRequestAsset}
          loading={actionLoading}
        />
      )}

      {modals.showModalOpen && (
        <ShowAssetModal
          isOpen={modals.showModalOpen}
          asset={modals.selectedAssetForShow}
          onClose={() => {
            modals.setShowModalOpen(false);
            modals.setSelectedAssetForShow(null);
          }}
          onAssign={(asset) => {
            modals.setSelectedAssetForAssign(asset);
            modals.setAssignModalOpen(true);
          }}
          onReturn={(asset) => {
            modals.setSelectedAssetForReturn(asset);
            modals.setReturnModalOpen(true);
          }}
          canManage={canManage}
        />
      )}
    </div>
  );
}
