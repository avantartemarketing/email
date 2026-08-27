import {
  AppProvider,
  Frame,
  Navigation,
  Spinner,
  Toast,
  TopBar,
} from '@shopify/polaris';
import en from '@shopify/polaris/locales/en.json';
import {
  CheckIcon,
  ClipboardChecklistIcon,
  HomeIcon,
  PersonIcon,
} from '@shopify/polaris-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import {
  BrowserRouter,
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import type { User } from './types';
import type { DataLayer } from './data';
import { getDataLayer } from './data';
import { AppContext } from './ui/AppContext';
import type { AppContextValue } from './ui/AppContext';
import { useAsync } from './ui/useAsync';
import { ReleasesIndex } from './screens/ReleasesIndex';
import { ReleaseDetail } from './screens/ReleaseDetail';
import { ApprovalQueue } from './screens/ApprovalQueue';
import { SendDetail } from './screens/SendDetail';

/** Route Polaris `url` props through react-router so navigation stays SPA. */
function AppLink({
  url,
  children,
  external,
  ...rest
}: {
  url: string;
  children?: ReactNode;
  external?: boolean;
  [key: string]: unknown;
}): ReactElement {
  if (external || /^https?:/.test(url)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...rest}>
        {children}
      </a>
    );
  }
  return (
    <RouterLink to={url} {...rest}>
      {children}
    </RouterLink>
  );
}

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
      <AppProvider i18n={en}>
        <div style={{ padding: 40 }}>Failed to start: {bootError}</div>
      </AppProvider>
    );
  }
  if (!boot) {
    return (
      <AppProvider i18n={en}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
          <Spinner accessibilityLabel="Loading" size="large" />
        </div>
      </AppProvider>
    );
  }

  return (
    <BrowserRouter>
      <AppProvider i18n={en} linkComponent={AppLink}>
        <AppFrame data={boot.data} initialUser={boot.user} users={boot.users} />
      </AppProvider>
    </BrowserRouter>
  );
}

function AppFrame({
  data,
  initialUser,
  users,
}: {
  data: DataLayer;
  initialUser: User;
  users: User[];
}): ReactElement {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [toast, setToast] = useState<{ content: string; error: boolean } | null>(null);

  const showToast = useCallback((content: string, isError = false) => {
    setToast({ content, error: isError });
  }, []);

  const switchUser = useCallback(
    async (userId: string) => {
      const user = await data.setCurrentUser(userId);
      setCurrentUser(user);
      setToast({
        content: `Now working as ${user.name} (${user.role}) — phase 2 replaces this with magic-link sign-in`,
        error: false,
      });
    },
    [data],
  );

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
    }),
    [data, currentUser, users, switchUser, showToast, userName],
  );

  // Pending-approval count for the nav badge; refreshed on navigation.
  const queueCount = useAsync(
    async () =>
      (await data.listApprovalQueue()).filter((i) => i.send.status === 'pending_approval').length,
    [location.pathname],
  );

  const topBar = (
    <TopBar
      showNavigationToggle
      onNavigationToggle={() => setNavOpen((open) => !open)}
      userMenu={
        <TopBar.UserMenu
          name={currentUser.name}
          detail={currentUser.role === 'admin' ? 'Admin' : 'Operator'}
          initials={currentUser.name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
          open={userMenuOpen}
          onToggle={() => setUserMenuOpen((open) => !open)}
          actions={[
            {
              items: users.map((user) => ({
                content: `${user.name} — ${user.role}`,
                icon: user.id === currentUser.id ? CheckIcon : PersonIcon,
                onAction: () => {
                  setUserMenuOpen(false);
                  void switchUser(user.id);
                },
              })),
            },
          ]}
        />
      }
    />
  );

  const navigation = (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            url: '/',
            label: 'Releases',
            icon: HomeIcon,
            selected: location.pathname === '/' || location.pathname.startsWith('/releases'),
          },
          {
            url: '/approvals',
            label: 'Approval queue',
            icon: ClipboardChecklistIcon,
            selected: location.pathname.startsWith('/approvals'),
            badge:
              queueCount.data !== null && queueCount.data > 0 ? String(queueCount.data) : undefined,
          },
        ]}
      />
    </Navigation>
  );

  return (
    <AppContext.Provider value={contextValue}>
      <Frame
        topBar={topBar}
        navigation={navigation}
        showMobileNavigation={navOpen}
        onNavigationDismiss={() => setNavOpen(false)}
        logo={{
          topBarSource:
            'data:image/svg+xml;utf8,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="28"><text x="0" y="20" font-family="Helvetica, Arial, sans-serif" font-size="15" font-weight="bold" fill="white">Post-purchase comms</text></svg>',
            ),
          width: 160,
          accessibilityLabel: 'Post-purchase comms',
        }}
      >
        <Routes>
          <Route path="/" element={<ReleasesIndex />} />
          <Route path="/releases/:releaseId" element={<ReleaseDetail />} />
          <Route path="/approvals" element={<ApprovalQueue />} />
          <Route path="/sends/:sendId" element={<SendDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        {toast ? (
          <Toast content={toast.content} error={toast.error} onDismiss={() => setToast(null)} />
        ) : null}
      </Frame>
    </AppContext.Provider>
  );
}
