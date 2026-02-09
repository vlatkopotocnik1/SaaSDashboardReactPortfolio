import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { Button, Input, Toast } from '../components/ui';
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
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [roleError, setRoleError] = useState<string | null>(null);

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: getRoles });
  const permissionsQuery = useQuery({ queryKey: ['permissions'], queryFn: getPermissions });

  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const selectedRole = roles.find((role) => role.id === selectedRoleId) ?? null;

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

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
    onSuccess: (role) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSelectedRoleId(role.id);
      setIsCreatingRole(false);
    },
    onError: (error) => setRoleError(parseError(error)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { name: string; description: string; permissionKeys: string[] } }) =>
      updateRole(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) => setRoleError(parseError(error)),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSelectedRoleId(null);
      setIsCreatingRole(false);
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
            setRoleName('');
            setRoleDescription('');
            setRolePermissions([]);
            setSelectedRoleId(null);
            setIsCreatingRole(true);
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
            <button
              key={role.id}
              type="button"
              className={['role-item', role.id === selectedRoleId ? 'role-item--active' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                setIsCreatingRole(false);
                setSelectedRoleId(role.id);
              }}
            >
              <div className="role-item-title">{role.name}</div>
              <div className="role-item-meta">{role.permissionKeys.length} permissions</div>
            </button>
          ))}
          {roles.length === 0 ? <div className="role-empty">No roles yet.</div> : null}
        </div>

        <div className="roles-detail">
          {selectedRole || isCreatingRole ? (
            <>
              <div className="role-detail-header">
                <div>
                  <h2>{selectedRole ? 'Edit role' : 'New role'}</h2>
                  <p>{selectedRole ? 'Update permissions and role details.' : 'Define a new role.'}</p>
                </div>
                <div className="role-detail-actions">
                  {selectedRole ? (
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => {
                        const confirmed = window.confirm(`Delete ${selectedRole.name}?`);
                        if (confirmed) {
                          deleteMutation.mutate(selectedRole.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="role-form-inline">
                <Input
                  label="Role name"
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  error={roleError ?? undefined}
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
                  disabled={!roleName.trim() || rolePermissions.length === 0}
                  onClick={() => {
                    setRoleError(null);
                    const payload = {
                      name: roleName.trim(),
                      description: roleDescription.trim(),
                      permissionKeys: rolePermissions,
                    };
                    if (selectedRole) {
                      updateMutation.mutate({ id: selectedRole.id, payload });
                      return;
                    }
                    createMutation.mutate(payload);
                  }}
                >
                  {selectedRole ? 'Save changes' : 'Create role'}
                </Button>
                {roleError ? <span className="form-error">{roleError}</span> : null}
              </div>
            </>
          ) : (
            <div className="role-empty">Select a role to edit permissions.</div>
          )}
        </div>
      </div>
    </section>
  );
}
