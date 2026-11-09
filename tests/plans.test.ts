import { describe, expect, it } from "vitest";
import { PLANS, getPlan, normalizePlanId, planPriceCents } from "@/lib/plans";
import { assertWithinRetention, getDocument, retentionDeadline } from "@/lib/documents";
import { createPublicLink } from "@/lib/templates";
import {
  authenticateApiKey,
  createApiKey,
  createTeamInvite,
  requestPlanChange,
} from "@/lib/workspace-admin";
import { addDocument, addTemplate, makeDb, seedWorkspace } from "./helpers";

describe("plan catalogue", () => {
  it("exposes the reference prices and popular plan", () => {
    expect(planPriceCents(PLANS.free)).toBe(0);
    expect(planPriceCents(PLANS.starter)).toBe(1_500_000);
    expect(planPriceCents(PLANS.team)).toBe(6_000_000);
    expect(PLANS.free.popular).toBe(false);
    expect(PLANS.starter.popular).toBe(true);
    expect(PLANS.team.popular).toBe(false);
  });

  it("centralizes the entitlements used by the server", () => {
    expect(PLANS.free.entitlements).toMatchObject({
      teamSeats: 1,
      templates: 1,
      apiDocumentSendsPerMonth: 0,
      aiContractReviews: 2,
      documentRetentionDays: 14,
      publicSigningLinks: false,
      customBranding: false,
      customMessages: false,
    });
    expect(PLANS.starter.entitlements).toMatchObject({
      teamSeats: 3,
      templates: null,
      apiDocumentSendsPerMonth: 50,
      documentRetentionDays: null,
      publicSigningLinks: true,
      customBranding: true,
      customMessages: true,
    });
    expect(PLANS.team.entitlements).toMatchObject({
      teamSeats: null,
      templates: null,
      apiDocumentSendsPerMonth: 250,
      documentRetentionDays: null,
      centralizedBilling: true,
    });
  });

  it("normalizes legacy plan identifiers", () => {
    expect(normalizePlanId("pro")).toBe("starter");
    expect(normalizePlanId("business")).toBe("team");
    expect(normalizePlanId("starter")).toBe("starter");
    expect(normalizePlanId("unknown")).toBe("free");
    expect(normalizePlanId(null)).toBe("free");
    expect(getPlan("business").name).toBe("Team");
  });
});

