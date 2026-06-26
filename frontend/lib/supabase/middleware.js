/**
 * Supabase middleware helper.
 * Not used directly — MediData uses its own JWT-based middleware.ts.
 * Kept here for compatibility if Supabase Auth is wired in later.
 */
export async function updateSession(request) {
  // No-op stub. See /middleware.ts for the active route protection logic.
  const { NextResponse } = await import("next/server");
  return NextResponse.next({ request });
}