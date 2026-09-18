import { auth } from "@/lib/auth";
import { fetchPipeline, fetchProspective, fetchRecurring } from "@/lib/finance/parseSheets";
import { saveLastSheetSync, savePipeline, saveProspective, saveRecurring } from "@/lib/finance/store";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [pipeline, prospective, recurring] = await Promise.all([fetchPipeline(), fetchProspective(), fetchRecurring()]);
    await savePipeline(pipeline);
    await saveProspective(prospective);
    await saveRecurring(recurring);

    const lastSheetSync = new Date().toISOString();
    await saveLastSheetSync(lastSheetSync);

    return Response.json({
      lastSheetSync,
      counts: { pipeline: pipeline.length, prospective: prospective.length, recurring: recurring.length },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Failed to refresh sheets" }, { status: 502 });
  }
}
