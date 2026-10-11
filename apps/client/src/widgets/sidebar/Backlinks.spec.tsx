// @vitest-environment jsdom
// The backlink excerpts go through DOMPurify, and happy-dom mishandles the NodeIterator traversal
// it relies on (see sanitize_content.spec.ts); jsdom matches real-browser behaviour.
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import type FNote from "../../entities/fnote.js";
import froca from "../../services/froca.js";
import server from "../../services/server.js";
import { buildNote } from "../../test/easy-froca.js";
import { BacklinksList, useBacklinkCount } from "./Backlinks.js";

let container: HTMLDivElement;

afterEach(() => {
    act(() => render(null, container));
    container.remove();
    vi.restoreAllMocks();
});

/**
 * Renders the list for a note whose single backlink carries the given excerpts, waiting for the
 * `note-map/…/backlinks` request and the froca prefetch that follows it.
 */
async function renderBacklinks(excerpts: string[]) {
    // Under a root, so that the header's NoteLink has a note path to resolve.
    buildNote({ id: "root", title: "root", children: [ { id: "source", title: "Source" }, { id: "target", title: "Target" } ] });
    const target = froca.getNoteFromCache("target");
    if (!target) throw new Error("the target note was not built");
    vi.spyOn(server, "get").mockResolvedValue([ { noteId: "source", excerpts } ]);

    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => render(<ul><BacklinksList note={target} /></ul>, container));

    // The request resolves, then the froca prefetch it awaits, then the state commits — each step
    // needs its own act() round before the excerpts are in the DOM.
    for (let round = 0; round < 3; round++) {
        await act(async () => {});
    }
    return container;
}

function BacklinkCountHarness({ note, enabled = true }: { note: FNote; enabled?: boolean }) {
    const count = useBacklinkCount(note, enabled);
    return <output data-testid="backlink-count">{count}</output>;
}

describe("Backlink count", () => {
    it("ignores a count response from a previously selected note", async () => {
        buildNote({ id: "root", title: "Root", children: [
            { id: "target-a", title: "First" },
            { id: "target-b", title: "Second" }
        ] });
        const first = froca.getNoteFromCache("target-a")!;
        const second = froca.getNoteFromCache("target-b")!;
        let resolveFirst!: (value: { count: number }) => void;
        let resolveSecond!: (value: { count: number }) => void;
        const requestFirst = new Promise<{ count: number }>(resolve => { resolveFirst = resolve; });
        const requestSecond = new Promise<{ count: number }>(resolve => { resolveSecond = resolve; });
        vi.spyOn(server, "get").mockImplementation(url =>
            (url.includes("target-a") ? requestFirst : requestSecond) as never
        );

        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => render(<BacklinkCountHarness note={first} />, container));
        act(() => render(<BacklinkCountHarness note={second} />, container));
        expect(container.textContent).toBe("0");

        await act(async () => resolveSecond({ count: 2 }));
        expect(container.textContent).toBe("2");

        await act(async () => resolveFirst({ count: 9 }));
        expect(container.textContent).toBe("2");
    });

    it("does not request or display a count outside the default view", async () => {
        buildNote({ id: "root", title: "Root", children: [ { id: "target", title: "Target" } ] });
        const target = froca.getNoteFromCache("target")!;
        const get = vi.spyOn(server, "get");
        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => render(<BacklinkCountHarness note={target} enabled={false} />, container));
        expect(get).not.toHaveBeenCalled();
        expect(container.textContent).toBe("0");
    });
});

describe("BacklinksList", () => {
    it("strips event handlers from an excerpt while keeping its link and prose", async () => {
        const excerpt = `<div class="ck-content backlink-excerpt"><p onmouseover="window.xss=1"`
            + ` onanimationstart="window.xss=1" style="animation:1s spin">See`
            + ` <a href="#root/abcdefghijkl" class="backlink-link">the other note</a>.</p></div>`;

        const paragraph = (await renderBacklinks([ excerpt ])).querySelector("p");
        expect(paragraph?.getAttribute("onmouseover")).toBeNull();
        expect(paragraph?.getAttribute("onanimationstart")).toBeNull();
        expect(paragraph?.textContent).toBe("See the other note.");
        expect(paragraph?.querySelector("a")?.getAttribute("href")).toBe("#root/abcdefghijkl");
    });

    it("does not display a late response for a previously selected note", async () => {
        buildNote({ id: "root", title: "Root", children: [
            { id: "source", title: "Source" },
            { id: "target-a", title: "First" },
            { id: "target-b", title: "Second" }
        ] });
        const first = froca.getNoteFromCache("target-a")!;
        const second = froca.getNoteFromCache("target-b")!;
        let resolveFirst!: (items: unknown[]) => void;
        let resolveSecond!: (items: unknown[]) => void;
        const firstRequest = new Promise(resolve => { resolveFirst = resolve; });
        const secondRequest = new Promise(resolve => { resolveSecond = resolve; });
        vi.spyOn(server, "get").mockImplementation((url) =>
            (url.includes("target-a") ? firstRequest : secondRequest) as never
        );

        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => render(<ul><BacklinksList note={first} /></ul>, container));
        act(() => render(<ul><BacklinksList note={second} /></ul>, container));
        await act(async () => resolveSecond([ { noteId: "source", excerpts: ["<p>Current note link</p>"] } ]));
        for (let i = 0; i < 3; i++) await act(async () => {});
        expect(container.textContent).toContain("Current note link");

        await act(async () => resolveFirst([ { noteId: "source", excerpts: ["<p>Old note link</p>"] } ]));
        for (let i = 0; i < 3; i++) await act(async () => {});
        expect(container.textContent).toContain("Current note link");
        expect(container.textContent).not.toContain("Old note link");
    });

    it("shows a retry action for failed requests and recovers", async () => {
        buildNote({ id: "root", title: "Root", children: [
            { id: "source", title: "Source" },
            { id: "target", title: "Target" }
        ] });
        const target = froca.getNoteFromCache("target")!;
        const get = vi.spyOn(server, "get")
            .mockRejectedValueOnce(new Error("network unavailable"))
            .mockResolvedValueOnce([ { noteId: "source", excerpts: ["<p>Recovered link</p>"] } ]);
        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => render(<ul><BacklinksList note={target} /></ul>, container));
        for (let i = 0; i < 3; i++) await act(async () => {});
        const retry = container.querySelector<HTMLButtonElement>(".backlinks-retry");
        expect(container.querySelector(".backlinks-error")).not.toBeNull();
        expect(retry?.type).toBe("button");

        await act(async () => retry?.click());
        for (let i = 0; i < 3; i++) await act(async () => {});
        expect(get).toHaveBeenCalledTimes(2);
        expect(container.textContent).toContain("Recovered link");
        expect(container.querySelector(".backlinks-error")).toBeNull();
    });

    it("drops a script tag from an excerpt", async () => {
        const excerpt = `<div class="ck-content backlink-excerpt"><script>window.xss=1</script>`
            + `<p><a href="#root/abcdefghijkl">link</a></p></div>`;

        const rendered = await renderBacklinks([ excerpt ]);
        expect(rendered.querySelector("script")).toBeNull();
        expect(rendered.querySelector("a")?.textContent).toBe("link");
    });
});
