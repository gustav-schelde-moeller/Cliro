import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildWhere, SORT_WHITELIST, REGION_BY_KOMMUNEKODE } from "@/lib/cvr/filters";
import { brancheDisplayGroup } from "@/lib/cvr/branche";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const where = buildWhere(Object.fromEntries(params));

  let sort = params.get("sort") || "navn";
  if (!SORT_WHITELIST.has(sort)) sort = "navn";
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  const page = Math.max(1, parseInt(params.get("page") || "1", 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(params.get("pageSize") || "50", 10)));

  const [total, rows] = await Promise.all([
    prisma.cvrCompany.count({ where }),
    prisma.cvrCompany.findMany({
      where,
      include: { lead: true },
      orderBy: [{ [sort]: { sort: dir, nulls: "last" } }],
      take: pageSize,
      skip: (page - 1) * pageSize,
    }),
  ]);

  const enriched = rows.map((row) => ({
    ...row,
    region: row.kommunekode ? REGION_BY_KOMMUNEKODE.get(row.kommunekode) || null : null,
    brancheLabel: row.brancheKode ? brancheDisplayGroup(row.brancheKode, row.brancheTekst).label : null,
  }));

  return Response.json({ rows: enriched, total, page, pageSize });
}
