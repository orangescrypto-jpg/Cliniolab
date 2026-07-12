'use client';

import { useRef, useState } from 'react';

interface ImagePickerProps {
  value: string;
  onChange: (url: string) => void;
  purpose: 'blog' | 'resources' | 'banners' | 'scholars';
  label?: string;
}

export function ImagePicker({ value, onChange, purpose, label }: ImagePickerProps) {
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Upload failed');
        return;
      }
      onChange(data.path);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {label && <label className="text-sm font-medium text-ink-700">{label}</label>}
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={() => setMode('url')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${mode === 'url' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          Paste link
        </button>
        <button
          type="button"
          onClick={() => setMode('upload')}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium ${mode === 'upload' ? 'border-pulse-400 bg-pulse-50 text-pulse-700' : 'border-ink-100 text-ink-600'}`}
        >
          Upload image
        </button>
      </div>

      {mode === 'url' ? (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... (image URL)"
          className="mt-2 w-full rounded-md border border-ink-100 px-4 py-2 text-sm focus:border-pulse-400 focus:outline-none"
        />
      ) : (
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileSelected}
            className="text-sm text-ink-600"
          />
          {uploading && <p className="mt-1 text-xs text-ink-400">Uploading…</p>}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-critical-500">{error}</p>}

      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-3 h-32 w-full rounded-md object-cover" />
      )}
    </div>
  );
}
