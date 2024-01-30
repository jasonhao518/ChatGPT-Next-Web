import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getToken } from "next-auth/jwt";
import { NextRequestWithAuth } from "next-auth/middleware";

async function handle(
  req: NextRequestWithAuth,
  { params }: { params: { path: string } },
) {
  const token = await getToken({ req });
  if (!token) {
    return NextResponse.json(
      {
        error: true,
        msg: "Access denied! Please login first ",
      },
      {
        status: 403,
      },
    );
  }
  const path = btoa(token.email!) + "-" + params.path;
  if ("POST" === req.method) {
    console.log("[OpenAI Route] params ", params);
    const body = await req.text();
    const result = await kv.set(path, body);
    return NextResponse.json({ result: result });
  } else {
    const result = await kv.get(path);
    return NextResponse.json({ result: result });
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
