"use client";

import { useEffect, useState } from "react";

interface UploadResponse {
  asset?: {
    src?: string;
  };
  error?: {
    message?: string;
  };
}

interface Props {
  src: string;
  alt: string;
  onSrcChange: (src: string) => void;
  onAltChange: (alt: string) => void;
  onAspectRatioChange?: (aspectRatio: number | null) => void;
}

const inputClass =
  "w-full border border-cream/30 bg-charcoal px-2 py-1 text-xs text-cream";
const labelClass = "block font-block text-[10px] uppercase text-cream/60";

export function ImageSourceFields({
  src,
  alt,
  onSrcChange,
  onAltChange,
  onAspectRatioChange,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => {
    setPreviewFailed(false);
    if (!src) {
      onAspectRatioChange?.(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const ratio =
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? image.naturalWidth / image.naturalHeight
          : null;
      onAspectRatioChange?.(ratio);
    };
    image.onerror = () => {
      setPreviewFailed(true);
      onAspectRatioChange?.(null);
    };
    image.src = src;
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [onAspectRatioChange, src]);

  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/editor/assets", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as UploadResponse;
      if (!response.ok || !result.asset?.src) {
        throw new Error(result.error?.message ?? "image upload failed");
      }
      onSrcChange(result.asset.src);
      if (!alt.trim()) {
        onAltChange(file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " "));
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "image upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label>
        <span className={labelClass}>Image source</span>
        <input
          type="text"
          value={src}
          onChange={(event) => onSrcChange(event.target.value)}
          placeholder="/map-assets/icon.svg or https://…"
          className={inputClass + " font-mono"}
        />
      </label>

      <label>
        <span className={labelClass}>Upload image</span>
        <input
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.avif,.svg,.gif,image/png,image/jpeg,image/webp,image/avif,image/svg+xml,image/gif"
          disabled={uploading || process.env.NODE_ENV !== "development"}
          onChange={(event) => {
            void uploadFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
          className="block w-full text-xs text-cream/70 file:mr-2 file:border-0 file:bg-cream file:px-2 file:py-1 file:text-charcoal disabled:opacity-50"
        />
        <span className="mt-1 block text-[10px] text-cream/45">
          PNG, JPEG, WebP, AVIF, SVG, or GIF. Maximum 10 MiB.
        </span>
      </label>

      {uploading && <p className="text-xs text-cream/60">Uploading…</p>}
      {uploadError && <p className="text-xs text-red-300">{uploadError}</p>}

      <label>
        <span className={labelClass}>Alt / semantic description</span>
        <input
          type="text"
          value={alt}
          onChange={(event) => onAltChange(event.target.value)}
          className={inputClass}
        />
      </label>

      {src && !previewFailed && (
        <div className="flex min-h-20 items-center justify-center border border-cream/20 bg-black/20 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            onError={() => setPreviewFailed(true)}
            className="max-h-24 max-w-full object-contain"
          />
        </div>
      )}
      {src && previewFailed && (
        <p className="border border-red-500/30 bg-red-950/30 px-2 py-1 text-xs text-red-200">
          The image could not be loaded. HTTPS sources must allow CORS.
        </p>
      )}
    </div>
  );
}
