"use client";


export type UploadProgress = {
  loaded: number;
  total: number;
  partsDone?: number;
  partsTotal?: number;
};

type IntentResponse = {
  assetId: string;
  deduped?: boolean;
  key?: string;
  url?: string;
  multipart?: {
    uploadId: string;
    partSize: number;
    parts: Array<{ partNumber: number; url: string }>;
  };
};

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
}

async function sha256Hex(file: File): Promise<string | undefined> {
  // Para archivos grandes no bloqueamos el navegador: el servidor validará por tamaño.
  if (file.size > 64 * 1024 * 1024) return undefined;
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function uploadFile(
  file: File,
  vaultId: string,
  onProgress: (progress: UploadProgress) => void,
): Promise<{ assetId: string; deduped: boolean }> {
  onProgress({ loaded: 0, total: file.size });

  const sha256 = await sha256Hex(file);

  const intentResponse = await fetch("/api/uploads/intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vaultId,
      fileName: file.name,
      mime: file.type || "application/octet-stream",
      size: file.size,
      sha256,
    }),
  });

  if (!intentResponse.ok) throw new Error(await readError(intentResponse));
  const intent = (await intentResponse.json()) as IntentResponse;

  if (intent.deduped) {
    onProgress({ loaded: file.size, total: file.size });
    return { assetId: intent.assetId, deduped: true };
  }

  const contentType = file.type || "application/octet-stream";

  if (intent.multipart) {
    const { parts, partSize } = intent.multipart;
    const queue = [...parts];
    const completed: Array<{ partNumber: number; etag: string }> = [];
    let loaded = 0;

    const worker = async () => {
      for (;;) {
        const part = queue.shift();
        if (!part) return;

        const start = (part.partNumber - 1) * partSize;
        const end = Math.min(start + partSize, file.size);
        const blob = file.slice(start, end);

        const response = await fetch(part.url, {
          method: "PUT",
          body: blob,
          headers: { "Content-Type": contentType },
        });

        if (!response.ok) {
          throw new Error(`Falló la parte ${part.partNumber} (${response.status})`);
        }

        const etag = response.headers.get("ETag") ?? response.headers.get("etag");
        if (!etag) {
          throw new Error(
            "El almacenamiento no expuso ETag. Revisa la configuración CORS del bucket.",
          );
        }

        completed.push({ partNumber: part.partNumber, etag });
        loaded += blob.size;
        onProgress({
          loaded,
          total: file.size,
          partsDone: completed.length,
          partsTotal: parts.length,
        });
      }
    };

    await Promise.all(Array.from({ length: 3 }, worker));

    const completeResponse = await fetch("/api/uploads/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assetId: intent.assetId, parts: completed }),
    });

    if (!completeResponse.ok) throw new Error(await readError(completeResponse));
    return { assetId: intent.assetId, deduped: false };
  }

  if (!intent.url) throw new Error("El servidor no devolvió una URL de subida.");

  const putResponse = await fetch(intent.url, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": contentType },
  });

  if (!putResponse.ok) throw new Error(`La subida falló (${putResponse.status})`);
  onProgress({ loaded: file.size, total: file.size });

  const completeResponse = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetId: intent.assetId }),
  });

  if (!completeResponse.ok) throw new Error(await readError(completeResponse));

  return { assetId: intent.assetId, deduped: false };
}

export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024;
