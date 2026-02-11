import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import { Button, Input, Modal, Select, Table, Toast } from '../components/ui';
import { createOrganization, createTeam, deleteOrganization, deleteTeam, getOrganizations, updateOrganization, updateTeam } from './api';
import type { Organization, Team } from './types';
import { getUsers } from '../users/api';
import type { User } from '../users/types';

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

type OrgModalState = { mode: 'create' } | { mode: 'edit'; organization: Organization };
type TeamModalState = { mode: 'create' } | { mode: 'edit'; team: Team };

export function OrganizationsPage() {
  const queryClient = useQueryClient();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [memberSearchInput, setMemberSearchInput] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [memberPageSize, setMemberPageSize] = useState(10);
  const [orgModal, setOrgModal] = useState<OrgModalState | null>(null);
  const [teamModal, setTeamModal] = useState<TeamModalState | null>(null);
  const [orgName, setOrgName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [orgError, setOrgError] = useState<string | null>(null);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [orgToast, setOrgToast] = useState<string | null>(null);

  const organizationsQuery = useQuery({
    queryKey: ['organizations', 'withTeams'],
    queryFn: () => getOrganizations(true),
  });

  const organizations = organizationsQuery.data ?? [];
  const selectedOrg = organizations.find((org) => org.id === selectedOrgId) ?? null;
  const teams = selectedOrg?.teams ?? [];
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;

  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  useEffect(() => {
    if (!selectedOrg) {
      setSelectedTeamId(null);
      return;
    }
    if (!selectedTeamId || !teams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(teams[0]?.id ?? null);
    }
  }, [selectedOrg, selectedTeamId, teams]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setMemberSearch(memberSearchInput.trim());
    }, 400);
    return () => window.clearTimeout(handle);
  }, [memberSearchInput]);

  useEffect(() => {
    setMemberPage(1);
  }, [selectedTeamId, memberSearch, memberPageSize]);

  const usersQuery = useQuery({
    queryKey: ['users', 'team', selectedTeamId, memberSearch, memberPage, memberPageSize],
    queryFn: () =>
      getUsers({
        page: memberPage,
        pageSize: memberPageSize,
        search: memberSearch || undefined,
        teamId: selectedTeamId ?? undefined,
      }),
    enabled: Boolean(selectedTeamId),
    placeholderData: (previous) => previous,
  });

  const createOrgMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setOrgModal(null);
    },
    onError: (error) => setOrgError(parseError(error)),
  });

  const updateOrgMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateOrganization(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setOrgModal(null);
    },
    onError: (error) => setOrgError(parseError(error)),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: deleteOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setSelectedOrgId(null);
    },
    onError: (error) => {
      const message = parseError(error);
      setOrgError(message);
      setOrgToast(message);
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: ({ organizationId, name }: { organizationId: string; name: string }) =>
      createTeam(organizationId, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setTeamModal(null);
    },
    onError: (error) => setTeamError(parseError(error)),
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateTeam(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setTeamModal(null);
    },
    onError: (error) => setTeamError(parseError(error)),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      setSelectedTeamId(null);
    },
    onError: (error) => setTeamError(parseError(error)),
  });

  const userColumns = useMemo(
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
    ],
    [],
  );

  const memberTotalCount = usersQuery.data?.totalCount ?? 0;
  const memberTotalPages = Math.max(1, Math.ceil(memberTotalCount / memberPageSize));
  const memberSafePage = Math.min(memberPage, memberTotalPages);
  const memberRangeStart = memberTotalCount === 0 ? 0 : (memberSafePage - 1) * memberPageSize + 1;
  const memberRangeEnd = Math.min(memberTotalCount, memberSafePage * memberPageSize);

  useEffect(() => {
    if (!usersQuery.data) return;
    if (memberSafePage !== memberPage) {
      setMemberPage(memberSafePage);
    }
  }, [memberPage, memberSafePage, usersQuery.data]);

  return (
    <section className="page">
      <div className="organizations-header">
        <div>
          <h1>Organizations & teams</h1>
          <p>Organizacije i timovi with nested team membership.</p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setOrgError(null);
            setOrgName('');
            setOrgModal({ mode: 'create' });
          }}
        >
          New organization
        </Button>
      </div>

      {organizationsQuery.isError ? (
        <Toast title="Unable to load organizations" variant="error">
          <span>{parseError(organizationsQuery.error)}</span>
        </Toast>
      ) : null}
      {orgToast ? (
        <Toast title="Action failed" variant="error" onClose={() => setOrgToast(null)}>
          <span>{orgToast}</span>
        </Toast>
      ) : null}

      <div className="organizations-layout">
        <div className="organizations-list">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              className={['org-item', org.id === selectedOrgId ? 'org-item--active' : '']
                .filter(Boolean)
                .join(' ')}
              onClick={() => setSelectedOrgId(org.id)}
            >
              <div className="org-item-title">{org.name}</div>
              <div className="org-item-meta">
                {org.teamCount} teams · {org.userCount} users
              </div>
            </button>
          ))}
          {organizations.length === 0 ? <div className="org-empty">No organizations yet.</div> : null}
        </div>

        <div className="organizations-detail">
          {selectedOrg ? (
            <>
              <div className="org-detail-header">
                <div>
                  <h2>{selectedOrg.name}</h2>
                  <p>{selectedOrg.teamCount} teams · {selectedOrg.userCount} users</p>
                </div>
                <div className="org-detail-actions">
                  <Button
                    variant="secondary"
                    type="button"
                    onClick={() => {
                      setOrgError(null);
                      setOrgName(selectedOrg.name);
                      setOrgModal({ mode: 'edit', organization: selectedOrg });
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      const confirmed = window.confirm(`Delete ${selectedOrg.name}?`);
                      if (confirmed) {
                        deleteOrgMutation.mutate(selectedOrg.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="org-teams-header">
                <h3>Teams</h3>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => {
                    setTeamError(null);
                    setTeamName('');
                    setTeamModal({ mode: 'create' });
                  }}
                >
                  New team
                </Button>
              </div>

              <div className="org-teams">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className={['team-item', team.id === selectedTeamId ? 'team-item--active' : '']
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <button type="button" onClick={() => setSelectedTeamId(team.id)}>
                      <div className="team-item-title">{team.name}</div>
                      <div className="team-item-meta">{team.userCount} users</div>
                    </button>
                    <div className="team-item-actions">
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          setTeamError(null);
                          setTeamName(team.name);
                          setTeamModal({ mode: 'edit', team });
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        type="button"
                        onClick={() => {
                          const confirmed = window.confirm(`Delete ${team.name}?`);
                          if (confirmed) {
                            deleteTeamMutation.mutate(team.id);
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {teams.length === 0 ? <div className="org-empty">No teams yet.</div> : null}
              </div>

              <div className="org-users">
                <div className="org-users-header">
                  <h3>{selectedTeam ? `${selectedTeam.name} members` : 'Team members'}</h3>
                </div>
                <div className="org-users-controls">
                  <Input
                    label="Search"
                    placeholder="Search by username"
                    value={memberSearchInput}
                    onChange={(event) => setMemberSearchInput(event.target.value)}
                  />
                  <Select
                    label="Page size"
                    value={String(memberPageSize)}
                    options={[
                      { label: '10 / page', value: '10' },
                      { label: '20 / page', value: '20' },
                      { label: '50 / page', value: '50' },
                    ]}
                    onChange={(event) => setMemberPageSize(Number(event.target.value))}
                  />
                </div>
                <div className="org-users-summary">
                  <span>
                    {memberTotalCount === 0
                      ? 'No users found.'
                      : `Showing ${memberRangeStart}-${memberRangeEnd} of ${memberTotalCount}`}
                  </span>
                  <span>Page {memberSafePage} of {memberTotalPages}</span>
                </div>
                <Table
                  columns={userColumns}
                  data={usersQuery.data?.items ?? []}
                  emptyMessage={selectedTeam ? 'No users assigned to this team.' : 'Select a team.'}
                />
                <div className="org-users-pagination">
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={memberSafePage <= 1 || usersQuery.isLoading}
                    onClick={() => setMemberPage((current) => Math.max(1, current - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={memberSafePage >= memberTotalPages || usersQuery.isLoading}
                    onClick={() => setMemberPage((current) => Math.min(memberTotalPages, current + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="org-empty">Select an organization to see details.</div>
          )}
        </div>
      </div>

      <Modal
        isOpen={Boolean(orgModal)}
        title={orgModal?.mode === 'edit' ? 'Rename organization' : 'New organization'}
        onClose={() => {
          setOrgModal(null);
          setOrgError(null);
        }}
      >
        <div className="org-form">
          <Input
            label="Organization name"
            value={orgName}
            onChange={(event) => setOrgName(event.target.value)}
            error={orgError ?? undefined}
          />
          <div className="org-form-actions">
            <Button
              type="button"
              disabled={!orgName.trim()}
              onClick={() => {
                setOrgError(null);
                if (orgModal?.mode === 'edit') {
                  updateOrgMutation.mutate({ id: orgModal.organization.id, name: orgName.trim() });
                } else {
                  createOrgMutation.mutate({ name: orgName.trim() });
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(teamModal)}
        title={teamModal?.mode === 'edit' ? 'Edit team' : 'New team'}
        onClose={() => {
          setTeamModal(null);
          setTeamError(null);
        }}
      >
        <div className="org-form">
          <Input
            label="Team name"
            value={teamName}
            onChange={(event) => setTeamName(event.target.value)}
            error={teamError ?? undefined}
          />
          <div className="org-form-actions">
            <Button
              type="button"
              disabled={!teamName.trim() || !selectedOrg}
              onClick={() => {
                setTeamError(null);
                if (!selectedOrg) return;
                if (teamModal?.mode === 'edit') {
                  updateTeamMutation.mutate({ id: teamModal.team.id, name: teamName.trim() });
                } else {
                  createTeamMutation.mutate({ organizationId: selectedOrg.id, name: teamName.trim() });
                }
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
