import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { FigureView } from './FigureView';

export type FigureAlign = 'left' | 'center' | 'right' | 'full';

export interface FigureOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    figure: {
      insertFigure: (attrs: { src: string; alt?: string; caption?: string }) => ReturnType;
    };
  }
}

/**
 * Replaces the plain Image node with a <figure><img/><figcaption/></figure>
 * that supports width (resize), alignment, and an editable caption.
 * Serializes to real <figure>/<figcaption>/<img> markup — all already on
 * sanitizeHtml()'s ALLOWED_TAGS list — with width/alignment expressed via
 * the same whitelisted `style` properties (width, text-align) the
 * sanitizer's STYLE_PROPERTY_VALIDATORS already checks, so nothing new
 * needs to be added there for this to round-trip through a save/reload.
 */
export const Figure = Node.create<FigureOptions>({
  name: 'figure',
  group: 'block',
  content: 'inline*',
  atom: false,
  isolating: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      width: { default: 60 }, // percent
      align: { default: 'center' as FigureAlign },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        getAttrs: (element) => {
          if (typeof element === 'string') return {};
          const img = (element as HTMLElement).querySelector('img');
          const style = img?.getAttribute('style') ?? '';
          const widthMatch = /width:\s*(\d+)%/.exec(style);
          const alignMatch = /text-align:\s*(left|center|right)/.exec(
            (element as HTMLElement).getAttribute('style') ?? ''
          );
          return {
            src: img?.getAttribute('src') ?? null,
            alt: img?.getAttribute('alt') ?? '',
            width: widthMatch ? Number(widthMatch[1]) : 60,
            align: (element as HTMLElement).classList.contains('figure-full')
              ? 'full'
              : (alignMatch?.[1] ?? 'center'),
          };
        },
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, alt, width, align } = node.attrs;
    const figureStyle = align === 'full' ? '' : `text-align: ${align === 'left' ? 'left' : align === 'right' ? 'right' : 'center'}`;
    const imgWidth = align === 'full' ? 100 : width;

    return [
      'figure',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: align === 'full' ? 'figure-full' : undefined,
        style: figureStyle || undefined,
      }),
      [
        'img',
        {
          src,
          alt: alt || '',
          style: `width: ${imgWidth}%; max-width: 100%`,
        },
      ],
      ['figcaption', 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FigureView);
  },

  addCommands() {
    return {
      insertFigure:
        ({ src, alt = '', caption = '' }) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { src, alt, width: 60, align: 'center' },
            content: caption ? [{ type: 'text', text: caption }] : [],
          }),
    };
  },
});
