import "server-only";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, isS3Configured } from "./env";

let client: S3Client | null = null;

export function s3(): S3Client {
  if (!isS3Configured()) {
    throw new Error(
      "S3 no está configurado. Define S3_ENDPOINT, S3_KEY y S3_SECRET en .env",
    );
  }
  client ??= new S3Client({
    endpoint: env.s3.endpoint,
    region: env.s3.region,
    forcePathStyle: env.s3.forcePathStyle,
    credentials: {
      accessKeyId: env.s3.key,
      secretAccessKey: env.s3.secret,
    },
    // Backblaze B2 no soporta los checksums nuevos por defecto del SDK v3.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export const bucketName = () => env.s3.bucket;

export async function presignPut(key: string, contentType: string, expiresIn = 900) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucketName(), Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export async function presignGet(key: string, expiresIn = 3600) {
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucketName(), Key: key }), {
    expiresIn,
  });
}

export async function createMultipart(key: string, contentType: string) {
  const out = await s3().send(
    new CreateMultipartUploadCommand({
      Bucket: bucketName(),
      Key: key,
      ContentType: contentType,
    }),
  );
  if (!out.UploadId) throw new Error("B2 no devolvió un UploadId");
  return out.UploadId;
}

export async function presignPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600,
) {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({
      Bucket: bucketName(),
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn },
  );
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: Array<{ partNumber: number; etag: string }>,
) {
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucketName(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
      },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string) {
  await s3().send(
    new AbortMultipartUploadCommand({
      Bucket: bucketName(),
      Key: key,
      UploadId: uploadId,
    }),
  );
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucketName(), Key: key }));
}

/** Borra todos los objetos bajo un prefijo (original, derivados y HLS). */
export async function deletePrefix(prefix: string) {
  let token: string | undefined;
  let deleted = 0;

  do {
    const page = await s3().send(
      new ListObjectsV2Command({
        Bucket: bucketName(),
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );

    const keys = (page.Contents ?? [])
      .map((item) => item.Key)
      .filter((key): key is string => Boolean(key));

    if (keys.length > 0) {
      await s3().send(
        new DeleteObjectsCommand({
          Bucket: bucketName(),
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
      deleted += keys.length;
    }

    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return deleted;
}

export async function headObject(key: string) {
  return s3().send(new HeadObjectCommand({ Bucket: bucketName(), Key: key }));
}

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObjectText(key: string, maxBytes = 1024 * 1024): Promise<string> {
  const out = await s3().send(
    new GetObjectCommand({
      Bucket: bucketName(),
      Key: key,
      Range: `bytes=0-${Math.max(0, maxBytes - 1)}`,
    }),
  );
  if (!out.Body) throw new Error("Objeto vacío");
  const bytes = await out.Body.transformToByteArray();
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, maxBytes));
}
