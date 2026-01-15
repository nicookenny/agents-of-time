import { google } from 'googleapis';

export type OAuthService = 'gmail' | 'calendar';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const ALL_SCOPES = [...new Set([...GMAIL_SCOPES, ...CALENDAR_SCOPES])];

export function getScopesForService(service: OAuthService): string[] {
  switch (service) {
    case 'gmail':
      return GMAIL_SCOPES;
    case 'calendar':
      return CALENDAR_SCOPES;
    default:
      return ALL_SCOPES;
  }
}

export function getRedirectUri(service: OAuthService): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  return `${baseUrl}/oauth/${service}`;
}

export function getOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri || process.env.GOOGLE_REDIRECT_URI
  );
}

export function getAuthUrl(service: OAuthService, state?: string) {
  const redirectUri = getRedirectUri(service);
  const oauth2Client = getOAuth2Client(redirectUri);
  const scopes = getScopesForService(service);

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state,
  });
}

export async function getTokensFromCode(code: string, redirectUri?: string) {
  const oauth2Client = getOAuth2Client(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function refreshAccessToken(refreshToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials;
}

export async function getUserInfo(accessToken: string) {
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
  const { data } = await oauth2.userinfo.get();

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    picture: data.picture,
  };
}

export async function revokeToken(token: string) {
  const oauth2Client = getOAuth2Client();
  await oauth2Client.revokeToken(token);
}
