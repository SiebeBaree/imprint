/* oxlint-disable no-await-in-loop -- Upload files sequentially to bound memory and show progress for the active file. */
import { Check, FileText, Plus, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { useAssetActions } from "./api";
export function UploadZone({
    pdf = false,
    count = 0,
    onDone,
    compact = false,
}: {
    pdf?: boolean;
    count?: number;
    onDone?: () => void;
    compact?: boolean;
}) {
    const input = useRef<HTMLInputElement>(null);
    const [drag, setDrag] = useState(false);
    const [status, setStatus] = useState<{ name: string; progress: number; index: number; total: number } | null>(null);
    const { upload } = useAssetActions();
    async function filesSelected(files: FileList | File[]) {
        const chosen = [...files];
        if (!pdf && chosen.length + count > 50) {
            toast.error(`You can add ${Math.max(0, 50 - count)} more reference images.`);
            return;
        }
        if (pdf && chosen.length > 1) {
            toast.error("Choose one brand guidelines PDF.");
            return;
        }
        for (const [index, file] of chosen.entries()) {
            if (
                pdf ? file.type !== "application/pdf" : !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ) {
                toast.error(`${file.name}: choose ${pdf ? "a PDF" : "a JPG, PNG or WebP image"}.`);
                continue;
            }
            setStatus({ name: file.name, progress: 0, index: index + 1, total: chosen.length });
            try {
                await upload.mutateAsync({
                    file,
                    progress: (progress) =>
                        setStatus({ name: file.name, progress, index: index + 1, total: chosen.length }),
                });
            } catch (error) {
                toast.error(error instanceof Error ? error.message : "Upload failed.");
            }
        }
        setStatus(null);
        if (input.current) input.current.value = "";
        onDone?.();
    }
    function drop(event: DragEvent) {
        event.preventDefault();
        setDrag(false);
        if (!status) void filesSelected(event.dataTransfer.files);
    }
    return (
        <div
            className={`upload-zone ${drag ? "dragging" : ""} ${compact ? "compact" : ""}`}
            onDragOver={(event) => {
                event.preventDefault();
                setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={drop}
        >
            <input
                ref={input}
                className="sr-only"
                type="file"
                accept={pdf ? ".pdf" : "image/jpeg,image/png,image/webp"}
                multiple={!pdf}
                aria-label={pdf ? "Upload brand guidelines PDF" : "Upload reference images"}
                onChange={(event) => {
                    if (event.target.files) void filesSelected(event.target.files);
                }}
                disabled={Boolean(status)}
            />
            <button
                className="upload-trigger"
                type="button"
                onClick={() => input.current?.click()}
                disabled={Boolean(status)}
            >
                {status ? (
                    <>
                        <Upload size={22} />
                        <strong>
                            {status.progress >= 95 ? "Processing" : "Uploading"} {status.index} of {status.total}
                        </strong>
                        <span>
                            {status.name} · {status.progress}%
                        </span>
                        <progress value={status.progress} max="100" aria-label="Upload progress" />
                    </>
                ) : (
                    <>
                        {pdf ? <FileText size={22} /> : compact ? <Plus size={20} /> : <Upload size={23} />}
                        <strong>
                            {pdf
                                ? "Upload brand guidelines"
                                : compact
                                  ? "Add images"
                                  : "Drop your product and brand images here"}
                        </strong>
                        <span>
                            {pdf
                                ? "PDF with selectable text · Up to 25 MB"
                                : compact
                                  ? "JPG, PNG or WebP"
                                  : "or choose files · JPG, PNG or WebP · Up to 20 MB each"}
                        </span>
                    </>
                )}
            </button>
        </div>
    );
}
export function FileReady({ name }: { name: string }) {
    return (
        <div className="file-ready">
            <FileText size={20} />
            <span>{name}</span>
            <Check size={16} />
        </div>
    );
}
