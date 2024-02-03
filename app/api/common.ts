import { NextRequest, NextResponse } from "next/server";
import { getCustomModels, getServerSideConfig } from "../config/server";
import { DEFAULT_MODELS, OPENAI_BASE_URL, GEMINI_BASE_URL } from "../constant";
import { collectModelTable } from "../utils/model";
import { makeAzurePath } from "../azure";
import { getToken } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET;

const serverConfig = getServerSideConfig();

export async function getQuota(req: NextRequest): Promise<any> {
  const token = await getToken({ req });
  if (token) {
    try {
      const response = await fetch(process.env.QUOTA_URL! + token.id, {
        method: "GET", // *GET, POST, PUT, DELETE, etc.
        cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
        headers: {
          "Content-Type": "application/json",
          "X-Token": process.env.API_TOKEN!,
          // 'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.json();
    } catch (error) {
      return {};
    }
  } else {
    return {};
  }
}

export async function requestOpenai(req: NextRequest, gpt4: boolean) {
  const controller = new AbortController();

  var authValue,
    authHeaderName = "";
  if (serverConfig.isAzure) {
    authValue =
      req.headers
        .get("Authorization")
        ?.trim()
        .replaceAll("Bearer ", "")
        .trim() ?? "";

    authHeaderName = "api-key";
  } else {
    authValue = req.headers.get("Authorization") ?? "";
    authHeaderName = "Authorization";
  }

  let path = `${req.nextUrl.pathname}${req.nextUrl.search}`.replaceAll(
    "/api/openai/",
    "",
  );

  let baseUrl =
    serverConfig.azureUrl || serverConfig.baseUrl || OPENAI_BASE_URL;

  if (!baseUrl.startsWith("http")) {
    baseUrl = `https://${baseUrl}`;
  }

  if (baseUrl.endsWith("/")) {
    baseUrl = baseUrl.slice(0, -1);
  }

  console.log("[Proxy] ", path);
  console.log("[Base Url]", baseUrl);
  // this fix [Org ID] undefined in server side if not using custom point
  if (serverConfig.openaiOrgId !== undefined) {
    console.log("[Org ID]", serverConfig.openaiOrgId);
  }

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  if (serverConfig.isAzure) {
    if (!serverConfig.azureApiVersion) {
      return NextResponse.json({
        error: true,
        message: `missing AZURE_API_VERSION in server env vars`,
      });
    }
    path = makeAzurePath(path, serverConfig.azureApiVersion);
  }
  const headers = req.headers;
  const fetchUrl = `${baseUrl}/${path}`;
  const token = (await getToken({ req, secret })) as any;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Transaction-Id": headers.get("X-Transaction-Id")!,
      "User-Agent": headers.get("User-Agent")!,
      "X-User": token?.id!,
      "X-Vercel-Ip-Country": headers.get("X-Vercel-IP-Country")!,
      "X-Vercel-Ip-City": headers.get("X-Vercel-IP-City")!,
      "X-Token": process.env.API_TOKEN!,
    },
    method: req.method,
    body: req.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  const customModels = getCustomModels(gpt4);
  // #1815 try to refuse gpt4 request
  if (customModels && req.body) {
    try {
      const modelTable = collectModelTable(DEFAULT_MODELS, customModels);
      const clonedBody = await req.text();
      fetchOptions.body = clonedBody;

      const jsonBody = JSON.parse(clonedBody) as { model?: string };

      // not undefined and is false
      if (modelTable[jsonBody?.model ?? ""].available === false) {
        return NextResponse.json(
          {
            error: true,
            message: `you are not allowed to use ${jsonBody?.model} model`,
          },
          {
            status: 403,
          },
        );
      }
    } catch (e) {
      console.error("[OpenAI] gpt4 filter", e);
    }
  }

  try {
    const res = await fetch(fetchUrl, fetchOptions);

    // to prevent browser prompt for credentials
    const newHeaders = new Headers(res.headers);
    newHeaders.delete("www-authenticate");
    // to disable nginx buffering
    newHeaders.set("X-Accel-Buffering", "no");

    // The latest version of the OpenAI API forced the content-encoding to be "br" in json response
    // So if the streaming is disabled, we need to remove the content-encoding header
    // Because Vercel uses gzip to compress the response, if we don't remove the content-encoding header
    // The browser will try to decode the response with brotli and fail
    newHeaders.delete("content-encoding");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers: newHeaders,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
