import { NextRequest, NextResponse } from "next/server";
import { getCustomModels, getServerSideConfig } from "../config/server";
import {
  DEFAULT_MODELS,
  OPENAI_BASE_URL,
  GEMINI_BASE_URL,
  Quota,
} from "../constant";
import { collectModelTable } from "../utils/model";
import { makeAzurePath } from "../azure";
import { getToken } from "next-auth/jwt";
import { kv } from "@vercel/kv";
import { Kafka } from "@upstash/kafka";

const kafka = new Kafka({
  url: process.env.KAFKA_URL!,
  username: process.env.KAFKA_USERNAME!,
  password: process.env.KAFKA_PASSWORD!,
});

const p = kafka.producer();

const serverConfig = getServerSideConfig();

export async function getQuota(req: NextRequest, type: string) {
  const token = await getToken({ req });
  if (token) {
    const result = await kv.get<number>(btoa(token.email!) + ":" + type);
    if (result == null) {
      return 0;
    } else {
      return result;
    }
  } else {
    return 0;
  }
}

export async function logTransaction(
  req: NextRequest,
  type: string,
  success: boolean,
  data: any,
) {
  const token = await getToken({ req });
  const transactionId = req.headers.get("x-transaction-id");
  if (token) {
    console.log(btoa(token.email!));
    // const result = await kv.decrby(btoa(token.email!)+":"+type, amount)
    // Objects will get serialized using "JSON.stringify"
    const message = {
      ...data,
      user: token.email,
      date: new Date().toISOString(),
      type,
      success,
      transactionId,
    };
    const res = await p.produce("transactions", message);
  }
}

export async function requestOpenai(req: NextRequest) {
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

  const fetchUrl = `${baseUrl}/${path}`;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      [authHeaderName]: authValue,
      ...(serverConfig.openaiOrgId && {
        "OpenAI-Organization": serverConfig.openaiOrgId,
      }),
    },
    method: req.method,
    body: req.body,
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  const gpt4 = await getQuota(req, Quota.GPT4);
  const customModels = getCustomModels(gpt4 === 0);
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

export async function requestLangchain(
  req: NextRequest,
  apiKey: string | undefined,
) {
  const controller = new AbortController();

  const timeoutId = setTimeout(
    () => {
      controller.abort();
    },
    10 * 60 * 1000,
  );

  const fetchUrl = process.env.LANGCHAIN_URL!;
  const folder = req.headers.get("Folder");
  const file = req.headers.get("File");
  const clonedBody = await req.text();
  const jsonBody = JSON.parse(clonedBody);

  const question = jsonBody.messages[jsonBody.messages.length - 1].content;
  console.log("apiKey:" + apiKey);
  const model = "gpt-3.5-turbo-16k";
  const temperature = jsonBody.temperature;
  const fetchOptions: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Token": process.env.API_TOKEN!,
    },
    method: req.method,
    body: JSON.stringify({
      input: question,
      config: {
        configurable: {
          model_name: model,
          openai_api_key: apiKey,
          temperature: temperature,
          search_kwargs: file
            ? { expr: `folder == '${folder}' and file == '${file}'` }
            : { expr: `folder == '${folder}'` },
        },
      },
    }),
    // to fix #2485: https://stackoverflow.com/questions/55920957/cloudflare-worker-typeerror-one-time-use-body
    redirect: "manual",
    // @ts-ignore
    duplex: "half",
    signal: controller.signal,
  };

  const gpt4 = await getQuota(req, Quota.GPT4);
  const customModels = getCustomModels(gpt4 === 0);
  // #1815 try to refuse gpt4 request
  if (customModels && req.body) {
    try {
      const modelTable = collectModelTable(DEFAULT_MODELS, customModels);

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
