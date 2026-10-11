import { ActionKeyboardShortcut } from "@triliumnext/commons";
import appContext, { type CommandNames } from "../components/app_context.js";
import type NoteTreeWidget from "../widgets/note_tree.js";
import { t, translationsInitializedPromise } from "./i18n.js";
import { copyTextWithToast } from "./clipboard_ext.js";
import froca from "./froca.js";
import keyboardActions from "./keyboard_actions.js";
import noteCreate from "./note_create.js";
import toast from "./toast.js";
import utils from "./utils.js";

/** A clickable Notebook reference whose visible label remains valid Markdown. */
export function formatMarkdownNoteLink(title: string, notePath: string): string {
    const label = title.replace(/\s+/g, " ").trim()
        .replace(/\\/g, "\\\\")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]");
    return `[${label}](#${notePath})`;
}

export interface CommandDefinition {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    /** The primary keyboard shortcut as stored, such as `CommandOrControl+N`. */
    shortcut?: string;
    commandName?: CommandNames;
    handler?: () => Promise<unknown> | null | undefined | void;
    aliases?: string[];
    source?: "manual" | "keyboard-action";
    /** Reference to the original keyboard action for scope checking. */
    keyboardAction?: ActionKeyboardShortcut;
}

export class CommandRegistry {
    private commands: Map<string, CommandDefinition> = new Map();
    private aliases: Map<string, string> = new Map();

    constructor() {
        this.loadCommands();
    }

    private async loadCommands() {
        await translationsInitializedPromise;
        this.registerDefaultCommands();
        await this.loadKeyboardActionsAsync();
    }

