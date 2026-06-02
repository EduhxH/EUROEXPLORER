import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useState } from 'react';
import anime from 'animejs';
import {
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Grid2X2,
  ListChecks,
  LogOut,
  Moon,
  Pause,
  Play,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Square,
  Sun,
  Trash2,
  Upload,
  UsersRound,
  X,
  XCircle,
} from 'lucide-react';
import adminDog from './assets/admin-dog.png';
import defaultUserIcon from './assets/default-user.png';

type CommitStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type StatusFilter = 'ALL' | CommitStatus;
type ViewKey = 'dashboard' | 'notifications' | 'calendar' | 'analytics' | 'team' | 'reminders';
type ThemeMode = 'light' | 'dark';
type TrackerStateName = 'stopped' | 'running' | 'paused';

type CommitDiff = {
  desc?: string;
  sections?: unknown[];
  images?: Array<{ url?: string; x?: number; y?: number; w?: number; h?: number }>;
  [key: string]: unknown;
};

type Commit = {
  _id: string;
  country_id: string;
  author_id: string;
  author_name: string;
  status: CommitStatus | string;
  message?: string;
  diff: CommitDiff;
  created_at: string;
  rejection_note?: string | null;
};

type AdminUser = {
  id: string;
  username: string;
  name?: string;
  email?: string | null;
  cargo?: string | null;
  role: string;
  avatar?: string | null;
  last_seen?: string | null;
  last_activity?: string | null;
  online?: boolean;
  commit_count?: number;
};

type Reminder = {
  _id: string;
  title: string;
  notes?: string | null;
  urgency?: string | null;
  due_at?: string | null;
  assigned_to?: string | null;
  created_by: string;
  created_by_name?: string | null;
  completed: boolean;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type PasswordResetRequest = {
  _id: string;
  username: string;
  user_id: string;
  user_role?: string | null;
  code?: string | null;
  status: string;
  attempts: number;
  created_at: string;
  updated_at?: string | null;
  expires_at?: string | null;
  used_at?: string | null;
};

type TimeTrackerState = {
  state: TrackerStateName;
  elapsed_ms: number;
  started_at?: string | null;
  updated_at?: string | null;
  received_at?: number;
};

type UserDetails = {
  user: AdminUser;
  recent_commits: Commit[];
  permissions: string[];
};

type Stats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  editors: number;
};

type ChartPoint = {
  key: string;
  label: string;
  count: number;
  height: string;
};

type DashboardNotification = {
  id: string;
  user: string;
  message: string;
  area: string;
  status: string;
  date: string;
  details: string[];
  kind: 'commit' | 'password-reset';
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';
const LANDING_PAGE_URL = import.meta.env.VITE_LANDING_PAGE_URL ?? '/landing.html';
const SESSION_FLAG = 'cookie-session';

const statusCopy: Record<CommitStatus, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
  REJECTED: 'Rejeitada',
};

const urgencyLabels: Record<string, string> = {
  high: 'Alta',
  normal: 'Normal',
  low: 'Baixa',
};

function authHeaders(_token?: string) {
  return {};
}

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail || data?.message;
    if (response.status === 401 && detail === 'Invalid credentials') {
      throw new Error('Credenciais invalidas.');
    }
    if (response.status === 403 && detail === 'Origin not allowed') {
      throw new Error('Este website nao esta autorizado pela API.');
    }
    if (response.status === 429) {
      throw new Error('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
    }
    if (detail === 'Reset code must have 6 digits') {
      throw new Error('O codigo deve ter 6 digitos.');
    }
    if (detail === 'Invalid or expired reset code') {
      throw new Error('Codigo invalido ou expirado.');
    }
    if (detail === 'Password must be at least 10 characters') {
      throw new Error('A nova senha deve ter pelo menos 10 caracteres.');
    }
    throw new Error(detail || `Pedido falhou com estado ${response.status}`);
  }
  return data as T;
}

