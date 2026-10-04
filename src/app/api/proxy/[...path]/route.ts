import { NextRequest, NextResponse } from 'next/server';

import { asApiError } from '@/lib/errors';
import { isBlockedPath } from '@/lib/proxy-rules';
import {
  currentSessionGeneration,
  isDefinitiveRefreshRejection,
  isRefreshCoolingDown,
  mayApplyRefreshResult,
  noteRefreshFailure,
  singleFlightRefresh,
  type RefreshOutcome,
} from '@/lib/refresh-lock';
import { clearSessionCookies, setSessionCookies } from '@/lib/session-cookies';
import { backendRequest, getAccessToken, getRefreshToken } from '@/lib/session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params, 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxy(request, params, 'DELETE');
}

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, error: { code, message }, code, message }, { status });
}

async function handleProxy(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
) {
  const { path } = await params;
  const pathStr = path.join('/');

  if (pathStr.includes('..')) {
    return jsonError(400, 'INVALID_PATH', 'Invalid path');
  }

  if (isBlockedPath(pathStr)) {
    return jsonError(403, 'PATH_NOT_ALLOWED', 'Path not allowed');
  }

  if (method !== 'GET') {
    const csrfHeader = request.headers.get('x-web-request');
    if (csrfHeader !== '1') {
      return jsonError(403, 'CSRF_PROTECTION', 'CSRF protection');
    }
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return jsonError(401, 'UNAUTHORIZED', 'Not signed in');
  }

  const url = new URL(request.url);
  const queryString = url.searchParams.toString();
  const backendPath = queryString ? `${pathStr}?${queryString}` : pathStr;

  let body: unknown;
  if (method !== 'GET' && method !== 'DELETE') {
    const text = await request.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        return jsonError(400, 'INVALID_JSON', 'Invalid JSON body');
      }
    }
  }

  // --- attempt 1 ------------------------------------------------------------
  try {
    const result = await backendRequest({
      method,
      path: `/${backendPath}`,
      body,
      accessToken,
    });

    return NextResponse.json({ success: true, data: result.data, meta: result.meta });
  } catch (e) {
    const apiErr = asApiError(e);

    if (apiErr.status !== 401) {
      return jsonError(apiErr.status, apiErr.code, apiErr.message);
    }

    // --- refresh ------------------------------------------------------------
    const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return jsonError(401, 'UNAUTHORIZED', 'Not signed in');
    }

    if (isRefreshCoolingDown()) {
      // A refresh failed very recently for a reason unrelated to the token.
      // Retrying now would hammer the failing endpoint; report the original 401
      // instead so the client falls back to sign-in.
      return jsonError(401, apiErr.code, apiErr.message);
    }

    // Captured before the refresh starts. Sign-out and sign-in bump the
    // generation, so a result that arrives afterwards is discarded instead of
    // resurrecting a dead session or overwriting a newer account's tokens.
    const generationAtRefresh = currentSessionGeneration();

    const outcome = await singleFlightRefresh(refreshToken, () =>
      performRefresh(refreshToken)
    );

    if (!outcome.ok) {
      if (isDefinitiveRefreshRejection(outcome)) {
        // The refresh token is gone, expired, revoked or was already rotated by
        // someone else. The session cannot be recovered: drop it so the browser
        // stops presenting dead cookies.
        const response = jsonError(outcome.status || 401, outcome.code, outcome.message);
        clearSessionCookies(response);
        return response;
      }
      // Inconclusive (5xx / 429 / timeout). Keep the session, but stop trying for
      // a cooldown so one broken refresh cannot become a refresh storm.
      noteRefreshFailure();
      return jsonError(401, apiErr.code, apiErr.message);
    }

    // The refresh may have been overtaken: the user signed out or signed in
    // again while it was in flight. Writing these cookies would resurrect a dead
    // session or overwrite a newer account's tokens.
    if (currentSessionGeneration() !== generationAtRefresh) {
      return jsonError(401, 'SESSION_CHANGED', 'Session changed during refresh');
    }

    const currentRefreshToken = await getRefreshToken();
    if (!mayApplyRefreshResult(currentRefreshToken, refreshToken)) {
      return jsonError(401, 'SESSION_CHANGED', 'Session changed during refresh');
    }

    // --- attempt 2: exactly one retry, with the new access token ------------
    // Deliberately not wrapped in another refresh attempt. A retry that itself
    // refreshed would be the infinite 401 → refresh → 401 loop; if the fresh
    // access token is already rejected, the answer is a hard 401.
    try {
      const retryResult = await backendRequest({
        method,
        path: `/${backendPath}`,
        body,
        accessToken: outcome.accessToken,
      });

      const response = NextResponse.json({
        success: true,
        data: retryResult.data,
        meta: retryResult.meta,
      });

      setSessionCookies(response, {
        accessToken: outcome.accessToken,
        refreshToken: outcome.refreshToken,
      });

      return response;
    } catch (retryErr) {
      const retryApiErr = asApiError(retryErr);

      const response = jsonError(retryApiErr.status, retryApiErr.code, retryApiErr.message);

      if (retryApiErr.status === 401) {
        // A brand-new access token was rejected straight away. The session is not
        // recoverable, and continuing to hold cookies would only produce the same
        // 401 on the next request.
        clearSessionCookies(response);
      } else {
        // The refresh itself succeeded, so the rotation happened server-side.
        // Persist it regardless, otherwise the rotated-away refresh token is
        // lost and the next request re-presents a spent one — which is precisely
        // the TOKEN_REUSE condition this whole mechanism exists to avoid.
        setSessionCookies(response, {
          accessToken: outcome.accessToken,
          refreshToken: outcome.refreshToken,
        });
      }

      return response;
    }
  }
}

/**
 * Performs the one refresh permitted for a given refresh token.
 *
 * Isolated so `singleFlightRefresh` has a single, auditable call site, and so
 * the mapping from backend failure to `RefreshOutcome` can be tested without a
 * request context.
 */
async function performRefresh(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const result = await backendRequest<{
      accessToken: string;
      refreshToken: string;
    }>({
      method: 'POST',
      path: '/auth/refresh',
      body: { refreshToken },
    });

    return {
      ok: true,
      accessToken: result.data.accessToken,
      refreshToken: result.data.refreshToken,
    };
  } catch (e) {
    const apiErr = asApiError(e);

    return {
      ok: false,
      status: apiErr.status,
      code: apiErr.code,
      message: apiErr.message,
    };
  }
}
