import { NextResponse } from "next/server";
import miniAppConfig from "@/minikit.config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(miniAppConfig);
}
