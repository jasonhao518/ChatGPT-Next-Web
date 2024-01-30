import { type OpenAIListModelResponse } from "@/app/client/platforms/openai";
import { getServerSideConfig } from "@/app/config/server";
import { ModelProvider, OpenaiPath, Quota } from "@/app/constant";
import { prettyObject } from "@/app/utils/format";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../auth";
import {
  getQuota,
  logTransaction,
  requestLangchain,
  requestOpenai,
} from "../../common";

const ALLOWD_PATH = new Set(Object.values(OpenaiPath));

function getModels(remoteModelRes: OpenAIListModelResponse) {
  const config = getServerSideConfig();

  if (config.disableGPT4) {
    remoteModelRes.data = remoteModelRes.data.filter(
      (m) => !m.id.startsWith("gpt-4"),
    );
  }

  return remoteModelRes;
}

async function handle(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  console.log("[OpenAI Route] params ", params);

  if (req.method === "OPTIONS") {
    return NextResponse.json({ body: "OK" }, { status: 200 });
  }

  const subpath = params.path.join("/");

  if (!ALLOWD_PATH.has(subpath)) {
    console.log("[OpenAI Route] forbidden path ", subpath);
    await logTransaction(req, Quota.OpenAI, false, {
      error: {
        message: "FORBIDDEN_PATH",
      },
      subpath,
    });
    return NextResponse.json(
      {
        error: true,
        msg: "you are not allowed to request " + subpath,
      },
      {
        status: 403,
      },
    );
  }

  const quota = await getQuota(req, Quota.OpenAI);
  if (quota <= 0) {
    await logTransaction(req, Quota.OpenAI, false, {
      error: {
        message: "NO_QUOTA",
      },
      quota,
    });
  }
  const authResult = auth(req, ModelProvider.GPT);
  if (authResult.error) {
    await logTransaction(req, Quota.OpenAI, false, {
      error: {
        message: "AUTH_ERROR",
      },
      subpath,
    });
    return NextResponse.json(authResult, {
      status: 401,
    });
  }
  const system = authResult.system;
  // when folder is provided, query using langchain instead
  const folder = req.headers.get("Folder");
  const length = parseInt(req.headers.get("Content-Length")!) - 370;
  // handle langchain
  try {
    const response = folder
      ? await requestLangchain(req, authResult.key)
      : await requestOpenai(req);

    // list models
    if (subpath === OpenaiPath.ListModelPath && response.status === 200) {
      const resJson = (await response.json()) as OpenAIListModelResponse;
      const availableModels = getModels(resJson);
      return NextResponse.json(availableModels, {
        status: response.status,
      });
    }
    const model = response.headers.get("openai-model");
    await logTransaction(req, Quota.OpenAI, true, {
      model,
      subpath,
      folder,
      quota,
      length,
      system,
    });
    return response;
  } catch (error: any) {
    console.error("[OpenAI] ", error);
    await logTransaction(req, Quota.OpenAI, false, {
      ...error,
      subpath,
      folder,
      quota,
      length,
      system,
    });
    return NextResponse.json(prettyObject(error));
  }
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
export const preferredRegion = [
  "arn1",
  "bom1",
  "cdg1",
  "cle1",
  "cpt1",
  "dub1",
  "fra1",
  "gru1",
  "hnd1",
  "iad1",
  "icn1",
  "kix1",
  "lhr1",
  "pdx1",
  "sfo1",
  "sin1",
  "syd1",
];
