import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { S3Client } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { NextRequest, NextResponse } from "next/server";
import { Quota } from "@/app/constant";
import { saveFile } from "../common";
import { auth } from "@clerk/nextjs";

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExtensionMap: { [key: string]: string } = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
    // Add more mappings as needed
  };

  const defaultExtension = "unknown";

  const extension = mimeToExtensionMap[mimeType] || defaultExtension;
  return extension;
}

export async function POST(req: NextRequest) {
  const { fileId, index, folder, folderName, filename, size, contentType } =
    await req.json();
  try {
    const token = await auth();
    if (!token) {
      return NextResponse.json(
        { error: "Invalid access" },
        {
          status: 401,
        },
      );
    }
    if (size > 20971520) {
      return NextResponse.json(
        { error: "Fize size limit is 20M" },
        {
          status: 400,
        },
      );
    }
    const bucket = folder
      ? process.env.AWS_BUCKET_NAME!
      : process.env.AWS_IMG_BUCKET_NAME!;
    const region = folder ? process.env.AWS_REGION : process.env.AWS_IMG_REGION;
    const client = new S3Client({ region: region });
    const path = folder
      ? folder + "/" + fileId
      : token.userId + "/" + fileId + "." + getExtensionFromMimeType(contentType);
    const { url, fields } = await createPresignedPost(client, {
      Bucket: bucket,
      Key: path,
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
    await saveFile("file", {
      user: token.userId,
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
    return Response.json({ error: error.message });
  }
}
