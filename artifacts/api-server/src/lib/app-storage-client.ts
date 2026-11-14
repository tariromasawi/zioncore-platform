import { Storage } from '@google-cloud/storage';
import { IdentityPoolClient } from 'google-auth-library';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

const authClient = new IdentityPoolClient({
  type: 'external_account',
  audience: 'replit',
  subject_token_type: 'access_token',
  token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
  credential_source: {
    url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
    format: {
      type: 'json',
      subject_token_field_name: 'access_token',
    },
  },
  universe_domain: 'googleapis.com',
  scopes: [
    'https://www.googleapis.com/auth/iam',
    'https://www.googleapis.com/auth/cloud-platform',
    'https://www.googleapis.com/auth/devstorage.full_control',
  ],
});

export const objectStorageClient = new Storage({
  authClient,
  projectId: '',
});
