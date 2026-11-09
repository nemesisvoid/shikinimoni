"use client";

import { useId, useState, type DragEvent } from "react";
import { ExternalLink, FileText, FileUp, Image as ImageIcon, X } from "lucide-react";
import { getDocumentLink } from "@/actions/document.action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DOCUMENT_TYPE_LABEL } from "@/lib/admin/property-options";
import type { DocumentType } from "@/lib/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { DOCUMENT_MIME_TYPES, MAX_DOCUMENT_BYTES, MAX_DOCUMENTS_PER_PROPERTY } from "@/schemas/media.schema";
import type { DocumentItem, StagedDocument } from "./upload-files";

const MAX_MB = MAX_DOCUMENT_BYTES / 1024 / 1024;
const ACCEPT = DOCUMENT_MIME_TYPES.join(",");

/**
 * Title documents, survey plans and the like. They're stored privately: only
 * admins can open them unless "Show to buyers" is on. On the edit page, saved
 * documents sit in the same list as new ones; nothing changes in storage until
 * the property is saved.
 */
export function DocumentPicker({
  documents,
  onChange,
  disabled,
}: {
  documents: DocumentItem[];
  onChange: (documents: DocumentItem[]) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  function addFiles(files: File[]) {
    const problems: string[] = [];
    const room = MAX_DOCUMENTS_PER_PROPERTY - documents.length;
    const accepted: StagedDocument[] = [];
    for (const file of files) {
      if (!(DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
        problems.push(`${file.name}: use a PDF, or a JPEG or PNG scan.`);
      } else if (file.size > MAX_DOCUMENT_BYTES) {
        problems.push(`${file.name}: larger than ${MAX_MB} MB.`);
      } else if (accepted.length >= room) {
        problems.push(`${file.name}: a property can have ${MAX_DOCUMENTS_PER_PROPERTY} documents at most.`);
      } else {
        accepted.push({
          kind: "new",
          id: crypto.randomUUID(),
          file,
          name: nameFromFile(file.name),
          type: guessType(file.name),
          isPublic: false,
        });
      }
    }
    setRejected(problems);
    if (accepted.length) onChange([...documents, ...accepted]);
  }

  const update = (id: string, patch: Partial<Pick<DocumentItem, "name" | "type" | "isPublic">>) =>
    onChange(documents.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!disabled) addFiles([...e.dataTransfer.files]);
  };

  return (
    <div className="flex flex-col gap-4">
      {documents.length > 0 && (
        <ul className="flex flex-col divide-y rounded-2xl border">
          {documents.map((doc, index) => {
            const mimeType = doc.kind === "new" ? doc.file.type : (doc.mimeType ?? "");
            const sizeBytes = doc.kind === "new" ? doc.file.size : doc.sizeBytes;
            const title = doc.kind === "new" ? doc.file.name : doc.name || "Untitled document";
            const isImage = mimeType.startsWith("image/");
            const nameId = `${inputId}-name-${doc.id}`;
            const typeId = `${inputId}-type-${doc.id}`;
            const publicId = `${inputId}-public-${doc.id}`;
            return (
              <li key={doc.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start gap-3">
                  <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-navy-50 text-navy-700">
                    {isImage ? <ImageIcon className="size-5" /> : <FileText className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {isImage ? "Image scan" : "PDF"}
                      {sizeBytes ? `, ${formatBytes(sizeBytes)}` : ""}
                      {doc.kind === "new" && documents.some((d) => d.kind === "saved") ? ", uploads when you save" : ""}
                    </p>
                  </div>
                  {doc.kind === "saved" && <ViewButton documentId={doc.id} name={title} disabled={disabled} />}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onChange(documents.filter((d) => d.id !== doc.id))}
                    disabled={disabled}
                    aria-label={`Remove ${title}`}
                  >
                    <X />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={nameId} className="text-sm font-medium">
                      Name
                    </label>
                    <Input
                      id={nameId}
                      value={doc.name}
                      onChange={(e) => update(doc.id, { name: e.target.value })}
                      disabled={disabled}
                      maxLength={200}
                      aria-invalid={doc.name.trim() === ""}
                      placeholder={`Document ${index + 1}`}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor={typeId} className="text-sm font-medium">
                      Type
                    </label>
                    <Select
                      items={DOCUMENT_TYPE_LABEL}
                      value={doc.type}
                      onValueChange={(value) => value && update(doc.id, { type: value as DocumentType })}
                      disabled={disabled}
                    >
                      <SelectTrigger id={typeId} className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent alignItemWithTrigger={false}>
                        {Object.entries(DOCUMENT_TYPE_LABEL).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <label htmlFor={publicId} className="text-sm">
                    <span className="font-medium">Show to buyers</span>
                    <span className="block text-muted-foreground">
                      {doc.isPublic ? "Buyers can open it from the listing." : "Private: only admins can open it."}
                    </span>
                  </label>
                  <Switch
                    id={publicId}
                    checked={doc.isPublic}
                    onCheckedChange={(on) => update(doc.id, { isPublic: on })}
                    disabled={disabled}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <label
        htmlFor={inputId}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed px-5 py-4 transition-colors",
          "hover:border-primary/50 hover:bg-plum-50/40 has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
          dragging && "border-primary bg-plum-50/60",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-plum-100 text-plum-800">
          <FileUp className="size-5" />
        </span>
        <span className="flex flex-col">
          <span className="font-medium">
            {documents.length === 0 ? "Add documents" : "Add another document"}
            <span className="font-normal text-muted-foreground"> or drop them here</span>
          </span>
          <span className="text-sm text-muted-foreground">PDF, or JPEG/PNG scans, up to {MAX_MB} MB each.</span>
        </span>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          multiple
          disabled={disabled}
          className="sr-only"
          onChange={(e) => {
            addFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>

      {rejected.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {rejected.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Opens a saved document through a 5-minute signed link. The tab opens before
 * the request so popup blockers allow it, then navigates once the link arrives.
 */
function ViewButton({ documentId, name, disabled }: { documentId: string; name: string; disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  async function open() {
    setError(null);
    setOpening(true);
    const tab = window.open("about:blank", "_blank");
    try {
      const result = await getDocumentLink({ id: documentId });
      if (result.ok && tab) tab.location.href = result.data.url;
      else {
        tab?.close();
        setError(result.ok ? "Allow pop-ups to open documents." : result.error);
      }
    } catch {
      tab?.close();
      setError("Couldn't open the document. Try again.");
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" size="sm" onClick={open} disabled={disabled || opening} aria-label={`View ${name}`}>
        <ExternalLink aria-hidden />
        View
      </Button>
      {error && (
        <p role="alert" className="max-w-48 text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** "c_of_o-scan.pdf" → "C of o scan" */
function nameFromFile(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 200);
}

/** A starting guess from the file name; the admin can change it. */
function guessType(fileName: string): DocumentType {
  const n = fileName.toLowerCase().replace(/[_.-]+/g, " ");
  if (/c\s*of\s*o|cofo|consent|title|gazette|excision/.test(n)) return "TITLE_DOCUMENT";
  if (/survey/.test(n)) return "SURVEY_PLAN";
  if (/deed|assignment/.test(n)) return "DEED";
  if (/approval|permit|plan approval/.test(n)) return "BUILDING_APPROVAL";
  if (/receipt|payment/.test(n)) return "RECEIPT";
  return "OTHER";
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
