'use client';

import { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';

interface SlashMenuProps {
  editor: Editor;
  onInsertImage: (file: File) => void;
}

interface Command {
  label: string;
  hint: string;
  run: (editor: Editor) => void;
}

const COMMANDS: Command[] = [
  { label: 'Heading 2', hint: 'H2', run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3', hint: 'H3', run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet list', hint: '•', run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered list', hint: '1.', run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Quote', hint: '"', run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Code block', hint: '</>', run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { label: 'Divider', hint: '―', run: (e) => e.chain().focus().setHorizontalRule().run() },
  { label: 'Table (3×3)', hint: '⊞', run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { label: 'HTML block', hint: '{ }', run: (e) => e.chain().focus().insertHtmlBlock().run() },
  { label: 'Callout: Info', hint: 'ℹ️', run: (e) => e.chain().focus().insertCallout('info').run() },
  { label: 'Callout: Tip', hint: '💡', run: (e) => e.chain().focus().insertCallout('tip').run() },
  { label: 'Callout: Warning', hint: '⚠️', run: (e) => e.chain().focus().insertCallout('warning').run() },
  {
    label: 'Video embed',
    hint: '▶',
    run: (e) => {
      const url = window.prompt('Paste a YouTube or Vimeo link:');
      if (!url) return;
      import('./Embed').then(({ toEmbedUrl }) => {
        const embedUrl = toEmbedUrl(url);
        if (!embedUrl) {
          window.alert('That link isn\'t a recognized YouTube or Vimeo URL.');
          return;
        }
        e.chain().focus().insertEmbed(embedUrl).run();
      });
    },
  },
];

/**
 * Notion-style slash menu: type "/" at the start of an empty-ish text
 * run and a filterable command list appears near the cursor. Purely a
 * UI convenience layer on top of the same editor.chain() commands the
 * toolbar buttons use — no custom Tiptap extension/schema needed.
 */
export function SlashMenu({ editor, onInsertImage }: SlashMenuProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  const allOptions = query === '' || 'image'.includes(query.toLowerCase())
    ? [...filtered, { label: 'Image', hint: '🖼', run: () => fileInputRef.current?.click() }]
    : filtered;

  useEffect(() => {
    function handleUpdate() {
      const { state, view } = editor;
      const { $from } = state.selection;
      const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\uFFFC');
      const match = /(?:^|\s)\/(\w*)$/.exec(textBefore);

      if (match) {
        const coordsAtPos = view.coordsAtPos($from.pos);
        const editorRect = view.dom.getBoundingClientRect();
        setCoords({
          top: coordsAtPos.bottom - editorRect.top + 4,
          left: coordsAtPos.left - editorRect.left,
        });
        setQuery(match[1]);
        setSelected(0);
        setOpen(true);
      } else {
        setOpen(false);
      }
    }

    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);
    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (!open) return;
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, allOptions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        runCommand(allOptions[selected]);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeydown, true);
    return () => window.removeEventListener('keydown', handleKeydown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selected, allOptions.length]);

  function removeSlashQuery() {
    const { state } = editor;
    const { $from } = state.selection;
    const textBefore = $from.parent.textBetween(0, $from.parentOffset, undefined, '\uFFFC');
    const match = /(?:^|\s)\/(\w*)$/.exec(textBefore);
    if (!match) return;
    const from = $from.pos - match[0].length + (match[0].startsWith(' ') ? 1 : 0);
    editor.chain().focus().deleteRange({ from, to: $from.pos }).run();
  }

  function runCommand(cmd: { label: string; run: (editor: Editor) => void }) {
    removeSlashQuery();
    cmd.run(editor);
    setOpen(false);
  }

  if (!open || !coords) {
    return (
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onInsertImage(file);
          e.target.value = '';
        }}
      />
    );
  }

  return (
    <>
      <div
        className="absolute z-20 w-56 overflow-hidden rounded-md border border-ink-100 bg-white shadow-lg"
        style={{ top: coords.top, left: coords.left }}
      >
        {allOptions.length === 0 && (
          <div className="px-3 py-2 text-xs text-ink-400">No matching commands</div>
        )}
        {allOptions.map((cmd, i) => (
          <button
            key={cmd.label}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              runCommand(cmd);
            }}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === selected ? 'bg-pulse-50 text-pulse-700' : 'text-ink-700 hover:bg-ink-50'}`}
          >
            <span className="w-6 text-center text-xs font-semibold text-ink-400">{cmd.hint}</span>
            {cmd.label}
          </button>
        ))}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onInsertImage(file);
          e.target.value = '';
        }}
      />
    </>
  );
}