function getStoredUser(): AdminUser | null {
  const raw = localStorage.getItem('admin_user');
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

function formatDate(value?: string | null) {
  if (!value) return 'Não registado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data indisponível';

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatDateOnly(value: Date) {
  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function avatarUrl(user?: AdminUser | null) {
  if (!user?.avatar) return '';
  if (user.avatar.startsWith('http')) return user.avatar;
  return `${API_BASE}${user.avatar}`;
}

function initials(value?: string | null) {
  const parts = (value || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'EU';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function userInitials(user?: AdminUser | null) {
  return initials(user?.username || user?.name || user?.email);
}

function describeDiff(diff: CommitDiff) {
  const details: string[] = [];

  if (diff.desc) details.push('Descrição alterada');
  if (Array.isArray(diff.sections)) details.push(`${diff.sections.length} secções recebidas`);
  if (Array.isArray(diff.images)) details.push(`${diff.images.length} imagens recebidas`);

  return details.length ? details : ['Diff recebido sem campos classificados'];
}

function toNotification(commit: Commit): DashboardNotification {
  return {
    id: commit._id,
    user: commit.author_name,
    message: commit.message || `${commit.author_name} fez uma alteração!`,
    area: commit.country_id,
    status: commit.status,
    date: commit.created_at,
    details: describeDiff(commit.diff ?? {}),
    kind: 'commit',
  };
}

function toPasswordResetNotification(reset: PasswordResetRequest): DashboardNotification {
  const details = reset.status === 'PENDING'
    ? [
        `Codigo: ${reset.code || 'indisponivel'}`,
        reset.expires_at ? `Expira em ${formatDate(reset.expires_at)}` : 'Codigo sem validade definida',
      ]
    : [
        reset.used_at ? `Usado em ${formatDate(reset.used_at)}` : `Estado: ${reset.status}`,
        reset.expires_at ? `Validade: ${formatDate(reset.expires_at)}` : 'Sem validade registada',
      ];

  return {
    id: `reset-${reset._id}`,
    user: reset.username,
    message: 'Pedido de redefinicao de senha',
    area: reset.user_role || 'Conta administrativa',
    status: reset.status,
    date: reset.created_at,
    details,
    kind: 'password-reset',
  };
}

function buildChartData(entries: Array<{ date: string }>, daysBack = 7): ChartPoint[] {
  const today = new Date();
  const days = Array.from({ length: daysBack }, (_, index) => {
    const day = new Date(today);
    day.setHours(0, 0, 0, 0);
    day.setDate(today.getDate() - (daysBack - 1 - index));
    return day;
  });

  const counts = days.map((day) => {
    const key = dateKey(day);
    return entries.filter((entry) => dateKey(new Date(entry.date)) === key).length;
  });
  const max = Math.max(...counts, 0);

  return days.map((day, index) => ({
    key: dateKey(day),
    label: new Intl.DateTimeFormat('pt-PT', { weekday: 'short' }).format(day).slice(0, 1),
    count: counts[index],
    height: max > 0 ? `${Math.max((counts[index] / max) * 100, counts[index] > 0 ? 16 : 0)}%` : '0%',
  }));
}

function groupCommitsBy(commits: Commit[], mode: 'day' | 'week' | 'month') {
  return commits.reduce<Record<string, number>>((acc, commit) => {
    const date = new Date(commit.created_at);
    if (Number.isNaN(date.getTime())) return acc;

    let key = dateKey(date);
    if (mode === 'week') {
      const firstDay = new Date(date);
      firstDay.setDate(date.getDate() - date.getDay());
      key = dateKey(firstDay);
    }
    if (mode === 'month') key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function App() {
  const [token, setToken] = useState(() => (getStoredUser() ? SESSION_FLAG : ''));
  const [user, setUser] = useState<AdminUser | null>(() => getStoredUser());
  const [commits, setCommits] = useState<Commit[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [passwordResets, setPasswordResets] = useState<PasswordResetRequest[]>([]);
  const [timeTracker, setTimeTracker] = useState<TimeTrackerState>({ state: 'stopped', elapsed_ms: 0 });
  const [trackerTick, setTrackerTick] = useState(Date.now());
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');
  const [activeEditor, setActiveEditor] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'login' | 'reset'>('login');
  const [resetName, setResetName] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('admin_theme') as ThemeMode) || 'light');

  const request = async <T,>(path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    return readJson<T>(await fetch(`${API_BASE}${path}`, { ...init, credentials: 'include', headers }));
  };

  const fetchCommits = async (authToken = token) => {
    if (!authToken) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/commits`, { credentials: 'include', headers: authHeaders(authToken) });
      setCommits(await readJson<Commit[]>(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar as alterações.');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (authToken = token) => {
    if (!authToken) return;
    setUsers(await readJson<AdminUser[]>(await fetch(`${API_BASE}/api/admin/users`, { credentials: 'include', headers: authHeaders(authToken) })));
  };

  const fetchReminders = async (authToken = token) => {
    if (!authToken) return;
    setReminders(await readJson<Reminder[]>(await fetch(`${API_BASE}/api/reminders`, { credentials: 'include', headers: authHeaders(authToken) })));
  };

  const fetchPasswordResets = async (authToken = token) => {
    if (!authToken) return;
    setPasswordResets(await readJson<PasswordResetRequest[]>(await fetch(`${API_BASE}/api/admin/password-resets`, { credentials: 'include', headers: authHeaders(authToken) })));
  };

  const fetchTracker = async (authToken = token) => {
    if (!authToken) return;
    const tracker = await readJson<TimeTrackerState>(await fetch(`${API_BASE}/api/time-tracker`, { credentials: 'include', headers: authHeaders(authToken) }));
    setTimeTracker({ ...tracker, received_at: Date.now() });
  };

  const refreshAll = async (authToken = token) => {
    if (!authToken) return;
    await Promise.all([fetchCommits(authToken), fetchUsers(authToken), fetchReminders(authToken), fetchPasswordResets(authToken), fetchTracker(authToken)]);
  };

  useEffect(() => {
    document.documentElement.dataset.adminTheme = theme;
    localStorage.setItem('admin_theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.removeItem('admin_token');
    let cancelled = false;

    const hydrateSession = async () => {
      try {
        const currentUser = await readJson<AdminUser>(
          await fetch(`${API_BASE}/api/admin/me`, { credentials: 'include' }),
        );
        if (cancelled) return;
        localStorage.setItem('admin_user', JSON.stringify(currentUser));
        setUser(currentUser);
        setToken(SESSION_FLAG);
      } catch {
        if (cancelled) return;
        localStorage.removeItem('admin_user');
        setUser(null);
        setToken('');
      }
    };

    hydrateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const sendHeartbeat = async () => {
      await fetch(`${API_BASE}/api/admin/heartbeat`, { credentials: 'include', method: 'POST', headers: authHeaders(token) }).catch(() => undefined);
      await fetchUsers(token).catch(() => undefined);
    };
    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 15000);
    return () => window.clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    if (timeTracker.state !== 'running') return undefined;
    const intervalId = window.setInterval(() => setTrackerTick(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [timeTracker.state]);

  useEffect(() => {
    if (token) return;
    anime({ targets: '.login-container', opacity: [0, 1], translateY: [40, 0], duration: 700, easing: 'easeOutQuad' });
    anime({ targets: '.login-visual', opacity: [0, 1], translateX: [-34, 0], scale: [0.985, 1], duration: 820, easing: 'easeOutExpo' });
    anime({ targets: '.login-input, .login-option', opacity: [0, 1], translateY: [20, 0], delay: anime.stagger(120), duration: 600, easing: 'easeOutQuad' });
  }, [token]);

  useEffect(() => {
    if (!token) return;
    anime({ targets: '.dashboard-frame', opacity: [0, 1], translateY: [28, 0], duration: 760, easing: 'easeOutExpo' });
    anime({ targets: '.stat-card', opacity: [0, 1], translateY: [30, 0], delay: anime.stagger(120), duration: 700, easing: 'easeOutExpo' });
    anime({ targets: '.chart-bar-fill', height: (target: HTMLElement) => target.dataset.height ?? '0%', delay: anime.stagger(80), duration: 900, easing: 'easeOutCubic' });
    anime({ targets: '.progress-arc', strokeDashoffset: [282, (target: HTMLElement) => Number(target.dataset.offset ?? 282)], duration: 1100, easing: 'easeOutExpo' });
    anime({ targets: '.timer-display', opacity: [0, 1], scale: [0.92, 1], duration: 640, easing: 'easeOutBack' });
  }, [token, commits, activeView]);

  useEffect(() => {
    if (!notificationsOpen) return;
    anime({ targets: '.notifications-panel', translateX: ['100%', '0%'], opacity: [0, 1], duration: 450, easing: 'easeOutCubic' });
    anime({ targets: '.notification-row', opacity: [0, 1], translateX: [18, 0], delay: anime.stagger(70, { start: 130 }), duration: 430, easing: 'easeOutQuad' });
  }, [notificationsOpen]);

  useEffect(() => {
    if (!settingsOpen && !selectedUser) return;
    anime({ targets: '.overlay-card', opacity: [0, 1], translateY: [24, 0], duration: 360, easing: 'easeOutQuad' });
  }, [settingsOpen, selectedUser]);

  const pendingCommits = useMemo(() => commits.filter((commit) => commit.status === 'PENDING'), [commits]);
  const notifications = useMemo(() => {
    return [...passwordResets.map(toPasswordResetNotification), ...commits.map(toNotification)]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [commits, passwordResets]);

  const stats = useMemo<Stats>(
    () => ({
      total: commits.length,
      pending: pendingCommits.length,
      approved: commits.filter((commit) => commit.status === 'APPROVED').length,
      rejected: commits.filter((commit) => commit.status === 'REJECTED').length,
      editors: users.length,
    }),
    [commits, pendingCommits.length, users.length],
  );

  const chartData = useMemo(() => buildChartData(commits.map((commit) => ({ date: commit.created_at }))), [commits]);
  const reminderChartData = useMemo(() => buildChartData(reminders.map((reminder) => ({ date: reminder.created_at }))), [reminders]);

  const visibleCommits = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return commits.filter((commit) => {
      const matchesEditor = !activeEditor || commit.author_name === activeEditor;
      const matchesStatus = statusFilter === 'ALL' || commit.status === statusFilter;
      const matchesQuery =
        !normalizedQuery ||
        commit.country_id.toLowerCase().includes(normalizedQuery) ||
        commit.author_name.toLowerCase().includes(normalizedQuery) ||
        (commit.message ?? '').toLowerCase().includes(normalizedQuery);

      return matchesEditor && matchesStatus && matchesQuery;
    });
  }, [activeEditor, commits, query, statusFilter]);

  const currentElapsed = useMemo(() => {
    if (timeTracker.state !== 'running' || !timeTracker.started_at) return timeTracker.elapsed_ms;
    return timeTracker.elapsed_ms + Math.max(0, trackerTick - (timeTracker.received_at || trackerTick));
  }, [timeTracker, trackerTick]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginLoading(true);
    setError('');
    try {
      const data = await readJson<{ user: AdminUser }>(
        await fetch(`${API_BASE}/api/auth/login`, {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: loginName.trim(), password: loginPassword }),
        }),
      );
      localStorage.setItem('admin_user', JSON.stringify(data.user));
      localStorage.removeItem('admin_token');
      setToken(SESSION_FLAG);
      setUser(data.user);
      setLoginPassword('');
      await refreshAll(SESSION_FLAG);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível iniciar sessão.');
    } finally {
      setLoginLoading(false);
    }
  };

  const openResetMode = () => {
    setResetName(loginName.trim());
    setResetCode('');
    setResetPassword('');
    setResetMessage('');
    setResetSuccess(false);
    setError('');
    setLoginMode('reset');
  };

  const openLoginMode = () => {
    setLoginName(resetName.trim());
    setError('');
    setResetMessage('');
    setResetSuccess(false);
    setLoginMode('login');
  };

  const handleResetRequest = async () => {
    const username = resetName.trim();
    if (!username) {
      setResetSuccess(false);
      setResetMessage('Preencha o utilizador para pedir o codigo.');
      return;
    }

    setResetLoading(true);
    setResetMessage('');
    setResetSuccess(false);
    try {
      await readJson<{ message: string }>(
        await fetch(`${API_BASE}/api/auth/password-reset/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        }),
      );
      setResetSuccess(true);
      setResetMessage('Codigo enviado para as notificacoes dos super admins.');
    } catch (err) {
      setResetSuccess(false);
      setResetMessage(err instanceof Error ? err.message : 'Nao foi possivel pedir o codigo.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetConfirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = resetName.trim();
    const code = resetCode.trim();

    if (!username || !code || !resetPassword) {
      setResetSuccess(false);
      setResetMessage('Preencha utilizador, codigo e nova senha.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setResetSuccess(false);
      setResetMessage('O codigo deve ter 6 digitos.');
      return;
    }
    if (resetPassword.length < 10) {
      setResetSuccess(false);
      setResetMessage('A nova senha deve ter pelo menos 10 caracteres.');
      return;
    }

    setResetLoading(true);
    setResetMessage('');
    setResetSuccess(false);
    try {
      await readJson<{ message: string }>(
        await fetch(`${API_BASE}/api/auth/password-reset/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, code, password: resetPassword }),
        }),
      );
      setLoginName(username);
      setLoginPassword('');
      setResetCode('');
      setResetPassword('');
      setLoginMode('login');
      setError('Senha redefinida. Entre com a nova senha.');
    } catch (err) {
      setResetSuccess(false);
      setResetMessage(err instanceof Error ? err.message : 'Nao foi possivel redefinir a senha.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/api/auth/logout`, { credentials: 'include', method: 'POST' });
    } catch {
      // Keep logout local even if the network request fails.
    }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken('');
    setUser(null);
    setCommits([]);
    setUsers([]);
    setReminders([]);
    setPasswordResets([]);
    setActiveEditor(null);
    setStatusFilter('ALL');
    setNotificationsOpen(false);
    setSettingsOpen(false);
    window.location.assign(LANDING_PAGE_URL);
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    setError('');
    try {
      await request(`/api/commits/${id}/approve`, { method: 'POST' });
      await fetchCommits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aprovar alteração.');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    const note = rejectNotes[id]?.trim();
    if (!note) {
      setError('Escreva uma justificação antes de rejeitar a alteração.');
      return;
    }
    setActionId(id);
    setError('');
    try {
      await request(`/api/commits/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
      setRejectNotes((current) => ({ ...current, [id]: '' }));
      await fetchCommits();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao rejeitar alteração.');
    } finally {
      setActionId(null);
    }
  };

  const handleTrackerAction = async (action: 'start' | 'resume' | 'pause' | 'stop') => {
    const tracker = await request<TimeTrackerState>(`/api/time-tracker/${action}`, { method: 'POST' });
    setTimeTracker({ ...tracker, received_at: Date.now() });
    await fetchUsers();
  };

  const handlePrimaryHover = (target: EventTarget & HTMLButtonElement, isEntering: boolean) => {
    anime.remove(target);
    anime({ targets: target, scale: isEntering ? 1.018 : 1, translateY: isEntering ? -2 : 0, duration: 240, easing: 'easeOutQuad' });
  };

  const openUserDetails = async (userId: string) => {
    setSelectedUser(await request<UserDetails>(`/api/admin/users/${userId}`));
  };

  if (!token) {
    return (
      <main className="login-page">
        <iframe className="landing-frame" src={LANDING_PAGE_URL} title="Europa Explorer" />
        <div className="login-backdrop" aria-hidden="true" />

        <section className="login-container" aria-labelledby="login-title" aria-modal="true" role="dialog">
          <aside className="login-visual" aria-label="Imagem institucional do acesso admin">
            <img className="dog-photo" src={adminDog} alt="Cao com chapeu" />
            <div className="visual-shade" />
          </aside>

          <section className="login-card" aria-label="Formulario de acesso administrativo">
            <div className="restricted-pill login-option">
              <ShieldCheck size={15} />
              Acesso restrito a administradores
            </div>

            <div className="login-heading">
              <h1 id="login-title">{loginMode === 'reset' ? 'Redefinir senha' : 'Login de administradores'}</h1>
              <p className="login-mode-copy">{loginMode === 'reset' ? 'Peca um codigo aos super admins e crie uma nova senha.' : 'Inicie sessao com uma conta de administrador.'}</p>
            </div>

            {loginMode === 'login' && error && <div className="login-error" role="alert">{error}</div>}

            {loginMode === 'login' ? (
              <form className="login-form" onSubmit={handleLogin}>
                <label className="login-input">
                  <span>Nome de utilizador</span>
                  <input autoComplete="username" onChange={(event) => setLoginName(event.target.value)} required type="text" value={loginName} />
                </label>

                <label className="login-input password-field">
                  <span>Palavra-passe</span>
                  <input autoComplete="current-password" onChange={(event) => setLoginPassword(event.target.value)} required type={showPassword ? 'text' : 'password'} value={loginPassword} />
                  <button aria-label={showPassword ? 'Esconder password' : 'Mostrar password'} onClick={() => setShowPassword((current) => !current)} type="button">
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </label>

                <button className="login-submit" disabled={loginLoading} onMouseEnter={(event) => handlePrimaryHover(event.currentTarget, true)} onMouseLeave={(event) => handlePrimaryHover(event.currentTarget, false)} type="submit">
                  {loginLoading ? 'A validar acesso' : 'Entrar no painel'}
                </button>
                <button className="login-text-action login-option" onClick={openResetMode} type="button">Redefinir senha</button>
              </form>
            ) : (
              <form className="login-form" onSubmit={handleResetConfirm}>
                {resetMessage && <div className={resetSuccess ? 'login-error reset-success' : 'login-error'} role="alert">{resetMessage}</div>}

                <label className="login-input">
                  <span>Nome de utilizador</span>
                  <input autoComplete="username" onChange={(event) => setResetName(event.target.value)} required type="text" value={resetName} />
                </label>

                <button className="login-secondary login-option" disabled={resetLoading} onClick={handleResetRequest} type="button">
                  {resetLoading ? 'A enviar codigo' : 'Pedir codigo aos super admins'}
                </button>

                <label className="login-input">
                  <span>Codigo de 6 digitos</span>
                  <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setResetCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required type="text" value={resetCode} />
                </label>

                <label className="login-input">
                  <span>Nova senha</span>
                  <input autoComplete="new-password" onChange={(event) => setResetPassword(event.target.value)} required type="password" value={resetPassword} />
                </label>

                <button className="login-submit" disabled={resetLoading} onMouseEnter={(event) => handlePrimaryHover(event.currentTarget, true)} onMouseLeave={(event) => handlePrimaryHover(event.currentTarget, false)} type="submit">
                  {resetLoading ? 'A redefinir senha' : 'Redefinir senha'}
                </button>
                <button className="login-text-action login-option" onClick={openLoginMode} type="button">Voltar ao login</button>
              </form>
            )}
          </section>
        </section>
      </main>
    );
  }

  if (user?.role && user.role !== 'SUPER_ADMIN') {
    return (
      <main className="dashboard-denied" role="alert">
        <a className="dashboard-denied-back" href={LANDING_PAGE_URL}>Voltar para website</a>
        <section>
          <div className="dashboard-denied-icon">!</div>
          <h1>VOCÊ NÃO TEM ACESSO A ESTA PÁGINA. APENAS SUPER ADMINS PODEM VER A DASHBOARD.</h1>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page" data-theme={theme}>
      <section className="dashboard-frame" aria-label="Dashboard administrativo Europa Explorer">
        <Sidebar
          activeView={activeView}
          commitsCount={commits.length}
          onLogout={handleLogout}
          onRefresh={() => refreshAll()}
          onSettings={() => setSettingsOpen(true)}
          setActiveView={setActiveView}
        />

        <section className="dashboard-workspace">
          <header className="dashboard-topbar">
            <div className="search-shell">
              <Search size={24} />
              <input onChange={(event) => setQuery(event.target.value)} type="search" value={query} />
            </div>

            <div className="topbar-actions">
              <button aria-label="Abrir menu de notificações" className="circle-button has-dot" onClick={() => setNotificationsOpen(true)} type="button">
                <Bell size={22} />
              </button>
              <button aria-label="Abrir definições" className="profile-chip profile-button" onClick={() => setSettingsOpen(true)} type="button">
                <Avatar user={user} />
                <span>
                  <strong>{user?.username ?? 'Sessão autenticada'}</strong>
                  <small>{user?.role ?? 'Administrador'}</small>
                </span>
              </button>
            </div>
          </header>

          <section className="dashboard-content">
            <div className="dashboard-title-row">
              <div>
                <h1>{viewTitle(activeView)}</h1>
                <p>{viewSubtitle(activeView)}</p>
              </div>

              <div className="dashboard-buttons">
                <button className="primary-action" onClick={() => setNotificationsOpen(true)} type="button">
                  <Bell size={21} />
                  Menu de Notificações
                </button>
                <button className="outline-action" onClick={() => refreshAll()} type="button">
                  <RefreshCw size={18} />
                  Atualizar dados
                </button>
              </div>
            </div>

            {error && <div className="dashboard-alert" role="alert">{error}</div>}

            {activeView === 'dashboard' && (
              <DashboardView
                chartData={chartData}
                currentElapsed={currentElapsed}
                notifications={notifications}
                onNotificationsOpen={() => setNotificationsOpen(true)}
                onReminderOpen={() => setActiveView('reminders')}
                onTrackerAction={handleTrackerAction}
                reminders={reminders}
                stats={stats}
                timeTracker={timeTracker}
                users={users}
              />
            )}

            {activeView === 'notifications' && <NotificationsView commits={visibleCommits} notifications={notifications} />}
            {activeView === 'calendar' && <CalendarView commits={commits} />}
            {activeView === 'analytics' && <AnalyticsView commits={commits} stats={stats} />}
            {activeView === 'team' && <TeamView currentUser={user} onUserClick={openUserDetails} users={users} />}
            {activeView === 'reminders' && (
              <RemindersView
                reminders={reminders}
                refreshReminders={fetchReminders}
                request={request}
                users={users}
              />
            )}

            <CommitReviewList
              actionId={actionId}
              commits={visibleCommits}
              loading={loading}
              onApprove={handleApprove}
              onReject={handleReject}
              rejectNotes={rejectNotes}
              setActiveEditor={setActiveEditor}
              setRejectNotes={setRejectNotes}
              setStatusFilter={setStatusFilter}
              statusFilter={statusFilter}
              users={users}
            />
          </section>
        </section>
      </section>

      {notificationsOpen && <NotificationsPanel notifications={notifications} onClose={() => setNotificationsOpen(false)} />}
      {settingsOpen && (
        <SettingsOverlay
          request={request}
          setTheme={setTheme}
          setUser={setUser}
          theme={theme}
          user={user}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {selectedUser && (
        <UserDetailsOverlay
          currentUser={user}
          details={selectedUser}
          onClose={() => setSelectedUser(null)}
          onSaved={async (userId) => {
            await fetchUsers();
            await openUserDetails(userId);
          }}
          request={request}
        />
      )}
    </main>
  );
}

function viewTitle(view: ViewKey) {
  return {
    dashboard: 'Dashboard',
    notifications: 'Notificações',
    calendar: 'Calendário',
    analytics: 'Análise',
    team: 'Equipa',
    reminders: 'Lembretes',
  }[view];
}

function viewSubtitle(view: ViewKey) {
  return {
    dashboard: 'Resumo operacional com dados carregados da API.',
    notifications: 'Alterações reais submetidas pelos utilizadores.',
    calendar: 'Calendário construído a partir das datas reais dos commits.',
    analytics: 'Métricas calculadas a partir dos commits reais.',
    team: 'Utilizadores reais registados no sistema.',
    reminders: 'Lembretes persistidos na API.',
  }[view];
}

function Avatar({ user }: { user?: AdminUser | null }) {
  const src = avatarUrl(user);
  const [imageFailed, setImageFailed] = useState(false);
  const [defaultFailed, setDefaultFailed] = useState(false);
  const imageSrc = src && !imageFailed ? src : defaultUserIcon;
  const showImage = Boolean(imageSrc && !defaultFailed);

  useEffect(() => {
    setImageFailed(false);
    setDefaultFailed(false);
  }, [src]);

  return (
    <span className={showImage ? 'avatar has-image' : 'avatar avatar-fallback'}>
      {showImage ? (
        <img
          src={imageSrc}
          alt=""
          onError={() => {
            if (imageSrc === defaultUserIcon) {
              setDefaultFailed(true);
            } else {
              setImageFailed(true);
            }
          }}
        />
      ) : (
        <span aria-hidden="true">{userInitials(user)}</span>
      )}
    </span>
  );
}

function Sidebar({
  activeView,
  commitsCount,
  onLogout,
  onRefresh,
  onSettings,
  setActiveView,
}: {
  activeView: ViewKey;
  commitsCount: number;
  onLogout: () => void;
  onRefresh: () => void;
  onSettings: () => void;
  setActiveView: (view: ViewKey) => void;
}) {
  const items: Array<{ key: ViewKey; label: string; icon: JSX.Element; badge?: number }> = [
    { key: 'dashboard', label: 'Dashboard', icon: <Grid2X2 size={22} />, badge: commitsCount },
    { key: 'notifications', label: 'Notificações', icon: <Bell size={22} /> },
    { key: 'calendar', label: 'Calendário', icon: <CalendarDays size={22} /> },
    { key: 'analytics', label: 'Análise', icon: <BarChart3 size={22} /> },
    { key: 'team', label: 'Equipa', icon: <UsersRound size={22} /> },
    { key: 'reminders', label: 'Lembretes', icon: <ListChecks size={22} /> },
  ];

  return (
    <aside className="donezo-sidebar" aria-label="Menu lateral">
      <a className="donezo-logo" href={LANDING_PAGE_URL}>
        <strong>Europa Explorer</strong>
      </a>

      <nav className="side-nav" aria-label="Navegacao principal">
        <span className="side-label">MENU</span>
        {items.map((item) => (
          <button className={activeView === item.key ? 'side-item active' : 'side-item'} key={item.key} onClick={() => setActiveView(item.key)} type="button">
            {item.icon}
            <span>{item.label}</span>
            {item.badge !== undefined && <b>{item.badge}</b>}
          </button>
        ))}
        <button className="side-item" onClick={onRefresh} type="button">
          <RefreshCw size={22} />
          <span>Atualizar</span>
        </button>
      </nav>

      <nav className="side-nav side-general" aria-label="Menu geral">
        <span className="side-label">GERAL</span>
        <button className="side-item" onClick={onSettings} type="button">
          <Settings size={22} />
          <span>Definições</span>
        </button>
        <button className="side-item" onClick={onLogout} type="button">
          <LogOut size={22} />
          <span>Sair</span>
        </button>
      </nav>
    </aside>
  );
}

function DashboardView({
  chartData,
  currentElapsed,
  notifications,
  onNotificationsOpen,
  onReminderOpen,
  onTrackerAction,
  reminders,
  stats,
  timeTracker,
  users,
}: {
  chartData: ChartPoint[];
  currentElapsed: number;
  notifications: DashboardNotification[];
  onNotificationsOpen: () => void;
  onReminderOpen: () => void;
  onTrackerAction: (action: 'start' | 'resume' | 'pause' | 'stop') => void;
  reminders: Reminder[];
  stats: Stats;
  timeTracker: TimeTrackerState;
  users: AdminUser[];
}) {
  return (
    <>
      <section className="stats-grid" aria-label="Resumo de alterações">
        <StatCard active label="Total de alterações" value={stats.total} />
        <StatCard label="Aprovadas" value={stats.approved} />
        <StatCard label="Pendentes" value={stats.pending} />
        <StatCard label="Rejeitadas" value={stats.rejected} />
      </section>

      <section className="dashboard-grid">
        <AnalyticsCard chartData={chartData} total={stats.total} />
        <ReminderQueueCard onOpen={onReminderOpen} reminders={reminders} />
        <NotificationsCard notifications={notifications} onOpen={onNotificationsOpen} />
        <TeamSummaryCard users={users} />
        <ProgressCard stats={stats} />
        <TimeTracker
          elapsed={currentElapsed}
          onAction={onTrackerAction}
          state={timeTracker.state}
        />
      </section>
    </>
  );
}

function StatCard({ active, label, value }: { active?: boolean; label: string; value: number }) {
  return (
    <article className={active ? 'stat-card active' : 'stat-card'}>
      <div className="stat-title-row">
        <h2>{label}</h2>
        <span className="stat-icon"><BarChart3 size={20} /></span>
      </div>
      <strong>{value}</strong>
      <p>{value === 1 ? '1 registo' : `${value} registos`}</p>
    </article>
  );
}

function AnalyticsCard({ chartData, total }: { chartData: ChartPoint[]; total: number }) {
  return (
    <article className="dash-card analytics-card">
      <h2>Análise de alterações</h2>
      <div className="bar-chart" aria-label="Gráfico de alterações por dia">
        {chartData.map((bar) => (
          <div className="chart-column" key={bar.key}>
            <div className="chart-bar">
              <div className="chart-bar-fill" data-height={bar.height} />
            </div>
            <span>{bar.label}</span>
            <small>{bar.count}</small>
          </div>
        ))}
      </div>
      {total === 0 && <EmptyInline text="Sem alterações recebidas da API." />}
    </article>
  );
}

function ReminderQueueCard({ onOpen, reminders }: { onOpen: () => void; reminders: Reminder[] }) {
  const openReminders = reminders.filter((reminder) => !reminder.completed);
  return (
    <article className="dash-card reminder-card">
      <h2>Lembretes</h2>
      <strong>{openReminders.length}</strong>
      <span>{openReminders.length === 1 ? 'lembrete em aberto' : 'lembretes em aberto'}</span>
      <button className="primary-action" onClick={onOpen} type="button">
        <ListChecks size={21} />
        Abrir fila
      </button>
    </article>
  );
}

function NotificationsCard({ notifications, onOpen }: { notifications: DashboardNotification[]; onOpen: () => void }) {
  return (
    <article className="dash-card project-card notification-menu-card">
      <div className="card-title-row">
        <h2>Menu de Notificações</h2>
        <button onClick={onOpen} type="button">
          <Bell size={16} />
          Abrir
        </button>
      </div>
      <div className="notification-mini-list">
        {notifications.slice(0, 5).map((item) => (
          <button className="mini-notification" key={item.id} onClick={onOpen} type="button">
            <span className="mini-icon"><Bell size={17} /></span>
            <span>
              <strong>{item.message}</strong>
              <small>{item.area} - {formatDate(item.date)}</small>
            </span>
          </button>
        ))}
      </div>
      {notifications.length === 0 && <EmptyInline text="Sem notificações recebidas da API." />}
    </article>
  );
}

function TeamSummaryCard({ users }: { users: AdminUser[] }) {
  return (
    <article className="dash-card team-card">
      <div className="card-title-row">
        <h2>Equipa</h2>
      </div>
      <div className="team-list">
        {users.slice(0, 4).map((item) => (
          <div className="team-row" key={item.id}>
            <Avatar user={item} />
            <div>
              <strong>{item.username}</strong>
              <span>{item.role}</span>
            </div>
            <small className={item.online ? 'completed' : 'pending'}>{item.online ? 'Online' : 'Offline'}</small>
          </div>
        ))}
      </div>
      {users.length === 0 && <EmptyInline text="Sem utilizadores recebidos da API." />}
    </article>
  );
}

function ProgressCard({ stats }: { stats: Stats }) {
  const totalProcessed = stats.approved + stats.rejected;
  const percent = stats.total > 0 ? Math.round((totalProcessed / stats.total) * 100) : 0;
  const offset = 282 - (282 * percent) / 100;

  return (
    <article className="dash-card progress-card">
      <h2>Progresso de revisão</h2>
      <div className="progress-meter" aria-label={`Progresso de revisão ${percent}%`}>
        <svg viewBox="0 0 220 140" role="img">
          <path className="progress-track" d="M38 112 A74 74 0 0 1 182 112" />
          <path className="progress-arc" data-offset={offset} d="M38 112 A74 74 0 0 1 182 112" />
        </svg>
        <div>
          <strong>{percent}%</strong>
          <span>{totalProcessed === 1 ? '1 revisão concluída' : `${totalProcessed} revisões concluídas`}</span>
        </div>
      </div>
      <div className="progress-legend">
        <span><i className="dot complete" />{stats.approved} aprovadas</span>
        <span><i className="dot progress" />{stats.pending} pendentes</span>
        <span><i className="stripe-dot" />{stats.rejected} rejeitadas</span>
      </div>
    </article>
  );
}

function TimeTracker({
  elapsed,
  onAction,
  state,
}: {
  elapsed: number;
  onAction: (action: 'start' | 'resume' | 'pause' | 'stop') => void;
  state: TrackerStateName;
}) {
  const primaryAction = state === 'running' ? 'pause' : state === 'paused' ? 'resume' : 'start';

  return (
    <article className="time-tracker">
      <h2>Time Tracker</h2>
      <strong className="timer-display">{formatDuration(elapsed)}</strong>
      <div className="timer-actions">
        <button aria-label={state === 'running' ? 'Pausar' : 'Iniciar ou retomar'} onClick={() => onAction(primaryAction)} type="button">
          {state === 'running' ? <Pause size={25} fill="currentColor" /> : <Play size={25} fill="currentColor" />}
        </button>
        <button aria-label="Parar" className="stop" onClick={() => onAction('stop')} type="button">
          <Square size={19} fill="currentColor" />
        </button>
      </div>
    </article>
  );
}

function NotificationsView({ commits, notifications }: { commits: Commit[]; notifications: DashboardNotification[] }) {
  return (
    <section className="view-card">
      <div className="card-title-row">
        <h2>Notificações</h2>
      </div>
      <div className="notification-mini-list full">
        {notifications.map((item) => (
          <div className="mini-notification static" key={item.id}>
            <span className="mini-icon"><Bell size={17} /></span>
            <span>
              <strong>{item.message}</strong>
              <small>{item.area} - {formatDate(item.date)}</small>
            </span>
            <StatusPill status={item.status} />
          </div>
        ))}
      </div>
      {commits.length === 0 && <EmptyInline text="Sem notificações recebidas da API." />}
    </section>
  );
}

function AnalyticsView({ commits, stats }: { commits: Commit[]; stats: Stats }) {
  const byUser = useMemo(() => {
    return commits.reduce<Record<string, number>>((acc, commit) => {
      acc[commit.author_name] = (acc[commit.author_name] || 0) + 1;
      return acc;
    }, {});
  }, [commits]);
  const byDay = groupCommitsBy(commits, 'day');
  const byWeek = groupCommitsBy(commits, 'week');
  const byMonth = groupCommitsBy(commits, 'month');
  const processed = stats.approved + stats.rejected;

  return (
    <section className="analysis-grid">
      <MetricList title="Commits por utilizador" data={byUser} />
      <MetricList title="Commits por dia" data={byDay} />
      <MetricList title="Commits por semana" data={byWeek} />
      <MetricList title="Commits por mês" data={byMonth} />
      <article className="view-card">
        <h2>Taxa de revisão</h2>
        <div className="rate-grid">
          <span><strong>{processed ? Math.round((stats.approved / processed) * 100) : 0}%</strong>Aprovação</span>
          <span><strong>{processed ? Math.round((stats.rejected / processed) * 100) : 0}%</strong>Rejeição</span>
        </div>
      </article>
    </section>
  );
}

function MetricList({ data, title }: { data: Record<string, number>; title: string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <article className="view-card">
      <h2>{title}</h2>
      <div className="metric-list">
        {entries.map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
      {entries.length === 0 && <EmptyInline text="Sem dados recebidos da API." />}
    </article>
  );
}

function CalendarView({ commits }: { commits: Commit[] }) {
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));

  const commitsByDay = useMemo(() => groupCommitsBy(commits, 'day'), [commits]);
  const selectedCommits = commits.filter((commit) => dateKey(new Date(commit.created_at)) === selectedDate);
  const visibleDays = useMemo(() => {
    const start = new Date(cursor);
    start.setHours(0, 0, 0, 0);
    if (mode === 'month') {
      start.setDate(1);
      const offset = start.getDay();
      start.setDate(start.getDate() - offset);
      return Array.from({ length: 42 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return day;
      });
    }
    start.setDate(cursor.getDate() - cursor.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [cursor, mode]);

  const shift = (delta: number) => {
    const next = new Date(cursor);
    next.setDate(cursor.getDate() + (mode === 'month' ? delta * 30 : delta * 7));
    setCursor(next);
  };

  return (
    <section className="calendar-layout">
      <article className="view-card">
        <div className="calendar-head">
          <button onClick={() => shift(-1)} type="button"><ChevronLeft size={18} /></button>
          <h2>{formatDateOnly(cursor)}</h2>
          <button onClick={() => shift(1)} type="button"><ChevronRight size={18} /></button>
          <div className="segmented-control">
            <button className={mode === 'month' ? 'active' : ''} onClick={() => setMode('month')} type="button">Mês</button>
            <button className={mode === 'week' ? 'active' : ''} onClick={() => setMode('week')} type="button">Semana</button>
          </div>
        </div>
        <div className="calendar-grid">
          {visibleDays.map((day) => {
            const key = dateKey(day);
            const count = commitsByDay[key] || 0;
            return (
              <button className={selectedDate === key ? 'calendar-day active' : 'calendar-day'} key={key} onClick={() => setSelectedDate(key)} type="button">
                <span>{day.getDate()}</span>
                <strong>{count}</strong>
              </button>
            );
          })}
        </div>
      </article>
      <article className="view-card">
        <h2>Commits do dia</h2>
        <div className="compact-list">
          {selectedCommits.map((commit) => (
            <div key={commit._id}>
              <strong>{commit.message || `${commit.author_name} fez uma alteração!`}</strong>
              <span>{commit.author_name} - {formatDate(commit.created_at)}</span>
            </div>
          ))}
        </div>
        {selectedCommits.length === 0 && <EmptyInline text="Sem commits recebidos para este dia." />}
      </article>
    </section>
  );
}

function TeamView({ currentUser, onUserClick, users }: { currentUser: AdminUser | null; onUserClick: (id: string) => void; users: AdminUser[] }) {
  return (
    <section className="view-card table-card">
      <div className="card-title-row">
        <h2>Equipa</h2>
      </div>
      <div className="team-table">
        <div className="team-table-head">
          <span>Utilizador</span>
          <span>Cargo</span>
          <span>Email</span>
          <span>Tipo</span>
          <span>Última atividade</span>
        </div>
        {users.map((item) => (
          <button className="team-table-row" key={item.id} onClick={() => onUserClick(item.id)} type="button">
            <span className="team-name">
              <Avatar user={item} />
              <i className={item.online ? 'status-dot online' : 'status-dot offline'} />
              <strong>{item.username}</strong>
            </span>
            <span>{item.cargo || 'Não definido'}</span>
            <span>{item.email || 'Não definido'}</span>
            <span>{item.role}</span>
            <span>{formatDate(item.last_activity || item.last_seen)}</span>
          </button>
        ))}
      </div>
      {users.length === 0 && <EmptyInline text="Sem utilizadores recebidos da API." />}
      {currentUser?.role !== 'SUPER_ADMIN' && <EmptyInline text="A edição de utilizadores requer SUPER_ADMIN." />}
    </section>
  );
}

function RemindersView({
  reminders,
  refreshReminders,
  request,
  users,
}: {
  reminders: Reminder[];
  refreshReminders: () => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  users: AdminUser[];
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = reminders.filter((reminder) => {
    const matchesUrgency = !filterUrgency || reminder.urgency === filterUrgency;
    const matchesUser = !filterUser || reminder.assigned_to === filterUser;
    const matchesDate = !filterDate || (reminder.due_at && dateKey(new Date(reminder.due_at)) === filterDate);
    return matchesUrgency && matchesUser && matchesDate;
  });

  const resetForm = () => {
    setTitle('');
    setNotes('');
    setUrgency('');
    setDueAt('');
    setAssignedTo('');
    setEditingId(null);
  };

  const saveReminder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      title,
      notes: notes || null,
      urgency: urgency || null,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      assigned_to: assignedTo || null,
    };
    if (editingId) await request(`/api/reminders/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
    else await request('/api/reminders', { method: 'POST', body: JSON.stringify(payload) });
    resetForm();
    await refreshReminders();
  };

  const editReminder = (reminder: Reminder) => {
    setEditingId(reminder._id);
    setTitle(reminder.title);
    setNotes(reminder.notes || '');
    setUrgency(reminder.urgency || '');
    setAssignedTo(reminder.assigned_to || '');
    setDueAt(reminder.due_at ? reminder.due_at.slice(0, 16) : '');
  };

  return (
    <section className="reminders-layout">
      <article className="view-card">
        <h2>{editingId ? 'Editar lembrete' : 'Criar lembrete'}</h2>
        <form className="settings-form" onSubmit={saveReminder}>
          <label>Título<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
          <label>Urgência<select value={urgency} onChange={(event) => setUrgency(event.target.value)}><option value="">Sem valor</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option></select></label>
          <label>Data<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label>
          <label>Utilizador<select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}><option value="">Sem utilizador</option>{users.map((item) => <option key={item.id} value={item.id}>{item.username}</option>)}</select></label>
          <div className="form-actions">
            <button className="primary-action" type="submit"><Save size={18} />Guardar</button>
            {editingId && <button className="outline-action" onClick={resetForm} type="button">Cancelar</button>}
          </div>
        </form>
      </article>

      <article className="view-card">
        <div className="filters-row">
          <select value={filterUrgency} onChange={(event) => setFilterUrgency(event.target.value)}><option value="">Urgência</option><option value="high">Alta</option><option value="normal">Normal</option><option value="low">Baixa</option></select>
          <select value={filterUser} onChange={(event) => setFilterUser(event.target.value)}><option value="">Utilizador</option>{users.map((item) => <option key={item.id} value={item.id}>{item.username}</option>)}</select>
          <input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} />
        </div>
        <div className="reminder-list">
          {filtered.map((reminder) => (
            <div className={reminder.completed ? 'reminder-row completed' : 'reminder-row'} key={reminder._id}>
              <div>
                <strong>{reminder.title}</strong>
                <span>{reminder.due_at ? formatDate(reminder.due_at) : 'Sem data'} {reminder.urgency ? `- ${urgencyLabels[reminder.urgency] || reminder.urgency}` : ''}</span>
              </div>
              <button onClick={() => request(`/api/reminders/${reminder._id}`, { method: 'PATCH', body: JSON.stringify({ completed: !reminder.completed }) }).then(refreshReminders)} type="button">
                <CheckCircle2 size={17} />
              </button>
              <button onClick={() => editReminder(reminder)} type="button"><Settings size={17} /></button>
              <button onClick={() => request(`/api/reminders/${reminder._id}`, { method: 'DELETE' }).then(refreshReminders)} type="button"><Trash2 size={17} /></button>
            </div>
          ))}
        </div>
        {filtered.length === 0 && <EmptyInline text="Sem lembretes recebidos para estes filtros." />}
      </article>
    </section>
  );
}

function CommitReviewList({
  actionId,
  commits,
  loading,
  onApprove,
  onReject,
  rejectNotes,
  setActiveEditor,
  setRejectNotes,
  setStatusFilter,
  statusFilter,
  users,
}: {
  actionId: string | null;
  commits: Commit[];
  loading: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  rejectNotes: Record<string, string>;
  setActiveEditor: (editor: string | null) => void;
  setRejectNotes: Dispatch<SetStateAction<Record<string, string>>>;
  statusFilter: StatusFilter;
  setStatusFilter: (status: StatusFilter) => void;
  users: AdminUser[];
}) {
  return (
    <section className="review-panel" aria-label="Fila de revisão administrativa">
      <div className="review-head">
        <div>
          <span>ALTERAÇÕES RECENTES</span>
          <h2>Revisão de propostas</h2>
        </div>

        <div className="segmented-control" role="tablist" aria-label="Filtrar por estado">
          {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as StatusFilter[]).map((status) => (
            <button aria-selected={statusFilter === status} className={statusFilter === status ? 'active' : ''} key={status} onClick={() => setStatusFilter(status)} role="tab" type="button">
              {status === 'ALL' ? 'Todos' : statusCopy[status]}
            </button>
          ))}
        </div>
      </div>
      <div className="filters-row">
        <select onChange={(event) => setActiveEditor(event.target.value || null)}>
          <option value="">Todos os utilizadores</option>
          {users.map((item) => <option key={item.id} value={item.username}>{item.username}</option>)}
        </select>
      </div>

      <div className="commit-review-list">
        {commits.map((commit) => (
          <article className="review-item" key={commit._id}>
            <div>
              <h3>{commit.message || `${commit.author_name} fez uma alteração!`}</h3>
              <p>{commit.author_name} - {commit.country_id} - {formatDate(commit.created_at)}</p>
              <ul>{describeDiff(commit.diff ?? {}).map((detail) => <li key={detail}>{detail}</li>)}</ul>
            </div>
            <StatusPill status={commit.status} />

            {commit.status === 'PENDING' && (
              <div className="review-actions">
                <button disabled={actionId === commit._id} onClick={() => onApprove(commit._id)} type="button"><CheckCircle2 size={17} />Aprovar</button>
                <label className="review-note-field">
                  <span>Motivo da decisão</span>
                  <textarea
                    aria-label="Motivo da decisão"
                    onChange={(event) => setRejectNotes((current) => ({ ...current, [commit._id]: event.target.value }))}
                    placeholder="Escreva o motivo antes de aprovar ou rejeitar"
                    rows={2}
                    value={rejectNotes[commit._id] ?? ''}
                  />
                </label>
                <button disabled={actionId === commit._id} onClick={() => onReject(commit._id)} type="button"><XCircle size={17} />Rejeitar</button>
              </div>
            )}
          </article>
        ))}

        {!loading && commits.length === 0 && (
          <div className="review-empty">
            <ShieldCheck size={23} />
            <strong>Sem propostas filtradas</strong>
            <span>Não existem alterações recebidas para este filtro.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function NotificationsPanel({ notifications, onClose }: { notifications: DashboardNotification[]; onClose: () => void }) {
  const grouped = notifications.reduce<Record<string, DashboardNotification[]>>((acc, item) => {
    acc[item.user] = [...(acc[item.user] ?? []), item];
    return acc;
  }, {});

  return (
    <aside className="notifications-panel" aria-label="Painel especial de alterações por utilizador">
      <div className="panel-head">
        <div>
          <span>Menu de Notificações</span>
          <h2>Alterações por utilizador</h2>
        </div>
        <button aria-label="Fechar notificações" onClick={onClose} type="button"><X size={20} /></button>
      </div>

      <div className="panel-list">
        {Object.entries(grouped).map(([name, items]) => (
          <section className="notification-row" key={name}>
            <div className="notification-user">
              <div><img src={defaultUserIcon} alt="" /></div>
              <span><strong>{name}</strong><small>{items.length} {items.length > 1 ? 'alterações' : 'alteração'}</small></span>
            </div>
            {items.map((item) => (
              <article className="notification-change" key={item.id}>
                <div><h3>{item.message}</h3><p>{item.area} - {formatDate(item.date)}</p></div>
                <StatusPill status={item.status} />
                <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
              </article>
            ))}
          </section>
        ))}
        {notifications.length === 0 && <EmptyInline text="Sem alterações recebidas da API." />}
      </div>
    </aside>
  );
}

function SettingsOverlay({
  onClose,
  request,
  setTheme,
  setUser,
  theme,
  user,
}: {
  onClose: () => void;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
  setTheme: (theme: ThemeMode) => void;
  setUser: (user: AdminUser) => void;
  theme: ThemeMode;
  user: AdminUser | null;
}) {
  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    let updated = await request<AdminUser>('/api/admin/me', {
      method: 'PATCH',
      body: JSON.stringify({ username, email, password: password || undefined }),
    });
    if (file) {
      const data = new FormData();
      data.append('file', file);
      updated = await request<AdminUser>('/api/admin/me/avatar', { method: 'POST', body: data });
    }
    localStorage.setItem('admin_user', JSON.stringify(updated));
    setUser(updated);
    onClose();
  };

  return (
    <div className="overlay-shell" role="dialog" aria-modal="true">
      <section className="overlay-card">
        <div className="panel-head">
          <div><span>Definições</span><h2>Perfil</h2></div>
          <button aria-label="Fechar" onClick={onClose} type="button"><X size={20} /></button>
        </div>
        <form className="settings-form" onSubmit={saveProfile}>
          <div className="profile-photo-row">
            <Avatar user={user} />
            <label className="file-button"><Upload size={17} />Foto<input accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" /></label>
          </div>
          <label>Nome<input required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          <div className="theme-toggle">
            <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')} type="button"><Sun size={18} />Claro</button>
            <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')} type="button"><Moon size={18} />Escuro</button>
          </div>
          <button className="primary-action" type="submit"><Save size={18} />Guardar</button>
        </form>
      </section>
    </div>
  );
}

function UserDetailsOverlay({
  currentUser,
  details,
  onClose,
  onSaved,
  request,
}: {
  currentUser: AdminUser | null;
  details: UserDetails;
  onClose: () => void;
  onSaved: (userId: string) => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
}) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(details.user.username);
  const [email, setEmail] = useState(details.user.email || '');
  const [cargo, setCargo] = useState(details.user.cargo || '');
  const [role, setRole] = useState(details.user.role);
  const [password, setPassword] = useState('');

  const saveUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await request<AdminUser>(`/api/admin/users/${details.user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ username, email, cargo, role, password: password || undefined }),
    });
    await onSaved(details.user.id);
    setEditing(false);
  };

  return (
    <div className="overlay-shell" role="dialog" aria-modal="true">
      <section className="overlay-card user-details-card">
        <div className="panel-head">
          <div><span>Equipa</span><h2>{details.user.username}</h2></div>
          <button aria-label="Fechar" onClick={onClose} type="button"><X size={20} /></button>
        </div>
        <div className="profile-photo-row">
          <Avatar user={details.user} />
          <span className={details.user.online ? 'status-label online' : 'status-label offline'}>{details.user.online ? 'Online' : 'Offline'}</span>
        </div>
        {editing ? (
          <form className="settings-form" onSubmit={saveUser}>
            <label>Nome<input required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
            <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Cargo<input value={cargo} onChange={(event) => setCargo(event.target.value)} /></label>
            <label>Tipo<select value={role} onChange={(event) => setRole(event.target.value)}><option value="SUPER_ADMIN">SUPER_ADMIN</option><option value="STANDARD_ADMIN">STANDARD_ADMIN</option></select></label>
            <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <button className="primary-action" type="submit"><Save size={18} />Guardar</button>
          </form>
        ) : (
          <>
            <div className="detail-grid">
              <span><strong>Email</strong>{details.user.email || 'Não definido'}</span>
              <span><strong>Cargo</strong>{details.user.cargo || 'Não definido'}</span>
              <span><strong>Tipo</strong>{details.user.role}</span>
              <span><strong>Última atividade</strong>{formatDate(details.user.last_activity || details.user.last_seen)}</span>
            </div>
            <MetricList title="Permissões" data={details.permissions.reduce<Record<string, number>>((acc, permission) => ({ ...acc, [permission]: 1 }), {})} />
            <div className="compact-list">
              {details.recent_commits.map((commit) => (
                <div key={commit._id}><strong>{commit.message || `${commit.author_name} fez uma alteração!`}</strong><span>{commit.country_id} - {formatDate(commit.created_at)}</span></div>
              ))}
            </div>
            {details.recent_commits.length === 0 && <EmptyInline text="Sem commits recentes recebidos para este utilizador." />}
            {currentUser?.role === 'SUPER_ADMIN' && <button className="primary-action" onClick={() => setEditing(true)} type="button"><Settings size={18} />Editar</button>}
          </>
        )}
      </section>
    </div>
  );
}

function EmptyInline({ text }: { text: string }) {
  return <p className="empty-inline">{text}</p>;
}

function StatusPill({ status }: { status: string }) {
  const normalized = status as CommitStatus;
  const resetStatusCopy: Record<string, string> = {
    PENDING: 'Pendente',
    USED: 'Usado',
    EXPIRED: 'Expirado',
    CANCELLED: 'Cancelado',
    LOCKED: 'Bloqueado',
  };
  const label = statusCopy[normalized] ?? resetStatusCopy[status] ?? status;
  return <span className={`status-pill ${String(status).toLowerCase()}`}>{label}</span>;
}

export default App;
