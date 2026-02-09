export type Team = {
  id: string;
  name: string;
  userCount: number;
};

export type TeamSummary = {
  id: string;
  name: string;
};

export type Organization = {
  id: string;
  name: string;
  teamCount: number;
  userCount: number;
  teams?: Team[] | null;
};

export type OrganizationDetail = {
  id: string;
  name: string;
  teams: Team[];
};
