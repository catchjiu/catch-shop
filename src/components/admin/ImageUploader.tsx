"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
}

export function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: form,
        });

        const json = await res.json();

        if (!res.ok || json.error) {
          toast.error(json.error ?? `Upload failed (${res.status}).`);
          return;
        }

        onChange(json.url);
        toast.success("Image uploaded.");
      } catch {
        toast.error("Upload failed. Check your connection.");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5 MB.");
        return;
      }
      upload(file);
    },
    [upload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleClear = () => onChange("");

  return (
    <div className="space-y-2">
      {value ? (
        /* ── Preview ─────────────────────────────────────────────────── */
        <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-slate-800">
          <div className="relative h-48 w-full">
            <Image
              src={value}
              alt="Product image"
              fill
              sizes="(max-width: 672px) 100vw, 672px"
              className="object-contain"
            />
          </div>

          {/* Hover overlay */}
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Replace
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors"
            >
              <X className="h-4 w-4" />
              Remove
            </button>
          </div>
        </div>
      ) : (
        /* ── Drop zone ───────────────────────────────────────────────── */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          disabled={uploading}
          className={[
            "flex h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed transition-colors",
            dragging
              ? "border-white/40 bg-white/5"
              : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5",
            uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer",
          ].join(" ")}
        >
          {uploading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-white/40" />
              <p className="text-sm text-white/40">Uploading…</p>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5">
                <ImageIcon className="h-6 w-6 text-white/30" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white/60">
                  Drop an image here, or{" "}
                  <span className="text-white underline underline-offset-2">browse</span>
                </p>
                <p className="mt-1 text-xs text-white/30">
                  JPEG, PNG, WebP or GIF — max 5 MB
                </p>
              </div>
            </>
          )}
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
