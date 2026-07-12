import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { HtmlBlockView } from './HtmlBlockView';

export interface HtmlBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    htmlBlock: {
      insertHtmlBlock: () => ReturnType;
    };
  }
}

/**
 * A block node that stores raw, sanitized HTML as a single atomic unit
 * inside an otherwise-structured Tiptap document. Renders in the editor
 * via HtmlBlockView (edit box + live sanitized preview), and on
 * TiptapEditor's onUpdate the block's outerHTML is included as-is in
 * editor.getHTML() — then re-run through sanitizeHtml() same as every
 * other node, so this is not a bypass of that security boundary, just a
 * way to author raw markup (custom tables, styled divs, code snippets)
 * that Markdown/the standard toolbar can't express.
 *
 * Stored/serialized as: <div data-html-block="true">...raw html...</div>
 * so it survives save/reload and is recognizable when re-parsed.
 */
export const HtmlBlock = Node.create<HtmlBlockOptions>({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  isolating: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      html: {
        default: '<p>Edit this HTML…</p>',
        parseHTML: (element) => element.innerHTML,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-html-block="true"]',
        getAttrs: (element) => {
          if (typeof element === 'string') return {};
          return { html: (element as HTMLElement).innerHTML };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    // Content is injected as a raw HTML string via innerHTML in the DOM
    // serializer path (see toDOM below) rather than as Tiptap child
    // nodes, since this node's whole purpose is to hold markup the
    // schema doesn't otherwise model.
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-html-block', 'true');
    Object.entries(mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)).forEach(
      ([key, val]) => {
        if (key !== 'data-html-block') wrapper.setAttribute(key, String(val));
      }
    );
    wrapper.innerHTML = node.attrs.html ?? '';
    return wrapper;
  },

  addNodeView() {
    return ReactNodeViewRenderer(HtmlBlockView);
  },

  addCommands() {
    return {
      insertHtmlBlock:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { html: '<p>Edit this HTML…</p>' } }),
    };
  },
});
