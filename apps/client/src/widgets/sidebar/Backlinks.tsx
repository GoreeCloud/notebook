import "./Backlinks.css";

import { BacklinkCountResponse, BacklinksResponse } from "@triliumnext/commons";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";

import FNote from "../../entities/fnote";
import attributes from "../../services/attributes";
import froca from "../../services/froca";
import { t } from "../../services/i18n";
import LoadResults from "../../services/load_results";
import { sanitizeNoteContentHtml } from "../../services/sanitize_content";
import server from "../../services/server";
import { useActiveNoteContext, useTriliumEvent } from "../react/hooks";
import NoItems from "../react/NoItems";
import NoteLink from "../react/NoteLink";
import RawHtml from "../react/RawHtml";
import RightPanelWidget from "./RightPanelWidget";
import SidebarHelp from "./SidebarHelp";

export default function Backlinks() {
    const { note } = useActiveNoteContext();

    return (
        <RightPanelWidget
            id="backlinks"
            title={t("right_pane.backlinks")}
            buttons={<SidebarHelp section="backlinks" />}
        >
            {note && <BacklinksWidget note={note} />}
        </RightPanelWidget>
    );
}

/**
 * {@link BacklinksList} in the markup its styling hangs off (see Backlinks.css), for the places that
 * frame the list: this card, the mobile note menu's modal and the status bar's dropdown.
 */
export function BacklinksWidget({ note }: { note: FNote }) {
    return (
        <div class="tn-backlinks-widget">
            <ul class="backlinks-items">
                <BacklinksList note={note} />
            </ul>
        </div>
    );
}

export function BacklinksList({ note }: { note: FNote }) {
    const [ result, setResult ] = useState<{ noteId: string; backlinks: BacklinksResponse }>();
    const [ failedNoteId, setFailedNoteId ] = useState<string>();
    const requestIdRef = useRef(0);

    function refresh() {
        const requestId = ++requestIdRef.current;
        const noteId = note.noteId;
        setFailedNoteId(undefined);
        // Hide the last snapshot while refreshing, particularly when the active note changes.
        setResult(undefined);
        void server.get<BacklinksResponse>(`note-map/${noteId}/backlinks`).then(async (backlinks) => {
            if (requestId !== requestIdRef.current) return;
            const noteIds = backlinks.filter(bl => "noteId" in bl).map(bl => bl.noteId);
            await froca.getNotes(noteIds);
            if (requestId === requestIdRef.current) setResult({ noteId, backlinks });
        }).catch(() => {
            if (requestId === requestIdRef.current) setFailedNoteId(noteId);
        });
    }

    useEffect(() => {
        refresh();
        // Unmounted lists and notes we have navigated away from must not accept late responses.
        return () => { requestIdRef.current++; };
    }, [ note ]);
    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (needsRefresh(note, loadResults)) refresh();
    });

    if (failedNoteId === note.noteId) {
        return (
            <li className="backlinks-error">
                <NoItems size="small" icon="bx bx-error-circle" text={t("zpetne_odkazy.unavailable")}>
                    <button type="button" className="btn btn-link backlinks-retry" onClick={refresh}>
                        {t("zpetne_odkazy.retry")}
                    </button>
                </NoItems>
            </li>
        );
    }

    // State belongs to the fetched note, not just to this persistent sidebar component.
    if (result?.noteId !== note.noteId) return null;
    const { backlinks } = result;

    if (!backlinks.length) {
        return (
            // An item of the `<ul>` that `BacklinksWidget` renders the list into.
            <li className="backlinks-empty">
                <NoItems size="small" icon="bx bx-link" text={t("zpetne_odkazy.no_backlinks")} />
            </li>
        );
    }

    // Keyed by position: one source note takes a row per relation it points with, so a note ID names
    // no single row, and the whole list is rebuilt at once anyway.
    return backlinks.map((backlink, index) => (
        <li key={index}>
            {/* Named so that the styling has something to hang off other than the position of the
                link within the item (see Backlinks.css). */}
            <NoteLink
                notePath={backlink.noteId}
                containerClassName="backlink-header"
                showNotePath showNoteIcon
                noPreview
            />

            {"relationName" in backlink ? (
                <p className="backlink-relation">{backlink.relationName}</p>
            ) : (
                backlink.excerpts.map((excerpt, excerptIndex) => (
                    <RawHtml key={excerptIndex} html={sanitizeNoteContentHtml(excerpt)} />
                ))
            )}
        </li>
    ));
}

export function useBacklinkCount(note: FNote | null | undefined, isDefaultViewMode: boolean) {
    const [ backlinkCount, setBacklinkCount ] = useState(0);

    const refresh = useCallback(() => {
        if (!note || !isDefaultViewMode) return;

        server.get<BacklinkCountResponse>(`note-map/${note.noteId}/backlink-count`).then(resp => {
            setBacklinkCount(resp.count);
        });
    }, [ isDefaultViewMode, note ]);

    useEffect(() => refresh(), [ refresh ]);
    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (note && needsRefresh(note, loadResults)) refresh();
    });

    return backlinkCount;
}

function needsRefresh(note: FNote, loadResults: LoadResults) {
    return loadResults.getAttributeRows().some(attr =>
        attr.type === "relation" &&
        attributes.isAffecting(attr, note));
}
