'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../../../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

interface AddForm {
  name: string;
  email: string;
  password: string;
  role: string;
}

interface EditForm {
  name: string;
  role: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD = '#D4A843';
const MUTED = '#A0A0A0';
const WHITE = '#FFFFFF';
const RED = '#ef4444';
const GREEN = '#22c55e';
const AMBER = '#f59e0b';

const ROLE_OPTIONS = ['student', 'institute', 'industry', 'government', 'admin'];

const ROLE_COLORS: Record<string, string> = {
  admin: GOLD,
  student: '#3b82f6',
  institute: '#8b5cf6',
  industry: '#10b981',
  government: AMBER,
};

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8,
  padding: '9px 12px',
  color: WHITE,
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: MUTED,
  fontWeight: 600,
  marginBottom: 4,
  display: 'block',
};

// ─── Toast Component ──────────────────────────────────────────────────────────

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          padding: '12px 20px',
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 600,
          color: WHITE,
          background: t.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${t.type === 'success' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          animation: 'slideIn 0.2s ease',
          maxWidth: 360,
        }}>
          <span style={{ marginRight: 8 }}>{t.type === 'success' ? '✓' : '✕'}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner({ size = 14, color = WHITE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'spin 0.8s linear infinite', display: 'block' }}>
      <circle cx="12" cy="12" r="10" stroke={color} strokeWidth="3" fill="none" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ─── Modal Backdrop ───────────────────────────────────────────────────────────

