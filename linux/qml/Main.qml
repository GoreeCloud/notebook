import QtQuick 6.12
import QtQuick.Controls 6.12
import QtQuick.Layouts 6.12
import QtQuick.Dialogs 6.12 as PlatformDialogs

ApplicationWindow {
    id: window
    visible: true
    width: 1120
    height: 730
    minimumWidth: 720
    minimumHeight: 460
    title: "GoreeCloud Notebook"
    color: "#F6F7FB"
    property var notes: []
    property bool hasMoreNotes: false
    property bool noteListCapped: false
    property var notebooks: []
    property var active: ({})
    property var revisions: []
    property var linked: ({incoming:{results:[],has_more:false},outgoing:{results:[],has_more:false}})
    property var pendingImportReport: ({})
    property string pendingAction: ""
    property string pendingId: ""
    property bool allowClose: false
    function runAction(action, noteId) {
        if (hasEdits) {
            pendingAction = action
            pendingId = noteId || ""
            unsavedDialog.open()
            return
        }
        performAction(action, noteId)
    }
    function performAction(action, noteId) {
        if (action === "select") backend.selectNote(noteId)
        else if (action === "linked") {
            search.text = ""
            backend.navigateLinkedNote(noteId)
        }
        else if (action === "new") backend.newNote()
        else if (action === "child") backend.newChildNote(noteId)
        else if (action === "notebook") backend.setNotebook(noteId)
        else if (action === "newNotebook") newNotebookDialog.open()
        else if (action === "importJson") jsonOpenDialog.open()
        else if (action === "exportJson") plaintextExportWarning.open()
        else if (action === "encryptedBackup") encryptedBackupWarning.open()
        else if (action === "trash") backend.deleteNote(active.id, active.version)
        else if (action === "showTrash") backend.setTrashView(true)
        else if (action === "showNotes") backend.setTrashView(false)
        else if (action === "restore") backend.restoreNote(active.id, active.version)
        else if (action === "close") { window.allowClose = true; Qt.quit() }
    }
    PlatformDialogs.FileDialog {
        id: jsonOpenDialog
        title: "Select a GoreeCloud Notebook JSON archive"
        fileMode: PlatformDialogs.FileDialog.OpenFile
        nameFilters: ["Notebook JSON (*.json)"]
        onAccepted: {
            var response = backend.previewJsonImport(selectedFile.toString())
            if (response.length > 0) {
                window.pendingImportReport = JSON.parse(response)
                importJsonConfirm.open()
            }
        }
    }
    Dialog {
        id: importJsonConfirm
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: Math.min(window.width - 40, 500)
        modal: true
        title: "Import as new notes?"
        standardButtons: Dialog.Ok | Dialog.Cancel
        Label {
            width: importJsonConfirm.availableWidth
            wrapMode: Text.Wrap
            text: "Validated " + (window.pendingImportReport.notebooks || 0) +
                  " notebooks, " + (window.pendingImportReport.notes || 0) +
                  " notes, and " + (window.pendingImportReport.revisions || 0) +
                  " revisions. This adds NEW IDs and does not overwrite existing notes. " +
                  "This operation is local; the source JSON is plaintext."
        }
        onAccepted: backend.applyJsonImport()
        onRejected: backend.cancelJsonImport()
    }
    Dialog {
        id: plaintextExportWarning
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: Math.min(window.width - 40, 500)
        modal: true
        title: "Export unencrypted notes?"
        standardButtons: Dialog.Ok | Dialog.Cancel
        Label {
            width: plaintextExportWarning.availableWidth
            wrapMode: Text.Wrap
            text: "This JSON will contain ALL notebooks, notes (including Trash), " +
                  "revisions, and note text without encryption. Choose a trusted " +
                  "private location. An existing file will never be overwritten."
        }
        onAccepted: jsonSaveDialog.open()
    }
    PlatformDialogs.FileDialog {
        id: jsonSaveDialog
        title: "Save unencrypted Notebook JSON archive"
        fileMode: PlatformDialogs.FileDialog.SaveFile
        nameFilters: ["Notebook JSON (*.json)"]
        defaultSuffix: "json"
        onAccepted: backend.exportJsonFile(selectedFile.toString())
    }
    Dialog {
        id: encryptedBackupWarning
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: Math.min(window.width - 40, 500)
        modal: true
        title: "Save an encrypted SQLite backup?"
        standardButtons: Dialog.Ok | Dialog.Cancel
        Label {
            width: encryptedBackupWarning.availableWidth
            wrapMode: Text.Wrap
            text: "This creates a new, AES-GCM encrypted backup of ALL local " +
                  "Notebook data, including Trash and history. Your live database " +
                  "remains UNENCRYPTED. Keep the passphrase separately; it cannot " +
                  "be recovered. Never choose a shared or untrusted destination."
        }
        onAccepted: encryptedBackupPasswordDialog.open()
    }
    Dialog {
        id: encryptedBackupPasswordDialog
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: Math.min(window.width - 40, 500)
        modal: true
        title: "Set backup passphrase"
        standardButtons: Dialog.Ok | Dialog.Cancel
        ColumnLayout {
            width: encryptedBackupPasswordDialog.availableWidth
            spacing: 10
            Label {
                Layout.fillWidth: true
                text: "Minimum 16 characters. No online password recovery or escrow."
                wrapMode: Text.Wrap
            }
            TextField {
                id: encryptedBackupSecret
                Layout.fillWidth: true
                echoMode: TextInput.Password
                inputMethodHints: Qt.ImhNoPredictiveText | Qt.ImhSensitiveData
                maximumLength: 1024
                Accessible.name: "New encrypted backup passphrase"
            }
            TextField {
                id: encryptedBackupRepeat
                Layout.fillWidth: true
                echoMode: TextInput.Password
                inputMethodHints: Qt.ImhNoPredictiveText | Qt.ImhSensitiveData
                maximumLength: 1024
                Accessible.name: "Confirm encrypted backup passphrase"
            }
            Label {
                id: encryptedBackupInputError
                Layout.fillWidth: true
                wrapMode: Text.Wrap
                color: "#B3261E"
            }
        }
        onAccepted: {
            if (encryptedBackupSecret.text.length < 16 ||
                encryptedBackupSecret.text !== encryptedBackupRepeat.text) {
                encryptedBackupInputError.text = "Passphrases must match and contain at least 16 characters."
                encryptedBackupSecret.text = ""
                encryptedBackupRepeat.text = ""
                Qt.callLater(function() { encryptedBackupPasswordDialog.open() })
            } else {
                encryptedBackupInputError.text = ""
                encryptedBackupSaveDialog.open()
            }
        }
        onRejected: {
            encryptedBackupSecret.text = ""
            encryptedBackupRepeat.text = ""
            encryptedBackupInputError.text = ""
        }
    }
    PlatformDialogs.FileDialog {
        id: encryptedBackupSaveDialog
        title: "Save a NEW encrypted Notebook SQLite backup"
        fileMode: PlatformDialogs.FileDialog.SaveFile
        nameFilters: ["Encrypted GoreeCloud Notebook (*.gcnb)"]
        defaultSuffix: "gcnb"
        onAccepted: {
            var passphrase = encryptedBackupSecret.text
            encryptedBackupSecret.text = ""
            encryptedBackupRepeat.text = ""
            backend.exportEncryptedBackup(selectedFile.toString(), passphrase)
            passphrase = ""
        }
        onRejected: {
            encryptedBackupSecret.text = ""
            encryptedBackupRepeat.text = ""
        }
    }
    Dialog {
        id: newNotebookDialog
        parent: Overlay.overlay
        anchors.centerIn: parent
        modal: true
        title: "Create notebook"
        standardButtons: Dialog.Ok | Dialog.Cancel
        TextField {
            id: newNotebookName
            width: 290
            placeholderText: "Notebook name"
            maximumLength: 120
            Accessible.name: "New notebook name"
        }
        onAccepted: {
            backend.newNotebook(newNotebookName.text)
            newNotebookName.text = ""
        }
    }
    Dialog {
        id: unsavedDialog
        parent: Overlay.overlay
        anchors.centerIn: parent
        modal: true
        title: "Discard unsaved changes?"
        standardButtons: Dialog.Cancel | Dialog.Discard
        Label { text: "This note has changes that have not been saved." }
        onDiscarded: window.performAction(window.pendingAction, window.pendingId)
    }
    Popup {
        id: historyPopup
        parent: Overlay.overlay
        anchors.centerIn: parent
        width: Math.min(window.width - 80, 460)
        height: Math.min(window.height - 100, 430)
        modal: true
        padding: 22
        ColumnLayout {
            anchors.fill: parent
            Label { text: "Version history"; font.pixelSize: 19; font.bold: true }
            Label { text: "Restoring creates a new revision."; color: "#68758C" }
            ListView {
                Layout.fillWidth: true
                Layout.fillHeight: true
                model: window.revisions
                clip: true
                delegate: ItemDelegate {
                    required property var modelData
                    width: ListView.view.width
                    text: "Revision " + modelData.version + " · " + modelData.title
                    onClicked: {
                        backend.restoreRevision(window.active.id, modelData.version, window.active.version)
                        historyPopup.close()
                    }
                }
            }
            Button { text: "Close"; onClicked: historyPopup.close() }
        }
    }
    function editTags(text) {
        return text.split(",").map(function(t) { return t.trim() }).filter(function(t) { return t.length > 0 })
    }
    property bool hasEdits: !!active.id && (noteTitle.text !== active.title ||
        noteBody.text !== active.body ||
        JSON.stringify(editTags(noteTags.text)) !== JSON.stringify(active.tags || []))
    Component.onCompleted: {
        var firstPage = JSON.parse(backend.notesPageJson)
        notes = firstPage.results
        hasMoreNotes = firstPage.has_more
        noteListCapped = firstPage.truncated
        notebooks = JSON.parse(backend.notebooksJson)
        active = JSON.parse(backend.selectedJson)
        revisions = JSON.parse(backend.revisionsJson)
        linked = JSON.parse(backend.linksJson)
    }
    Connections {
        target: backend
        function onNotesChanged() {
            var page = JSON.parse(backend.notesPageJson)
            window.notes = page.results
            window.hasMoreNotes = page.has_more
            window.noteListCapped = page.truncated
        }
        function onNotebooksChanged() { window.notebooks = JSON.parse(backend.notebooksJson) }
        function onRevisionsChanged() { window.revisions = JSON.parse(backend.revisionsJson) }
        function onLinksChanged() { window.linked = JSON.parse(backend.linksJson) }
        function onSelectedChanged() {
            window.active = JSON.parse(backend.selectedJson)
            noteTitle.text = window.active.title || ""
            noteBody.text = window.active.body || ""
            noteTags.text = (window.active.tags || []).join(", ")
        }
    }
    onClosing: function(close) {
        if (!allowClose && hasEdits) {
            close.accepted = false
            pendingAction = "close"
            pendingId = ""
            unsavedDialog.open()
        }
    }
    RowLayout {
        anchors.fill: parent
        spacing: 0
        Rectangle {
            Layout.preferredWidth: 330
            Layout.fillHeight: true
            color: "#F6F7FB"
            ColumnLayout {
                anchors.fill: parent
                anchors.margins: 22
                spacing: 15
                RowLayout {
                    Layout.fillWidth: true
                    Rectangle {
                        Layout.preferredWidth: 42
                        Layout.preferredHeight: 42
                        radius: 14
                        color: "#5146C8"
                        Text { anchors.centerIn: parent; color: "white"; text: "G✦"; font.pixelSize: 19; font.bold: true }
                    }
                    Column {
                        spacing: 2
                        Text { text: "Notebook"; font.pixelSize: 20; font.bold: true; color: "#1B2030" }
                        Text { text: "GOREECLOUD"; font.pixelSize: 10; font.letterSpacing: 2; color: "#68758C" }
                    }
                    Item { Layout.fillWidth: true }
                    Button { text: "+"; enabled: !backend.trashView;
                        onClicked: window.runAction("new", ""); Accessible.name: "New note" }
                }
                RowLayout {
                    Layout.fillWidth: true
                    ComboBox {
                        id: notebookPicker
                        Layout.fillWidth: true
                        Accessible.name: "Selected notebook"
                        model: [{id:"", name:"All notebooks"}].concat(window.notebooks)
                        textRole: "name"
                        currentIndex: {
                            var items = model
                            for(var index=0;index<items.length;index++) {
                                if(items[index].id === backend.activeNotebook)return index
                            }
                            return 0
                        }
                        onActivated: function(index) {
                            window.runAction("notebook", model[index].id)
                        }
                    }
                    Button {
                        text: "New"
                        Accessible.name: "Create notebook"
                        onClicked: window.runAction("newNotebook", "")
                    }
                }
                RowLayout {
                    Layout.fillWidth: true
                    Label { text: backend.trashView ? "TRASH" : "MY COLLECTION"; font.pixelSize: 10; font.bold: true; color: "#68758C" }
                    Item { Layout.fillWidth: true }
                    Button { text: backend.trashView ? "All notes" : "Trash"
                        onClicked: window.runAction(backend.trashView ? "showNotes" : "showTrash", "") }
                }
                TextField {
                    id: search
                    Layout.fillWidth: true
                    placeholderText: "Search notes"
                    onTextChanged: backend.setQuery(text)
                }
                Label {
                    text: "Showing " + window.notes.length + (window.hasMoreNotes || window.noteListCapped ? "+" : "") + " notes"
                    font.pixelSize: 12
                    color: "#68758C"
                }
                ListView {
                    id: noteList
                    Layout.fillHeight: true
                    Layout.fillWidth: true
                    clip: true
                    spacing: 8
                    model: window.notes
                    delegate: Rectangle {
                        required property var modelData
                        width: ListView.view.width
                        height: 78
                        radius: 14
                        color: window.active.id === modelData.id ? "#E8E5FF" : "#FFFFFF"
                        border.color: window.active.id === modelData.id ? "#5146C8" : "#E5E8F0"
                        Column {
                            anchors.fill: parent
                            anchors.margins: 14
                            spacing: 7
                            Text { text: (modelData.parent_id ? "↳ " : "") + modelData.title;
                                font.bold: true; color: "#1B2030"; elide: Text.ElideRight; width: parent.width }
                            Text {
                                text: modelData.preview ? modelData.preview.replace(/\n/g, " ").slice(0, 90) : "Start writing..."
                                font.pixelSize: 12; color: "#68758C"; elide: Text.ElideRight; width: parent.width
                            }
                        }
                        MouseArea { anchors.fill: parent; onClicked: window.runAction("select", modelData.id) }
                    }
                    ScrollBar.vertical: ScrollBar {}
                }
                Button {
                    Layout.fillWidth: true
                    visible: window.hasMoreNotes
                    text: "Load 500 more notes"
                    Accessible.name: "Load more stored notes"
                    onClicked: backend.loadMoreNotes()
                }
                Label {
                    Layout.fillWidth: true
                    visible: window.noteListCapped
                    text: "Local list display cap reached (5,000 notes). Narrow your notebook or search."
                    wrapMode: Text.Wrap
                    color: "#68758C"
                }
                Button {
                    Layout.fillWidth: true
                    text: "Import JSON (offline)"
                    Accessible.name: "Import portable Notebook JSON"
                    onClicked: window.runAction("importJson", "")
                }
                Button {
                    Layout.fillWidth: true
                    text: "Export JSON (plaintext)"
                    Accessible.name: "Export unencrypted Notebook JSON"
                    onClicked: window.runAction("exportJson", "")
                }
                Button {
                    Layout.fillWidth: true
                    text: "Encrypted SQLite backup (offline)"
                    Accessible.name: "Export a passphrase-encrypted SQLite backup"
                    enabled: backend.encryptedBackupAvailable
                    onClicked: window.runAction("encryptedBackup", "")
                }
                Label {
                    visible: !backend.encryptedBackupAvailable
                    Layout.fillWidth: true
                    text: "Encrypted backup requires optional vetted PyCA cryptography in the Python runtime."
                    color: "#68758C"
                    wrapMode: Text.Wrap
                    font.pixelSize: 11
                }
                Label { text: backend.status; wrapMode: Text.Wrap; font.pixelSize: 11; color: "#68758C" }
            }
        }
        Rectangle {
            Layout.fillWidth: true
            Layout.fillHeight: true
            color: "#FFFFFF"
            ColumnLayout {
                anchors.fill: parent
                spacing: 0
                Rectangle {
                    Layout.fillWidth: true
                    Layout.preferredHeight: 70
                    color: "#FFFFFF"
                    border.color: "#EEF0F7"
                    RowLayout {
                        anchors.fill: parent
                        anchors.leftMargin: 34
                        anchors.rightMargin: 30
                        spacing: 12
                        Text { text: "PERSONAL KNOWLEDGE  /  NOTE"; font.pixelSize: 10; font.letterSpacing: 1.8; color: "#68758C" }
                        Item { Layout.fillWidth: true }
                        Button {
                            text: backend.trashView ? "Restore" : "Move to Trash"
                            enabled: !!window.active.id
                            onClicked: window.runAction(backend.trashView ? "restore" : "trash", "")
                        }
                        Button {
                            text: "Add child"
                            Accessible.name: "Create nested note"
                            enabled: !!window.active.id && !backend.trashView
                            onClicked: window.runAction("child", window.active.id)
                        }
                        Button {
                            text: "History"
                            enabled: !!window.active.id && !backend.trashView && window.revisions.length > 0
                            onClicked: historyPopup.open()
                        }
                        Button {
                            text: hasEdits ? "Save changes" : "Saved"
                            enabled: !!window.active.id && hasEdits && !backend.trashView
                            onClicked: backend.saveNoteWithTags(window.active.id, noteTitle.text, noteBody.text,
                                noteTags.text, window.active.version)
                        }
                    }
                }
                ScrollView {
                    Layout.fillWidth: true
                    Layout.fillHeight: true
                    contentWidth: availableWidth
                    ColumnLayout {
                        width: Math.max(360, parent.width)
                        spacing: 14
                        Item { Layout.preferredHeight: 34 }
                        TextField {
                            id: noteTitle
                            Layout.fillWidth: true
                            Layout.leftMargin: 44
                            Layout.rightMargin: 44
                            text: window.active.title || ""
                            placeholderText: "Select a note"
                            maximumLength: 200
                            font.pixelSize: 32
                            font.bold: true
                            color: "#1B2030"
                            background: Item {}
                            enabled: !!window.active.id && !backend.trashView
                        }
                        Text {
                            Layout.leftMargin: 49
                            text: window.active.id ? "Revision " + window.active.version + " · Markdown text" : "Create or select a note to begin"
                            font.pixelSize: 12
                            color: "#68758C"
                        }
                        TextField {
                            id: noteTags
                            Layout.fillWidth: true
                            Layout.leftMargin: 44
                            Layout.rightMargin: 44
                            placeholderText: "Tags, separated by commas"
                            Accessible.name: "Note tags"
                            enabled: !!window.active.id && !backend.trashView
                            maximumLength: 500
                            text: (window.active.tags || []).join(", ")
                        }
                        Rectangle { Layout.fillWidth: true; Layout.leftMargin: 44; Layout.rightMargin: 44; height: 1; color: "#EEF0F7" }
                        TextArea {
                            id: noteBody
                            Layout.fillWidth: true
                            Layout.leftMargin: 44
                            Layout.rightMargin: 44
                            Layout.preferredHeight: Math.max(400, implicitHeight)
                            text: window.active.body || ""
                            placeholderText: "Start writing. Notes are stored locally in SQLite."
                            wrapMode: TextEdit.Wrap
                            font.pixelSize: 15
                            color: "#1B2030"
                            selectByMouse: true
                            enabled: !!window.active.id && !backend.trashView
                            background: Item {}
                        }
                        ColumnLayout {
                            Layout.fillWidth: true
                            Layout.leftMargin: 44
                            Layout.rightMargin: 44
                            Layout.bottomMargin: 24
                            spacing: 10
                            visible: !!window.active.id && !backend.trashView
                            Label {
                                text: "LINKED NOTES"
                                font.pixelSize: 12
                                font.bold: true
                                color: "#68758C"
                            }
                            Label {
                                text: "Outgoing · references from this note"
                                font.bold: true
                                Accessible.name: "Outgoing note links"
                            }
                            Repeater {
                                model: window.linked.outgoing ? window.linked.outgoing.results : []
                                delegate: Button {
                                    required property var modelData
                                    Layout.fillWidth: true
                                    text: "↗ " + modelData.title
                                    Accessible.name: "Open linked note " + modelData.title
                                    onClicked: window.runAction("linked", modelData.id)
                                }
                            }
                            Label {
                                visible: !!window.linked.outgoing && window.linked.outgoing.results.length === 0
                                text: "No resolved outgoing references"
                                color: "#68758C"
                            }
                            Label {
                                visible: !!window.linked.outgoing && window.linked.outgoing.has_more
                                text: "More outgoing notes exist; first 30 shown."
                                color: "#68758C"
                            }
                            Label {
                                text: "Incoming · notes that refer here"
                                font.bold: true
                                Accessible.name: "Incoming note links"
                            }
                            Repeater {
                                model: window.linked.incoming ? window.linked.incoming.results : []
                                delegate: Button {
                                    required property var modelData
                                    Layout.fillWidth: true
                                    text: "↙ " + modelData.title
                                    Accessible.name: "Open referring note " + modelData.title
                                    onClicked: window.runAction("linked", modelData.id)
                                }
                            }
                            Label {
                                visible: !!window.linked.incoming && window.linked.incoming.results.length === 0
                                text: "No resolved incoming references"
                                color: "#68758C"
                            }
                            Label {
                                visible: !!window.linked.incoming && window.linked.incoming.has_more
                                text: "More referring notes exist; first 30 shown."
                                color: "#68758C"
                            }
                            Label {
                                Layout.fillWidth: true
                                wrapMode: Text.Wrap
                                text: "Title links resolve only when unique in this notebook. [[note:UUID]] links can cross notebooks."
                                color: "#68758C"
                                font.pixelSize: 12
                            }
                        }
                    }
                }
            }
        }
    }
}
