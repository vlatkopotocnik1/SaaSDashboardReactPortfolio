import './App.css';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { ThemeProvider, useTheme } from './theme';
import { login as loginApi, logout as logoutApi } from './auth/api';
import { getRefreshToken, getSessionUser, onSessionChange, refreshSession } from './auth/session';
import { UsersPage } from './users/UsersPage';
import { OrganizationsPage } from './organizations/OrganizationsPage';
import { RolesPage } from './roles/RolesPage';
import { BillingPage } from './billing/BillingPage';

type AuthUser = {
  username: string;
  role: 'Admin' | 'User';
};

type AuthContextValue = {
  isAuthed: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(() => getSessionUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const hydrateSession = async () => {
      if (getRefreshToken()) {
        await refreshSession();
        setUser(getSessionUser());
      }
      setIsLoading(false);
    };

    hydrateSession();
  }, []);

  useEffect(() => {
    return onSessionChange(() => setUser(getSessionUser()));
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      isAuthed: Boolean(user),
      isLoading,
      user,
      login: async (username, password) => {
        const nextUser = await loginApi(username, password);
        setUser(nextUser);
      },
      logout: async () => {
        await logoutApi(getRefreshToken());
        setUser(null);
      },
    };
  }, [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/users': 'Users',
  '/organizations': 'Organizations',
  '/roles': 'Roles',
  '/billing': 'Billing',
  '/settings': 'Settings',
  '/login': 'Login',
};

function Breadcrumbs() {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return (
      <div className="breadcrumbs">
        <span>Dashboard</span>
      </div>
    );
  }

  const crumbs = segments.map((segment, index) => {
    const path = `/${segments.slice(0, index + 1).join('/')}`;
    const label = routeLabels[path] ?? segment[0]?.toUpperCase() + segment.slice(1);
    return { path, label };
  });

  return (
    <div className="breadcrumbs">
      <Link to="/">Dashboard</Link>
      {crumbs.map((crumb) => (
        <span key={crumb.path}>
          <span className="breadcrumbs-separator">/</span>
          <Link to={crumb.path}>{crumb.label}</Link>
        </span>
      ))}
    </div>
  );
}

function Sidebar() {
  const { user } = useAuth();
  const items = [
    { to: '/', label: 'Dashboard' },
    { to: '/users', label: 'Users', roles: ['Admin'] },
    { to: '/organizations', label: 'Organizations', roles: ['Admin'] },
    { to: '/roles', label: 'Roles', roles: ['Admin'] },
    { to: '/billing', label: 'Billing' },
    { to: '/settings', label: 'Settings' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">SaaS Dashboard</div>
      <nav className="sidebar-nav">
        {items
          .filter((item) => !item.roles || (user && item.roles.includes(user.role)))
          .map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
      </nav>
    </aside>
  );
}

function Topbar() {
  const { logout } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      navigate('/login');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-title">Overview</div>
      <div className="topbar-actions">
        <button className="ghost-button" type="button" onClick={toggleTheme}>
          {mode === 'light' ? 'Dark mode' : 'Light mode'}
        </button>
        <button className="ghost-button" type="button">
          Notifications
        </button>
        <button className="ghost-button" type="button">
          Profile
        </button>
        <button className="ghost-button" onClick={handleLogout} type="button">
          Logout
        </button>
      </div>
    </header>
  );
}

function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <Topbar />
        <Breadcrumbs />
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function PublicLayout() {
  return (
    <div className="public-layout">
      <div className="public-card">
        <Outlet />
      </div>
    </div>
  );
}

function RequireAuth() {
  const { isAuthed, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <section className="page">
        <p>Loading session…</p>
      </section>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

function RequireRole({ roles }: { roles: AuthUser['role'][] }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function DashboardPage() {
  return (
    <section className="page">
      <h1>Dashboard</h1>
      <p>Quick snapshot of your product, users, and revenue.</p>
    </section>
  );
}

function SettingsPage() {
  return (
    <section className="page">
      <h1>Settings</h1>
      <p>Configure workspace preferences and billing.</p>
    </section>
  );
}

function LoginPage() {
  const { isAuthed, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { from?: { pathname?: string } } | null;
  const fallbackPath = state?.from?.pathname ?? '/';
  const [error, setError] = useState<string | null>(null);

  if (isAuthed) {
    return <Navigate to={fallbackPath} replace />;
  }

  const handleLogin = async (username: string, password: string) => {
    setError(null);
    try {
      await login(username, password);
      navigate(fallbackPath, { replace: true });
    } catch {
      setError('Login failed. Check credentials and try again.');
    }
  };

  return (
    <section className="page">
      <h1>Login</h1>
      <p>Sign in to access your dashboard.</p>
      <form
        className="login-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const username = String(formData.get('username') ?? '');
          const password = String(formData.get('password') ?? '');
          handleLogin(username, password);
        }}
      >
        <label className="login-field">
          <span>Username</span>
          <input name="username" placeholder="admin or user" required />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input name="password" type="password" placeholder="•••••••" required />
        </label>
        <button className="primary-button" type="submit">
          Continue
        </button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}

function NotFoundPage() {
  return (
    <section className="page">
      <h1>Page not found</h1>
      <Link to="/">Go back to Dashboard</Link>
    </section>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route element={<RequireRole roles={['Admin']} />}>
                <Route path="users" element={<UsersPage />} />
                <Route path="organizations" element={<OrganizationsPage />} />
                <Route path="roles" element={<RolesPage />} />
              </Route>
              <Route path="billing" element={<BillingPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route element={<PublicLayout />}>
            <Route path="login" element={<LoginPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
