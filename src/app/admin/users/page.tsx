'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { AppUser, UserRole } from '@/types';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);

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

  return (
    <div>
      <h1 className="font-display text-2xl font-semibold text-ink-800">Users</h1>
      <div className="mt-6 space-y-3">
        {users.map((u) => (
          <Card key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-ink-800">{u.displayName ?? u.email}</p>
              <p className="text-xs text-ink-400">{u.email}</p>
            </div>
            <select
              value={u.role}
              onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
              className="rounded-md border border-ink-100 px-3 py-1.5 text-sm"
            >
              <option value="user">User</option>
              <option value="moderator">Moderator</option>
              <option value="admin">Admin</option>
            </select>
          </Card>
        ))}
        {users.length === 0 && <p className="text-sm text-ink-400">No users yet.</p>}
      </div>
    </div>
  );
}
