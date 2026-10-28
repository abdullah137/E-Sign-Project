"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, RotateCcw, ShieldCheck, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { apiFetch } from "@/lib/client";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/cn";

interface UploadResponse {
  id: string;
  redirect: string;
}

export function UploadDropzone({ maxUploadMb }: { maxUploadMb: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const acceptFile = (candidate: File) => {
    setError(null);
    if (!candidate.name.toLowerCase().endsWith(".pdf") && candidate.type !== "application/pdf") {
      setError("Choose a PDF file. Other file types are not supported.");
      return;
    }
    if (candidate.size === 0) {
      setError("That file is empty. Choose a different PDF.");
      return;
    }
    if (candidate.size > maxUploadMb * 1024 * 1024) {
      setError(
        `This file is ${formatBytes(candidate.size)}. The limit is ${maxUploadMb} MB per document.`,
      );
      return;
    }
    setFile(candidate);
    if (!titleTouched) {
      setTitle(
        candidate.name
          .replace(/\.pdf$/i, "")
          .replace(/[_-]+/g, " ")
          .trim()
          .slice(0, 160),
      );
    }
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const upload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      if (title.trim()) form.append("title", title.trim());
      const result = await apiFetch<UploadResponse>("/api/documents", {
        method: "POST",
        body: form,
      });
      router.push(result.redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The upload failed. Please try again.");
      setUploading(false);
    }
  };

  return (
    <div className="rounded-card border border-hairline bg-surface p-5 sm:p-7">
      {!file ? (
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center rounded-md border border-dashed px-6 py-14 text-center transition-colors sm:py-20",
            dragging
              ? "border-gold bg-warning-bg/40"
              : "border-hairline-strong bg-surface-subtle/40 hover:border-[rgba(18,20,23,0.22)]",
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-slate ring-1 ring-hairline">
            <UploadCloud className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
          </div>
          <p className="mt-4 font-serif text-[24px] leading-8 text-ink">Drop a PDF here</p>
          <p className="mt-1.5 text-[13px] text-slate">or choose a file from your computer</p>
          <Button variant="secondary" className="mt-5" onClick={() => inputRef.current?.click()}>
            Browse files
          </Button>
          <p className="mt-4 text-[11.5px] uppercase tracking-overline text-slate">
            PDF only · up to {maxUploadMb} MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) acceptFile(selected);
              event.target.value = "";
            }}
          />
        </div>
      ) : (
        <div>
          <div className="flex flex-col gap-4 rounded-md border border-hairline bg-surface-subtle/50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-hairline bg-surface text-slate">
                <FileText className="h-5 w-5" strokeWidth={1.6} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-ink">{file.name}</p>
                <p className="mt-0.5 text-[12px] text-slate">{formatBytes(file.size)} · PDF</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFile(null);
                setError(null);
              }}
              disabled={uploading}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Replace
            </Button>
          </div>

          <div className="mt-5">
            <Label htmlFor="document-title" required>
              Document title
            </Label>
            <Input
              id="document-title"
              value={title}
              maxLength={160}
              onChange={(event) => {
                setTitleTouched(true);
                setTitle(event.target.value);
              }}
              placeholder="e.g. Mutual NDA — Acme Corp"
            />
            <p className="mt-1.5 text-[12px] text-slate">
              Recipients see this title in their invitation. You can edit it before sending.
            </p>
          </div>

          {error ? (
            <div className="mt-4 rounded border border-[rgba(186,26,26,0.2)] bg-[#FBEAEA] px-3.5 py-3 text-[12.5px] leading-5 text-danger" role="alert">
              {error}
            </div>
          ) : null}

          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-hairline pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-1.5 text-[11.5px] text-slate">
              <ShieldCheck className="h-3.5 w-3.5 text-success-text" aria-hidden="true" />
              Stored privately. Only your workspace can access it.
            </p>
            <Button onClick={upload} disabled={uploading || !file || !title.trim()} loading={uploading}>
              {uploading ? "Uploading…" : "Continue to prepare"}
            </Button>
          </div>
        </div>
      )}

      {error && !file ? (
        <p className="mt-4 text-center text-[12.5px] leading-5 text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
