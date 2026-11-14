"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UploadButton({
  onFiles,
  label = "Subir archivos",
  variant = "primary",
  className,
}: {
  onFiles: (files: File[]) => void;
  label?: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = "";
        }}
      />
      <Button
        variant={variant}
        className={className}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        {label}
      </Button>
    </>
  );
}
