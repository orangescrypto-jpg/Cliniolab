import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { EmbedView } from './EmbedView';

export interface EmbedOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      insertEmbed: (src: string) => ReturnType;
    };
  }
}

/** Converts a normal YouTube/Vimeo watch/share URL into the embeddable form. */
export function toEmbedUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());
    const host = url.hostname.replace(/^www\./, '');

    if (host === 'youtube.com' && url.pathname === '/watch' && url.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${url.searchParams.get('v')}`;
    }
    if (host === 'youtu.be' && url.pathname.length > 1) {
      return `https://www.youtube.com/embed/${url.pathname.slice(1)}`;
    }
    if (host === 'youtube.com' && url.pathname.startsWith('/embed/')) {
      return `https://www.youtube.com${url.pathname}`;
    }
    if (host === 'vimeo.com' && /^\/\d+$/.test(url.pathname)) {
      return `https://player.vimeo.com/video${url.pathname}`;
    }
    if (host === 'player.vimeo.com' && url.pathname.startsWith('/video/')) {
      return `https://player.vimeo.com${url.pathname}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Video embed block. Stores only a `src` attribute pointing at a verified
 * youtube.com/embed/ or player.vimeo.com/video/ URL. Serializes to a plain
 * <iframe src="..."> — the SAME url shape sanitizeHtml()'s isSafeEmbedSrc()
 * accepts, so saving doesn't strip it back out. Any other src is rejected
 * at insert time by toEmbedUrl() returning null, well before it ever
 * reaches the sanitizer.
 */
export const Embed = Node.create<EmbedOptions>({
  name: 'embed',
  group: 'block',
  atom: true,

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'iframe[src]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'iframe',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        src: node.attrs.src,
        width: '100%',
        height: '360',
        frameborder: '0',
        sandbox: 'allow-scripts allow-same-origin allow-presentation',
        allowfullscreen: 'true',
        loading: 'lazy',
        title: 'Embedded video',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedView);
  },

  addCommands() {
    return {
      insertEmbed:
        (src: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    };
  },
});
