"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, ImageUp, PenTool, Type as TypeIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type Mode = "type" | "draw" | "upload";

const TABS: Array<{ mode: Mode; label: string; icon: typeof PenTool }> = [
  { mode: "type", label: "Type", icon: TypeIcon },
  { mode: "draw", label: "Draw", icon: PenTool },
  { mode: "upload", label: "Upload", icon: ImageUp },
];

export function SignatureDialog({
  open,
  onClose,
  onAdopt,
  suggestedName,
  fieldLabel,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onAdopt: (dataUrl: string, mode: Mode) => Promise<void>;
  suggestedName: string;
  fieldLabel: string;
  saving: boolean;
}) {
  const [mode, setMode] = useState<Mode>("type");
  const [typed, setTyped] = useState(suggestedName);
  const [uploaded, setUploaded] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("type");
    setTyped(suggestedName);
    setUploaded(null);
    setUploadError(null);
    setHasDrawing(false);
    setError(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [open, suggestedName]);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const width = 560;
    const height = 170;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#121417";
  }, [open]);

  if (!open) return null;

  const typedDataUrl = (): string | null => {
    if (!typed.trim()) return null;
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 260;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#121417";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "italic 104px Newsreader, Georgia, 'Times New Roman', serif";
    const maxWidth = 820;
    const measured = context.measureText(typed.trim()).width;
    const scale = Math.min(1, maxWidth / Math.max(measured, 1));
    context.save();
    context.translate(450, 140);
    context.scale(scale, scale);
    context.fillText(typed.trim(), 0, 0);
    context.restore();
    return canvas.toDataURL("image/png");
  };

  const drawnDataUrl = (): string | null => {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawing) return null;
    return canvas.toDataURL("image/png");
  };

  const handleAdopt = async () => {
    setError(null);
    let dataUrl: string | null = null;
    if (mode === "type") dataUrl = typedDataUrl();
    if (mode === "draw") dataUrl = drawnDataUrl();
    if (mode === "upload") dataUrl = uploaded;
    if (!dataUrl) {
      setError(
        mode === "type"
          ? "Type your name to create a signature."
          : mode === "draw"
            ? "Draw your signature first."
            : "Choose a signature image.",
      );
      return;
    }
    try {
      await onAdopt(dataUrl, mode);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The signature could not be saved.");
    }
  };

  const pointerPosition = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 560,
      y: ((event.clientY - rect.top) / rect.height) * 170,
    };
  };

  const handleUpload = (file: File) => {
    setUploadError(null);
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setUploadError("Use a PNG or JPEG image with a transparent or white background.");
      return;
    }
    if (file.size > 1_500_000) {
      setUploadError("The image must be 1.5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setUploaded(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      title="Add your signature"
      description={`This signature will be applied to the ${fieldLabel.toLowerCase()} field.`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleAdopt} loading={saving}>
            Adopt and sign
          </Button>
        </>
      }
    >
      <div role="tablist" aria-label="Signature method" className="flex gap-1 rounded border border-hairline bg-surface-subtle p-1">
        {TABS.map((tab) => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={mode === tab.mode}
            onClick={() => setMode(tab.mode)}
            className={cn(
              "flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded text-[12.5px] font-medium transition-colors",
              mode === tab.mode ? "bg-surface text-ink shadow-[0_1px_2px_rgba(18,20,23,0.08)]" : "text-slate hover:text-ink",
            )}
          >
            <tab.icon className="h-3.5 w-3.5" aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === "type" ? (
          <div>
            <Label htmlFor="signature-typed" required>
              Your name or preferred signature
            </Label>
            <Input
              id="signature-typed"
              value={typed}
              maxLength={80}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Type your name"
              data-autofocus
            />
            <div className="mt-3 flex h-[120px] items-center justify-center rounded border border-hairline bg-surface-subtle/40 px-6">
              <span
                className="max-w-full truncate font-serif text-[40px] italic leading-tight text-ink"
                style={{ fontFamily: "Newsreader, Georgia, 'Times New Roman', serif" }}
              >
                {typed.trim() || suggestedName || "Your signature"}
              </span>
            </div>
            <p className="mt-2 text-[11.5px] leading-4 text-slate">
              A typed signature is a stylised rendering of your name. Your consent and signing record are
              stored separately as evidence.
            </p>
          </div>
        ) : null}

        {mode === "draw" ? (
          <div>
            <p className="mb-2 text-[12px] text-slate">Draw with a mouse, trackpad, finger or stylus.</p>
            <div className="relative rounded border border-hairline bg-surface">
              <div className="pointer-events-none absolute inset-x-5 bottom-10 border-b border-dashed border-[rgba(18,20,23,0.14)]" />
              <canvas
                ref={canvasRef}
                className="mx-auto block h-[170px] w-full max-w-[560px] touch-none"
                style={{ touchAction: "none" }}                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  drawingRef.current = true;
                  const point = pointerPosition(event);
                  lastPointRef.current = point;
                  const context = event.currentTarget.getContext("2d");
                  if (context) {
                    context.beginPath();
                    context.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
                    context.fillStyle = "#121417";
                    context.fill();
                  }
                  setHasDrawing(true);
                }}
                onPointerMove={(event) => {
                  if (!drawingRef.current) return;
                  const context = event.currentTarget.getContext("2d");
                  const point = pointerPosition(event);
                  const last = lastPointRef.current;
                  if (context && last) {
                    context.beginPath();
                    context.moveTo(last.x, last.y);
                    context.lineTo(point.x, point.y);
                    context.stroke();
                  }
                  lastPointRef.current = point;
                }}
                onPointerUp={() => {
                  drawingRef.current = false;
                  lastPointRef.current = null;
                }}
                onPointerLeave={() => {
                  drawingRef.current = false;
                  lastPointRef.current = null;
                }}
                aria-label="Signature drawing canvas"
                role="img"
              />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-slate">Sign clearly — this is how your signature will appear.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  const context = canvas.getContext("2d");
                  if (!context) return;
                  context.clearRect(0, 0, canvas.width, canvas.height);
                  setHasDrawing(false);
                }}
              >
                <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {mode === "upload" ? (
          <div>
            <input
              ref={uploadRef}
              type="file"
              accept="image/png,image/jpeg"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleUpload(file);
                event.target.value = "";
              }}
            />
            <div className="flex flex-col items-center rounded border border-dashed border-hairline-strong bg-surface-subtle/40 px-6 py-8 text-center">
              {uploaded ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploaded} alt="Uploaded signature preview" className="max-h-[110px] max-w-full object-contain" />
              ) : (
                <>
                  <ImageUp className="h-6 w-6 text-slate" aria-hidden="true" />
                  <p className="mt-2 text-[12.5px] text-slate">PNG or JPEG, up to 1.5 MB.</p>
                </>
              )}
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => uploadRef.current?.click()}>
                {uploaded ? "Choose another image" : "Choose image"}
              </Button>
            </div>
            <FieldError>{uploadError}</FieldError>
            <p className="mt-2 text-[11.5px] leading-4 text-slate">
              Use an image of your handwritten signature with a transparent or white background.
            </p>
          </div>
        ) : null}
      </div>

      <FieldError>{error}</FieldError>
      <p className="mt-3 text-[10.5px] leading-4 text-slate">
        By adopting this signature you confirm it is your own and may be used to sign this document.
      </p>
    </Modal>
  );
}
