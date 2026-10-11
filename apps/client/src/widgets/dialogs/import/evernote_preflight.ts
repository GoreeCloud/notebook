/**
 * Bounded, read-only ENEX selection inspection.
 *
 * This is a UX guard, NOT full XML validation, authentication, duplicate
 * detection, or an importer guarantee. Read only the initial 16 KiB of each
 * local file; no contents leave the browser during this inspection.
 */
export type EvernotePreflightCode = "ready" | "empty" | "extension" | "doctype" | "header" | "duplicate" | "unreadable";

export interface EvernotePreflightResult {
    source: EvernotePreflightFile;
    name: string;
    bytes: number;
    code: EvernotePreflightCode;
    ready: boolean;
}

export type EvernotePreflightFile = Pick<File, "name" | "size" | "slice"> & Partial<Pick<File, "lastModified">>;

const HEADER_BYTES = 16 * 1024;
const ENEX_OPEN_TAG = /^(?:<\?xml\s[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<en-export(?=[\s/>])/i;
const UNSAFE_DECLARATION = /<!\s*(?:doctype|entity)\b/i;

export async function inspectEvernoteFile(file: EvernotePreflightFile): Promise<EvernotePreflightResult> {
    const result = (code: EvernotePreflightCode): EvernotePreflightResult => ({
        source: file,
        name: file.name,
        bytes: file.size,
        code,
        ready: code === "ready"
    });

    if (!/\.enex$/i.test(file.name)) {
        return result("extension");
    }
    if (file.size <= 0) {
        return result("empty");
    }
    try {
        // The file stays local until the explicit import action; no whole-file
        // read, XML DOM construction, external entity resolution, or network.
        const header = (await file.slice(0, HEADER_BYTES).text()).replace(/^\uFEFF/, "").trimStart();
        // Only XML declarations BEFORE the export root are relevant to
        // the header review. Note content can legitimately contain a
        // literal "<!DOCTYPE" in an example or CDATA string.
        const rootMatch = ENEX_OPEN_TAG.exec(header);
        const rootStart = rootMatch ? rootMatch[0].lastIndexOf("<en-export") : header.length;
        const prolog = header.slice(0, rootStart);
        if (UNSAFE_DECLARATION.test(prolog)) {
            return result("doctype");
        }
        if (!rootMatch) {
            return result("header");
        }
        return result("ready");
    } catch {
        return result("unreadable");
    }
}

export async function inspectEvernoteSelection(files: readonly EvernotePreflightFile[]): Promise<EvernotePreflightResult[]> {
    const checks = await Promise.all(files.map(inspectEvernoteFile));
    const seen = new Set<EvernotePreflightFile>();
    const identities = new Set<string>();
    return checks.map((check) => {
        const file = check.source;
        const identity = typeof file.lastModified === "number"
            ? JSON.stringify([file.name, file.size, file.lastModified]) : undefined;
        const repeated = seen.has(file) || (identity !== undefined && identities.has(identity));
        seen.add(file);
        if (identity !== undefined) identities.add(identity);
        return check.ready && repeated ? { ...check, code: "duplicate", ready: false } : check;
    });
}

export function canImportEvernote(
    files: readonly EvernotePreflightFile[],
    results: readonly EvernotePreflightResult[],
    backupConfirmed: boolean,
    inspecting: boolean
): boolean {
    if (inspecting || !backupConfirmed || files.length === 0 || files.length !== results.length) {
        return false;
    }
    return results.every((result, index) =>
        result.ready && result.source === files[index]
    );
}