describe("retention entitlement", () => {
  it("measures the Free window from completion or creation", () => {
    expect(
      retentionDeadline(getPlan("free"), {
        created_at: "2026-01-01T00:00:00.000Z",
        completed_at: null,
      }),
    ).toBe("2026-01-15T00:00:00.000Z");
    expect(
      retentionDeadline(getPlan("free"), {
        created_at: "2026-01-01T00:00:00.000Z",
        completed_at: "2026-01-05T00:00:00.000Z",
      }),
    ).toBe("2026-01-19T00:00:00.000Z");
    expect(
      retentionDeadline(getPlan("starter"), {
        created_at: "2026-01-01T00:00:00.000Z",
        completed_at: null,
      }),
    ).toBeNull();
  });

  it("blocks access outside the Free window but not on paid plans", () => {
    const freeDb = makeDb();
    const free = seedWorkspace(freeDb, "free");
    addDocument(freeDb, free.workspaceId, {
      id: "doc_old",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    const freeDoc = getDocument(freeDb, "doc_old");
    if (!freeDoc) throw new Error("fixture document missing");
    expect(() => assertWithinRetention(freeDb, freeDoc)).toThrow(/14 days/i);

    const paidDb = makeDb();
    const paid = seedWorkspace(paidDb, "starter");
    addDocument(paidDb, paid.workspaceId, {
      id: "doc_old_paid",
      createdAt: "2020-01-01T00:00:00.000Z",
    });
    const paidDoc = getDocument(paidDb, "doc_old_paid");
    if (!paidDoc) throw new Error("fixture document missing");
    expect(() => assertWithinRetention(paidDb, paidDoc)).not.toThrow();
  });
});

describe("API access entitlement", () => {
  it("refuses keys on Free and authenticates them on Starter", () => {
    const freeDb = makeDb();
    const free = seedWorkspace(freeDb, "free");
    expect(() => createApiKey(freeDb, free.workspaceId, "Reporting")).toThrow(
      /available on Starter and Team/i,
    );

    const paidDb = makeDb();
    const paid = seedWorkspace(paidDb, "starter");
    const created = createApiKey(paidDb, paid.workspaceId, "Reporting");
    expect(created.key.startsWith("jp_live_")).toBe(true);
    expect(authenticateApiKey(paidDb, created.key)).toMatchObject({
      workspaceId: paid.workspaceId,
      scopes: ["documents:read"],
    });
  });
});

describe("public signing link entitlement", () => {
  it("requires a paid plan", () => {
    const freeDb = makeDb();
    const free = seedWorkspace(freeDb, "free");
    addTemplate(freeDb, free.workspaceId);
    expect(() =>
      createPublicLink(freeDb, {
        workspaceId: free.workspaceId,
        templateId: "tpl_test",
        name: "Website request",
      }),
    ).toThrow(/Starter and Team/i);

    const paidDb = makeDb();
    const paid = seedWorkspace(paidDb, "starter");
    addTemplate(paidDb, paid.workspaceId);
    expect(
      createPublicLink(paidDb, {
        workspaceId: paid.workspaceId,
        templateId: "tpl_test",
        name: "Website request",
      }).status,
    ).toBe("active");
  });
});

describe("team seat entitlement", () => {
  it("blocks a Free invite once the owner occupies the seat", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db, "free");
    expect(() =>
      createTeamInvite(db, {
        workspaceId,
        workspaceName: "Test Workspace",
        email: "colleague@example.com",
        role: "member",
        actor: { id: "usr_owner", label: "Dana Owner" },
        plan: getPlan("free"),
      }),
    ).toThrow(/1 team seat/i);
  });

  it("allows a Starter invite within the three-seat allocation", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db, "starter");
    const result = createTeamInvite(db, {
      workspaceId,
      workspaceName: "Test Workspace",
      email: "colleague@example.com",
      role: "member",
      actor: { id: "usr_owner", label: "Dana Owner" },
      plan: getPlan("starter"),
    });
    expect(result.invite.email).toBe("colleague@example.com");
    expect(result.link).toContain("/auth/register?invite=");
  });
});

describe("plan change flow", () => {
  it("records paid upgrades as pending without changing the workspace", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db, "free");
    const result = requestPlanChange(db, workspaceId, "starter", "usr_owner");
    expect(result).toMatchObject({ changed: false, pending: true });
    const workspace = db.prepare("SELECT plan FROM workspaces WHERE id = ?").get(workspaceId) as {
      plan: string;
    };
    expect(workspace.plan).toBe("free");
    const request = db
      .prepare("SELECT plan, status FROM plan_requests WHERE workspace_id = ?")
      .get(workspaceId) as { plan: string; status: string };
    expect(request).toEqual({ plan: "starter", status: "pending" });
  });

  it("cancels a pending request when Free is requested again", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db, "free");
    requestPlanChange(db, workspaceId, "team", "usr_owner");
    const result = requestPlanChange(db, workspaceId, "free", "usr_owner");
    expect(result.pending).toBe(false);
    expect(result.message).toMatch(/cancelled/i);
    const request = db
      .prepare("SELECT status FROM plan_requests WHERE workspace_id = ?")
      .get(workspaceId) as { status: string };
    expect(request.status).toBe("cancelled");
  });

  it("applies a downgrade immediately", () => {
    const db = makeDb();
    const { workspaceId } = seedWorkspace(db, "starter");
    const result = requestPlanChange(db, workspaceId, "free", "usr_owner");
    expect(result).toMatchObject({ changed: true, pending: false });
    const workspace = db.prepare("SELECT plan FROM workspaces WHERE id = ?").get(workspaceId) as {
      plan: string;
    };
    expect(workspace.plan).toBe("free");
  });
});