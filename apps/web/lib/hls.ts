/**
 * Utilidades de HLS privado.
 *
 * Las playlists se guardan con URIs relativas y `EXT-X-MAP`; antes de
 * entregarlas al navegador hay que firmar cada referencia para que el
 * bucket siga siendo privado.
 */

export type SignUri = (uri: string) => Promise<string | null>;

export async function rewritePlaylist(
  playlist: string,
  sign: SignUri,
): Promise<string> {
  const lines = playlist.split(/\r?\n/);
  const output: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      output.push(line);
      continue;
    }

    if (trimmed.startsWith("#")) {
      output.push(await rewriteTag(line, sign));
      continue;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      output.push(line);
      continue;
    }

    const signed = await sign(trimmed);
    output.push(signed ?? line);
  }

  return output.join("\n");
}

async function rewriteTag(line: string, sign: SignUri): Promise<string> {
  const match = /URI="([^"]+)"/.exec(line);
  if (!match?.[1] || /^https?:\/\//i.test(match[1])) return line;

  const signed = await sign(match[1]);
  if (!signed) return line;

  return line.replace(match[1], signed);
}
