'use client';

import { useRef, useState } from 'react';

interface InlineImageManagerProps {
  purpose: 'blog' | 'resources' | 'banners' | 'scholars';
  /** Called with a ready-to-use <figure> HTML snippet the caller inserts into content. */
  onInsert: (html: string) => void;
}

/**
 * Upload-then-insert flow for images placed mid-post, built as a
 * standalone component deliberately isolated from the live Tiptap editor
 * instance — modeled on ImagePicker (the featured-image control), which
 * has never had the reliability problems the in-editor image button did.
 *
 * Why this exists instead of the toolbar/slash-menu image button: on
 * mobile, tapping those opens the OS file picker as a separate
 * activity/overlay, and Android will sometimes reclaim the WebView while
 * it's in the background. When that happens mid-upload, the live
 * ProseMirror editor instance the old flow depended on (to run
 * `editor.chain().insertFigure(...)`) is gone, and the whole admin page
 * can come back as a blank/crashed reload — losing whatever the admin
 * hadn't saved yet.
 *
 * This component sidesteps that failure mode entirely: the upload
 * finishes and produces a stable result *before* anything touches the
 * editor. There's no `editor.chain()` call in the upload path at all.
 * The resulting HTML snippet is handed to the caller (BlogAdminPage),
 * which inserts it into the `content` string directly — the same state
 * value the draft-autosave effect already watches — rather than through
 * a live editor command that requires the ProseMirror instance to still
 * exist in memory.
 */
export function InlineImageManager({ purpose, onInsert }: InlineImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastPath, setLastPath] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', purpose);
      const res = await fetch('/api/uploads/image', { method: 'POST', body: formData });
      let data: { path?: string; error?: string };
      try {
        data = await res.json();
      } catch {
        setError('Upload failed — the server returned an unexpected response.');
        return;
      }
      if (!res.ok || !data.path) {
        setError(data.error ?? 'Upload failed');
        return;
      }
      setLastPath(data.path);
    } catch {
      setError('Upload failed — check your connection and try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function insertNow() {
    if (!lastPath) return;
    const safeCaption = caption.trim();
    const html = safeCaption
      ? `<figure style="text-align: center"><img src="${lastPath}" alt="${safeCaption.replace(/"/g, '&quot;')}" style="width: 60%; max-width: 100%" /><figcaption>${safeCaption}</figcaption></figure>`
      : `<figure style="text-align: center"><img src="${lastPath}" alt="" style="width: 60%; max-width: 100%" /><figcaption></figcaption></figure>`;
    onInsert(html);
    setLastPath(null);
    setCaption('');
  }

  return (
    <div className="rounded-md border border-ink-100 bg-ink-50/40 p-3">
      <p className="mb-2 text-xs font-medium text-ink-600">
        Insert image into post body
      </p>
      <p className="mb-2 text-[11px] text-ink-400">
        Uploads separately from the editor, so a native picker reload can never lose your draft.
        After uploading, it gets appended to the end of your content below — cut and paste it
        wherever it belongs in the text.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelected}
        className="text-sm text-ink-600"
      />
      {uploading && <p className="mt-1 text-xs text-ink-400">Uploading…</p>}
      {error && <p className="mt-1 text-xs text-critical-500">{error}</p>}

      {lastPath && (
        <div className="mt-3 rounded-md border border-pulse-200 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lastPath} alt="" className="h-28 w-full rounded object-cover" />
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="mt-2 w-full rounded-md border border-ink-100 px-2 py-1 text-xs focus:border-pulse-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={insertNow}
            className="mt-2 w-full rounded-md bg-pulse-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-pulse-700"
          >
            Add to end of content
          </button>
        </div>
      )}
    </div>
  );
}
