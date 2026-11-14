export * from "./constants";
export * from "./schemas";

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function storageKey(
  vaultId: string,
  assetId: string,
  file:
    | "original"
    | "thumb"
    | "preview"
    | "poster"
    | "storyboard"
    | "storyboard_vtt"
    | "master"
    | "segment",
  name?: string,
): string {
  const base = `vaults/${vaultId}/${assetId}`;
  switch (file) {
    case "original":
      return `${base}/original${name ? `-${name}` : ""}`;
    case "thumb":
      return `${base}/thumb.webp`;
    case "preview":
      return `${base}/preview.webp`;
    case "poster":
      return `${base}/poster.webp`;
    case "storyboard":
      return `${base}/storyboard.jpg`;
    case "storyboard_vtt":
      return `${base}/storyboard.vtt`;
    case "master":
      return `${base}/hls/master.m3u8`;
    case "segment":
      return `${base}/hls/${name ?? "segment"}`;
  }
}

export function isTextPreviewable(kind: string): boolean {
  return kind === "text";
}

export function relativeTime(date: Date | string | number, locale = "es"): string {
  const target = typeof date === "string" || typeof date === "number" ? new Date(date) : date;
  const diff = Date.now() - target.getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const table: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["week", 604_800_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
    ["second", 1_000],
  ];
  for (const [unit, ms] of table) {
    if (Math.abs(diff) >= ms) {
      return formatter.format(-Math.round(diff / ms), unit);
    }
  }
  return "ahora";
}
