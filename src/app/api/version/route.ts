// Both Vercel and Railway automatically set their own env var to the git
// commit SHA of the running deployment (different names per platform).
// Polled by UpdateChecker so an already-open tab can detect that a newer
// version has been deployed and prompt for a reload.
export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RAILWAY_GIT_COMMIT_SHA ?? null;
  return Response.json({ commit });
}
