"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { FileWarning } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { cn } from "@/lib/cn";

export interface PdfViewerProps {
  url: string;
  width: number;
  renderPageOverlay?: (pageIndex: number) => ReactNode;
  onLoaded?: (pageCount: number) => void;
  className?: string;
}

interface PageSize {
  width: number;
  height: number;
}

export function PdfViewer({ url, width, renderPageOverlay, onLoaded, className }: PdfViewerProps) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PageSize[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    setPdf(null);
    setPages([]);
    setError(null);

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const loadingTask = pdfjs.getDocument({
          url,
          isEvalSupported: false,
          disableAutoFetch: false,
        });
        task = loadingTask;
        const document = await loadingTask.promise;
        if (cancelled) {
          await document.destroy();
          return;
        }
        const sizes: PageSize[] = [];
        for (let index = 1; index <= document.numPages; index += 1) {
          const page = await document.getPage(index);
          const viewport = page.getViewport({ scale: 1 });
          sizes.push({ width: viewport.width, height: viewport.height });
        }
        if (cancelled) return;
        setPages(sizes);
        setPdf(document);
        onLoaded?.(document.numPages);
      } catch {
        if (!cancelled) {
          setError("This PDF could not be displayed. Try downloading it to check the file.");
        }
      }
    })();

    return () => {
      cancelled = true;
      void task?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-card border border-hairline bg-surface px-6 py-12 text-center">
        <FileWarning className="h-6 w-6 text-danger" aria-hidden="true" />
        <p className="text-[13.5px] font-semibold text-ink">Preview unavailable</p>
        <p className="max-w-sm text-[12.5px] leading-5 text-slate">{error}</p>
      </div>
    );
  }

  if (!pdf) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading document">
        <div className="mx-auto h-[520px] w-full max-w-[760px] animate-pulse rounded-sm bg-surface-muted/70" />
        <p className="text-center text-[12px] text-slate">Loading document…</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {pages.map((size, index) => (
        <PdfPage
          key={index}
          pdf={pdf}
          pageNumber={index + 1}
          size={size}
          width={width}
          overlay={renderPageOverlay?.(index)}
        />
      ))}
    </div>
  );
}

function PdfPage({
  pdf,
  pageNumber,
  size,
  width,
  overlay,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  size: PageSize;
  width: number;
  overlay?: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: { cancel: () => void } | null = null;
    (async () => {
      try {
        const page = await pdf.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        const context = canvas.getContext("2d");
        if (!context) return;
        renderTask = page.render({ canvasContext: context, viewport });
        await (renderTask as unknown as { promise: Promise<void> }).promise;
        if (!cancelled) setRendered(true);
      } catch {
        // Rendering can be cancelled when the viewer unmounts; leave the skeleton in that case.
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [visible, pdf, pageNumber]);

  const ratio = size.width / size.height;
  return (
    <div
      ref={hostRef}
      data-page={pageNumber}
      className="relative mx-auto bg-white shadow-[0_1px_2px_rgba(18,20,23,0.06),0_12px_32px_-12px_rgba(18,20,23,0.18)] ring-1 ring-[rgba(18,20,23,0.07)]"
      style={{ width, aspectRatio: String(ratio) }}
    >
      {!rendered ? (
        <div className="absolute inset-0 animate-pulse rounded-sm bg-surface-muted/60" />
      ) : null}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={`Page ${pageNumber}`} />
      <div className="absolute inset-0">{overlay}</div>
      <span className="pointer-events-none absolute -top-5 right-0 text-[10.5px] font-medium tracking-wide text-slate">
        Page {pageNumber}
      </span>
    </div>
  );
}
