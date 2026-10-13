import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET ?? "campuspulse";

export const storageClient = endpoint ? new S3Client({ endpoint, region: process.env.S3_REGION ?? "us-east-1", forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? "", secretAccessKey: process.env.S3_SECRET_KEY ?? "" } }) : null;

export async function createUploadUrl(objectKey: string, contentType: string) {
  if (!storageClient) throw new Error("S3 storage is not configured");
  return getSignedUrl(storageClient, new PutObjectCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }), { expiresIn: 900 });
}

export async function createDownloadUrl(objectKey: string) {
  if (!storageClient) throw new Error("S3 storage is not configured");
  return getSignedUrl(storageClient, new GetObjectCommand({ Bucket: bucket, Key: objectKey }), { expiresIn: 900 });
}

export async function storeObject(key: string, body: Buffer, contentType: string) {
  if (!storageClient) throw new Error("Private object storage is not configured");
  await storageClient.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function readObject(key: string) {
  if (!storageClient) throw new Error("Object storage is not configured");
  const result = await storageClient.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return { bytes: await result.Body?.transformToByteArray(), contentType: result.ContentType };
}

export async function removeObject(key: string) {
  if (!storageClient) return;
  await storageClient.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
