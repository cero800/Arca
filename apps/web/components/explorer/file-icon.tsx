import { File, FileText, FileType2, Film, Image as ImageIcon, Music } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileIcon({
  kind,
  className,
}: {
  kind: string;
  className?: string;
}) {
  const Icon =
    kind === "image"
      ? ImageIcon
      : kind === "video"
        ? Film
        : kind === "text"
          ? FileText
          : kind === "pdf"
            ? FileType2
            : kind === "audio"
              ? Music
              : File;

  return <Icon className={cn("h-4 w-4", className)} strokeWidth={1.5} />;
}

const LABELS: Record<string, string> = {
  image: "Imagen",
  video: "Video",
  text: "Texto",
  pdf: "PDF",
  audio: "Audio",
  other: "Archivo",
};

export function kindLabel(kind: string): string {
  return LABELS[kind] ?? "Archivo";
}
