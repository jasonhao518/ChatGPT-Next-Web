import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { authOptions } from "@/lib/auth";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { Quota } from "@/app/constant";

export async function POST(req: NextRequest) {
  const { fileId, index, folder, folderName, filename, size, contentType } =
    await req.json();
  try {
    if (size > 20971520) {
      return NextResponse.json(
        { error: "Fize size limit is 20M" },
        {
          status: 400,
        },
      );
    }
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
    return Response.json({ url, fields });
  } catch (error: any) {
    return Response.json({ error: error.message });
  }
}
