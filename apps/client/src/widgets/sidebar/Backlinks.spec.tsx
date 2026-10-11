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
import { BacklinksList, BacklinksWidget, useBacklinkCount } from "./Backlinks.js";

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

describe("Backlinks filtering", () => {
    it("filters cached source titles and relation names without more network requests", async () => {
        buildNote({ id: "root", title: "Root", children: [
            { id: "filter-alpha", title: "Project Alpha" },
            { id: "filter-beta", title: "Team Beta" },
            { id: "filter-target", title: "Target" }
        ] });
        const target = froca.getNoteFromCache("filter-target")!;
        const get = vi.spyOn(server, "get").mockResolvedValue([
            { noteId: "filter-beta", relationName: "supports" },
            { noteId: "filter-alpha", excerpts: ["<p>Alpha reference</p>"] }
        ]);
        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => render(<BacklinksWidget note={target} />, container));
        for (let i = 0; i < 3; i++) await act(async () => {});

        const input = container.querySelector<HTMLInputElement>(".backlinks-filter input")!;
        const items = () => container.querySelectorAll(".backlinks-items > li");
        expect(input.getAttribute("aria-label")).toBeTruthy();
        expect(items()).toHaveLength(2);
        expect(items()[0].textContent).toContain("supports");
        const sorter = container.querySelector<HTMLInputElement>(".backlinks-sort-label input")!;
        act(() => sorter.click());
        expect(items()[0].textContent).toContain("Alpha reference");
        act(() => sorter.click());
        expect(items()[0].textContent).toContain("supports");

        act(() => {
            input.value = "ALPHA";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(items()).toHaveLength(1);
        expect(container.textContent).toContain("Alpha reference");
        expect(container.textContent).not.toContain("supports");

        act(() => {
            input.value = "support";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(items()).toHaveLength(1);
        expect(container.textContent).toContain("supports");

        act(() => {
            input.value = "missing source";
            input.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(container.querySelector(".backlinks-no-matches")).not.toBeNull();
        expect(container.querySelector(".backlinks-empty")).toBeNull();

        const clear = container.querySelector<HTMLButtonElement>(".backlinks-filter-clear")!;
        expect(clear.type).toBe("button");
        clear.focus();
        expect(document.activeElement).toBe(clear);
        act(() => clear.click());
        expect(document.activeElement).toBe(input);
        expect(input.value).toBe("");
        expect(items()).toHaveLength(2);
        expect(get).toHaveBeenCalledTimes(1);
    });
});

describe("Backlinks filter navigation", () => {
    it("clears the filter when changing the selected note", async () => {
        buildNote({ id: "root", title: "Root", children: [
            { id: "nav-source", title: "Source" },
            { id: "nav-first", title: "First target" },
            { id: "nav-second", title: "Second target" }
        ] });
        const first = froca.getNoteFromCache("nav-first")!;
        const second = froca.getNoteFromCache("nav-second")!;
        vi.spyOn(server, "get").mockResolvedValue([
            { noteId: "nav-source", excerpts: [ "<p>Visible backlink</p>" ] }
        ]);
        container = document.createElement("div");
        document.body.appendChild(container);
        act(() => render(<BacklinksWidget note={first} />, container));
        for (let i = 0; i < 3; i++) await act(async () => {});

        const filter = container.querySelector<HTMLInputElement>(".backlinks-filter input")!;
        act(() => {
            filter.value = "nothing matches";
            filter.dispatchEvent(new Event("input", { bubbles: true }));
        });
        expect(container.querySelector(".backlinks-no-matches")).not.toBeNull();

        act(() => render(<BacklinksWidget note={second} />, container));
        for (let i = 0; i < 3; i++) await act(async () => {});
        expect(container.querySelector<HTMLInputElement>(".backlinks-filter input")?.value).toBe("");
        expect(container.querySelector(".backlinks-no-matches")).toBeNull();
        expect(container.textContent).toContain("Visible backlink");
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
