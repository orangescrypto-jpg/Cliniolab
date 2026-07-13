'use client';

import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';

export function EmbedView({ node, selected }: NodeViewProps) {
  const src = node.attrs.src as string | null;

  return (
    <NodeViewWrapper
      className={`my-3 overflow-hidden rounded-md border ${selected ? 'border-pulse-400 ring-1 ring-pulse-300' : 'border-ink-100'}`}
      contentEditable={false}
    >
      {src ? (
        <div className="aspect-video w-full bg-black">
          <iframe
            src={src}
            className="h-full w-full"
            frameBorder="0"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allowFullScreen
            loading="lazy"
            title="Embedded video"
          />
        </div>
      ) : (
        <p className="p-4 text-sm text-ink-400">Invalid embed</p>
      )}
    </NodeViewWrapper>
  );
}
