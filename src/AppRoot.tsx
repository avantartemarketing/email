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
import type { AdminArea, User } from './types';
import type { DataLayer } from './data';
import { getDataLayer } from './data';
import { AppContext } from './ui/AppContext';
import type { AppContextValue } from './ui/AppContext';
import { useAsync } from './ui/useAsync';
import { needsApprovingNow, ownerFor } from './logic/approvals';
import { Skeleton } from './ui/rd';
import Menu from './rd/components/Menu';
import { Tour } from './components/Tour';
import { ReleasesIndex } from './screens/ReleasesIndex';
import { ReleaseDetail } from './screens/ReleaseDetail';
import { PromiseDateOverview } from './screens/PromiseDateOverview';
import { ScheduledEmails } from './screens/ScheduledEmails';
import { EmailsToWrite } from './screens/EmailsToWrite';
import { MyApprovals } from './screens/MyApprovals';
import { SlackFeed } from './screens/SlackFeed';
import { SendDetail } from './screens/SendDetail';
import { Permissions } from './screens/Permissions';

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
  /* Live, not boot-frozen: the Permissions screen adds and edits people, and
     the who-switcher and every name lookup read this same list. */
  const [userList, setUserList] = useState(users);
  const [whoOpen, setWhoOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
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
      showToast(`Working as ${user.name}`);
    },
    [data, showToast],
  );

  const refreshApprovals = useCallback(() => setQueueTick((n) => n + 1), []);

  const refreshUsers = useCallback(async () => {
    const next = await data.listUsers();
    setUserList(next);
    /* Access may have changed under the person doing the editing. */
    const me = next.find((u) => u.id === currentUser.id);
    if (me) setCurrentUser(me);
  }, [data, currentUser.id]);

  const userName = useCallback(
    (userId: string | undefined) => {
      if (!userId) return '—';
      if (userId === 'system') return 'System';
      return userList.find((u) => u.id === userId)?.name ?? userId;
    },
    [userList],
  );

  const contextValue = useMemo<AppContextValue>(
    () => ({
      data,
      currentUser,
      users: userList,
      isAdmin: currentUser.role === 'admin',
      switchUser,
      showToast,
      userName,
      refreshUsers,
      setCrumb,
      refreshApprovals,
    }),
    [data, currentUser, userList, switchUser, showToast, userName, refreshUsers, refreshApprovals],
  );

  /* The badge counts what is DUE, not what exists.
     Eleven pending sends, two of which go out this week, is not "11 things to
     do" — it is two, and nine to read about. A badge that counts the inventory
     rather than the work is a badge somebody learns to ignore. */
  const queueCount = useAsync(
    async () =>
      /* YOUR list under the stage handover — the PM's sends before dispatch,
         the warehouse's from Preparing for dispatch. The page still shows
         everything with its Owner column; the summons is personal. */
      (await data.listApprovalQueue()).filter(
        (i) => needsApprovingNow(i.send) && ownerFor(i.release, i.send) === currentUser.id,
      ).length,
    [location.pathname, queueTick, currentUser.id],
  );

  /* The delay-copy badge, and it summons CRM ONLY.
     Same argument as the count above, one step further out: a badge that
     counts somebody else's work is a badge you learn to ignore, and every
     unwritten delay email is CRM's work by definition. The PAGE stays open to
     everyone — an ops lead should be able to see what is stuck — but the
     summons on the rail belongs to the team that owes it. */
  const copyCount = useAsync(
    async () => {
      if (currentUser.team !== 'crm') return 0;
      /* Both halves of CRM's setup debt: delay emails to write, and releases
         still owing images — image-picking used to have no summons at all,
         which is how a release sat on "6 emails have no image" for weeks. */
      const jobs = (await data.listCopyQueue()).length;
      const owing = (await data.listReleases()).filter((r) => r.imagesOwed > 0).length;
      return jobs + owing;
    },
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
      : location.pathname.startsWith('/scheduled')
        ? ['Scheduled emails', '/scheduled']
        : location.pathname.startsWith('/copy')
          ? ['Emails to write', '/copy']
          : location.pathname.startsWith('/slack')
            ? ['Slack notifications', '/slack']
            : location.pathname.startsWith('/permissions')
              ? ['Permissions', '/permissions']
              : ['My approvals', '/approvals'];
  const can = (a: AdminArea) => currentUser.access.includes(a);
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
            {/* Two groups, the owner's shape (9 Sep 2026): Releases holds the
                two overviews and opens the index itself; Actions holds the
                two worklists and opens approvals itself. A group head is a
                destination AND a heading, so it wears its own class — a child
                row is the only thing that carries `.on`, which is also what
                keeps the naming check honest. What a person cannot open, the
                rail does not show: `user.access`, set on Permissions. */}
            {can('releases') ? (
              <>
                <NavLink to="/" className="rd-navhead">
                  Releases
                </NavLink>
                <NavLink
                  to="/overview"
                  className={({ isActive }) =>
                    isActive ? 'rd-navrow rd-navsub on' : 'rd-navrow rd-navsub'
                  }
                >
                  Promise date overview
                </NavLink>
                <NavLink
                  to="/scheduled"
                  className={({ isActive }) =>
                    isActive ? 'rd-navrow rd-navsub on' : 'rd-navrow rd-navsub'
                  }
                >
                  Scheduled emails
                </NavLink>
              </>
            ) : null}
            {can('approvals') || can('copy') ? (
              <>
                <NavLink
                  to="/approvals"
                  className="rd-navhead"
                >
                  Actions
                </NavLink>
                {can('approvals') ? (
                  <NavLink
                    to="/approvals"
                    className={({ isActive }) =>
                      isActive ? 'rd-navrow rd-navsub on' : 'rd-navrow rd-navsub'
                    }
                  >
                    My approvals
                    {queueCount.data ? (
                      <span className="rd-navcount">{queueCount.data}</span>
                    ) : null}
                  </NavLink>
                ) : null}
                {can('copy') ? (
                  <NavLink
                    to="/copy"
                    className={({ isActive }) =>
                      isActive ? 'rd-navrow rd-navsub on' : 'rd-navrow rd-navsub'
                    }
                  >
                    Emails to write
                    {copyCount.data ? <span className="rd-navcount">{copyCount.data}</span> : null}
                  </NavLink>
                ) : null}
              </>
            ) : null}
            {can('slack') ? (
              <NavLink
                to="/slack"
                className={({ isActive }) => (isActive ? 'rd-navrow on' : 'rd-navrow')}
              >
                Slack notifications
              </NavLink>
            ) : null}
            {can('permissions') ? (
              <NavLink
                to="/permissions"
                className={({ isActive }) => (isActive ? 'rd-navrow on' : 'rd-navrow')}
              >
                Permissions
              </NavLink>
            ) : null}
            {/* The guide, where a new starter's eye lands first. It drives the
                real app, so it can never say something the product no longer
                does — see Tour.tsx. */}
            <button type="button" className="rd-navrow" onClick={() => setTourOpen(true)}>
              Tour
            </button>
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
                label: `${u.name} · ${u.role}`,
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
              <Route path="/scheduled" element={<ScheduledEmails />} />
              <Route path="/permissions" element={<Permissions />} />
              <Route path="/copy" element={<EmailsToWrite />} />
              <Route path="/approvals" element={<MyApprovals />} />
              <Route path="/slack" element={<SlackFeed />} />
              <Route path="/sends/:sendId" element={<SendDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>

        <Tour open={tourOpen} onClose={() => setTourOpen(false)} />

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
