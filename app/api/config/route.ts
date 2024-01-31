import { NextRequest, NextResponse } from "next/server";
import { getCustomModels, getServerSideConfig } from "../../config/server";
import { getQuota } from "../common";

const serverConfig = getServerSideConfig();
const customModels = getCustomModels(true);

// Danger! Do not hard code any secret value here!
// 警告！不要在这里写入任何敏感信息！
const DANGER_CONFIG = {
  needCode: serverConfig.needCode,
  hideUserApiKey: serverConfig.hideUserApiKey,
  disableGPT4: serverConfig.disableGPT4,
  hideBalanceQuery: serverConfig.hideBalanceQuery,
  disableFastLink: serverConfig.disableFastLink,
  customModels: customModels,
};

declare global {
  type DangerConfig = typeof DANGER_CONFIG;
}

async function handle(req: NextRequest) {
  const gpt4 = (await getQuota(req)).gpt4;

  return NextResponse.json({
    needCode: serverConfig.needCode,
    hideUserApiKey: serverConfig.hideUserApiKey,
    disableGPT4: gpt4 === 0,
    hideBalanceQuery: serverConfig.hideBalanceQuery,
    disableFastLink: serverConfig.disableFastLink,
    customModels: getCustomModels(gpt4 === 0),
  });
}

export const GET = handle;
export const POST = handle;

export const runtime = "edge";
