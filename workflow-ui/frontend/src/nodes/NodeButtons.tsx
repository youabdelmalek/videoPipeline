import { Download, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import type { CollapsibleNodeData, NodeDetail } from './types';

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'output';

export function DownloadMarkdownButton({ filename, markdown }: { filename: string; markdown: string }) {
  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slugify(filename)}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button
      className="open-button nodrag nopan"
      type="button"
      onClick={download}
      title="Download output as Markdown"
      aria-label="Download output as Markdown"
    >
      <Download size={14} />
    </button>
  );
}

export function CollapseToggle({ data, label }: { data: CollapsibleNodeData; label: string }) {
  return (
    <button
      className="collapse-button nodrag nopan"
      type="button"
      onClick={() => data.onToggleCollapse(data.nodeId)}
      title={data.collapsed ? `Maximize ${label}` : `Minimize ${label}`}
      aria-label={data.collapsed ? `Maximize ${label}` : `Minimize ${label}`}
    >
      {data.collapsed ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
    </button>
  );
}

export function OpenDetailButton({ data, label, detail }: { data: CollapsibleNodeData; label: string; detail: NodeDetail }) {
  return (
    <button className="open-button nodrag nopan" type="button" onClick={() => data.onOpenDetail(detail)} title={`Open ${label}`} aria-label={`Open ${label}`}>
      <ExternalLink size={14} />
    </button>
  );
}
