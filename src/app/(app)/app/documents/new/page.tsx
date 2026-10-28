import type { Metadata } from "next";
import { FileSignature, Lock, MousePointerClick, Users } from "lucide-react";
import { requireWorkspace } from "@/lib/auth";
import { env } from "@/lib/env";
import { PageHeader } from "@/components/ui/page-header";
import { UploadDropzone } from "@/components/documents/upload-dropzone";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New document" };

const steps = [
  {
    icon: Users,
    title: "Add recipients",
    description: "Each signer gets a private link — no account required.",
  },
  {
    icon: MousePointerClick,
    title: "Place fields",
    description: "Drag signature, date and text fields onto the exact page position.",
  },
  {
    icon: FileSignature,
    title: "Send and track",
    description: "Monitor every open and signature, then download the completed PDF.",
  },
];

export default async function NewDocumentPage() {
  await requireWorkspace();
  return (
    <div className="page-container py-8 sm:py-10">
      <PageHeader
        overline="New document"
        title="Prepare a signing request"
        description="Start with a PDF. You will place fields and add recipients in the next step."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <UploadDropzone maxUploadMb={env.maxUploadMb} />

        <aside className="space-y-5">
          <div className="rounded-card border border-hairline bg-surface p-5">
            <p className="overline">How it works</p>
            <ol className="mt-4 space-y-4">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-hairline text-[11px] font-semibold text-gold-text">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">{step.title}</p>
                    <p className="mt-0.5 text-[12px] leading-5 text-slate">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-card border border-hairline bg-surface-subtle/60 p-5">
            <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-overline text-slate">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              File requirements
            </p>
            <ul className="mt-3 space-y-2 text-[12.5px] leading-5 text-slate">
              <li>PDF documents only, up to {env.maxUploadMb} MB</li>
              <li>Password-protected or encrypted PDFs cannot be processed</li>
              <li>Up to {env.maxPdfPages} pages per document</li>
              <li>Your original file is preserved unchanged</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
