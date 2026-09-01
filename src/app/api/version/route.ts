// Vercel automatically sets this to the git commit SHA of the running
// deployment. Polled by UpdateChecker so an already-open tab can detect
// that a newer version has been deployed and prompt for a reload.
export async function GET() {
  return Response.json({ commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null });
}
