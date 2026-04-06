import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function s3Client(): S3Client | null {
  const bucket = process.env.S3_BUCKET?.trim();
  const region = process.env.S3_REGION?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();
  if (!bucket || !region || !accessKeyId || !secretAccessKey) return null;
  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * Upload scan screenshot bytes; returns `s3:${bucket}:${key}` or null if S3 is not configured / upload fails.
 */
export async function uploadScanScreenshot(input: {
  siteId: string;
  scanRunId: string;
  pageId: string;
  buffer: Buffer;
}): Promise<string | null> {
  const bucket = process.env.S3_BUCKET?.trim();
  const client = s3Client();
  if (!client || !bucket) return null;

  const key = `scan/${input.siteId}/${input.scanRunId}/${input.pageId}.jpg`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: input.buffer,
        ContentType: "image/jpeg",
      }),
    );
    return `s3:${bucket}:${key}`;
  } catch (e) {
    console.warn("[S3] screenshot upload failed, falling back to inline storage", e);
    return null;
  }
}
