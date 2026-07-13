import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CalloutView } from './CalloutView';

export type CalloutVariant = 'info' | 'warning' | 'tip' | 'danger';

export interface CalloutOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      insertCallout: (variant?: CalloutVariant) => ReturnType;
    };
  }
}

/**
 * Callout/info box — content is normal Tiptap block content (paragraphs,
 * lists, etc.) wrapped in a <div class="callout callout-{variant}">, so
 * unlike HtmlBlock this is NOT atomic: the text inside is real, editable,
 * schema-checked Tiptap content and authors can format it normally.
 * Renders through the standard block pipeline, so it needs no special
 * handling in sanitizeHtml() beyond div/class already being allowed —
 * the class values are constrained to a fixed set at the UI layer.
 */
export const Callout = Node.create<CalloutOptions>({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (element) => {
          const cls = element.getAttribute('class') ?? '';
          const match = /callout-(info|warning|tip|danger)/.exec(cls);
          return match ? match[1] : 'info';
        },
        renderHTML: (attrs) => ({ class: `callout callout-${attrs.variant}` }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },

  addCommands() {
    return {
      insertCallout:
        (variant: CalloutVariant = 'info') =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { variant },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Your note here…' }] }],
          }),
    };
  },
});
