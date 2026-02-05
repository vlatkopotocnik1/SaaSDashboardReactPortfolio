import './App.css';
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
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

type AuthContextValue = {
  isAuthed: boolean;
  login: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthed, setIsAuthed] = useState(() => localStorage.getItem('demo_auth') === 'true');

  const value = useMemo<AuthContextValue>(() => {
    return {
      isAuthed,
      login: () => {
        localStorage.setItem('demo_auth', 'true');
        setIsAuthed(true);
      },
      logout: () => {
        localStorage.removeItem('demo_auth');
        setIsAuthed(false);
      },
    };
  }, [isAuthed]);

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
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">SaaS Dashboard</div>
      <nav className="sidebar-nav">
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/users">Users</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
    </aside>
  );
}

function Topbar() {
  const { logout } = useAuth();
  const { mode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
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
  const { isAuthed } = useAuth();
  const location = useLocation();

  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location }} />;
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

function UsersPage() {
  return (
    <section className="page">
      <h1>Users</h1>
      <p>Manage team members, roles, and access.</p>
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

  if (isAuthed) {
    return <Navigate to={fallbackPath} replace />;
  }

  const handleLogin = () => {
    login();
    navigate(fallbackPath, { replace: true });
  };

  return (
    <section className="page">
      <h1>Login</h1>
      <p>Sign in to access your dashboard.</p>
      <button className="primary-button" onClick={handleLogin} type="button">
        Continue
      </button>
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
              <Route path="users" element={<UsersPage />} />
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
