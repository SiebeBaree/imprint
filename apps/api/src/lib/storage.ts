import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { Storage } from "./dependencies";

export function createStorage(config: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
}): Storage {
    const client = new S3Client({
        region: "auto",
        forcePathStyle: true,
        // Presigned browser uploads do not have a body when signed, so the SDK must not checksum an empty body.
        requestChecksumCalculation: "WHEN_REQUIRED",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
    const base = (key: string) => ({ Bucket: config.bucket, Key: key });
    return {
        uploadUrl: (key, contentType, size) =>
            getSignedUrl(
                client,
                new PutObjectCommand({ ...base(key), ContentType: contentType, ContentLength: size }),
                { expiresIn: 600 },
            ),
        readUrl: (key, filename) =>
            getSignedUrl(
                client,
                new GetObjectCommand({
                    ...base(key),
                    ...(filename
                        ? {
                              ResponseContentDisposition: `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
                          }
                        : {}),
                }),
                { expiresIn: 3600 },
            ),
        async read(key) {
            const result = await client.send(new GetObjectCommand(base(key)));
            if (!result.Body) throw new Error("Object is empty");
            return result.Body.transformToByteArray();
        },
        async put(key, bytes, contentType) {
            await client.send(new PutObjectCommand({ ...base(key), Body: bytes, ContentType: contentType }));
        },
        async remove(key) {
            await client.send(new DeleteObjectCommand(base(key)));
        },
        async head(key) {
            const result = await client.send(new HeadObjectCommand(base(key)));
            return { size: result.ContentLength ?? 0, contentType: result.ContentType ?? "" };
        },
    };
}
