import { NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { results, totalNew, totalClosed } = await syncAll();

    return NextResponse.json({
      ok: true,
      checkedAt: new Date().toISOString(),
      totalNew,
      totalClosed,
      results,
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      error: err.message,
    }, { status: 500 });
  }
}
