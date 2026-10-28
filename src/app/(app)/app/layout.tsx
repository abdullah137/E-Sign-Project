import { requireWorkspace } from "@/lib/auth";
import { getPlan } from "@/lib/plans";
import { AppShell } from "@/components/app/app-shell";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const plan = getPlan(ctx.workspace.plan);
  return (
    <AppShell
      user={{
        name: ctx.user.full_name || ctx.user.email,
        email: ctx.user.email,
        role: ctx.membership.role,
      }}
      workspace={{
        name: ctx.workspace.brand_display_name || ctx.workspace.name,
        plan: ctx.workspace.plan,
        planName: plan.name,
      }}
    >
      {children}
    </AppShell>
  );
}
