import type { ResearchSession } from '@/lib/celestial-experiment';
import type { Observation } from '@/lib/observations';

export type AccountExportProfile = {
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
  providers: string[];
};

type AccountExportInput = {
  profile: AccountExportProfile;
  accountDeviceObservations: Observation[];
  accountCloudObservations: Observation[] | null;
  accountResearchSessions: ResearchSession[];
  exportedAt: string;
};

export function createAccountExport({
  profile,
  accountDeviceObservations,
  accountCloudObservations,
  accountResearchSessions,
  exportedAt,
}: AccountExportInput) {
  return {
    format: 'zioncore.account-export',
    schemaVersion: 1,
    exportedAt,
    account: {
      email: profile.email,
      displayName: profile.displayName,
      emailVerified: profile.emailVerified,
      providers: [...profile.providers],
    },
    records: {
      accountDeviceObservations,
      accountCloudObservations,
      accountResearchSessions,
    },
    coverage: {
      cloudHistoryIncluded: accountCloudObservations !== null,
      cloudHistoryNote: accountCloudObservations === null
        ? 'Cloud history is not connected or approved in this environment.'
        : null,
      creditsAndMembershipIncluded: false,
      creditsAndMembershipNote: 'No verified credits or membership service is connected in this workspace.',
      rawAudioIncluded: false,
    },
  };
}
