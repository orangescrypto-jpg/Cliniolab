'use client';

import { useCallback, useRef, useState } from 'react';
import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { AlignLeft, AlignCenter, AlignRight, Maximize2 } from 'lucide-react';

const ALIGN_OPTIONS = [
  { value: 'left', icon: AlignLeft, title: 'Align left' },
  { value: 'center', icon: AlignCenter, title: 'Align center' },
  { value: 'right', icon: AlignRight, title: 'Align right' },
  { value: 'full', icon: Maximize2, title: 'Full width' },
] as const;

export function FigureView({ node, updateAttributes, selected }: NodeViewProps) {
  const { src, alt, width, align } = node.attrs;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const startResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizing(true);
      const startX = e.clientX;
      const startWidth = width;
      const parentWidth = wrapperRef.current?.parentElement?.getBoundingClientRect().width ?? 600;

      function onMove(moveEvent: MouseEvent) {
        const deltaPx = moveEvent.clientX - startX;
        const deltaPercent = (deltaPx / parentWidth) * 100;
        const next = Math.min(100, Math.max(15, Math.round(startWidth + deltaPercent)));
        updateAttributes({ width: next });
      }
      function onUp() {
        setResizing(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [width, updateAttributes]
  );

  const justify = align === 'left' ? 'justify-start' : align === 'right' ? 'justify-end' : 'justify-center';
  const effectiveWidth = align === 'full' ? 100 : width;

  return (
    <NodeViewWrapper className="my-3" ref={wrapperRef}>
      <div className={`flex ${align === 'full' ? '' : justify}`}>
        <div
          className={`group relative ${selected ? 'outline outline-2 outline-pulse-300' : ''}`}
          style={{ width: `${effectiveWidth}%` }}
        >
          {/* Alignment toolbar — shown on hover/select */}
          <div
            contentEditable={false}
            className="absolute -top-9 left-1/2 z-10 flex -translate-x-1/2 gap-0.5 rounded-md border border-ink-100 bg-white p-1 opacity-0 shadow-md group-hover:opacity-100"
          >
            {ALIGN_OPTIONS.map(({ value, icon: Icon, title }) => (
              <button
                key={value}
                type="button"
                title={title}
                onClick={() => updateAttributes({ align: value })}
                className={`rounded p-1 hover:bg-ink-100 ${align === value ? 'bg-pulse-100 text-pulse-700' : 'text-ink-500'}`}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>

          <img
            src={src}
            alt={alt || ''}
            className="w-full rounded-md"
            draggable={false}
          />

          {align !== 'full' && (
            <div
              onMouseDown={startResize}
              className={`absolute bottom-1 right-1 h-4 w-4 cursor-se-resize rounded-sm border-2 border-white bg-pulse-500 shadow ${resizing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              title="Drag to resize"
            />
          )}

          <NodeViewContent
            as="figcaption"
            className="mt-1.5 text-center text-xs italic text-ink-400 empty:before:text-ink-300 empty:before:content-['Add_a_caption…']"
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
