"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Palette, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FormField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

const PRESET_COLORS = ["#0D294D", "#1E406B", "#3A5C8A", "#FAB641", "#111827", "#475569"];

export function BrandingForm({
  workspaceName,
  brandDisplayName,
  brandColor,
  logoAssetId: initialLogoAssetId,
  canEdit,
}: {
  workspaceName: string;
  brandDisplayName: string | null;
  brandColor: string | null;
  logoAssetId: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(workspaceName);
  const [display, setDisplay] = useState(brandDisplayName ?? "");
  const [color, setColor] = useState(brandColor ?? "#0D294D");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoAssetId, setLogoAssetId] = useState(initialLogoAssetId);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  const uploadLogo = async (file: File | null) => {
    setLogoError(null);
    if (!file) return;
    if (file.type !== "image/png" && file.type !== "image/jpeg") {
      setLogoError("Choose a PNG or JPEG image.");
      return;
    }
    if (file.size > 1024 * 1024) {
      setLogoError("The logo must be 1 MB or smaller.");
      return;
    }
    setLogoBusy(true);
    try {
      const body = new FormData();
      body.set("logo", file);
      const result = await apiFetch<{ logoAssetId: string }>("/api/workspace/branding/logo", {
        method: "POST",
        body,
      });
      setLogoAssetId(result.logoAssetId);
      toast({ title: "Firm logo updated", variant: "success" });
      router.refresh();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "The logo could not be uploaded.");
    } finally {
      setLogoBusy(false);
    }
  };

  const removeLogo = async () => {
    setLogoError(null);
    setLogoBusy(true);
    try {
      await apiFetch("/api/workspace/branding/logo", { method: "DELETE" });
      setLogoAssetId(null);
      toast({ title: "Firm logo removed", variant: "success" });
      router.refresh();
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "The logo could not be removed.");
    } finally {
      setLogoBusy(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/api/workspace/branding", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          brandDisplayName: display.trim() || null,
          brandColor: color.trim() || null,
        }),
      });
      toast({ title: "Branding updated", variant: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Branding could not be updated.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-slate">
            <Palette className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Workspace identity</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-slate">
              Your display name appears to recipients. The colour is used as a subtle accent on signing pages.
            </p>
          </div>
        </div>

        <div className="mt-5 max-w-xl">
          <p className="mb-1.5 text-[13px] font-medium text-ink">Firm logo</p>
          <div className="flex flex-wrap items-center gap-3">
            {logoAssetId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/workspace/branding/logo?v=${encodeURIComponent(logoAssetId)}`}
                alt="Firm logo"
                className="h-16 w-28 rounded border border-hairline bg-white object-contain p-1"
              />
            ) : (
              <div className="flex h-16 w-28 items-center justify-center rounded border border-dashed border-hairline-strong text-[11px] text-slate">
                No logo
              </div>
            )}
            {canEdit ? (
              <div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-hairline bg-card px-3 py-1.5 text-[12px] font-medium text-ink hover:border-brand-500">
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {logoBusy ? "Uploading…" : logoAssetId ? "Change logo" : "Upload logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      disabled={logoBusy}
                      onChange={(event) => {
                        void uploadLogo(event.target.files?.[0] ?? null);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  {logoAssetId ? (
                    <button
                      type="button"
                      onClick={() => void removeLogo()}
                      disabled={logoBusy}
                      className="text-[12px] font-medium text-slate hover:text-ink hover:underline disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 text-[11.5px] leading-5 text-slate">
                  PNG or JPEG up to 1 MB. Used on agreement and inquiry letterheads.
                </p>
                {logoError ? (
                  <p className="mt-1 text-[12px] leading-5 text-danger" role="alert">
                    {logoError}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] leading-5 text-slate">
                Only workspace owners and admins can change the logo.
              </p>
            )}
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 max-w-xl space-y-5" noValidate>
          <FormField label="Workspace name" htmlFor="workspaceName" required>
            <Input
              id="workspaceName"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canEdit}
              required
              maxLength={80}
            />
          </FormField>
          <FormField
            label="Display name"
            htmlFor="brandDisplayName"
            hint="Shown to recipients instead of the workspace name. Leave blank to use the workspace name."
          >
            <Input
              id="brandDisplayName"
              value={display}
              onChange={(event) => setDisplay(event.target.value)}
              disabled={!canEdit}
              maxLength={80}
              placeholder={workspaceName}
            />
          </FormField>
          <div>
            <Label htmlFor="brandColor">Brand colour</Label>
            <div className="flex flex-wrap items-center gap-2">
              <input
                id="brandColor"
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value.toUpperCase())}
                disabled={!canEdit}
                className="h-11 w-14 cursor-pointer rounded border border-hairline-strong bg-surface p-1 disabled:cursor-not-allowed"
                aria-label="Brand colour"
              />
              <Input
                value={color}
                onChange={(event) => setColor(event.target.value)}
                disabled={!canEdit}
                maxLength={7}
                className="w-32 font-mono uppercase"
                aria-label="Brand colour hex value"
              />
              {PRESET_COLORS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setColor(preset)}
                  disabled={!canEdit}
                  className="h-7 w-7 rounded-full border border-hairline-strong transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                  style={{ backgroundColor: preset }}
                  aria-label={`Use ${preset}`}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[12px] leading-5 text-slate">
              Applied as an accent inside the signing experience. Contrast-safe neutrals remain unchanged.
            </p>
          </div>

          {error ? (
            <p className="text-[12.5px] leading-5 text-danger" role="alert">
              {error}
            </p>
          ) : null}

          {canEdit ? (
            <Button type="submit" loading={saving}>
              Save branding
            </Button>
          ) : (
            <p className="rounded border border-hairline bg-surface-subtle/60 px-4 py-3 text-[12px] text-slate">
              Only workspace owners and admins can edit branding.
            </p>
          )}
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-[15px] font-semibold text-ink">Preview</h2>
        <p className="mt-0.5 text-[12px] text-slate">How recipients will see your workspace.</p>
        <div className="mt-4 rounded-card border border-hairline bg-surface-subtle/40 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {logoAssetId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/workspace/branding/logo?v=${encodeURIComponent(logoAssetId)}`}
                  alt=""
                  className="h-8 w-14 rounded border border-hairline bg-white object-contain p-0.5"
                />
              ) : (
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                  style={{ backgroundColor: color }}
                >
                  {(display || name).trim().charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-[13px] font-semibold text-ink">{display || name}</span>
            </div>
            <span className="text-[11px] uppercase tracking-overline text-slate">Secure signing</span>
          </div>
          <div className="mt-4 rounded border border-hairline bg-white p-4">
            <p className="text-[13px] font-medium text-ink">Signature requested</p>
            <p className="mt-1 text-[12px] leading-5 text-slate">
              Review the document and add your signature to finish.
            </p>
            <span
              className="mt-3 inline-flex h-9 items-center rounded px-4 text-[12px] font-semibold text-white"
              style={{ backgroundColor: color }}
            >
              Continue
            </span>
          </div>
          <p className="mt-3 text-[11px] text-slate">
            Colour is decorative only. Controls keep accessible contrast ratios on the actual signing page.
          </p>
        </div>
      </section>
    </div>
  );
}
