'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Area, AreaChart,
} from 'recharts';
import api from '../../../lib/api';
import Link from 'next/link';

/* ── Design tokens ─────────────────────────────────────────────────────────── */
const GOLD   = '#D4A843';
const AMBER  = '#F59E0B';
const GREEN  = '#22c55e';
const RED    = '#ef4444';
const INDIGO = '#6366f1';
const PURPLE = '#8b5cf6';

/* ── Types ──────────────────────────────────────────────────────────────────── */
interface KpiData {
    totalUsers:    number;
    activeStudents: number;
    totalInstitutes: number;
    revenue:       number;
}

interface RecentUser {
    _id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
}

/* ── Mock growth data (marked as mock) ──────────────────────────────────────── */
const MOCK_GROWTH = [
    { day: 'Mon', users: 12 },
    { day: 'Tue', users: 19 },
    { day: 'Wed', users: 14 },
    { day: 'Thu', users: 28 },
    { day: 'Fri', users: 34 },
    { day: 'Sat', users: 22 },
    { day: 'Sun', users: 17 },
];

const MOCK_ACTIVITY = [
    { day: 'Mon', logins: 1240, analyses: 890 },
    { day: 'Tue', logins: 1380, analyses: 1020 },
    { day: 'Wed', logins: 1560, analyses: 1180 },
    { day: 'Thu', logins: 1290, analyses: 950 },
    { day: 'Fri', logins: 1720, analyses: 1340 },
    { day: 'Sat', logins: 980,  analyses: 720 },
    { day: 'Sun', logins: 760,  analyses: 540 },
];

const ROLE_COLOR: Record<string, string> = {
    student: GOLD, institute: '#a78bfa', industry: GREEN,
    government: AMBER, admin: '#64748b',
};

/* ── Skeleton ────────────────────────────────────────────────────────────────── */
function Skeleton({ w = '100%', h = 20, r = 8 }: { w?: string | number; h?: number; r?: number }) {
    return (
        <div style={{ width: w, height: h, borderRadius: r, background: 'rgba(255,255,255,0.06)', animation: 'pulse 1.4s ease infinite' }} />
    );
}