function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 460, background: '#0f0d18', border: '1px solid rgba(212,168,67,0.15)', borderRadius: 16, padding: 28 }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  // Per-row loading (stores the _id of the row being acted on)
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddForm>({ name: '', email: '', password: '', role: 'student' });
  const [addLoading, setAddLoading] = useState(false);

  // Edit modal
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', role: '' });
  const [editLoading, setEditLoading] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // ── Fetch users ───────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setFetching(true);
    setFetchError(null);
    try {
      const { data } = await api.get('/admin/users?limit=100');
      setUsers(data.data ?? []);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to load users';
      setFetchError(msg);
      showToast(msg, 'error');
    } finally {
      setFetching(false);
    }
  }, [showToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Add User ──────────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!addForm.name.trim() || !addForm.email.trim() || !addForm.password.trim()) {
      showToast('Name, email and password are required', 'error');
      return;
    }
    setAddLoading(true);
    try {
      await api.post('/admin/users', addForm);
      showToast(`User ${addForm.name} created successfully`);
      setShowAdd(false);
      setAddForm({ name: '', email: '', password: '', role: 'student' });
      await fetchUsers();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to create user';
      showToast(msg, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  // ── Edit User ─────────────────────────────────────────────────────────────

  const openEdit = (user: AdminUser) => {
    setEditUser(user);
    setEditForm({ name: user.name, role: user.role });
  };

  const handleEdit = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const { data } = await api.patch(`/admin/users/${editUser._id}`, { name: editForm.name, role: editForm.role });
      const updated: AdminUser = data.data;
      setUsers((prev) => prev.map((u) => (u._id === updated._id ? updated : u)));
      showToast(`${updated.name} updated successfully`);
      setEditUser(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to update user';
      showToast(msg, 'error');
    } finally {
      setEditLoading(false);
    }
  };

  // ── Suspend / Unsuspend ───────────────────────────────────────────────────

  const handleToggleSuspend = async (user: AdminUser) => {
    setLoadingId(user._id);
    const newActive = !user.isActive;
    // Optimistic update
    setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, isActive: newActive } : u)));
    try {
      await api.patch(`/admin/users/${user._id}`, { isActive: newActive });
      showToast(`${user.name} ${newActive ? 'unsuspended' : 'suspended'} successfully`);
    } catch (err: unknown) {
      // Revert on failure
      setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, isActive: !newActive } : u)));
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Action failed';
      showToast(msg, 'error');
    } finally {
      setLoadingId(null);
    }
  };

  // ── Delete User ───────────────────────────────────────────────────────────

  const handleDelete = async (user: AdminUser) => {
    if (!window.confirm(`Delete "${user.name}"?\n\nThis will deactivate their account permanently.`)) return;
    setLoadingId(user._id);
    try {
      await api.delete(`/admin/users/${user._id}`);
      setUsers((prev) => prev.filter((u) => u._id !== user._id));
      showToast(`${user.name} removed from system`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Failed to delete user';
      showToast(msg, 'error');
    } finally {
      setLoadingId(null);
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase()),
  );

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* CSS keyframes injected once */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>

      <ToastContainer toasts={toasts} />

      <div style={{ color: WHITE, maxWidth: 1100 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
            User <span style={{ color: GOLD }}>Management</span>
          </h1>
          <p style={{ margin: '4px 0 0', color: MUTED, fontSize: 14 }}>
            {fetching ? 'Loading…' : `${users.length} registered users`}
          </p>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Search by name, email or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, ...inputStyle }}
          />
          <button
            onClick={() => setShowAdd(true)}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: `linear-gradient(135deg, ${GOLD}, #8b6512)`,
              color: '#1a0f00', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            + Add User
          </button>
          <button
            onClick={fetchUsers}
            disabled={fetching}
            style={{
              padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
              background: 'transparent', color: MUTED, fontSize: 12, cursor: 'pointer',
            }}
          >
            {fetching ? <Spinner size={13} color={MUTED} /> : '↻'}
          </button>
        </div>

        {/* Error state */}
        {fetchError && !fetching && (
          <div style={{ padding: '16px 20px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: RED, fontSize: 13, marginBottom: 16 }}>
            {fetchError}
            <button onClick={fetchUsers} style={{ marginLeft: 16, color: RED, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 12 }}>Retry</button>
          </div>
        )}

        {/* Loading skeleton */}
        {fetching && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.04)', animation: 'pulse 1.5s infinite' }} />
            ))}
            <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.3} }`}</style>
          </div>
        )}

        {/* Table */}
        {!fetching && (
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'rgba(212,168,67,0.08)' }}>
                  {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: MUTED, fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.08)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '40px 14px', textAlign: 'center', color: MUTED, fontSize: 13 }}>
                      {search ? 'No users match your search.' : 'No users found.'}
                    </td>
                  </tr>
                )}
                {filtered.map((user, i) => {
                  const isRowLoading = loadingId === user._id;
                  return (
                    <tr key={user._id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      {/* Name */}
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${GOLD}, #8b6512)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#1a0f00', flexShrink: 0 }}>
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ color: WHITE, fontWeight: 500 }}>{user.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td style={{ padding: '10px 14px', color: MUTED, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{user.email}</td>

                      {/* Role */}
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${ROLE_COLORS[user.role] ?? MUTED}18`, color: ROLE_COLORS[user.role] ?? MUTED, border: `1px solid ${ROLE_COLORS[user.role] ?? MUTED}40` }}>
                          {user.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {user.isActive ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
                            <span style={{ color: GREEN, fontSize: 12 }}>Active</span>
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: RED }} />
                            <span style={{ color: RED, fontSize: 11, fontWeight: 700 }}>Suspended</span>
                          </div>
                        )}
                      </td>

                      {/* Joined */}
                      <td style={{ padding: '10px 14px', color: MUTED, borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
                        {new Date(user.createdAt).toLocaleDateString('en-IN')}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {/* Edit */}
                          <button
                            onClick={() => openEdit(user)}
                            disabled={isRowLoading}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: MUTED, fontSize: 11, cursor: 'pointer' }}
                          >
                            Edit
                          </button>

                          {/* Suspend / Unsuspend */}
                          <button
                            onClick={() => handleToggleSuspend(user)}
                            disabled={isRowLoading}
                            style={{
                              padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 5,
                              border: user.isActive ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)',
                              background: user.isActive ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)',
                              color: user.isActive ? RED : GREEN,
                            }}
                          >
                            {isRowLoading ? <Spinner size={11} color={user.isActive ? RED : GREEN} /> : null}
                            {user.isActive ? 'Suspend' : 'Unsuspend'}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(user)}
                            disabled={isRowLoading}
                            style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(100,116,139,0.3)', background: 'rgba(100,116,139,0.08)', color: '#64748b', fontSize: 11, cursor: 'pointer' }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add User Modal ───────────────────────────────────────────────────── */}
      {showAdd && (
        <Modal onClose={() => setShowAdd(false)}>
          <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: WHITE, marginBottom: 20, marginTop: 0 }}>Add New User</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input type="text" placeholder="Enter full name" value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" placeholder="Enter email address" value={addForm.email} onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Password *</label>
              <input type="password" placeholder="Min 8 characters" value={addForm.password} onChange={(e) => setAddForm((f) => ({ ...f, password: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))} style={{ ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowAdd(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={addLoading}
              style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${GOLD}, #8b6512)`, color: '#1a0f00', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {addLoading && <Spinner size={13} color="#1a0f00" />}
              {addLoading ? 'Creating…' : 'Add User'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Edit User Modal ───────────────────────────────────────────────────── */}
      {editUser && (
        <Modal onClose={() => setEditUser(null)}>
          <h2 className="font-display" style={{ fontSize: 18, fontWeight: 800, color: WHITE, marginBottom: 4, marginTop: 0 }}>Edit User</h2>
          <p style={{ color: MUTED, fontSize: 12, marginBottom: 20, marginTop: 0 }}>{editUser.email}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input type="text" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))} style={{ ...inputStyle, appearance: 'auto' as React.CSSProperties['appearance'] }}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditUser(null)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: MUTED, fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleEdit}
              disabled={editLoading}
              style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: `linear-gradient(135deg, ${GOLD}, #8b6512)`, color: '#1a0f00', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {editLoading && <Spinner size={13} color="#1a0f00" />}
              {editLoading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
