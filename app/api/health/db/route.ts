import { connection } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  await connection();
  try {
    const [row] = await prisma.$queryRaw<{ now: Date; version: string }[]>`
      SELECT now() AS now, version() AS version
    `;
    return Response.json({ ok: true, ...row });
  } catch (error) {
    console.error("Database health check failed", error);
    return Response.json({ ok: false }, { status: 503 });
  }
}
