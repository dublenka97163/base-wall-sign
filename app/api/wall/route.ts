export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchSignatureEvents } from "@/lib/events";
import { buildWallPng } from "@/lib/serverWallRenderer";

const WIDTH = 1024;
const HEIGHT = 1024;

export async function GET() {
  const events = await fetchSignatureEvents(WIDTH, HEIGHT);
  const strokes = events.flatMap((entry) => entry.signature);
  const png = await buildWallPng(strokes, WIDTH, HEIGHT);

  return new NextResponse(png, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=30",
    },
  });
}
