import { NextRequest, NextResponse } from 'next/server';

import { ApiError, asApiError, httpStatusFor } from '@/lib/errors';
import { bumpSessionGeneration, resetRefreshState } from '@/lib/refresh-lock';
import { setDeviceIdCookie, setSessionCookies } from '@/lib/session-cookies';
import { backendRequest } from '@/lib/session';
import { resolveDeviceIdentity } from '@/lib/web-device';
import { serverConfig, cookieNames } from '@/lib/config';

const STUDENT_ONLY_MESSAGE =
  'This site is for student accounts only. Staff accounts sign in to the staff dashboard.';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identity = await resolveDeviceIdentity(request);
    const result = await backendRequest<{
      user: { id: string; fullName: string; phone: string; role: string; status: string; avatarUrl?: string | null };
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    }>({
      method: 'POST',
      path: '/auth/register',
      body,
      deviceId: identity.deviceId,
      device: identity.device,
    });

    const { user, accessToken, refreshToken } = result.data;

    if (user.role !== 'STUDENT') {
      throw new ApiError({
        code: 'INSUFFICIENT_ROLE',
        status: 403,
        message: STUDENT_ONLY_MESSAGE,
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new ApiError({
        code: 'ACCOUNT_DISABLED',
        status: 403,
        message: 'This account is not active.',
      });
    }

    const response = NextResponse.json({ success: true, data: { user } });

    bumpSessionGeneration();
    resetRefreshState();

    setSessionCookies(response, { accessToken, refreshToken });

    // Persisted on the response that bound it, so the next sign-in presents the
    // same device instead of registering a new one and — on a one-device
    // account — parking the student in PENDING_APPROVAL.
    if (identity.isNew) setDeviceIdCookie(response, identity.deviceId);

    response.cookies.set(
      cookieNames.profile,
      JSON.stringify({
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl ?? null,
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: serverConfig.secureCookies,
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    return response;
  } catch (e) {
    const apiErr = asApiError(e);
    return NextResponse.json(
      {
        success: false,
        error: { code: apiErr.code, message: apiErr.message, fields: apiErr.errors },
        statusCode: apiErr.status,
        code: apiErr.code,
        message: apiErr.message,
        errors: apiErr.errors,
      },
      { status: httpStatusFor(apiErr) }
    );
  }
}

