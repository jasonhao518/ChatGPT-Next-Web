import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { auth } from "@clerk/nextjs";

async function handle(
  req: Request,
  { params }: { params: { path: string } },
) {
  const token = await auth();
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
  const path = token.userId + "-" + params.path;
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
