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
    const [ filterQuery, setFilterQuery ] = useState("");

    // Moving between notes starts a fresh search rather than carrying an unrelated filter.
    useEffect(() => setFilterQuery(""), [ note.noteId ]);

    return (
        <div class="tn-backlinks-widget">
            <div class="backlinks-filter">
                <input
                    aria-label={t("zpetne_odkazy.filter_label") || "Filter backlinks"}
                    type="search"
                    class="form-control"
                    value={filterQuery}
                    placeholder={t("zpetne_odkazy.filter_placeholder")}
                    onInput={event => setFilterQuery(event.currentTarget.value)}
                />
                {filterQuery && (
                    <button type="button" class="backlinks-filter-clear btn btn-link"
                        onClick={() => setFilterQuery("")}>
                        {t("zpetne_odkazy.clear_filter")}
                    </button>
                )}
            </div>
            <ul class="backlinks-items">
                <BacklinksList note={note} filterQuery={filterQuery} />
            </ul>
        </div>
    );
}

export function BacklinksList({ note, filterQuery = "" }: { note: FNote; filterQuery?: string }) {
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

    // Filter cached source-note titles and relation names without an additional server request.
    const term = filterQuery.trim().toLowerCase();
    const visibleBacklinks = term
        ? backlinks.filter(backlink => {
            const sourceTitle = froca.getNoteFromCache(backlink.noteId)?.title ?? "";
            const relation = "relationName" in backlink ? backlink.relationName : "";
            return sourceTitle.toLowerCase().includes(term) || relation.toLowerCase().includes(term);
        })
        : backlinks;

    if (!visibleBacklinks.length) {
        return (
            <li className="backlinks-no-matches" aria-live="polite">
                <NoItems size="small" icon="bx bx-search" text={t("zpetne_odkazy.no_matches")} />
            </li>
        );
    }

    // Keyed by position: one source note takes a row per relation it points with, so a note ID names
    // no single row, and the whole list is rebuilt at once anyway.
    return visibleBacklinks.map((backlink, index) => (
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
    const [ result, setResult ] = useState<{ noteId: string; count: number }>();
    const requestIdRef = useRef(0);

    const refresh = useCallback(() => {
        const requestId = ++requestIdRef.current;
        if (!note || !isDefaultViewMode) {
            setResult(undefined);
            return;
        }

        const noteId = note.noteId;
        void server.get<BacklinkCountResponse>(`note-map/${noteId}/backlink-count`).then(resp => {
            if (requestId === requestIdRef.current) setResult({ noteId, count: resp.count });
        }).catch(() => {
            // A failed count cannot be shown as a reliable value for this note.
            if (requestId === requestIdRef.current) setResult(undefined);
        });
    }, [ isDefaultViewMode, note ]);

    useEffect(() => {
        refresh();
        return () => { requestIdRef.current++; };
    }, [ refresh ]);
    useTriliumEvent("entitiesReloaded", ({ loadResults }) => {
        if (note && needsRefresh(note, loadResults)) refresh();
    });

    return isDefaultViewMode && result?.noteId === note?.noteId ? result.count : 0;
}

function needsRefresh(note: FNote, loadResults: LoadResults) {
    return loadResults.getAttributeRows().some(attr =>
        attr.type === "relation" &&
        attributes.isAffecting(attr, note));
}
