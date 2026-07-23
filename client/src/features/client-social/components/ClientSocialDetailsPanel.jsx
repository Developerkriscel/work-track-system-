import { StatusPill } from '@/components/common/StatusPill';
import {
  clientSocialStatusTone,
  formatClientSocialDate
} from '@/features/client-social/services/clientSocialPresentation';

export function ClientSocialDetailsPanel({ details, submitting, onClose, onAddRemark }) {
  if (!details.post && !details.loading) return null;

  const post = details.post || {};

  return (
    <article className="migration-panel migration-panel--full">
      <div className="migration-panel__row">
        <h2>Social Task Details</h2>
        <button type="button" className="attendance-cta attendance-cta--gray" onClick={onClose}>
          Close
        </button>
      </div>

      {details.loading ? (
        <p>Loading social task details...</p>
      ) : (
        <>
          <div className="migration-grid">
            <article className="migration-panel">
              <h2>{post.Description || post.Caption || 'Social Task'}</h2>
              <p><strong>Post ID:</strong> {post['Post ID'] || post.ID || '-'}</p>
              <p><strong>Platform:</strong> {post.Platform || '-'}</p>
              <p><strong>Content Type:</strong> {post['Content Type'] || '-'}</p>
              <p><strong>Planned Date:</strong> {formatClientSocialDate(post['Planned Post Date'] || post.Date)}</p>
              <p><strong>Status:</strong> <StatusPill tone={clientSocialStatusTone(post.Status)}>{post.Status || '-'}</StatusPill></p>
              <p><strong>Caption:</strong> {post.Caption || '-'}</p>
              {post.CreativeLink ? (
                <a className="forms-open-link attendance-cta attendance-cta--purple" href={post.CreativeLink} target="_blank" rel="noreferrer">
                  Open Creative
                </a>
              ) : null}
            </article>

            <article className="migration-panel">
              <h2>History</h2>
              {details.history.length ? (
                <div className="todo-bulk-stack">
                  {details.history.map((item) => (
                    <div key={item['History ID'] || item.historyId} className="migration-panel">
                      <p><strong>Status Change:</strong> {item['Status Change'] || '-'}</p>
                      <p><strong>Updated By:</strong> {item['Updated By'] || '-'}</p>
                      <p><strong>Remarks:</strong> {item.Remarks || '-'}</p>
                      <p><strong>Client Remark:</strong> {item['Client Remark'] || '-'}</p>
                      <button
                        type="button"
                        className="attendance-cta attendance-cta--blue"
                        disabled={submitting}
                        onClick={() => onAddRemark(item)}
                      >
                        Add Remark
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No history entries found.</p>
              )}
            </article>
          </div>
        </>
      )}
    </article>
  );
}