    private registerDefaultCommands() {
        this.register({
            id: "export-note",
            name: t("command_palette.export_note_title"),
            description: t("command_palette.export_note_description"),
            icon: "bx bx-export",
            handler: () => {
                const notePath = appContext.tabManager.getActiveContextNotePath();
                if (notePath) {
                    appContext.triggerCommand("showExportDialog", {
                        notePath,
                        defaultType: "single"
                    });
                }
            }
        });

        this.register({
            id: "show-attachments",
            name: t("command_palette.show_attachments_title"),
            description: t("command_palette.show_attachments_description"),
            icon: "bx bx-paperclip",
            handler: () => appContext.triggerCommand("showAttachments")
        });

        // Inbox capture works without a selected note.
        this.register({
            id: "create-inbox-note",
            name: t("command_palette.create_inbox_note_title"),
            description: t("command_palette.create_inbox_note_description"),
            icon: "bx bx-plus-circle",
            aliases: ["quick capture", "new note", "inbox note", "capture note"],
            handler: () => appContext.triggerCommand("createNoteIntoInbox", {})
        });
        // Use the existing type chooser so template destinations and presets are respected.
        this.register({
            id: "create-note-from-template",
            name: t("command_palette.create_from_template_title"),
            description: t("command_palette.create_from_template_description"),
            icon: "bx bx-file-blank",
            aliases: ["note template", "choose note type", "new from template", "new typed note"],
            handler: () => {
                const notePath = appContext.tabManager.getActiveContextNotePath();
                if (notePath) {
                    return noteCreate.createNoteWithTypePrompt(notePath);
                }
            }
        });

        // Direct routes to inherited editing and navigation tools. Neither needs new persistence.
        this.register({
            id: "show-current-note-revisions",
            name: t("command_palette.note_revisions_title"),
            description: t("command_palette.note_revisions_description"),
            icon: "bx bx-history",
            aliases: ["note history", "version history", "revisions"],
            handler: () => {
                const noteId = appContext.tabManager.getActiveContextNoteId();
                if (noteId) {
                    appContext.triggerCommand("showRevisions", { noteId });
                }
            }
        });

        this.register({
            id: "copy-current-note-link",
            name: t("command_palette.copy_note_link_title"),
            description: t("command_palette.copy_note_link_description"),
            icon: "bx bx-link",
            aliases: ["copy note link", "internal note link", "note reference"],
            handler: () => {
                const notePath = appContext.tabManager.getActiveContextNotePath();
                if (notePath) {
                    copyTextWithToast(`#${notePath}`);
                }
            }
        });

        this.register({
            id: "copy-current-note-markdown-link",
            name: t("command_palette.copy_markdown_link_title"),
            description: t("command_palette.copy_markdown_link_description"),
            icon: "bx bx-link-alt",
            aliases: ["markdown note link", "copy markdown link", "linked note reference"],
            handler: async () => {
                const notePath = appContext.tabManager.getActiveContextNotePath();
                const noteId = appContext.tabManager.getActiveContextNoteId();
                if (!notePath || !noteId || !/^root[A-Za-z0-9_/-]*$/.test(notePath)) return;
                try {
                    const note = await froca.getNote(noteId);
                    // A slow lookup must not copy a reference to a note we have since left.
                    if (appContext.tabManager.getActiveContextNotePath() !== notePath
                        || appContext.tabManager.getActiveContextNoteId() !== noteId) return;
                    if (!note) {
                        toast.showError(t("command_palette.copy_markdown_link_failed"));
                        return;
                    }
                    const title = note.title.trim() || t("command_palette.untitled_note");
                    copyTextWithToast(formatMarkdownNoteLink(title, notePath));
                } catch {
                    if (appContext.tabManager.getActiveContextNotePath() === notePath
                        && appContext.tabManager.getActiveContextNoteId() === noteId) {
                        toast.showError(t("command_palette.copy_markdown_link_failed"));
                    }
                }
            }
        });

        // Special search commands with custom logic
        this.register({
            id: "search-notes",
            name: t("command_palette.search_notes_title"),
            description: t("command_palette.search_notes_description"),
            icon: "bx bx-search",
            handler: () => appContext.triggerCommand("searchNotes", {})
        });

        this.register({
            id: "search-in-subtree",
            name: t("command_palette.search_subtree_title"),
            description: t("command_palette.search_subtree_description"),
            icon: "bx bx-search-alt",
            handler: () => {
                const notePath = appContext.tabManager.getActiveContextNotePath();
                if (notePath) {
                    appContext.triggerCommand("searchInSubtree", { notePath });
                }
            }
        });

        this.register({
            id: "recent-changes-in-current-note",
            name: t("command_palette.recent_changes_subtree_title"),
            description: t("command_palette.recent_changes_subtree_description"),
            icon: "bx bx-history",
            aliases: ["recent edits", "subtree changes", "recent note changes"],
            handler: () => {
                const ancestorNoteId = appContext.tabManager.getActiveContextNoteId();
                if (ancestorNoteId) {
                    appContext.triggerCommand("showRecentChanges", { ancestorNoteId });
                }
            }
        });

        this.register({
            id: "show-search-history",
            name: t("command_palette.search_history_title"),
            description: t("command_palette.search_history_description"),
            icon: "bx bx-history",
            handler: () => appContext.triggerCommand("showSearchHistory")
        });

        this.register({
            id: "show-launch-bar",
            name: t("command_palette.configure_launch_bar_title"),
            description: t("command_palette.configure_launch_bar_description"),
            icon: "bx bx-sidebar",
            handler: () => appContext.triggerCommand("showLaunchBarSubtree")
        });

        this.register({
            id: "pin-active-tab",
            name: t("command_palette.pin_tab_title"),
            description: t("command_palette.pin_tab_description"),
            icon: "bx bx-pin",
            handler: () => {
                const ntxId = appContext.tabManager.getActiveMainContext()?.ntxId;
                if (ntxId) {
                    appContext.triggerCommand("pinTab", { ntxId });
                }
            }
        });

        this.register({
            id: "unpin-active-tab",
            name: t("command_palette.unpin_tab_title"),
            description: t("command_palette.unpin_tab_description"),
            icon: "bx bx-pin",
            handler: () => {
                const ntxId = appContext.tabManager.getActiveMainContext()?.ntxId;
                if (ntxId) {
                    appContext.triggerCommand("unpinTab", { ntxId });
                }
            }
        });
    }

    private async loadKeyboardActionsAsync() {
        try {
            const actions = await keyboardActions.getActions();
            this.registerKeyboardActions(actions);
        } catch (error) {
            console.error("Failed to load keyboard actions:", error);
        }
    }

