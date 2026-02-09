import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { ApiError } from '../api/client';
import { Button, Input, Modal, Select, Table, Toast } from '../components/ui';
import { createUser, deleteUser, getUsers, updateUser } from './api';
import type { User, UserRole } from './types';
import { getOrganizations } from '../organizations/api';
import type { Organization } from '../organizations/types';
import { getRoles } from '../roles/api';

const roleOptionsDefault = [{ label: 'All roles', value: 'all' }];

const pageSizeOptions = [
  { label: '10 / page', value: '10' },
  { label: '20 / page', value: '20' },
  { label: '50 / page', value: '50' },
];

const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters.')
  .max(32, 'Username must be at most 32 characters.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use letters, numbers, dots, dashes, or underscores.');

const roleSchema = z.string().min(1, 'Role is required.');
const organizationSchema = z.string().min(1, 'Organization is required.');
const teamSchema = z.string().min(1, 'Team is required.');

const passwordOptionalSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().min(6, 'Password must be at least 6 characters.').max(64, 'Password is too long.').optional(),
);

const createSchema = z.object({
  username: usernameSchema,
  role: roleSchema,
  organizationId: organizationSchema,
  teamId: teamSchema,
  password: z.string().min(6, 'Password must be at least 6 characters.').max(64, 'Password is too long.'),
});

