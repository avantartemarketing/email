/**
 * The shell, in the kit's own shape (redesign.css §"The shell, 27 Aug 2026").
 *
 * Three moves that only work together: the rail runs the full height of the
 * window and carries the wordmark, so the top-left corner belongs to it; the
 * 44px bar belongs to the WORK AREA and starts where the rail ends, which is
 * what leaves the rail one uninterrupted field; and the bar says where you
 * are, while the screen says its own name once, at full size, below the
 * hairline.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import type { User } from './types';
import type { DataLayer } from './data';
import { getDataLayer } from './data';
import { AppContext } from './ui/AppContext';
import type { AppContextValue } from './ui/AppContext';
import { useAsync } from './ui/useAsync';
import { needsApprovingNow } from './logic/approvals';
import { Skeleton } from './ui/rd';
import Menu from './rd/components/Menu';
import { ReleasesIndex } from './screens/ReleasesIndex';
import { ReleaseDetail } from './screens/ReleaseDetail';
import { PromiseDateOverview } from './screens/PromiseDateOverview';
import { EmailsToWrite } from './screens/EmailsToWrite';
import { MyApprovals } from './screens/MyApprovals';
import { SendDetail } from './screens/SendDetail';

export function AppRoot(): ReactElement {
  const [boot, setBoot] = useState<{ data: DataLayer; user: User; users: User[] } | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    getDataLayer()
      .then(async (data) => {
        const [user, users] = await Promise.all([data.getCurrentUser(), data.listUsers()]);
        setBoot({ data, user, users });
      })
      .catch((err: unknown) => setBootError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (bootError) {
    return (
      <div className="rd-shell rd-page">
        <div className="rd-warnbar rd-failbar">
          <span className="rd-faildot" aria-hidden>
            ●
          </span>
          <div>Failed to start: {bootError}</div>
        </div>
      </div>
    );
  }
  if (!boot) {
    return (
      <div className="rd-shell rd-page">
        <Skeleton rows={8} />
      </div>
    );
  }

  // The single-file artifact build has no server behind it — hash routing
  // keeps navigation working from one static HTML file.
  const Router = import.meta.env.VITE_HASH_ROUTER ? HashRouter : BrowserRouter;
  return (
    <Router>
      <Shell data={boot.data} initialUser={boot.user} users={boot.users} />
    </Router>
  );
}

function Shell({
  data,
  initialUser,
  users,
}: {
  data: DataLayer;
  initialUser: User;
  users: User[];
}): ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [whoOpen, setWhoOpen] = useState(false);
  const [crumb, setCrumb] = useState<string | null>(null);
  /* Bumped by refreshApprovals; the rail's badge is keyed on it. */
  const [queueTick, setQueueTick] = useState(0);
  const [toast, setToast] = useState<{ content: string; error: boolean } | null>(null);

  const showToast = useCallback((content: string, isError = false) => {
    setToast({ content, error: isError });
  }, []);

  /* A toast is read and then gone. Left up, it becomes furniture — and the one
     that says who you are now would still be on screen three screens later. */
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const switchUser = useCallback(
    async (userId: string) => {
      const user = await data.setCurrentUser(userId);
      setCurrentUser(user);
      showToast(`Now working as ${user.name} — phase 2 replaces this with magic-link sign-in`);
    },
    [data, showToast],
  );

  const refreshApprovals = useCallback(() => setQueueTick((n) => n + 1), []);

  const userName = useCallback(
    (userId: string | undefined) => {
      if (!userId) return '—';
      if (userId === 'system') return 'System';
      return users.find((u) => u.id === userId)?.name ?? userId;
    },
    [users],
  );

  const contextValue = useMemo<AppContextValue>(
    () => ({
      data,
      currentUser,
      users,
      isAdmin: currentUser.role === 'admin',
      switchUser,
      showToast,
      userName,
      setCrumb,
      refreshApprovals,
    }),
    [data, currentUser, users, switchUser, showToast, userName, refreshApprovals],
  );

  /* The badge counts what is DUE, not what exists.
     Eleven pending sends, two of which go out this week, is not "11 things to
     do" — it is two, and nine to read about. A badge that counts the inventory
     rather than the work is a badge somebody learns to ignore. */
  const queueCount = useAsync(
    async () =>
      (await data.listApprovalQueue()).filter((i) => needsApprovingNow(i.send)).length,
    [location.pathname, queueTick],
  );

  /* The delay-copy badge, and it summons CRM ONLY.
     Same argument as the count above, one step further out: a badge that
     counts somebody else's work is a badge you learn to ignore, and every
     unwritten delay email is CRM's work by definition. The PAGE stays open to
     everyone — an ops lead should be able to see what is stuck — but the
     summons on the rail belongs to the team that owes it. */
  const copyCount = useAsync(
    async () => (currentUser.team === 'crm' ? (await data.listCopyQueue()).length : 0),
    [location.pathname, queueTick, currentUser.id],
  );

  const onReleases = location.pathname === '/' || location.pathname.startsWith('/releases');
  /* The area the crumb hops back to, named once. It used to be two
     expressions — a label and a path — computed apart, so a fourth rail item
     could be labelled "Emails to write" and still hop to My approvals. */
  const [area, areaPath] = onReleases
    ? ['Releases', '/']
    : location.pathname.startsWith('/overview')
      ? ['Promise date overview', '/overview']
      : location.pathname.startsWith('/copy')
        ? ['Emails to write', '/copy']
        : ['My approvals', '/approvals'];
  const initials = currentUser.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);

  return (
    <AppContext.Provider value={contextValue}>
      <div className="rd-shell rd-app">
        <nav className="rd-rail" id="rd-rail" aria-label="Sections">
          <div className="rd-wordmark">
            <span className="rd-wordmark-badge" aria-hidden>
              AA
            </span>
            Post-purchase
          </div>
          <div className="rd-railnav">
            <NavLink to="/" className={onReleases ? 'rd-navrow on' : 'rd-navrow'}>
              Releases
            </NavLink>
            <NavLink
              to="/overview"
              className={({ isActive }) => (isActive ? 'rd-navrow on' : 'rd-navrow')}
            >
              Promise date overview
            </NavLink>
            <NavLink
              to="/copy"
              className={({ isActive }) => (isActive ? 'rd-navrow on' : 'rd-navrow')}
            >
              Emails to write
              {copyCount.data ? <span className="rd-navcount">{copyCount.data}</span> : null}
            </NavLink>
            <NavLink
              to="/approvals"
              className={({ isActive }) => (isActive ? 'rd-navrow on' : 'rd-navrow')}
            >
              My approvals
              {queueCount.data ? <span className="rd-navcount">{queueCount.data}</span> : null}
            </NavLink>
          </div>
        </nav>

        <div className="rd-work">
          <div className="rd-bar">
            <div className="rd-barpath">
              {crumb ? (
                <>
                  <button
                    type="button"
                    className="rd-barhop"
                    onClick={() => navigate(areaPath)}
                  >
                    {area}
                  </button>
                  <span className="rd-barsep" aria-hidden>
                    ›
                  </span>
                  <span className="rd-barhere">{crumb}</span>
                </>
              ) : (
                <span className="rd-barhere">{area}</span>
              )}
            </div>
            <span style={{ flex: 1 }} />
            <Menu
              chipClass="rd-who"
              chip={
                <>
                  <span className="rd-face" aria-hidden>
                    {initials}
                  </span>
                  {currentUser.name}
                </>
              }
              open={whoOpen}
              setOpen={setWhoOpen}
              heading="Working as"
              items={users.map((u) => ({
                key: u.id,
                label: `${u.id === currentUser.id ? '✓' : '  '}  ${u.name} · ${u.role}`,
                on: u.id === currentUser.id,
              }))}
              onPick={(id) => {
                void switchUser(id);
              }}
            />
          </div>

          <div className="rd-workscroll">
            <Routes>
              <Route path="/" element={<ReleasesIndex />} />
              <Route path="/releases/:releaseId" element={<ReleaseDetail />} />
              <Route path="/overview" element={<PromiseDateOverview />} />
              <Route path="/copy" element={<EmailsToWrite />} />
              <Route path="/approvals" element={<MyApprovals />} />
              <Route path="/sends/:sendId" element={<SendDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>

        {toast ? (
          <div className={toast.error ? 'rd-toast rd-toast-bad' : 'rd-toast'} role="status">
            <span>{toast.content}</span>
            <button
              type="button"
              className="rd-toastx"
              aria-label="Dismiss"
              onClick={() => setToast(null)}
            >
              ×
            </button>
          </div>
        ) : null}
      </div>
    </AppContext.Provider>
  );
}
