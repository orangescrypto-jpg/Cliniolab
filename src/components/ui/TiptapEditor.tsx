'use client';

import { useCallback, useEffect, useState } from 'react';
import { useEditor, EditorContent, BubbleMenu, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Placeholder from '@tiptap/extension-placeholder';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';
import { SlashMenu } from './editor/SlashMenu';
import { HtmlBlock } from './editor/HtmlBlock';

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Where uploaded images should be filed under (matches /api/uploads/image "purpose"). */
  uploadPurpose?: 'blog' | 'resources' | 'banners' | 'scholars';
  minHeightPx?: number;
}

/**
 * Rich WYSIWYG editor built on Tiptap (ProseMirror). Replaces the old
 * Markdown-textarea editor. Content is authored as real HTML from the
 * start, so what the admin sees while editing is what gets rendered.
 *
 * Security: Tiptap's own schema already constrains what nodes/marks can
 * exist, but as a defense-in-depth measure (compromised admin session,
 * bugs in a third-party extension, etc.) every HTML snapshot handed back
 * via onChange is passed through the same sanitizeHtml() used at render
 * time before it's persisted. This keeps the existing string-based
 * sanitizer as the single security boundary — no DOM/jsdom dependency
 * added, still safe to run in the Cloudflare Workers runtime.
 */
export function TiptapEditor({
  value,
  onChange,
  placeholder = 'Write your post…',
  uploadPurpose = 'blog',
  minHeightPx = 320,
}: TiptapEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File): Promise<string | null> => {
      setUploadError(null);
      if (!file.type.startsWith('image/')) {
        setUploadError('Only image files can be inserted.');
        return null;
      }
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('purpose', uploadPurpose);
        const res = await fetch('/api/uploads/image', { method: 'POST', body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadError(data.error ?? 'Image upload failed.');
          return null;
        }
        return data.path as string;
      } catch {
        setUploadError('Image upload failed — check your connection.');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [uploadPurpose]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Placeholder.configure({ placeholder }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noreferrer', target: '_blank' },
      }),
      Image.configure({ HTMLAttributes: { style: 'max-width:100%;border-radius:6px;margin:8px 0' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      HtmlBlock,
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(sanitizeHtml(editor.getHTML()));
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none px-4 py-4',
      },
      handleDrop(view, event) {
        const file = event.dataTransfer?.files?.[0];
        if (!file || !file.type.startsWith('image/')) return false;
        event.preventDefault();
        uploadFile(file).then((path) => {
          if (!path || !editor) return;
          const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
          const pos = coords?.pos ?? view.state.selection.from;
          editor.chain().focus().insertContentAt(pos, { type: 'image', attrs: { src: path } }).run();
        });
        return true;
      },
      handlePaste(_view, event) {
        const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        uploadFile(file).then((path) => {
          if (!path || !editor) return;
          editor.chain().focus().setImage({ src: path }).run();
        });
        return true;
      },
    },
  });

  // Keep editor content in sync if `value` changes externally (e.g. switching drafts).
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  return (
    <div className="rounded-md border border-ink-100">
      <Toolbar editor={editor} onInsertImage={async (file) => {
        const path = await uploadFile(file);
        if (path) editor.chain().focus().setImage({ src: path }).run();
      }} />

      {uploadError && (
        <p className="border-b border-ink-100 bg-red-50 px-4 py-2 text-xs text-red-700">{uploadError}</p>
      )}
      {uploading && (
        <p className="border-b border-ink-100 bg-pulse-50 px-4 py-2 text-xs text-pulse-700">Uploading image…</p>
      )}

      {editor && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div className="flex items-center gap-0.5 rounded-md border border-ink-100 bg-white p-1 shadow-lg">
            <MarkButton editor={editor} mark="bold" label="B" />
            <MarkButton editor={editor} mark="italic" label="I" />
            <MarkButton editor={editor} mark="strike" label="S" />
            <button
              type="button"
              onClick={() => {
                const url = window.prompt('Link URL:', editor.getAttributes('link').href ?? '');
                if (url === null) return;
                if (url === '') {
                  editor.chain().focus().unsetLink().run();
                } else {
                  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                }
              }}
              className={`rounded px-2 py-1 text-xs font-semibold hover:bg-ink-100 ${editor.isActive('link') ? 'bg-pulse-100 text-pulse-700' : 'text-ink-600'}`}
              title="Link"
            >
              🔗
            </button>
          </div>
        </BubbleMenu>
      )}

      <div className="relative" style={{ minHeight: minHeightPx }}>
        <EditorContent editor={editor} />
        <SlashMenu editor={editor} onInsertImage={async (file) => {
          const path = await uploadFile(file);
          if (path) editor.chain().focus().setImage({ src: path }).run();
        }} />
      </div>
    </div>
  );
}

function MarkButton({ editor, mark, label }: { editor: Editor; mark: 'bold' | 'italic' | 'strike'; label: string }) {
  const run = {
    bold: () => editor.chain().focus().toggleBold().run(),
    italic: () => editor.chain().focus().toggleItalic().run(),
    strike: () => editor.chain().focus().toggleStrike().run(),
  }[mark];
  return (
    <button
      type="button"
      onClick={run}
      className={`rounded px-2 py-1 text-xs font-semibold hover:bg-ink-100 ${editor.isActive(mark) ? 'bg-pulse-100 text-pulse-700' : 'text-ink-600'}`}
      title={label}
    >
      {label}
    </button>
  );
}

function Toolbar({ editor, onInsertImage }: { editor: Editor; onInsertImage: (file: File) => void }) {
  const fileInputId = 'tiptap-image-input';

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-ink-100 bg-ink-50/50 p-2">
      <ToolbarBtn active={editor.isActive('heading', { level: 2 })} title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('heading', { level: 3 })} title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>H3</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('bold')} title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>B</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('italic')} title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>I</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('strike')} title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()}>S</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('blockquote')} title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>&quot;</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('codeBlock')} title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()}>{'</>'}</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('bulletList')} title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>•</ToolbarBtn>
      <ToolbarBtn active={editor.isActive('orderedList')} title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>1.</ToolbarBtn>
      <ToolbarBtn title="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</ToolbarBtn>
      <ToolbarBtn
        title="Insert table"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        ⊞
      </ToolbarBtn>
      <ToolbarBtn title="Insert HTML block" onClick={() => editor.chain().focus().insertHtmlBlock().run()}>
        {'{ }'}
      </ToolbarBtn>
      <label htmlFor={fileInputId} className="cursor-pointer rounded px-2 py-1 text-xs font-semibold text-ink-600 hover:bg-ink-100" title="Insert image">
        🖼
      </label>
      <input
        id={fileInputId}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onInsertImage(file);
          e.target.value = '';
        }}
      />
      <div className="ml-auto flex items-center gap-1 text-[11px] text-ink-400">
        Type <kbd className="rounded border border-ink-200 bg-white px-1">/</kbd> for commands
      </div>
    </div>
  );
}

function ToolbarBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded px-2 py-1 text-xs font-semibold hover:bg-ink-100 ${active ? 'bg-pulse-100 text-pulse-700' : 'text-ink-600'}`}
    >
      {children}
    </button>
  );
}