const editSchema = z.object({
  username: usernameSchema,
  role: roleSchema,
  organizationId: organizationSchema,
  teamId: teamSchema,
  password: passwordOptionalSchema,
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues = z.infer<typeof editSchema>;
type UserFormValues = CreateFormValues | EditFormValues;

type UserFormProps = {
  mode: 'create' | 'edit';
  defaultValues: UserFormValues;
  isSaving: boolean;
  formError?: string | null;
  roleOptions: { label: string; value: string }[];
  organizations: Organization[];
  onSubmit: (values: UserFormValues) => void;
};

function UserForm({ mode, defaultValues, isSaving, formError, roleOptions, organizations, onSubmit }: UserFormProps) {
  const schema = mode === 'create' ? createSchema : editSchema;
  const formId = `user-form-${mode}`;
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<UserFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const organizationId = useWatch({ control, name: 'organizationId' });
  const teamId = useWatch({ control, name: 'teamId' });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (!organizationId && organizations.length > 0) {
      setValue('organizationId', organizations[0].id);
    }
  }, [organizationId, organizations, setValue]);

  const teamOptions = useMemo(() => {
    const org = organizations.find((item) => item.id === organizationId);
    if (!org?.teams?.length) return [];
    return org.teams.map((team) => ({ label: team.name, value: team.id }));
  }, [organizationId, organizations]);

  useEffect(() => {
    if (!teamOptions.length) return;
    if (!teamId || !teamOptions.some((option) => option.value === teamId)) {
      setValue('teamId', teamOptions[0].value);
    }
  }, [teamId, teamOptions, setValue]);

  const isBusy = isSubmitting || isSaving;

  return (
    <form id={formId} className="users-form" onSubmit={handleSubmit(onSubmit)}>
      <Input
        label="Username"
        placeholder="jane.doe"
        error={errors.username?.message}
        {...register('username')}
      />
      {formError ? <p className="form-error users-form-error">{formError}</p> : null}
      <Select
        label="Role"
        options={roleOptions.filter((option) => option.value !== 'all')}
        error={errors.role?.message}
        {...register('role')}
      />
      <Select
        label="Organization"
        options={organizations.map((org) => ({ label: org.name, value: org.id }))}
        error={errors.organizationId?.message}
        {...register('organizationId')}
      />
      <Select
        label="Team"
        options={teamOptions}
        error={errors.teamId?.message}
        {...register('teamId')}
      />
      <Input
        label={mode === 'create' ? 'Password' : 'Reset password'}
        helperText={mode === 'create' ? undefined : 'Leave blank to keep current password.'}
        error={errors.password?.message}
        type="password"
        autoComplete="new-password"
        {...register('password')}
      />
      <div className="users-form-actions">
        <Button type="submit" disabled={isBusy}>
          {isBusy ? 'Saving…' : mode === 'create' ? 'Create user' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}

const parseError = (error: unknown) => {
  if (error instanceof ApiError) {
    const message = (error.payload as { message?: string } | undefined)?.message;
    return message ?? `Request failed (${error.status}).`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Something went wrong.';
};

export function UsersPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | string>('all');
  const [organizationFilter, setOrganizationFilter] = useState<'all' | string>('all');
  const [teamFilter, setTeamFilter] = useState<'all' | string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'withTeams'],
    queryFn: () => getOrganizations(true),
  });
  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: getRoles,
  });

  const organizations = organizationsQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const defaultOrganizationId = organizations[0]?.id ?? '';
  const defaultTeamId = organizations[0]?.teams?.[0]?.id ?? '';
  const defaultRoleName = roles[0]?.name ?? 'User';

  const createDefaultValues = useMemo<UserFormValues>(
    () => ({
      username: '',
      role: defaultRoleName,
      organizationId: defaultOrganizationId,
      teamId: defaultTeamId,
      password: '',
    }),
    [defaultOrganizationId, defaultTeamId, defaultRoleName],
  );
  const editDefaultValues = useMemo<UserFormValues | null>(() => {
    if (!editingUser) return null;
    return {
      username: editingUser.username,
      role: editingUser.role,
      organizationId: editingUser.organizationId,
      teamId: editingUser.teamId,
      password: '',
    };
  }, [editingUser]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 400);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, roleFilter, pageSize, organizationFilter, teamFilter]);

  const organizationOptions = useMemo(
    () => [{ label: 'All organizations', value: 'all' }, ...organizations.map((org) => ({ label: org.name, value: org.id }))],
    [organizations],
  );

  const teamOptions = useMemo(() => {
    if (organizationFilter === 'all') {
      const allTeams = organizations.flatMap((org) =>
        org.teams?.map((team) => ({ label: `${org.name} / ${team.name}`, value: team.id })) ?? [],
      );
      return [{ label: 'All teams', value: 'all' }, ...allTeams];
    }

    const org = organizations.find((item) => item.id === organizationFilter);
    const teams = org?.teams?.map((team) => ({ label: team.name, value: team.id })) ?? [];
    return [{ label: 'All teams', value: 'all' }, ...teams];
  }, [organizationFilter, organizations]);

  const roleOptions = useMemo(() => {
    const roleItems = roles.map((role) => ({ label: role.name, value: role.name }));
    return [...roleOptionsDefault, ...roleItems];
  }, [roles]);

  useEffect(() => {
    if (teamFilter === 'all') return;
    if (!teamOptions.some((option) => option.value === teamFilter)) {
      setTeamFilter('all');
    }
  }, [teamFilter, teamOptions]);

  const queryKey = useMemo(
    () => [
      'users',
      {
        page,
        pageSize,
        search,
        role: roleFilter,
        organizationId: organizationFilter,
        teamId: teamFilter,
      },
    ],
    [page, pageSize, search, roleFilter, organizationFilter, teamFilter],
  );

  const usersQuery = useQuery({
    queryKey,
    queryFn: () =>
      getUsers({
        page,
        pageSize,
        search: search || undefined,
        role: roleFilter === 'all' ? undefined : roleFilter,
        organizationId: organizationFilter === 'all' ? undefined : organizationFilter,
        teamId: teamFilter === 'all' ? undefined : teamFilter,
      }),
    placeholderData: (previous) => previous,
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setIsCreateOpen(false);
      setCreateError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: EditFormValues }) => updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setEditingUser(null);
      setUpdateError(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
    onError: (error) => setToastMessage(parseError(error)),
  });

  const totalCount = usersQuery.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    if (!usersQuery.data) return;
    if (safePage !== page) {
      setPage(safePage);
    }
  }, [page, safePage, usersQuery.data]);

  useEffect(() => {
    if (!editingUser) {
      setUpdateError(null);
    }
  }, [editingUser]);

  const listItems = usersQuery.data?.items ?? [];
  const rangeStart = totalCount === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, safePage * pageSize);

  const columns = useMemo(
    () => [
      {
        key: 'username',
        header: 'Username',
        render: (user: User) => user.username,
      },
      {
        key: 'role',
        header: 'Role',
        render: (user: User) => user.role,
      },
      {
        key: 'organization',
        header: 'Organization',
        render: (user: User) => user.organizationName,
      },
      {
        key: 'team',
        header: 'Team',
        render: (user: User) => user.teamName,
      },
      {
        key: 'actions',
        header: '',
        render: (user: User) => (
          <div className="users-row-actions">
            <Button variant="ghost" type="button" onClick={() => setEditingUser(user)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                if (deleteMutation.isPending) return;
                const confirmed = window.confirm(`Delete ${user.username}? This cannot be undone.`);
                if (confirmed) {
                  deleteMutation.mutate(user.id);
                }
              }}
            >
              Delete
            </Button>
          </div>
        ),
      },
    ],
    [deleteMutation],
  );

  return (
    <section className="page">
      <div className="users-header">
        <div>
          <h1>Users</h1>
          <p>Manage team members, roles, and access.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setCreateError(null);
            createMutation.reset();
            setIsCreateOpen(true);
          }}
        >
          New user
        </Button>
      </div>

      <div className="users-filters">
        <Input
          label="Search"
          placeholder="Search by username"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
        <Select
          label="Role"
          value={roleFilter}
          options={roleOptions}
          onChange={(event) => setRoleFilter(event.target.value)}
        />
        <Select
          label="Organization"
          value={organizationFilter}
          options={organizationOptions}
          onChange={(event) => setOrganizationFilter(event.target.value)}
        />
        <Select
          label="Team"
          value={teamFilter}
          options={teamOptions}
          onChange={(event) => setTeamFilter(event.target.value)}
        />
        <Select
          label="Page size"
          value={String(pageSize)}
          options={pageSizeOptions}
          onChange={(event) => setPageSize(Number(event.target.value))}
        />
      </div>

      {usersQuery.isError ? (
        <Toast title="Unable to load users" variant="error" onClose={() => usersQuery.refetch()}>
          <span>{parseError(usersQuery.error)}</span>
        </Toast>
      ) : null}

      <div className="users-summary">
        <span>
          {totalCount === 0 ? 'No users found.' : `Showing ${rangeStart}-${rangeEnd} of ${totalCount}`}
        </span>
        <span>Page {safePage} of {totalPages}</span>
      </div>

      <Table columns={columns} data={listItems} emptyMessage={usersQuery.isLoading ? 'Loading users…' : 'No users'} />

      <div className="users-pagination">
        <Button
          variant="secondary"
          type="button"
          disabled={safePage <= 1 || usersQuery.isLoading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          Previous
        </Button>
        <Button
          variant="secondary"
          type="button"
          disabled={safePage >= totalPages || usersQuery.isLoading}
          onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
        >
          Next
        </Button>
      </div>

      <Modal
        isOpen={isCreateOpen}
        title="Create user"
        onClose={() => {
          if (createMutation.isPending) return;
          setIsCreateOpen(false);
          setCreateError(null);
        }}
      >
        <UserForm
          mode="create"
          isSaving={createMutation.isPending}
          formError={createError}
          defaultValues={createDefaultValues}
          roleOptions={roleOptions}
          organizations={organizations}
          onSubmit={async (values) => {
            setCreateError(null);
            try {
              await createMutation.mutateAsync(values as CreateFormValues);
            } catch (error) {
              setCreateError(parseError(error));
            }
          }}
        />
      </Modal>

      <Modal
        isOpen={Boolean(editingUser)}
        title="Edit user"
        onClose={() => {
          if (updateMutation.isPending) return;
          setEditingUser(null);
          setUpdateError(null);
        }}
      >
        {editingUser ? (
          <UserForm
            mode="edit"
            isSaving={updateMutation.isPending}
            formError={updateError}
            defaultValues={editDefaultValues ?? createDefaultValues}
            roleOptions={roleOptions}
            organizations={organizations}
            onSubmit={async (values) => {
              setUpdateError(null);
              try {
                await updateMutation.mutateAsync({ id: editingUser.id, payload: values as EditFormValues });
              } catch (error) {
                setUpdateError(parseError(error));
              }
            }}
          />
        ) : null}
      </Modal>

      {toastMessage ? (
        <Toast title="Action failed" variant="error" onClose={() => setToastMessage(null)}>
          <span>{toastMessage}</span>
        </Toast>
      ) : null}
    </section>
  );
}
