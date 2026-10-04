import { cookies } from 'next/headers';
import { cache } from 'react';

import { serverConfig, cookieNames } from './config';
import { ApiError, asApiError, toApiError } from './errors';

export interface SessionUser {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  status: string;
  avatarUrl?: string | null;
}

interface BackendResponse<T> {
  status: number;
  data: T;
  meta?: Record<string, unknown>;
}

export async function backendRequest<T>(params: {
  method: string;
  path: string;
  body?: unknown;
  accessToken?: string;
  signal?: AbortSignal;
}): Promise<BackendResponse<T>> {
  const { method, path, body, accessToken, signal } = params;

  const headers: Record<string, string> = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (accessToken) headers['authorization'] = `Bearer ${accessToken}`;
  headers['x-client'] = 'web';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), serverConfig.apiTimeoutMs);

  if (signal) {
    signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${serverConfig.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await res.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }
    }

    if (!res.ok) {
      throw toApiError(res.status, parsed);
    }

    const envelope = parsed as { success?: boolean; data?: T } | null;
    const hasEnvelope = envelope !== null && typeof envelope === 'object' && 'data' in envelope;
    const data = (hasEnvelope ? envelope.data : parsed) as T;

    return { status: res.status, data };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw asApiError(e);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(cookieNames.accessToken)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(cookieNames.refreshToken)?.value ?? null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(cookieNames.profile)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessionUser;
  } catch {
    return null;
  }
}

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new ApiError({ code: 'UNAUTHORIZED', status: 401, message: 'Not signed in' });
  }
  return user;
}

export const getSessionUserCached = cache(getSessionUser);
