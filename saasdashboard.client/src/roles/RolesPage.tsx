import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { Button, Input, Modal, Toast } from '../components/ui';
import { createRole, deleteRole, getPermissions, getRoles, updateRole } from './api';
import type { Permission, Role } from './types';

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

export function RolesPage() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [isCreatingRole, setIsCreatingRole] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: getRoles });
  const permissionsQuery = useQuery({ queryKey: ['permissions'], queryFn: getPermissions });

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0 && !isCreatingRole) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId, isCreatingRole]);

  useEffect(() => {
    if (!selectedRole) return;
    setIsCreatingRole(false);
    setRoleName(selectedRole.name);
    setRoleDescription(selectedRole.description);
    setRolePermissions(selectedRole.permissionKeys);
  }, [selectedRole]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    for (const permission of permissions) {
      const [group] = permission.key.split('.');
      const groupKey = group ?? 'general';
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(permission);
    }
    return Object.entries(groups).map(([group, items]) => ({
      group,
      items: items.sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [permissions]);

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: async (role, variables) => {
      await queryClient.refetchQueries({ queryKey: ['roles'] });
      const rolesData = queryClient.getQueryData<Role[]>(['roles']) ?? [];
      const match =
        role?.id ??
        rolesData.find((item) => item.name.trim().toLowerCase() === variables.name.trim().toLowerCase())?.id ??
        null;
      setSelectedRoleId(match);
      setIsCreatingRole(false);
      setIsModalOpen(false);
    },
    onError: (error) => setRoleError(parseError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; description: string; permissionKeys: string[] } }) =>
      updateRole(id, payload),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: ['roles'] });
      setIsModalOpen(false);
    },
    onError: (error) => setRoleError(parseError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSelectedRoleId(null);
      setIsCreatingRole(false);
      setIsModalOpen(false);
    },
    onError: (error) => setRoleError(parseError(error)),
  });

  const togglePermission = (key: string) => {
    setRolePermissions((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  };

  return (
    <section className="page">
      <div className="roles-header">
        <div>
          <h1>Permissions & roles</h1>
          <p>Manage role access with a permissions matrix.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setRoleError(null);
            setToastMessage(null);
            setRoleName('');
            setRoleDescription('');
            setRolePermissions([]);
            setSelectedRoleId(null);
            setIsCreatingRole(true);
            setIsModalOpen(true);
          }}
        >
          New role
        </Button>
      </div>

      {rolesQuery.isError ? (
        <Toast title="Unable to load roles" variant="error">
          <span>{parseError(rolesQuery.error)}</span>
        </Toast>
      ) : null}

      <div className="roles-layout">
        <div className="roles-list">
          {roles.map((role) => (
            <div
              key={role.id}
              className={['role-item-row', role.id === selectedRoleId ? 'role-item-row--active' : '']
                .filter(Boolean)
                .join(' ')}
            >
              <button
                type="button"
                className="role-item"
                onClick={() => {
                  setRoleError(null);
                  setToastMessage(null);
                  setIsCreatingRole(false);
                  setSelectedRoleId(role.id);
                  setIsModalOpen(true);
                }}
              >
                <div className="role-item-title">{role.name}</div>
                <div className="role-item-meta">{role.permissionKeys.length} permissions</div>
              </button>
              <div className="role-item-actions">
                <Button
                  variant="ghost"
                  type="button"
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (deleteMutation.isPending) return;
                    const confirmed = window.confirm(`Delete ${role.name}?`);
                    if (confirmed) {
                      deleteMutation.mutate(role.id);
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
          {roles.length === 0 ? <div className="role-empty">No roles yet.</div> : null}
        </div>

        <div className="roles-detail" />
      </div>
      <Modal
        isOpen={isModalOpen}
        title={selectedRole ? 'Edit role' : 'New role'}
        onClose={() => {
          if (createMutation.isPending || updateMutation.isPending || deleteMutation.isPending) return;
          setIsModalOpen(false);
          setIsCreatingRole(false);
          setRoleError(null);
        }}
      >
        <div className="role-detail-header">
          <div>
            <h2>{selectedRole ? 'Edit role' : 'New role'}</h2>
            <p>{selectedRole ? 'Update permissions and role details.' : 'Define a new role.'}</p>
          </div>
        </div>

        <div className="role-form-inline">
          <Input
            label="Role name"
            value={roleName}
            onChange={(event) => setRoleName(event.target.value)}
            error={roleError === 'Select at least one permission.' ? undefined : roleError ?? undefined}
          />
          <Input
            label="Description"
            value={roleDescription}
            onChange={(event) => setRoleDescription(event.target.value)}
          />
        </div>

        {permissionsQuery.isError ? (
          <Toast title="Unable to load permissions" variant="error">
            <span>{parseError(permissionsQuery.error)}</span>
          </Toast>
        ) : null}

        <div className="permissions-matrix">
          {groupedPermissions.map((group) => (
            <div key={group.group} className="permissions-group">
              <div className="permissions-group-title">{group.group}</div>
              <div className="permissions-grid">
                {group.items.map((permission) => (
                  <label key={permission.key} className="permission-row">
                    <div className="permission-name">
                      {permission.label}
                      <span className="permission-info" title={permission.description}>
                        i
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={rolePermissions.includes(permission.key)}
                      onChange={() => togglePermission(permission.key)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="role-save">
          <Button
            type="button"
            disabled={
              !roleName.trim() ||
              createMutation.isPending ||
              updateMutation.isPending
            }
            onClick={async () => {
              setRoleError(null);
              setToastMessage(null);
              if (rolePermissions.length === 0) {
                setRoleError('Select at least one permission.');
                return;
              }
              const payload = {
                name: roleName.trim(),
                description: roleDescription.trim(),
                permissionKeys: rolePermissions,
              };
              try {
                if (selectedRole) {
                  await updateMutation.mutateAsync({ id: selectedRole.id, payload });
                  setToastMessage('Role updated.');
                  return;
                }
                await createMutation.mutateAsync(payload);
                setToastMessage('Role created.');
              } catch (error) {
                setRoleError(parseError(error));
              }
            }}
          >
            {createMutation.isPending || updateMutation.isPending
              ? 'Saving…'
              : selectedRole
                ? 'Save changes'
                : 'Create role'}
          </Button>
          {roleError ? <span className="form-error">{roleError}</span> : null}
        </div>
      </Modal>
      {toastMessage ? (
        <Toast title="Success" onClose={() => setToastMessage(null)}>
          <span>{toastMessage}</span>
        </Toast>
      ) : null}
    </section>
  );
}
