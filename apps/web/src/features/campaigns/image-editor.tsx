import type { Campaign, CampaignItem } from "@repo/contracts";
import { ArrowUp, Check, Copy, Download, History, RotateCcw, ScanLine } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ErrorMessage, Field, Modal } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { formatDate, formatTime } from "@/lib/dates";

import { useCampaignActions } from "./api";
export function ImageEditor({ campaign, item, close }: { campaign: Campaign; item: CampaignItem; close: () => void }) {
    const actions = useCampaignActions(campaign.id);
    const [tab, setTab] = useState("image");
    const [versionId, setVersionId] = useState<string | null>(null);
    const [prompt, setPrompt] = useState("");
    const [caption, setCaption] = useState(item.caption);
    const [publishDate, setPublishDate] = useState(item.publishDate);
    const [publishTime, setPublishTime] = useState(item.publishTime);
    const [compare, setCompare] = useState(false);
    const [history, setHistory] = useState(false);
    const [copied, setCopied] = useState(false);
    const version =
        item.versions.find((entry) => entry.id === (versionId ?? item.currentVersionId)) ??
        item.versions.find((entry) => entry.url);
    const original = item.versions.toReversed().find((entry) => entry.url);
    const working = ["queued", "generating", "checking"].includes(item.status);
    const latestError = item.versions.find((entry) => entry.status === "failed")?.error;
    async function edit() {
        if (!version) return;
        try {
            await actions.edit.mutateAsync({ itemId: item.id, baseVersionId: version.id, prompt });
            track("image_edit_requested", { format: item.format });
            setPrompt("");
            setVersionId(null);
            toast.success("Editing your image. You can keep browsing.");
        } catch {
            /* Keep the prompt for retry. */
        }
    }
    async function download() {
        try {
            const file = await actions.download.mutateAsync(item.id);
            const anchor = document.createElement("a");
            anchor.href = file.url;
            anchor.download = file.filename;
            anchor.rel = "noopener";
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            track("image_downloaded", { format: item.format });
        } catch {
            /* Shown below. */
        }
    }
    return (
        <Modal
            open
            onOpenChange={(open) => {
                if (!open) close();
            }}
            title={item.title}
            className="image-editor-modal"
        >
            <div className="image-editor">
                <div className="editor-canvas">
                    <div className="canvas-toolbar">
                        <span>Instagram {item.format === "feed" ? "feed · 4:5" : "story · 9:16"}</span>
                        <div>
                            {item.versions.filter((entry) => entry.url).length > 1 && (
                                <button className={compare ? "selected" : ""} onClick={() => setCompare(!compare)}>
                                    <ScanLine size={15} />
                                    Compare
                                </button>
                            )}
                            <button onClick={() => setHistory(!history)}>
                                <History size={15} />
                                Versions
                            </button>
                        </div>
                    </div>
                    <div className={`editor-image-stage ${compare ? "comparing" : ""}`}>
                        {compare && original?.url && (
                            <figure>
                                <img src={original.url} alt="Original version" />
                                <figcaption>Original</figcaption>
                            </figure>
                        )}
                        {version?.url ? (
                            <figure>
                                <img src={version.url} alt={item.title} />
                                <figcaption>{compare ? `Version ${version.number}` : ""}</figcaption>
                            </figure>
                        ) : (
                            <div className="unavailable-image">This image is not ready yet.</div>
                        )}
                    </div>
                    {history && (
                        <div className="version-history">
                            {item.versions.map((entry) => (
                                <button
                                    className={entry.id === version?.id ? "selected" : ""}
                                    key={entry.id}
                                    onClick={() => {
                                        setVersionId(entry.id);
                                        setCompare(false);
                                    }}
                                    disabled={!entry.url}
                                >
                                    {entry.url ? (
                                        <img src={entry.url} alt={`Version ${entry.number}`} />
                                    ) : (
                                        <span>…</span>
                                    )}
                                    <span>
                                        V{entry.number}
                                        {entry.id === item.currentVersionId ? <Check size={12} /> : null}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                    {version && version.id !== item.currentVersionId && (
                        <div className="restore-bar">
                            <span>Viewing version {version.number}</span>
                            <Button
                                variant="outline"
                                disabled={working || actions.restore.isPending}
                                onClick={async () => {
                                    try {
                                        await actions.restore.mutateAsync({ itemId: item.id, versionId: version.id });
                                        setVersionId(null);
                                        toast.success("Version restored.");
                                    } catch {
                                        /* Shown beside controls. */
                                    }
                                }}
                            >
                                <RotateCcw size={14} />
                                Use this version
                            </Button>
                        </div>
                    )}
                </div>
                <aside className="editor-panel">
                    <div className="tabs" role="tablist" aria-label="Edit post">
                        <button role="tab" aria-selected={tab === "image"} onClick={() => setTab("image")}>
                            Image
                        </button>
                        <button role="tab" aria-selected={tab === "caption"} onClick={() => setTab("caption")}>
                            Caption & schedule
                        </button>
                    </div>
                    {tab === "image" ? (
                        <div className="editor-panel-content">
                            <div className="editor-context">
                                <h3>{item.concept}</h3>
                                <p>
                                    {formatDate(item.publishDate)} at {formatTime(item.publishTime)}
                                </p>
                            </div>
                            {version?.quality && !version.quality.passed && (
                                <div className="image-quality-issues">
                                    <h3>Needs review</h3>
                                    <ul>
                                        {version.quality.issues.map((issue) => (
                                            <li key={issue}>{issue}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {working ? (
                                <output className="edit-progress">
                                    <div className="loading-line" />
                                    <h3>{item.status === "checking" ? "Checking the edit" : "Editing your image"}</h3>
                                    <p>Your current image is saved. This can take a few minutes.</p>
                                </output>
                            ) : (
                                <form
                                    className="edit-prompt"
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        void edit();
                                    }}
                                >
                                    <label htmlFor="image-prompt">What would you like to change?</label>
                                    <div>
                                        <textarea
                                            id="image-prompt"
                                            placeholder="Move the jar closer to the toast. Keep everything else the same."
                                            value={prompt}
                                            onChange={(event) => setPrompt(event.target.value)}
                                            minLength={3}
                                            maxLength={2000}
                                            rows={4}
                                        />
                                        <Button
                                            type="submit"
                                            size="icon"
                                            aria-label="Apply image edit"
                                            disabled={!version || prompt.trim().length < 3 || actions.edit.isPending}
                                        >
                                            <ArrowUp size={17} />
                                        </Button>
                                    </div>
                                    <p>Describe the change. Imprint will keep the rest of the image.</p>
                                </form>
                            )}
                            <ErrorMessage
                                error={
                                    actions.edit.error ||
                                    actions.restore.error ||
                                    (item.status === "failed" ? latestError : null)
                                }
                            />
                            <div className="editor-caption-preview">
                                <div className="section-label">
                                    <h3>Caption</h3>
                                    <button className="text-link" onClick={() => setTab("caption")}>
                                        Edit
                                    </button>
                                </div>
                                <p>{item.caption}</p>
                                <button
                                    className="copy-button"
                                    onClick={async () => {
                                        try {
                                            await navigator.clipboard.writeText(item.caption);
                                            setCopied(true);
                                        } catch {
                                            toast.error("Could not copy. Select the caption and copy it manually.");
                                        }
                                    }}
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? "Copied" : "Copy caption"}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form
                            className="editor-panel-content caption-form"
                            onSubmit={async (event) => {
                                event.preventDefault();
                                try {
                                    await actions.save.mutateAsync({
                                        itemId: item.id,
                                        caption,
                                        publishDate,
                                        publishTime,
                                        revision: item.revision,
                                    });
                                    toast.success("Post updated.");
                                } catch {
                                    /* Shown below. */
                                }
                            }}
                        >
                            <Field label="Instagram caption" htmlFor="caption">
                                <textarea
                                    id="caption"
                                    value={caption}
                                    onChange={(event) => setCaption(event.target.value)}
                                    maxLength={2200}
                                    rows={11}
                                />
                                <span className="caption-count">{caption.length} / 2,200</span>
                            </Field>
                            <div className="schedule-fields">
                                <Field label="Post date" htmlFor="post-date">
                                    <input
                                        id="post-date"
                                        type="date"
                                        required
                                        value={publishDate}
                                        onChange={(event) => setPublishDate(event.target.value)}
                                    />
                                </Field>
                                <Field label="Time" htmlFor="post-time">
                                    <input
                                        id="post-time"
                                        type="time"
                                        required
                                        value={publishTime}
                                        onChange={(event) => setPublishTime(event.target.value)}
                                    />
                                </Field>
                            </div>
                            <ErrorMessage error={actions.save.error} />
                            <Button type="submit" disabled={actions.save.isPending}>
                                {actions.save.isPending ? "Saving…" : "Save caption & schedule"}
                            </Button>
                        </form>
                    )}
                    <div className="editor-panel-footer">
                        <ErrorMessage error={actions.download.error} />
                        <Button
                            className="download-button"
                            variant="outline"
                            disabled={!item.currentVersionId || actions.download.isPending}
                            onClick={() => void download()}
                        >
                            <Download size={16} />
                            Download {versionId && versionId !== item.currentVersionId ? "current image" : "image"}
                        </Button>
                        <p>PNG · {item.format === "feed" ? "896 × 1120" : "720 × 1280"} px</p>
                    </div>
                </aside>
            </div>
        </Modal>
    );
}
