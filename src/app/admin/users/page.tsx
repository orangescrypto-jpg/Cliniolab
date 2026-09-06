'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { AppUser, UserRole } from '@/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  function load() {
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then((data) => setUsers(data.users ?? []));
  }

  useEffect(load, []);

  async function changeRole(userId: string, role: UserRole) {
    const res = await fetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) load();
  }

  async function deleteUser(userId: string) {
    setError(null);
    setWarning(null);
    setDeletingId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete user');
        return;
      }
      if (data.warning) setWarning(data.warning);
      setConfirmingId(null);
      load();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Users</h1>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {warning && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {warning}
        </div>
      )}

      <div className="mt-6 space-y-3">
        {users.map((u) => (
          <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-ink-800">{u.displayName ?? u.email}</p>
              <p className="text-xs text-ink-400">{u.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={u.role}
                onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
              >
                <option value="user">User</option>
                <option value="moderator">Moderator</option>
                <option value="admin">Admin</option>
              </select>

              {confirmingId === u.id ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-600">Delete permanently?</span>
                  <button
                    type="button"
                    onClick={() => deleteUser(u.id)}
                    disabled={deletingId === u.id}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {deletingId === u.id ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="rounded-md border border-ink-100 px-3 py-1.5 text-xs text-ink-600 hover:bg-ink-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setConfirmingId(u.id);
                  }}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          </Card>
        ))}
        {users.length === 0 && <p className="text-sm text-ink-400">No users yet.</p>}
      </div>
    </div>
  );
}
