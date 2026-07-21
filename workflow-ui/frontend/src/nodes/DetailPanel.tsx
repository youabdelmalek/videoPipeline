import { X } from 'lucide-react';
import { ShotsDetail } from './ShotsDetail';
import type { NodeDetail } from './types';

export function DetailPanel({ detail, onClose }: { detail: NodeDetail; onClose: () => void }) {
  return (
    <div className="detail-backdrop" role="presentation" onClick={onClose}>
      <section className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="detail-title" onClick={(event) => event.stopPropagation()}>
        <header className="detail-header">
          <div>
            <div className="node-kicker">{detail.kicker}</div>
            <h2 id="detail-title">{detail.title}</h2>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Close detail view" title="Close detail view">
            <X size={18} />
          </button>
        </header>
        {detail.videos?.length ? (
          <ShotsDetail videos={detail.videos} />
        ) : (
          <pre className="detail-body">{detail.body}</pre>
        )}
      </section>
    </div>
  );
}