    private registerKeyboardActions(actions: ActionKeyboardShortcut[]) {
        for (const action of actions) {
            // Skip actions that we've already manually registered
            if (this.commands.has(action.actionName)) {
                continue;
            }

            // Skip Electron-only actions if not in Electron environment
            if (action.isElectronOnly && !utils.isElectron()) {
                continue;
            }

            // Skip actions that should not appear in the command palette
            if (action.ignoreFromCommandPalette) {
                continue;
            }

            // Get the primary shortcut (first one in the list)
            const primaryShortcut = action.effectiveShortcuts?.[0];

            let name = action.friendlyName;
            if (action.scope === "note-tree") {
                name = t("command_palette.tree-action-name", { name: action.friendlyName });
            }

            // Create a command definition from the keyboard action
            const commandDef: CommandDefinition = {
                id: action.actionName,
                name,
                description: action.description,
                icon: action.iconClass,
                shortcut: primaryShortcut,
                commandName: action.actionName as CommandNames,
                source: "keyboard-action",
                keyboardAction: action
            };

            this.register(commandDef);
        }
    }

    register(command: CommandDefinition) {
        this.commands.set(command.id, command);

        // Register aliases
        if (command.aliases) {
            for (const alias of command.aliases) {
                this.aliases.set(alias.toLowerCase(), command.id);
            }
        }
    }

    getCommand(id: string): CommandDefinition | undefined {
        return this.commands.get(id);
    }

    getAllCommands(): CommandDefinition[] {
        const commands = Array.from(this.commands.values());

        // Sort commands by name
        commands.sort((a, b) => a.name.localeCompare(b.name));

        return commands;
    }

    searchCommands(query: string): CommandDefinition[] {
        const normalizedQuery = query.toLowerCase();
        const results: { command: CommandDefinition; score: number }[] = [];

        for (const command of this.commands.values()) {
            let score = 0;

            // Exact match on name
            if (command.name.toLowerCase() === normalizedQuery) {
                score = 100;
            }
            // Name starts with query
            else if (command.name.toLowerCase().startsWith(normalizedQuery)) {
                score = 80;
            }
            // Name contains query
            else if (command.name.toLowerCase().includes(normalizedQuery)) {
                score = 60;
            }
            // Description contains query
            else if (command.description?.toLowerCase().includes(normalizedQuery)) {
                score = 40;
            }
            // Check aliases
            else if (command.aliases?.some(alias => alias.toLowerCase().includes(normalizedQuery))) {
                score = 50;
            }

            if (score > 0) {
                results.push({ command, score });
            }
        }

        // Sort by score (highest first) and then by name
        results.sort((a, b) => {
            if (a.score !== b.score) {
                return b.score - a.score;
            }
            return a.command.name.localeCompare(b.command.name);
        });

        return results.map(r => r.command);
    }

    async executeCommand(commandId: string) {
        const command = this.getCommand(commandId);
        if (!command) {
            console.error(`Command not found: ${commandId}`);
            return;
        }

        // Execute custom handler if provided
        if (command.handler) {
            await command.handler();
            return;
        }

        // Handle keyboard action with scope-aware execution
        if (command.keyboardAction && command.commandName) {
            if (command.keyboardAction.scope === "note-tree") {
                this.executeWithNoteTreeFocus(command.commandName);
            } else if (command.keyboardAction.scope === "text-detail") {
                this.executeWithTextDetail(command.commandName);
            } else {
                appContext.triggerCommand(command.commandName, {
                    ntxId: appContext.tabManager.activeNtxId
                });
            }
            return;
        }

        // Fallback for commands without keyboard action reference
        if (command.commandName) {
            appContext.triggerCommand(command.commandName, {
                ntxId: appContext.tabManager.activeNtxId
            });
            return;
        }

        console.error(`Command ${commandId} has no handler or commandName`);
    }

    private executeWithNoteTreeFocus(actionName: CommandNames) {
        const tree = document.querySelector(".tree-wrapper") as HTMLElement;
        if (!tree) {
            return;
        }

        const treeComponent = appContext.getComponentByEl(tree) as NoteTreeWidget;
        const activeNode = treeComponent.getActiveNode();
        treeComponent.triggerCommand(actionName, {
            ntxId: appContext.tabManager.activeNtxId,
            node: activeNode
        });
    }

    private async executeWithTextDetail(actionName: CommandNames) {
        const typeWidget = await appContext.tabManager.getActiveContext()?.getTypeWidget();
        if (!typeWidget) {
            return;
        }

        typeWidget.triggerCommand(actionName, {
            ntxId: appContext.tabManager.activeNtxId
        });
    }
}

const commandRegistry = new CommandRegistry();
export default commandRegistry;
