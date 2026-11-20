import QtQuick 6.12
import QtQuick.Controls 6.12
import QtQuick.Layouts 6.12

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
    property var active: ({})
    property bool hasEdits: !!active.id && (noteTitle.text !== active.title || noteBody.text !== active.body)
    Component.onCompleted: {
        notes = JSON.parse(backend.notesJson)
        active = JSON.parse(backend.selectedJson)
    }
    Connections {
        target: backend
        function onNotesChanged() { window.notes = JSON.parse(backend.notesJson) }
        function onSelectedChanged() {
            window.active = JSON.parse(backend.selectedJson)
            noteTitle.text = window.active.title || ""
            noteBody.text = window.active.body || ""
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
                    Button { text: "+"; onClicked: backend.newNote(); Accessible.name: "New note" }
                }
                Label { text: "MY COLLECTION"; font.pixelSize: 10; font.bold: true; color: "#68758C" }
                TextField {
                    id: search
                    Layout.fillWidth: true
                    placeholderText: "Search notes"
                    onTextChanged: backend.setQuery(text)
                }
                Label { text: window.notes.length + " notes"; font.pixelSize: 12; color: "#68758C" }
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
                            Text { text: modelData.title; font.bold: true; color: "#1B2030"; elide: Text.ElideRight; width: parent.width }
                            Text {
                                text: modelData.body ? modelData.body.replace(/\n/g, " ").slice(0, 90) : "Start writing..."
                                font.pixelSize: 12; color: "#68758C"; elide: Text.ElideRight; width: parent.width
                            }
                        }
                        MouseArea { anchors.fill: parent; onClicked: {
                            if (window.hasEdits) { backend.selectNote(modelData.id) }
                            else backend.selectNote(modelData.id)
                        }}
                    }
                    ScrollBar.vertical: ScrollBar {}
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
                            text: "Move to Trash"
                            enabled: !!window.active.id
                            onClicked: backend.deleteNote(window.active.id, window.active.version)
                        }
                        Button {
                            text: hasEdits ? "Save changes" : "Saved"
                            enabled: !!window.active.id && hasEdits
                            onClicked: backend.saveNote(window.active.id, noteTitle.text, noteBody.text, window.active.version)
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
                            font.pixelSize: 32
                            font.bold: true
                            color: "#1B2030"
                            background: Item {}
                            enabled: !!window.active.id
                        }
                        Text {
                            Layout.leftMargin: 49
                            text: window.active.id ? "Revision " + window.active.version + " · Markdown text" : "Create or select a note to begin"
                            font.pixelSize: 12
                            color: "#68758C"
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
                            enabled: !!window.active.id
                            background: Item {}
                        }
                    }
                }
            }
        }
    }
}
