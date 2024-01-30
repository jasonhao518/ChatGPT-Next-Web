import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { authOptions } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { getQuota, logTransaction } from "../common";
import { Quota } from "@/app/constant";

export async function POST(req: NextRequest) {
  const { fileId, index, folder, folderName, filename, size, contentType } =
    await req.json();
  const upload = await getQuota(req, Quota.Upload);
  const storage = await getQuota(req, Quota.Storage);
  if (upload < size || storage < size) {
    await logTransaction(req, Quota.Upload, false, {
      error: {
        message: "NO_QUOTA",
      },
      fileId,
      index,
      folder,
      folderName,
      filename,
      size,
      contentType,
    });
    return NextResponse.json(
      { error: "NO_QUOTA" },
      {
        status: 401,
      },
    );
  }
  try {
    const client = new S3Client({ region: process.env.AWS_REGION });
    const { url, fields } = await createPresignedPost(client, {
      Bucket: process.env.AWS_BUCKET_NAME!,
      Key: folder + "/" + index + "-" + fileId,
      Conditions: [
        ["content-length-range", 0, size], // up to 20 MB
        ["starts-with", "$Content-Type", contentType],
      ],
      Fields: {
        acl: "public-read",
        "Content-Type": contentType,
      },
      Expires: 600, // Seconds before the presigned post expires. 3600 by default.
    });
    await logTransaction(req, Quota.Upload, true, {
      fileId,
      index,
      folder,
      folderName,
      filename,
      size,
      contentType,
    });
    return Response.json({ url, fields });
  } catch (error: any) {
    await logTransaction(req, Quota.Upload, false, {
      ...error,
      fileId,
      index,
      folder,
      folderName,
      filename,
      size,
      contentType,
    });
    return Response.json({ error: error.message });
  }
}
