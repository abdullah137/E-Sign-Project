"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Briefcase,
  CalendarDays,
  CheckSquare,
  Mail,
  MapPin,
  Minus,
  MousePointer2,
  PenLine,
  Plus,
  Redo2,
  Send,
  Signature,
  Trash2,
  Type,
  Undo2,
  User,
  Users,
  X,
} from "lucide-react";
import {
  FIELD_DEFINITIONS,
  isValidEmail,
  recipientColor,
  type FieldType,
} from "@/lib/field-types";
import { clamp01 } from "@/lib/pdf/coords";
import { cn } from "@/lib/cn";
import { apiFetch } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input, Label, FieldError, Checkbox, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { PdfViewer } from "@/components/pdf/pdf-viewer";

export interface EditorRecipient {
  id: string;
  name: string;
  email: string;
}

export interface EditorField {
  id: string;
  pageIndex: number;
  type: FieldType;
  label: string | null;
  recipientId: string;
  required: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PrepareEditorProps {
  documentId: string;
  initialTitle: string;
  initialMessage: string | null;
  initialRecipients: EditorRecipient[];
  initialFields: EditorField[];
  fileUrl: string;
  recipientLimit: number;
  planName: string;
}

const MIN_WIDTH = 0.015;
const MIN_HEIGHT = 0.012;

const TOOL_GROUPS: Array<{ label: string; types: FieldType[] }> = [
  { label: "Signature", types: ["signature", "initials"] },
  { label: "Information", types: ["name", "email", "title", "address", "date"] },
  { label: "Additional", types: ["checkbox", "text"] },
];

const TOOL_ICONS: Record<FieldType, typeof PenLine> = {
  signature: Signature,
  initials: PenLine,
  date: CalendarDays,
  name: User,
  email: Mail,
  address: MapPin,
  title: Briefcase,
  checkbox: CheckSquare,
  text: Type,
};

function newClientId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${uuid.replace(/-/g, "").slice(0, 20)}`;
}

function clampRect(rect: EditorField): EditorField {
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), 1);
  const height = Math.min(Math.max(rect.height, MIN_HEIGHT), 1);
  return {
    ...rect,
    x: clamp01(Math.min(rect.x, 1 - width)),
    y: clamp01(Math.min(rect.y, 1 - height)),
    width,
    height,
  };
}

export function PrepareEditor({
  documentId,
  initialTitle,
  initialMessage,
  initialRecipients,
  initialFields,
  fileUrl,
  recipientLimit,
  planName,
}: PrepareEditorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [recipients, setRecipients] = useState<EditorRecipient[]>(initialRecipients);
  const [fields, setFields] = useState<EditorField[]>(initialFields);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(
    initialRecipients[0]?.id ?? null,
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<FieldType | null>(null);
  const [zoom, setZoom] = useState(100);
  const [containerWidth, setContainerWidth] = useState(760);
  const [nonce, setNonce] = useState(0);
  const [savedNonce, setSavedNonce] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [history, setHistory] = useState<EditorField[][]>([]);
  const [future, setFuture] = useState<EditorField[][]>([]);
  const [draftRect, setDraftRect] = useState<{ pageIndex: number; field: EditorField } | null>(null);
  const [recipientsOpen, setRecipientsOpen] = useState(false);
  const [addFormOpen, setAddFormOpen] = useState(initialRecipients.length === 0);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<EditorRecipient | null>(null);
  const [sending, setSending] = useState(false);

  const workbenchRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ title, recipients, fields });
  const dirtyRef = useRef(false);
  const dragRef = useRef<{
    mode: "move" | "resize";
    fieldId: string;
    pageElement: HTMLElement;
    startClientX: number;
    startClientY: number;
    startField: EditorField;
    snapshot: EditorField[];
    pointerId: number;
  } | null>(null);
  const movedRef = useRef(false);

  useEffect(() => {
    stateRef.current = { title, recipients, fields };
    dirtyRef.current = nonce !== savedNonce;
  }, [title, recipients, fields, nonce, savedNonce]);

  const selectedField = fields.find((field) => field.id === selectedFieldId) ?? null;
  const activeRecipient =
    recipients.find((recipient) => recipient.id === selectedRecipientId) ?? null;

  const pageWidth = Math.round(Math.min(820, Math.max(300, containerWidth - 40)) * (zoom / 100));

  useEffect(() => {
    const element = workbenchRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(element);
    setContainerWidth(element.clientWidth);
    return () => observer.disconnect();
  }, []);

  const markDirty = useCallback(() => {
    setSaveState("idle");
    setNonce((value) => value + 1);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    const snapshot = stateRef.current;
    if (!snapshot.title.trim()) {
      setSaveState("error");
      setSaveError("Add a document title before saving.");
      return false;
    }
    setSaveState("saving");
    setSaveError(null);
    try {
      await apiFetch(`/api/documents/${documentId}`, {
        method: "PUT",
        body: JSON.stringify({
          title: snapshot.title.trim(),
          message: initialMessage,
          recipients: snapshot.recipients.map((recipient, index) => ({
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            order: index + 1,
          })),
          fields: snapshot.fields.map((field) => ({
            id: field.id,
            pageIndex: field.pageIndex,
            type: field.type,
            label: field.label,
            recipientId: field.recipientId,
            required: field.required,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            rotation: field.rotation,
          })),
        }),
      });
      setSaveState("saved");
      return true;
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Draft could not be saved.");
      return false;
    }
  }, [documentId, initialMessage]);

  useEffect(() => {
    if (nonce === 0 || nonce === savedNonce) return;
    const target = nonce;
    const timer = window.setTimeout(async () => {
      const ok = await save();
      if (ok) setSavedNonce(target);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [nonce, savedNonce, save]);

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current) return;
      const snapshot = stateRef.current;
      void fetch(`/api/documents/${documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: snapshot.title.trim() || "Untitled document",
          message: initialMessage,
          recipients: snapshot.recipients.map((recipient, index) => ({
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            order: index + 1,
          })),
          fields: snapshot.fields.map((field) => ({
            id: field.id,
            pageIndex: field.pageIndex,
            type: field.type,
            label: field.label,
            recipientId: field.recipientId,
            required: field.required,
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            rotation: field.rotation,
          })),
        }),
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [documentId, initialMessage]);

  const pushHistory = useCallback((snapshot: EditorField[]) => {
    setHistory((current) => [...current.slice(-39), snapshot]);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setHistory((current) => {
      if (!current.length) return current;
      const previous = current[current.length - 1];
      setFields((value) => {
        setFuture((redo) => [...redo, value]);
        return previous;
      });
      setSelectedFieldId(null);
      markDirty();
      return current.slice(0, -1);
    });
  }, [markDirty]);

  const redo = useCallback(() => {
    setFuture((current) => {
      if (!current.length) return current;
      const next = current[current.length - 1];
      setFields((value) => {
        setHistory((undoStack) => [...undoStack, value]);
        return next;
      });
      setSelectedFieldId(null);
      markDirty();
      return current.slice(0, -1);
    });
  }, [markDirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !isTyping) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if (event.key === "Escape" && !isTyping) {
        setActiveTool(null);
        setSelectedFieldId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const addRecipient = () => {
    setRecipientError(null);
    if (!newName.trim()) {
      setRecipientError("Enter the recipient's name.");
      return;
    }
    if (!isValidEmail(newEmail)) {
      setRecipientError("Enter a valid email address.");
      return;
    }
    if (recipients.length >= recipientLimit) {
      setRecipientError(
        `Your ${planName} plan allows ${recipientLimit} recipients per document.`,
      );
      return;
    }
    if (
      recipients.some(
        (recipient) => recipient.email.trim().toLowerCase() === newEmail.trim().toLowerCase(),
      )
    ) {
      setRecipientError("That email address is already a recipient on this document.");
      return;
    }
    const recipient: EditorRecipient = {
      id: newClientId("rcp"),
      name: newName.trim(),
      email: newEmail.trim(),
    };
    setRecipients((current) => [...current, recipient]);
    setSelectedRecipientId(recipient.id);
    setNewName("");
    setNewEmail("");
    setAddFormOpen(false);
    markDirty();
    toast({ title: "Recipient added", description: "Choose a field tool, then click the document.", variant: "success" });
  };

  const removeRecipient = (recipient: EditorRecipient) => {
    const remaining = recipients.filter((item) => item.id !== recipient.id);
    setRecipients(remaining);
    setFields((current) => current.filter((field) => field.recipientId !== recipient.id));
    if (selectedRecipientId === recipient.id) {
      setSelectedRecipientId(remaining[0]?.id ?? null);
    }
    setSelectedFieldId(null);
    setRemoveTarget(null);
    markDirty();
  };

  const addFieldAt = (pageIndex: number, x: number, y: number, width: number, height: number) => {
    if (!activeTool) return;
    const recipientId = selectedRecipientId ?? recipients[0]?.id;
    if (!recipientId) {
      toast({
        title: "Add a recipient first",
        description: "Fields must be assigned to the person who will complete them.",
        variant: "error",
      });
      return;
    }
    const definition = FIELD_DEFINITIONS[activeTool];
    const field = clampRect({
      id: newClientId("fld"),
      pageIndex,
      type: activeTool,
      label: definition.label,
      recipientId,
      required: activeTool !== "text" && activeTool !== "title" && activeTool !== "address",
      x,
      y,
      width,
      height,
      rotation: 0,
    });
    pushHistory(fields);
    setFields((current) => [...current, field]);
    setSelectedFieldId(field.id);
    markDirty();
  };

  const beginPageInteraction = (
    event: React.PointerEvent<HTMLDivElement>,
    pageIndex: number,
  ) => {
    if (!activeTool) return;
    if (event.button !== 0) return;
    if (!selectedRecipientId && !recipients.length) {
      toast({
        title: "Add a recipient first",
        description: "Fields must be assigned to the person who will complete them.",
        variant: "error",
      });
      return;
    }
    const overlay = event.currentTarget;
    const rect = overlay.getBoundingClientRect();
    const startX = clamp01((event.clientX - rect.left) / rect.width);
    const startY = clamp01((event.clientY - rect.top) / rect.height);
    const tool = activeTool;
    const recipientId = selectedRecipientId ?? recipients[0]?.id ?? null;
    if (!recipientId) return;
    const definition = FIELD_DEFINITIONS[tool];

    const preview: EditorField = {
      id: "preview",
      pageIndex,
      type: tool,
      label: definition.label,
      recipientId,
      required: true,
      x: startX,
      y: startY,
      width: 0,
      height: 0,
      rotation: 0,
    };
    setDraftRect({ pageIndex, field: preview });

    const onMove = (moveEvent: PointerEvent) => {
      const cx = clamp01((moveEvent.clientX - rect.left) / rect.width);
      const cy = clamp01((moveEvent.clientY - rect.top) / rect.height);
      const x = Math.min(startX, cx);
      const y = Math.min(startY, cy);
      setDraftRect({
        pageIndex,
        field: {
          ...preview,
          x,
          y,
          width: Math.abs(cx - startX),
          height: Math.abs(cy - startY),
        },
      });
    };
    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const cx = clamp01((upEvent.clientX - rect.left) / rect.width);
      const cy = clamp01((upEvent.clientY - rect.top) / rect.height);
      const draggedWidth = Math.abs(cx - startX);
      const draggedHeight = Math.abs(cy - startY);
      const x = Math.min(startX, cx);
      const y = Math.min(startY, cy);
      setDraftRect(null);
      if (draggedWidth > 0.02 && draggedHeight > 0.012) {
        addFieldAt(pageIndex, x, y, draggedWidth, draggedHeight);
      } else {
        const width = definition.defaultWidth;
        const height = definition.defaultHeight;
        addFieldAt(
          pageIndex,
          Math.min(Math.max(startX - width / 2, 0), 1 - width),
          Math.min(Math.max(startY - height / 2, 0), 1 - height),
          width,
          height,
        );
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const beginFieldDrag = (
    event: React.PointerEvent<HTMLElement>,
    field: EditorField,
    mode: "move" | "resize",
  ) => {
    event.stopPropagation();
    if (event.button !== 0) return;
    setSelectedFieldId(field.id);
    const pageElement = event.currentTarget.closest("[data-page-overlay]") as HTMLElement | null;
    if (!pageElement) return;
    dragRef.current = {
      mode,
      fieldId: field.id,
      pageElement,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startField: field,
      snapshot: fields,
      pointerId: event.pointerId,
    };
    movedRef.current = false;
  };

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rect = drag.pageElement.getBoundingClientRect();
      const dx = (event.clientX - drag.startClientX) / rect.width;
      const dy = (event.clientY - drag.startClientY) / rect.height;
      if (Math.abs(dx) > 0.001 || Math.abs(dy) > 0.001) movedRef.current = true;
      setFields((current) =>
        current.map((field) => {
          if (field.id !== drag.fieldId) return field;
          if (drag.mode === "move") {
            return clampRect({
              ...field,
              x: clamp01(Math.min(1 - drag.startField.width, Math.max(0, drag.startField.x + dx))),
              y: clamp01(Math.min(1 - drag.startField.height, Math.max(0, drag.startField.y + dy))),
            });
          }
          return clampRect({
            ...field,
            width: Math.max(MIN_WIDTH, Math.min(1 - drag.startField.x, drag.startField.width + dx)),
            height: Math.max(MIN_HEIGHT, Math.min(1 - drag.startField.y, drag.startField.height + dy)),
          });
        }),
      );
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      if (movedRef.current) {
        pushHistory(drag.snapshot);
        markDirty();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [pushHistory, markDirty]);

  const updateField = (patch: Partial<EditorField>) => {
    if (!selectedField) return;
    pushHistory(fields);
    setFields((current) =>
      current.map((field) =>
        field.id === selectedField.id ? clampRect({ ...field, ...patch }) : field,
      ),
    );
    markDirty();
  };

  const deleteField = (fieldId: string) => {
    pushHistory(fields);
    setFields((current) => current.filter((field) => field.id !== fieldId));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    markDirty();
  };

  const nudgeField = (event: React.KeyboardEvent<HTMLDivElement>, field: EditorField) => {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      deleteField(field.id);
      return;
    }
    const step = event.shiftKey ? 0.02 : 0.005;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -step;
    else if (event.key === "ArrowRight") dx = step;
    else if (event.key === "ArrowUp") dy = -step;
    else if (event.key === "ArrowDown") dy = step;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedFieldId(field.id);
      return;
    }
    if (!dx && !dy) return;
    event.preventDefault();
    setFields((current) =>
      current.map((item) =>
        item.id === field.id
          ? clampRect({
              ...item,
              x: clamp01(Math.min(1 - item.width, Math.max(0, item.x + dx))),
              y: clamp01(Math.min(1 - item.height, Math.max(0, item.y + dy))),
            })
          : item,
      ),
    );
    markDirty();
  };

  const goToSend = async () => {
    setSending(true);
    if (nonce !== savedNonce || saveState === "error" || saveState === "idle") {
      const ok = await save();
      if (!ok) {
        setSending(false);
        toast({
          title: "Draft not saved",
          description: saveError ?? "Fix the highlighted issue before continuing.",
          variant: "error",
        });
        return;
      }
      setSavedNonce(nonce);
    }
    router.push(`/app/documents/${documentId}/send`);
  };

  const statusLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "error"
        ? "Not saved"
        : nonce !== savedNonce
          ? "Unsaved changes"
          : saveState === "saved"
            ? "Saved"
            : "Draft";

  const recipientsPanel = (idPrefix: string) => (
    <RecipientsPanel
      idPrefix={idPrefix}
      recipients={recipients}
      fields={fields}
      selectedRecipientId={selectedRecipientId}
      selectedField={selectedField}
      addFormOpen={addFormOpen}
      setAddFormOpen={setAddFormOpen}
      newName={newName}
      newEmail={newEmail}
      setNewName={setNewName}
      setNewEmail={setNewEmail}
      recipientError={recipientError}
      setRecipientError={setRecipientError}
      onAdd={addRecipient}
      onSelectRecipient={setSelectedRecipientId}
      onRemove={setRemoveTarget}
      onUpdateField={updateField}
      onDeleteField={deleteField}
      recipientLimit={recipientLimit}
      planName={planName}
    />
  );

  const toolButtons = (compact: boolean) => (
    <>
      <button
        type="button"
        onClick={() => {
          setActiveTool(null);
          setSelectedFieldId(null);
        }}
        className={cn(
          "flex items-center gap-2 rounded text-left transition-colors",
          compact ? "min-h-[52px] shrink-0 flex-col justify-center px-3 text-[10px]" : "min-h-[40px] w-full px-2.5 text-[12.5px]",
          activeTool === null
            ? "bg-surface text-ink ring-1 ring-hairline"
            : "text-slate hover:bg-surface-subtle hover:text-ink",
        )}
        aria-pressed={activeTool === null}
      >
        <MousePointer2 className={compact ? "h-4 w-4" : "h-4 w-4"} strokeWidth={1.7} aria-hidden="true" />
        <span>Select</span>
      </button>
      {TOOL_GROUPS.map((group) => (
        <div key={group.label} className={compact ? "contents" : "mt-4"}>
          {!compact ? <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-overline text-slate">{group.label}</p> : null}
          {group.types.map((type) => {
            const Icon = TOOL_ICONS[type];
            const definition = FIELD_DEFINITIONS[type];
            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveTool(type)}
                aria-pressed={activeTool === type}
                title={definition.hint}
                className={cn(
                  "flex items-center gap-2.5 rounded text-left transition-colors",
                  compact ? "min-h-[52px] shrink-0 flex-col justify-center px-3 text-[10px]" : "min-h-[38px] w-full px-2.5 text-[12.5px]",
                  activeTool === type
                    ? "bg-warning-bg/70 text-ink ring-1 ring-[rgba(184,149,88,0.35)]"
                    : "text-slate hover:bg-surface-subtle hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
                <span>{compact ? definition.label : definition.label}</span>
              </button>
            );
          })}
        </div>
      ))}
    </>
  );

  return (
    <div className="relative min-h-[calc(100vh-4rem)] pb-24 lg:pb-0">
      <div className="sticky top-16 z-20 border-b border-hairline bg-surface/95 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <Link
            href="/app/documents"
            className="flex h-9 w-9 items-center justify-center rounded text-slate hover:bg-surface-subtle hover:text-ink"
            aria-label="Back to all documents"
            onClick={() => void save()}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="min-w-0 flex-1">
            <label htmlFor="editor-title" className="sr-only">
              Document title
            </label>
            <input
              id="editor-title"
              value={title}
              maxLength={160}
              onChange={(event) => {
                setTitle(event.target.value);
                markDirty();
              }}
              className="w-full max-w-md truncate rounded border border-transparent bg-transparent px-1.5 py-1 text-[15px] font-semibold text-ink hover:border-hairline focus:border-gold-text focus:bg-surface focus:outline-none"
            />
            <p
              className={cn(
                "px-1.5 text-[11px]",
                saveState === "error" ? "text-danger" : "text-slate",
              )}
              aria-live="polite"
            >
              {statusLabel}
              {saveState === "error" && saveError ? ` · ${saveError}` : ""}
            </p>
          </div>

          <div className="hidden items-center gap-0.5 rounded border border-hairline bg-surface p-0.5 sm:flex">
            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded text-slate hover:bg-surface-subtle hover:text-ink disabled:opacity-40"
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0}
              className="flex h-8 w-8 items-center justify-center rounded text-slate hover:bg-surface-subtle hover:text-ink disabled:opacity-40"
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="hidden items-center gap-0.5 rounded border border-hairline bg-surface p-0.5 md:flex">
            <button
              type="button"
              onClick={() => setZoom((value) => Math.max(60, value - 10))}
              className="flex h-8 w-8 items-center justify-center rounded text-slate hover:bg-surface-subtle hover:text-ink"
              aria-label="Zoom out"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setZoom(100)}
              className="tabular min-w-[48px] px-1 text-[12px] font-medium text-ink-secondary"
              aria-label="Reset zoom to 100 percent"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={() => setZoom((value) => Math.min(200, value + 10))}
              className="flex h-8 w-8 items-center justify-center rounded text-slate hover:bg-surface-subtle hover:text-ink"
              aria-label="Zoom in"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setRecipientsOpen(true)}
            className="hidden h-9 items-center gap-1.5 rounded border border-hairline px-2.5 text-[12.5px] font-medium text-ink-secondary hover:bg-surface-subtle sm:flex xl:hidden"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            <span className="tabular">{recipients.length}</span>
            <span className="sr-only">recipients</span>
          </button>

          <Button size="sm" onClick={goToSend} loading={sending} className="ml-auto" aria-label="Send for signing">
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sm:hidden">Send</span>
            <span className="hidden sm:inline">Send for signing</span>
          </Button>
        </div>
      </div>

      <div className="flex items-start">
        <aside className="sticky top-[112px] hidden h-[calc(100vh-7rem)] w-[196px] shrink-0 overflow-y-auto border-r border-hairline bg-surface px-3 py-4 lg:block">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-overline text-slate">
            Field tools
          </p>
          {toolButtons(false)}
          <div className="mt-5 rounded border border-dashed border-hairline-strong px-2.5 py-3 text-[11px] leading-4 text-slate">
            {activeTool
              ? `Click or drag on a page to place ${FIELD_DEFINITIONS[activeTool].label.toLowerCase()}.`
              : "Choose a tool, then click or drag on the document. Arrow keys nudge a selected field."}
          </div>
        </aside>

        <div
          ref={workbenchRef}
          className="min-w-0 flex-1 overflow-x-auto bg-[#EDEEEF]/70 px-4 py-6 sm:px-8"
        >
          <div className="mx-auto" style={{ width: pageWidth }}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-slate">
              <p>
                {activeRecipient
                  ? `Placing fields for ${activeRecipient.name}`
                  : "Add a recipient to place fields"}
              </p>
              <p className="tabular">
                {fields.length} field{fields.length === 1 ? "" : "s"} · {recipients.length} recipient
                {recipients.length === 1 ? "" : "s"}
              </p>
            </div>
            <PdfViewer
              url={fileUrl}
              width={pageWidth}
              renderPageOverlay={(pageIndex) => (
                <div
                  data-page-overlay
                  className={cn("absolute inset-0", activeTool ? "cursor-crosshair" : "cursor-default")}
                  onPointerDown={(event) => beginPageInteraction(event, pageIndex)}
                >
                  {draftRect?.pageIndex === pageIndex ? (
                    <div
                      className="pointer-events-none absolute rounded-sm border-2 border-dashed border-gold bg-warning-bg/40"
                      style={{
                        left: `${draftRect.field.x * 100}%`,
                        top: `${draftRect.field.y * 100}%`,
                        width: `${draftRect.field.width * 100}%`,
                        height: `${draftRect.field.height * 100}%`,
                      }}
                    />
                  ) : null}
                  {fields
                    .filter((field) => field.pageIndex === pageIndex)
                    .map((field) => (
                      <FieldBox
                        key={field.id}
                        field={field}
                        pageIndex={pageIndex}
                        recipientIndex={recipients.findIndex((recipient) => recipient.id === field.recipientId)}
                        recipientName={
                          recipients.find((recipient) => recipient.id === field.recipientId)?.name ?? ""
                        }
                        selected={field.id === selectedFieldId}
                        dimmed={
                          Boolean(selectedRecipientId) && field.recipientId !== selectedRecipientId
                        }
                        onPointerDown={(event) => beginFieldDrag(event, field, "move")}
                        onResizeStart={(event) => beginFieldDrag(event, field, "resize")}
                        onKeyDown={(event) => nudgeField(event, field)}
                      />
                    ))}
                </div>
              )}
            />
          </div>
        </div>

        <aside className="sticky top-[112px] hidden h-[calc(100vh-7rem)] w-[300px] shrink-0 overflow-y-auto border-l border-hairline bg-surface px-4 py-4 xl:block">
          {recipientsPanel("desktop")}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/97 px-2 py-1.5 backdrop-blur-md xl:hidden">
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
          {toolButtons(true)}
          <button
            type="button"
            onClick={() => setRecipientsOpen(true)}
            className="flex min-h-[52px] shrink-0 flex-col items-center justify-center gap-1 rounded px-3 text-[10px] text-slate hover:bg-surface-subtle hover:text-ink"
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Recipients
          </button>
        </div>
      </div>

      <Modal
        open={recipientsOpen}
        onClose={() => setRecipientsOpen(false)}
        title="Recipients and fields"
        description="Fields are only visible to the recipient they belong to."
        size="md"
      >
        {recipientsPanel("mobile")}
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={() => {
          if (removeTarget) removeRecipient(removeTarget);
        }}
        title="Remove this recipient?"
        description="Their fields will also be removed from the document preparation."
        confirmLabel="Remove recipient"
      >
        <p className="text-[13px] leading-6 text-slate">
          {removeTarget?.name || removeTarget?.email} will no longer receive this document.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function FieldBox({
  field,
  pageIndex,
  recipientIndex,
  recipientName,
  selected,
  dimmed,
  onPointerDown,
  onResizeStart,
  onKeyDown,
}: {
  field: EditorField;
  pageIndex: number;
  recipientIndex: number;
  recipientName: string;
  selected: boolean;
  dimmed: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  const color = recipientColor(Math.max(0, recipientIndex));
  const Icon = TOOL_ICONS[field.type];
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${FIELD_DEFINITIONS[field.type].label} for ${recipientName || "recipient"} on page ${pageIndex + 1}${field.required ? ", required" : ""}`}
      aria-pressed={selected}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className={cn(
        "group absolute flex items-center justify-center rounded-sm text-[10px] transition-opacity",
        selected ? "z-10 outline-none" : "z-[1]",
        dimmed ? "opacity-45" : "opacity-100",
      )}
      style={{
        left: `${field.x * 100}%`,
        top: `${field.y * 100}%`,
        width: `${field.width * 100}%`,
        height: `${field.height * 100}%`,
        border: `1px solid ${selected ? "#B89558" : color.border}`,
        backgroundColor: selected ? "rgba(184,149,88,0.12)" : color.fill,
        boxShadow: selected ? "0 0 0 2px #B89558" : undefined,
        cursor: "move",
        touchAction: "none",
      }}
    >
      <span
        className="pointer-events-none flex max-w-full items-center gap-1 overflow-hidden px-1 font-semibold uppercase tracking-wide"
        style={{ color: color.text }}
      >
        <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
        {field.width > 0.09 ? (
          <span className="truncate">
            {field.label || FIELD_DEFINITIONS[field.type].label}
            {field.required ? " *" : ""}
          </span>
        ) : null}
      </span>
      {selected ? (
        <span
          role="presentation"
          onPointerDown={onResizeStart}
          className="absolute -bottom-[5px] -right-[5px] h-2.5 w-2.5 cursor-nwse-resize rounded-[2px] border border-white bg-gold"
        />
      ) : null}
    </div>
  );
}

function RecipientsPanel({
  idPrefix,
  recipients,
  fields,
  selectedRecipientId,
  selectedField,
  addFormOpen,
  setAddFormOpen,
  newName,
  newEmail,
  setNewName,
  setNewEmail,
  recipientError,
  setRecipientError,
  onAdd,
  onSelectRecipient,
  onRemove,
  onUpdateField,
  onDeleteField,
  recipientLimit,
  planName,
}: {
  idPrefix: string;
  recipients: EditorRecipient[];
  fields: EditorField[];
  selectedRecipientId: string | null;
  selectedField: EditorField | null;
  addFormOpen: boolean;
  setAddFormOpen: (open: boolean) => void;
  newName: string;
  newEmail: string;
  setNewName: (value: string) => void;
  setNewEmail: (value: string) => void;
  recipientError: string | null;
  setRecipientError: (value: string | null) => void;
  onAdd: () => void;
  onSelectRecipient: (id: string) => void;
  onRemove: (recipient: EditorRecipient) => void;
  onUpdateField: (patch: Partial<EditorField>) => void;
  onDeleteField: (fieldId: string) => void;
  recipientLimit: number;
  planName: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="overline">Recipients</p>
          <p className="mt-1 text-[12px] text-slate">
            {recipients.length} of {recipientLimit} on {planName}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddFormOpen(!addFormOpen);
            setRecipientError(null);
          }}
          className="flex h-8 items-center gap-1 rounded border border-hairline px-2 text-[12px] font-medium text-ink-secondary hover:bg-surface-subtle"
        >
          {addFormOpen ? <X className="h-3.5 w-3.5" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
          {addFormOpen ? "Close" : "Add"}
        </button>
      </div>

      {addFormOpen ? (
        <div className="mt-3 rounded-md border border-hairline bg-surface-subtle/50 p-3">
          <div className="space-y-2.5">
            <div>
              <Label htmlFor={`${idPrefix}-recipient-name`}>Full name</Label>
              <Input
                id={`${idPrefix}-recipient-name`}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                placeholder="Alex Morgan"
                className="h-10 text-[13.5px]"
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-recipient-email`}>Email</Label>
              <Input
                id={`${idPrefix}-recipient-email`}
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="alex@company.com"
                className="h-10 text-[13.5px]"
                onKeyDown={(event) => {
                  if (event.key === "Enter") onAdd();
                }}
              />
            </div>
            <FieldError>{recipientError}</FieldError>
            <Button size="sm" onClick={onAdd} className="w-full">
              Add recipient
            </Button>
          </div>
        </div>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {recipients.map((recipient, index) => {
          const color = recipientColor(index);
          const count = fields.filter((field) => field.recipientId === recipient.id).length;
          const active = recipient.id === selectedRecipientId;
          return (
            <li key={recipient.id}>
              <div
                className={cn(
                  "group flex items-center gap-2 rounded border px-2.5 py-2 transition-colors",
                  active ? "border-hairline bg-surface-subtle" : "border-transparent hover:bg-surface-subtle/60",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelectRecipient(recipient.id)}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                  aria-pressed={active}
                >
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: color.border }}
                    aria-hidden="true"
                  >
                    {(recipient.name || recipient.email).slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-ink">
                      {recipient.name || "Unnamed"}
                    </span>
                    <span className="block truncate text-[11px] text-slate">{recipient.email}</span>
                  </span>
                </button>
                <span className="tabular rounded-pill bg-surface px-1.5 py-0.5 text-[10px] text-slate">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(recipient)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate opacity-0 transition-opacity hover:bg-[#FBEAEA] hover:text-danger focus:opacity-100 group-hover:opacity-100"
                  aria-label={`Remove ${recipient.name || recipient.email}`}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 border-t border-hairline pt-4">
        <p className="overline">Field properties</p>
        {!selectedField ? (
          <p className="mt-2 text-[12px] leading-5 text-slate">
            Select a placed field to change its recipient, label, or required state.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold text-ink">
                {FIELD_DEFINITIONS[selectedField.type].label}
              </span>
              <span className="text-slate">Page {selectedField.pageIndex + 1}</span>
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-field-recipient`}>Assigned to</Label>
              <Select
                id={`${idPrefix}-field-recipient`}
                value={selectedField.recipientId}
                className="h-10 text-[13px]"
                onChange={(event) => onUpdateField({ recipientId: event.target.value })}
              >
                {recipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name || recipient.email}
                  </option>
                ))}
              </Select>
            </div>
            {selectedField.type === "text" || selectedField.type === "title" || selectedField.type === "name" ? (
              <div>
                <Label htmlFor={`${idPrefix}-field-label`}>Field label</Label>
                <Input
                  id={`${idPrefix}-field-label`}
                  value={selectedField.label ?? ""}
                  maxLength={120}
                  className="h-10 text-[13px]"
                  onChange={(event) => onUpdateField({ label: event.target.value })}
                />
              </div>
            ) : null}
            <Checkbox
              id={`${idPrefix}-field-required`}
              checked={selectedField.required}
              onChange={(event) => onUpdateField({ required: event.target.checked })}
              label="Required to complete signing"
            />
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-danger hover:bg-[#FBEAEA]"
              onClick={() => onDeleteField(selectedField.id)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              Delete field
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
