import "./evernote_review.css";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import { t } from "../../../services/i18n.js";
import importService from "../../../services/import.js";
import { fileAccept } from "../../../services/utils.js";
import Button from "../../react/Button.js";
import { Card, CardSection } from "../../react/Card.js";
import FileDropZone from "../../react/FileDropZone.js";
import { useTriliumOptionBool } from "../../react/hooks.js";
import OptionsRow, { OptionsRowWithToggle } from "../../type_widgets/options/components/OptionsRow.js";
import { canImportEvernote, inspectEvernoteSelection, type EvernotePreflightResult } from "./evernote_preflight.js";
import iconUrl from "./icons/evernote.svg?url";
import type { ImportProvider, ImportProviderPanelProps } from "./types.js";

function EvernotePanel({ parentNoteId, closeDialog, setFooter }: ImportProviderPanelProps) {
    const [files, setFiles] = useState<File[]>([]);
    const [results, setResults] = useState<EvernotePreflightResult[]>([]);
    const [inspecting, setInspecting] = useState(false);
    const [backupConfirmed, setBackupConfirmed] = useState(false);
    const [compressImages] = useTriliumOptionBool("compressImages");
    const [shrinkImages, setShrinkImages] = useState(compressImages);

    // An Evernote export is one ENEX (.enex) file per notebook, so allow selecting several at once.
    const onChange = useCallback((fileList: File[] | null) => setFiles(fileList ?? []), []);

    // Selection preflight is strictly local and reads only a bounded prefix.
    // Dropping/adding a file invalidates both prior checks and backup consent.
    useEffect(() => {
        let active = true;
        setBackupConfirmed(false);
        setResults([]);
        setInspecting(files.length > 0);
        if (files.length) {
            void inspectEvernoteSelection(files).then((checks) => {
                if (active) setResults(checks);
            }).finally(() => {
                if (active) setInspecting(false);
            });
        }
        return () => { active = false; };
    }, [files]);

    const ready = canImportEvernote(files, results, backupConfirmed, inspecting);

    const doImport = useCallback(async () => {
        if (!canImportEvernote(files, results, backupConfirmed, inspecting)) {
            return;
        }

        // Close immediately and let the shared import toasts (registered in import.ts) report progress,
        // completion and any error. Unlike Notion (a .zip that needs an explicit format tag), an ENEX
        // upload is routed by its .enex extension on the shared file-import endpoint, so no format is set;
        // each file becomes its own notebook root. uploadFiles surfaces upload errors via its own toast,
        // so swallow the rejection to avoid an unhandled rejection from this void-ed call.
        closeDialog();
        await importService.uploadFiles("notes", parentNoteId, files, { safeImport: "true", shrinkImages: shrinkImages ? "true" : "false" }).catch(() => {});
    }, [files, results, backupConfirmed, inspecting, shrinkImages, parentNoteId, closeDialog]);

    // Keep the latest import handler in a ref so the footer effect depends only on whether files are
    // selected, never on doImport's identity — otherwise re-pushing the footer on every change would loop
    // with the parent re-rendering us back (see the Notion/OneNote panels for the same reasoning).
    const doImportRef = useRef(doImport);
    doImportRef.current = doImport;

    useEffect(() => {
        setFooter(
            <Button
                text={t("evernote_import.import")}
                kind="primary"
                disabled={!ready}
                onClick={() => void doImportRef.current()}
            />
        );
    }, [ready, setFooter]);

    return (
        <Card heading={t("evernote_import.choose_file")}>
            <CardSection>
                <OptionsRow name="import-file" description={t("evernote_import.description_long")} stacked>
                    <FileDropZone multiple onChange={onChange} accept={fileAccept(".enex")} />
                </OptionsRow>
                <OptionsRowWithToggle
                    name="shrink-images"
                    label={t("import.shrinkImages")}
                    description={t("import.shrinkImagesProviderTooltip")}
                    currentValue={compressImages && shrinkImages}
                    onChange={setShrinkImages}
                    disabled={!compressImages}
                />
                {files.length > 0 && (
                    <section className="goreecloud-enex-review" aria-label={t("goreecloud_notebook.enex.review_title")}>
                        <h6>{t("goreecloud_notebook.enex.review_title")}</h6>
                        <p>{t("goreecloud_notebook.enex.local_check")}</p>
                        {inspecting && <p role="status">{t("goreecloud_notebook.enex.inspecting")}</p>}
                        {!inspecting && (
                            <ul className="goreecloud-enex-review-files">
                                {results.map((result, index) => (
                                    <li key={index} className={result.ready ? "goreecloud-enex-ready" : "goreecloud-enex-blocked"}>
                                        <span aria-hidden="true" className={result.ready ? "bx bx-check-circle" : "bx bx-error-circle"} />
                                        <span className="goreecloud-enex-filename">{result.name}</span>
                                        <small>{new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(result.bytes / 1048576)} MiB</small>
                                        <span className="goreecloud-enex-status">{t(`goreecloud_notebook.enex.${result.code}`)}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="goreecloud-enex-caution">{t("goreecloud_notebook.enex.qualification_warning")}</p>
                        <label className="goreecloud-enex-confirmation">
                            <input type="checkbox" checked={backupConfirmed}
                                onChange={(event) => setBackupConfirmed(event.currentTarget.checked)}
                                disabled={inspecting || !results.length || results.some(result => !result.ready)} />
                            <span>{t("goreecloud_notebook.enex.backup_confirmation")}</span>
                        </label>
                    </section>
                )}
            </CardSection>
        </Card>
    );
}

const provider: ImportProvider = {
    id: "evernote",
    helpPage: "syuSEKf2rUGr",
    name: t("evernote_import.name"),
    iconUrl,
    description: t("evernote_import.description"),
    Panel: EvernotePanel
};

export default provider;
