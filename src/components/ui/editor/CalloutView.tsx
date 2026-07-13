'use client';

import { NodeViewWrapper, NodeViewContent, type NodeViewProps } from '@tiptap/react';
import { Info, AlertTriangle, Lightbulb, AlertOctagon } from 'lucide-react';

const VARIANTS = {
  info: { icon: Info, label: 'Info', classes: 'border-blue-200 bg-blue-50 text-blue-900' },
  warning: { icon: AlertTriangle, label: 'Warning', classes: 'border-amber-200 bg-amber-50 text-amber-900' },
  tip: { icon: Lightbulb, label: 'Tip', classes: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  danger: { icon: AlertOctagon, label: 'Danger', classes: 'border-red-200 bg-red-50 text-red-900' },
} as const;

export function CalloutView({ node, updateAttributes, selected }: NodeViewProps) {
  const variant = (node.attrs.variant ?? 'info') as keyof typeof VARIANTS;
  const { icon: Icon, label, classes } = VARIANTS[variant];

  return (
    <NodeViewWrapper
      className={`my-3 rounded-md border-l-4 p-4 ${classes} ${selected ? 'ring-2 ring-pulse-300' : ''}`}
      data-callout-variant={variant}
    >
      <div className="mb-2 flex items-center justify-between" contentEditable={false}>
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
          <Icon size={14} /> {label}
        </span>
        <select
          value={variant}
          onChange={(e) => updateAttributes({ variant: e.target.value })}
          className="rounded border-0 bg-white/60 px-1.5 py-0.5 text-[11px] font-medium"
        >
          {Object.entries(VARIANTS).map(([key, v]) => (
            <option key={key} value={key}>{v.label}</option>
          ))}
        </select>
      </div>
      <NodeViewContent className="prose prose-sm max-w-none [&_p]:m-0" />
    </NodeViewWrapper>
  );
}
