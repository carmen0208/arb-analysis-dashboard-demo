import { NextRequest, NextResponse } from "next/server";
import * as apiClients from "@dex-ai/api-clients";

const API_KEY = process.env.API_KEY;

function getExportBySlug(slugArr: string[]) {
  const result = slugArr.reduce(
    (acc, key) => (acc && acc[key] ? acc[key] : undefined),
    apiClients,
  );
  return typeof result === "function" ? result : null;
}

async function parseArgs(req: NextRequest) {
  if (req.method === "GET") {
    return Object.fromEntries(req.nextUrl.searchParams.entries());
  }
  if (req.method === "POST") {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }
  return {};
}

async function handle(req: NextRequest, params: { slug: string[] }) {
  const apiKey = req.headers.get("x-api-key");
  if (!API_KEY || apiKey !== API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const slugArr = params.slug;
  if (!slugArr || slugArr.length < 2) {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }
  const func = getExportBySlug(slugArr);
  if (!func) {
    return NextResponse.json({ error: "Function not found" }, { status: 404 });
  }
  const args = await parseArgs(req);
  try {
    const result = await func(args);

    return NextResponse.json({ result });
  } catch (e: unknown) {
    console.error("error", { e });
    const errorMessage =
      e instanceof Error ? e.message : "Function execution error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  ctx: { params: { slug: string[] } },
) {
  return handle(req, ctx.params);
}

export async function POST(
  req: NextRequest,
  ctx: { params: { slug: string[] } },
) {
  return handle(req, ctx.params);
}
