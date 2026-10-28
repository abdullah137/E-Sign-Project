"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, FormField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/client";

const PRESET_COLORS = ["#B89558", "#1F4E5A", "#3E7B51", "#6B4E8C", "#8A3B3B", "#121417"];

export function BrandingForm({
  workspaceName,
  brandDisplayName,
  brandColor,
  canEdit,
}: {
  workspaceName: string;
  brandDisplayName: string | null;
  brandColor: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(workspaceName);
  const [display, setDisplay] = useState(brandDisplayName ?? "");
  const [color, setColor] = useState(brandColor ?? "#B89558");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                className="h-11 w-14 cursor-pointer rounded border border-[rgba(18,20,23,0.12)] bg-surface p-1 disabled:cursor-not-allowed"
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
                  className="h-7 w-7 rounded-full border border-[rgba(18,20,23,0.12)] transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-text focus-visible:ring-offset-2 disabled:cursor-not-allowed"
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
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold text-white"
                style={{ backgroundColor: color }}
              >
                {(display || name).trim().charAt(0).toUpperCase()}
              </span>
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
