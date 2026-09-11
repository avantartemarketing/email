import { useId, useState } from 'react';
import type { ReactElement } from 'react';
import type { AdminArea, Role, Team, User } from '../types';
import { useApp } from '../ui/AppContext';
import { Bar, Btn, Cap, Dialog, Page, Pill, RowAct } from '../ui/rd';
import { DataTable } from '../ui/DataTable';
import type { Column } from '../ui/DataTable';
import Field from '../rd/components/Field';
import { SelectField } from '../rd/components/Picker';

/**
 * Who can open which part of the admin. The owner, 9 Sep 2026: "create a
 * permissions tab where you add users and define passwords and access to
 * different parts of the admin."
 *
 * Access decides what a person's RAIL shows (the shell reads `user.access`);
 * what a role may DO is unchanged — approving still needs `admin`. The
 * password is accepted and never stored or shown: phase 2's auth server
 * keeps a hash, and `hasPassword` is the only thing a screen ever sees.
 */

/** Every area, in the rail's own order, with the rail's own names. */
const AREAS: { area: AdminArea; label: string }[] = [
  { area: 'releases', label: 'Releases' },
  { area: 'approvals', label: 'My approvals' },
  { area: 'copy', label: 'Emails to write' },
  { area: 'slack', label: 'Slack notifications' },
  { area: 'permissions', label: 'Permissions' },
];

const DEFAULT_ACCESS: AdminArea[] = ['releases', 'approvals', 'copy', 'slack'];

export function Permissions(): ReactElement {
  const { currentUser, users, refreshUsers, showToast } = useApp();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  if (!currentUser.access.includes('permissions')) {
    return (
      <Page title="Permissions">
        <Bar tone="fail" title="No access." />
      </Page>
    );
  }

  const columns: Column<User>[] = [
    {
      id: 'name',
      title: 'Name',
      locked: true,
      kind: 'text',
      value: (u) => u.name,
      cell: (u) => (
        <span className="rd-cellflex">
          <span className="rd-ink">{u.name}</span>
          {u.id === currentUser.id ? (
            <Pill tone="blue" small>
              You
            </Pill>
          ) : null}
        </span>
      ),
    },
    {
      id: 'email',
      title: 'Email',
      kind: 'text',
      value: (u) => u.email,
      cell: (u) => <Cap>{u.email}</Cap>,
    },
    {
      id: 'team',
      title: 'Team',
      kind: 'choice',
      caption: 'TEAM',
      value: (u) => (u.team === 'crm' ? 'CRM' : 'Ops'),
      cell: (u) => (u.team === 'crm' ? 'CRM' : 'Ops'),
    },
    {
      id: 'role',
      title: 'Role',
      kind: 'choice',
      caption: 'ROLE',
      order: ['Admin', 'Operator'],
      value: (u) => (u.role === 'admin' ? 'Admin' : 'Operator'),
      cell: (u) => (u.role === 'admin' ? <span className="rd-ink">Admin</span> : 'Operator'),
    },
    {
      id: 'access',
      title: 'Access',
      kind: 'choice',
      caption: 'ACCESS',
      value: (u) =>
        u.access.length === AREAS.length ? 'All areas' : `${u.access.length} of ${AREAS.length}`,
      cell: (u) =>
        u.access.length === AREAS.length ? 'All areas' : `${u.access.length} of ${AREAS.length}`,
    },
    {
      id: 'password',
      title: 'Password',
      kind: 'choice',
      caption: 'PASSWORD',
      value: (u) => (u.hasPassword ? 'Set' : 'None'),
      cell: (u) =>
        u.hasPassword ? (
          'Set'
        ) : (
          <Pill tone="amber" small>
            None
          </Pill>
        ),
    },
    {
      id: 'actions',
      title: '',
      locked: true,
      cell: (u) => (
        <div className="rd-rowacts">
          <RowAct onClick={() => setEditing(u)}>Edit</RowAct>
        </div>
      ),
    },
  ];

  return (
    <Page
      title="Permissions"
      actions={
        <Btn kind="pri" onClick={() => setAdding(true)}>
          Add user
        </Btn>
      }
    >
      <DataTable
        table="permissions-users"
        noun="user"
        searchPlaceholder="Search people"
        columns={columns}
        rows={users}
        rowKey={(u) => u.id}
        empty="Nobody yet."
      />

      <AddUserDialog
        open={adding}
        onClose={() => setAdding(false)}
        onSaved={async (name) => {
          await refreshUsers();
          showToast(`${name} added`);
          setAdding(false);
        }}
      />
      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSaved={async (name) => {
          await refreshUsers();
          showToast(`${name} updated`);
          setEditing(null);
        }}
      />
    </Page>
  );
}

function AddUserDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (name: string) => Promise<void>;
}): ReactElement {
  const { data, showToast } = useApp();
  const pwId = useId();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('operator');
  const [team, setTeam] = useState<Team>('ops');
  const [access, setAccess] = useState<AdminArea[]>(DEFAULT_ACCESS);
  const [saving, setSaving] = useState(false);

  const reset = (): void => {
    setName('');
    setEmail('');
    setPassword('');
    setRole('operator');
    setTeam('ops');
    setAccess(DEFAULT_ACCESS);
  };

  const why = !name.trim()
    ? 'No name.'
    : !email.trim()
      ? 'No email.'
      : !password
        ? 'No password.'
        : access.length === 0
          ? 'No area picked.'
          : undefined;

  const save = async (): Promise<void> => {
    setSaving(true);
    try {
      await data.createUser({ name, email, password, role, team, access });
      const saved = name.trim();
      reset();
      await onSaved(saved);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  const close = (): void => {
    reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add user"
      primary={{
        label: 'Add',
        onClick: () => void save(),
        disabled: saving || why !== undefined,
        why,
      }}
      secondary={{ label: 'Cancel', onClick: close }}
    >
      <div className="rd-fields">
        <div className="rd-fieldrow">
          <Field label="Name" value={name} onChange={setName} />
          <Field label="Email" value={email} onChange={setEmail} />
        </div>
        <Field label="Password" value={password} controlId={pwId}>
          <input
            id={pwId}
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <div className="rd-fieldrow">
          <SelectField
            label="Role"
            value={role}
            options={[
              { label: 'Operator', value: 'operator' },
              { label: 'Admin', value: 'admin' },
            ]}
            onChange={(v) => setRole(v as Role)}
          />
          <SelectField
            label="Team"
            value={team}
            options={[
              { label: 'Ops', value: 'ops' },
              { label: 'CRM', value: 'crm' },
            ]}
            onChange={(v) => setTeam(v as Team)}
          />
        </div>
      </div>
      <div className="rd-grouphd">Access</div>
      <div className="rd-fields">
        <AccessSwitches access={access} onChange={setAccess} />
      </div>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSaved,
}: {
  user: User | null;
  onClose: () => void;
  onSaved: (name: string) => Promise<void>;
}): ReactElement {
  const { data, showToast } = useApp();
  const pwId = useId();
  const [access, setAccess] = useState<AdminArea[]>([]);
  const [role, setRole] = useState<Role>('operator');
  const [password, setPassword] = useState('');
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  /* Prime the form when a different user opens — during render rather than
     in an effect, so the first paint already shows their real state. */
  if (user && openFor !== user.id) {
    setOpenFor(user.id);
    setAccess(user.access);
    setRole(user.role);
    setPassword('');
  }
  if (!user && openFor !== null) setOpenFor(null);

  const save = async (): Promise<void> => {
    if (!user) return;
    setSaving(true);
    try {
      await data.updateUserAccess(user.id, access, role);
      if (password) await data.setUserPassword(user.id, password);
      await onSaved(user.name);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err), true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={user !== null}
      onClose={onClose}
      title={user ? user.name : ''}
      primary={{
        label: 'Save',
        onClick: () => void save(),
        disabled: saving || access.length === 0,
        why: access.length === 0 ? 'No area picked.' : undefined,
      }}
      secondary={{ label: 'Cancel', onClick: onClose }}
    >
      <div className="rd-fields">
        <SelectField
          label="Role"
          value={role}
          options={[
            { label: 'Operator', value: 'operator' },
            { label: 'Admin', value: 'admin' },
          ]}
          onChange={(v) => setRole(v as Role)}
        />
        <Field
          label="New password"
          value={password}
          controlId={pwId}
        >
          <input
            id={pwId}
            type="password"
            value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </div>
      <div className="rd-grouphd">Access</div>
      <div className="rd-fields">
        <AccessSwitches access={access} onChange={setAccess} />
      </div>
    </Dialog>
  );
}

/** One switch per area, in the rail's order — the same control the release
    setup wears for milestones, because it is the same question: on or off,
    per named thing. */
function AccessSwitches({
  access,
  onChange,
}: {
  access: AdminArea[];
  onChange: (next: AdminArea[]) => void;
}): ReactElement {
  return (
    <>
      {AREAS.map(({ area, label }) => {
        const on = access.includes(area);
        return (
          <button
            key={area}
            type="button"
            role="switch"
            aria-checked={on}
            className={on ? 'rd-sw on' : 'rd-sw'}
            onClick={() => onChange(on ? access.filter((a) => a !== area) : [...access, area])}
          >
            <span className="rd-swlab">
              {label}
            </span>
            <span className="rd-swt" aria-hidden>
              <span className="rd-swk" />
            </span>
          </button>
        );
      })}
    </>
  );
}