/* ── KPI Card ────────────────────────────────────────────────────────────────── */
function KpiCard({ label, value, icon, color, delta, loading }: { label: string; value: string | number; icon: string; color: string; delta?: string; loading: boolean }) {
    return (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`, borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}14`, border: `1px solid ${color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{icon}</div>
            </div>
            {loading ? <Skeleton h={32} w="60%" r={6} /> : (
                <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{value}</div>
            )}
            {delta && !loading && (
                <div style={{ marginTop: 8, fontSize: 11, color: GREEN, fontWeight: 600 }}>↑ {delta} this week</div>
            )}
        </div>
    );
}

/* ── Custom Tooltip ─────────────────────────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: '#0f0d18', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
            <p style={{ color: '#94a3b8', marginBottom: 6, fontWeight: 600 }}>{label}</p>
            {payload.map((p, i) => (
                <p key={i} style={{ color: p.color, fontWeight: 700 }}>{p.name}: {p.value.toLocaleString('en-IN')}</p>
            ))}
        </div>
    );
};

/* ── Page ────────────────────────────────────────────────────────────────────── */
export default function AdminDashboardPage() {
    const [kpi, setKpi] = useState<KpiData | null>(null);
    const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [greeting, setGreeting] = useState('');
    const [adminName, setAdminName] = useState('Admin');

    /* ── greeting + user name ── */
    useEffect(() => {
        const h = new Date().getHours();
        setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
        try {
            const u = JSON.parse(localStorage.getItem('ss_user') || '{}');
            if (u.name) setAdminName(u.name.split(' ')[0]);
        } catch { /* noop */ }
    }, []);

    /* ── Fetch live data ── */
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get('/admin/users?limit=5&sort=-createdAt');
            const users: RecentUser[] = data.data ?? [];
            setRecentUsers(users);

            // Build KPI from real users list
            const active   = users.filter((u: RecentUser) => u.isActive).length;
            const studs    = users.filter((u: RecentUser) => u.role === 'student').length;
            const insts    = users.filter((u: RecentUser) => u.role === 'institute').length;

            // For total count, use a separate call
            const totRes = await api.get('/admin/users?limit=1');
            const total  = totRes.data.total ?? totRes.data.data?.length ?? users.length;

            setKpi({
                totalUsers:      total,
                activeStudents:  studs,
                totalInstitutes: insts,
                revenue:         0, // [MOCK] — no billing module yet
            });
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load dashboard data';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    return (
        <div style={{ color: '#fff', maxWidth: 1100, padding: '0 4px' }}>
            <style>{`@keyframes pulse { 0%,100%{opacity:.6} 50%{opacity:.3} }`}</style>

            {/* ── Header ── */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, fontFamily: 'Space Grotesk, sans-serif' }}>
                    {greeting}, <span style={{ color: GOLD }}>{adminName}!</span> 👋
                </h1>
                <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                    Here&apos;s what&apos;s happening on SkillSense AI today.
                </p>
            </div>

            {/* ── Error ── */}
            {error && (
                <div style={{ padding: '14px 20px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: RED, fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {error}
                    <button onClick={fetchData} style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }}>Retry</button>
                </div>
            )}

            {/* ── KPI Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
                <KpiCard label="Total Users"      value={kpi?.totalUsers ?? 0}      icon="👥" color={GOLD}   delta="12 new" loading={loading} />
                <KpiCard label="Active Students"  value={kpi?.activeStudents ?? 0}  icon="🎓" color={INDIGO} delta="5"      loading={loading} />
                <KpiCard label="Institutes"       value={kpi?.totalInstitutes ?? 0} icon="🏫" color={PURPLE} delta="2"      loading={loading} />
                <KpiCard label="Revenue (MOCK)"   value="₹—"                        icon="💰" color={GREEN}                loading={loading} />
            </div>

            {/* ── Quick Actions ── */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
                {[
                    { label: '+ Add User', href: '/admin/users', color: GOLD },
                    { label: '📊 View Reports', href: '/admin/reports', color: INDIGO },
                    { label: '🔒 Audit Logs', href: '/admin/audit-logs', color: '#64748b' },
                    { label: '⚖️ Fairness', href: '/admin/fairness', color: PURPLE },
                ].map(a => (
                    <Link key={a.label} href={a.href} style={{
                        padding: '9px 18px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: `${a.color}14`, border: `1px solid ${a.color}30`,
                        color: a.color, textDecoration: 'none',
                    }}>
                        {a.label}
                    </Link>
                ))}
            </div>

            {/* ── Charts Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
                {/* User growth — 7 days [MOCK] */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>User Registrations</div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>Last 7 days <span style={{ color: AMBER }}>[MOCK DATA]</span></div>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={MOCK_GROWTH} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <defs>
                                <linearGradient id="gUsers" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip />} />
                            <Area type="monotone" dataKey="users" name="New Users" stroke={GOLD} strokeWidth={2} fill="url(#gUsers)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Platform activity [MOCK] */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px' }}>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Platform Activity</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>Logins & AI analyses <span style={{ color: AMBER }}>[MOCK DATA]</span></div>
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={MOCK_ACTIVITY} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                            <Tooltip content={<ChartTip />} />
                            <Bar dataKey="logins"   name="Logins"   fill={INDIGO} radius={[4,4,0,0]} />
                            <Bar dataKey="analyses" name="Analyses" fill={GOLD}   radius={[4,4,0,0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Recent Registrations ── */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', marginBottom: 28 }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Recent Registrations</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Latest 5 users from MongoDB</div>
                    </div>
                    <Link href="/admin/users" style={{ fontSize: 11, color: GOLD, textDecoration: 'none', fontWeight: 600 }}>View all →</Link>
                </div>

                {loading ? (
                    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[1,2,3].map(i => <Skeleton key={i} h={40} />)}
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                                {['Name', 'Email', 'Role', 'Status', 'Joined'].map(h => (
                                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {recentUsers.length === 0 ? (
                                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No users found</td></tr>
                            ) : recentUsers.map((u, i) => (
                                <tr key={u._id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `linear-gradient(135deg, ${ROLE_COLOR[u.role] ?? GOLD}, ${ROLE_COLOR[u.role] ?? GOLD}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                                                {u.name.charAt(0).toUpperCase()}
                                            </div>
                                            <span style={{ color: '#fff', fontWeight: 500 }}>{u.name}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{u.email}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: `${ROLE_COLOR[u.role] ?? GOLD}18`, color: ROLE_COLOR[u.role] ?? GOLD, border: `1px solid ${ROLE_COLOR[u.role] ?? GOLD}35` }}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: u.isActive ? GREEN : RED }} />
                                            <span style={{ fontSize: 12, color: u.isActive ? GREEN : RED }}>{u.isActive ? 'Active' : 'Suspended'}</span>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: '#64748b', fontSize: 12 }}>
                                        {new Date(u.createdAt).toLocaleDateString('en-IN')}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ── System Health [MOCK] ── */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '20px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>System Health <span style={{ fontSize: 10, color: AMBER, fontWeight: 600 }}>[MOCK]</span></div>
                <div style={{ fontSize: 11, color: '#64748b', marginBottom: 16 }}>All services operational</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                    {[
                        { name: 'AI Analysis Engine',     uptime: '99.9%', ok: true },
                        { name: 'Authentication API',      uptime: '100%',  ok: true },
                        { name: 'Database Cluster',        uptime: '99.8%', ok: true },
                        { name: 'Resume Parser',           uptime: '99.7%', ok: true },
                        { name: 'GitHub Analyzer',         uptime: '99.5%', ok: true },
                        { name: 'Notification Service',    uptime: '97.2%', ok: false },
                    ].map((s, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.ok ? GREEN : AMBER, boxShadow: `0 0 6px ${s.ok ? GREEN : AMBER}` }} />
                                <span style={{ fontSize: 12, color: '#94a3b8' }}>{s.name}</span>
                            </div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: s.ok ? GREEN : AMBER }}>{s.uptime}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
