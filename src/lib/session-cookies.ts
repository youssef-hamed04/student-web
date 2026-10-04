import type { NextResponse } from 'next/server';

import { cookieNames, serverConfig } from './config';

/**
 * Cookie writers for the proxy's session state.
 *
 * Kept in one place so that signing in, refreshing and signing out cannot drift
 * apart on the attributes that decide whether a cookie is usable at all — the
 * `httpOnly` flag, `secure` in production, `sameSite`, and the two lifetimes.
 *
 * The lifetimes mirror the backend: the access cookie outlives its token by a
 * little (12h vs a much shorter JWT), and the refresh cookie matches the
 * backend's refresh-token window (30d).
 */

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_MAX_AGE_S = 60 * 60 * 12;
const REFRESH_MAX_AGE_S = 60 * 60 * 24 * 30;

export function setSessionCookies(response: NextResponse, tokens: SessionTokens): void {
  response.cookies.set(cookieNames.accessToken, tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: serverConfig.secureCookies,
    path: '/',
    maxAge: ACCESS_MAX_AGE_S,
  });

  response.cookies.set(cookieNames.refreshToken, tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: serverConfig.secureCookies,
    path: '/',
    maxAge: REFRESH_MAX_AGE_S,
  });
}

export function clearSessionCookies(response: NextResponse): void {
  for (const name of [cookieNames.accessToken, cookieNames.refreshToken, cookieNames.profile]) {
    response.cookies.set(name, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: serverConfig.secureCookies,
      path: '/',
      maxAge: 0,
    });
  }
}
