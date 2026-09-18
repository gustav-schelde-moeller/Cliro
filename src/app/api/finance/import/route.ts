import { auth } from "@/lib/auth";
import { parseSparekassenCsv } from "@/lib/finance/parseSparekassen";
import { mergeTransactions, recordImport } from "@/lib/finance/store";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return Response.json({ error: 'No file uploaded (expected multipart field "file").' }, { status: 400 });
  }

  const text = await file.text();
  const txs = parseSparekassenCsv(text);

  if (txs.length === 0) {
    return Response.json({ error: "No transactions could be parsed from this file." }, { status: 400 });
  }

  const { added, skipped, total } = await mergeTransactions(txs);
  await recordImport({ source: "sparekassen", file: file.name, added, skipped });

  return Response.json({ parsed: txs.length, added, skipped, total });
}
