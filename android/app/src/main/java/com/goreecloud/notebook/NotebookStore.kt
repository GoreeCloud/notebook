package com.goreecloud.notebook

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID

data class NoteRecord(
    val id: String,
    val title: String,
    val body: String,
    val version: Int,
    val updatedAt: Long
)

/**
 * Private app sandbox storage. No analytics, networking, external storage
 * or background synchronization. Encryption at rest is not yet implemented.
 */
class NotebookStore(context: Context) : SQLiteOpenHelper(context, "notebook.db", null, 1) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """CREATE TABLE notes(
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                body TEXT NOT NULL DEFAULT '',
                version INTEGER NOT NULL DEFAULT 1,
                updated_at INTEGER NOT NULL,
                deleted INTEGER NOT NULL DEFAULT 0
            )""".trimIndent()
        )
        db.execSQL("CREATE INDEX notes_by_recent ON notes(deleted, updated_at)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // Schema upgrades must add numbered, reversible migrations.
        check(oldVersion == newVersion) { "Missing database migration" }
    }

    fun list(query: String = ""): List<NoteRecord> {
        val search = "%${query.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")}%"
        val where = if (query.isBlank()) "deleted=0" else
            "deleted=0 AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')"
        val args = if (query.isBlank()) null else arrayOf(search, search)
        val notes = mutableListOf<NoteRecord>()
        readableDatabase.query(
            "notes", arrayOf("id", "title", "body", "version", "updated_at"),
            where, args, null, null, "updated_at DESC", "500"
        ).use { c ->
            while (c.moveToNext()) notes.add(
                NoteRecord(c.getString(0), c.getString(1), c.getString(2),
                    c.getInt(3), c.getLong(4))
            )
        }
        return notes
    }

    fun create(): NoteRecord {
        val note = NoteRecord(UUID.randomUUID().toString(), "Untitled note", "", 1,
            System.currentTimeMillis())
        writableDatabase.insertOrThrow("notes", null, ContentValues().apply {
            put("id", note.id)
            put("title", note.title)
            put("body", note.body)
            put("version", note.version)
            put("updated_at", note.updatedAt)
        })
        return note
    }

    /** Returns null on edit conflict instead of overwriting another revision. */
    fun save(note: NoteRecord, title: String, body: String): NoteRecord? {
        require(title.length <= 200 && body.length <= 1_000_000)
        val timestamp = System.currentTimeMillis()
        val changed = writableDatabase.update("notes", ContentValues().apply {
            put("title", title.ifBlank { "Untitled note" })
            put("body", body)
            put("version", note.version + 1)
            put("updated_at", timestamp)
        }, "id=? AND version=? AND deleted=0", arrayOf(note.id, note.version.toString()))
        if (changed != 1) return null
        return note.copy(title = title.ifBlank { "Untitled note" }, body = body,
            version = note.version + 1, updatedAt = timestamp)
    }

    fun trash(note: NoteRecord): Boolean = writableDatabase.update(
        "notes", ContentValues().apply { put("deleted", 1) },
        "id=? AND version=? AND deleted=0", arrayOf(note.id, note.version.toString())
    ) == 1
}
