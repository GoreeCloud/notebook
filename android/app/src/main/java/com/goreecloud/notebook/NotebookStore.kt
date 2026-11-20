package com.goreecloud.notebook

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID
import java.time.Instant
import org.json.JSONArray
import org.json.JSONObject

data class NotebookRecord(val id: String, val name: String, val createdAt: Long)

data class NoteRecord(
    val id: String, val title: String, val body: String, val version: Int,
    val updatedAt: Long, val tags: String = "", val pinned: Boolean = false,
    val deleted: Boolean = false, val notebookId: String = "",
    val parentId: String? = null, val createdAt: Long = updatedAt
)

data class NoteRevision(
    val version: Int, val title: String, val body: String,
    val tags: String, val pinned: Boolean, val savedAt: Long
)

/** List-only data; a preview must never be used as a save/edit record. */
data class NotePreview(
    val id: String, val notebookId: String, val title: String,
    val excerpt: String, val tags: String, val pinned: Boolean,
    val parentId: String?, val updatedAt: Long
)
data class NotePreviewPage(val results: List<NotePreview>, val hasMore: Boolean)


/** Private on-device SQLite. No background sync, network or app-layer encryption. */
class NotebookStore(context: Context, databaseName:String="notebook.db") :
    SQLiteOpenHelper(context, databaseName, null, 3) {
    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(true)
    }

    private fun makeRevisions(db: SQLiteDatabase) {
        db.execSQL("""CREATE TABLE IF NOT EXISTS revisions(
            note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
            version INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL,
            tags TEXT NOT NULL, pinned INTEGER NOT NULL, saved_at INTEGER NOT NULL,
            PRIMARY KEY(note_id,version)
        )""".trimIndent())
    }

    private fun makeNotebooks(db: SQLiteDatabase): String {
        db.execSQL("""CREATE TABLE IF NOT EXISTS notebooks(
            id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )""".trimIndent())
        db.rawQuery("SELECT id FROM notebooks ORDER BY created_at,id LIMIT 1",null).use { cursor ->
            if(cursor.moveToFirst())return cursor.getString(0)
        }
        val id=UUID.randomUUID().toString()
        db.execSQL("INSERT INTO notebooks(id,name,created_at) VALUES(?,?,?)",
            arrayOf<Any>(id,"My Notebook",System.currentTimeMillis()))
        return id
    }

    override fun onCreate(db: SQLiteDatabase) {
        val defaultBook=makeNotebooks(db)
        db.execSQL("""CREATE TABLE notes(
            id TEXT PRIMARY KEY NOT NULL,
            notebook_id TEXT NOT NULL REFERENCES notebooks(id) ON DELETE RESTRICT,
            parent_id TEXT REFERENCES notes(id) ON DELETE RESTRICT,
            title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '',
            version INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
            deleted INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '', pinned INTEGER NOT NULL DEFAULT 0
        )""".trimIndent())
        db.execSQL("CREATE INDEX notes_by_recent ON notes(notebook_id,deleted,pinned,updated_at)")
        db.execSQL("CREATE INDEX notes_by_parent ON notes(parent_id)")
        makeRevisions(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        var step=oldVersion
        if(step==1 && newVersion>=2) {
            db.execSQL("ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
            db.execSQL("DROP INDEX IF EXISTS notes_by_recent")
            db.execSQL("CREATE INDEX notes_by_recent ON notes(deleted,pinned,updated_at)")
            makeRevisions(db)
            step=2
        }
        if(step==2 && newVersion>=3) {
            val defaultBook=makeNotebooks(db)
            db.execSQL("ALTER TABLE notes ADD COLUMN notebook_id TEXT REFERENCES notebooks(id) ON DELETE RESTRICT")
            db.execSQL("ALTER TABLE notes ADD COLUMN parent_id TEXT REFERENCES notes(id) ON DELETE RESTRICT")
            db.execSQL("ALTER TABLE notes ADD COLUMN created_at INTEGER NOT NULL DEFAULT 0")
            db.execSQL("UPDATE notes SET notebook_id=?,created_at=updated_at WHERE notebook_id IS NULL",
                arrayOf(defaultBook))
            db.execSQL("DROP INDEX IF EXISTS notes_by_recent")
            db.execSQL("CREATE INDEX notes_by_recent ON notes(notebook_id,deleted,pinned,updated_at)")
            db.execSQL("CREATE INDEX IF NOT EXISTS notes_by_parent ON notes(parent_id)")
            step=3
        }
        if(step!=newVersion)error("No safe schema migration from $oldVersion to $newVersion")
    }

    private val columns=arrayOf(
        "id","title","body","version","updated_at",
        "tags","pinned","deleted","notebook_id","parent_id","created_at"
    )

    private fun decode(c:Cursor): NoteRecord=NoteRecord(
        c.getString(0),c.getString(1),c.getString(2),c.getInt(3),
        c.getLong(4),c.getString(5),c.getInt(6)!=0,c.getInt(7)!=0,
        c.getString(8),if(c.isNull(9))null else c.getString(9),c.getLong(10)
    )

    fun notebooks(): List<NotebookRecord> {
        val results=mutableListOf<NotebookRecord>()
        readableDatabase.rawQuery("SELECT id,name,created_at FROM notebooks ORDER BY name COLLATE NOCASE,id",
            null).use { c ->
            while(c.moveToNext())results+=NotebookRecord(c.getString(0),c.getString(1),c.getLong(2))
        }
        return results
    }

    fun defaultNotebookId(): String {
        readableDatabase.rawQuery("SELECT id FROM notebooks ORDER BY created_at,id LIMIT 1",null).use { c ->
            check(c.moveToFirst()) { "Notebook database has no default notebook" }
            return c.getString(0)
        }
    }

    fun createNotebook(name:String): NotebookRecord {
        val clean=name.trim()
        require(clean.isNotEmpty() && clean.length<=120)
        val result=NotebookRecord(UUID.randomUUID().toString(),clean,System.currentTimeMillis())
        writableDatabase.insertOrThrow("notebooks",null,ContentValues().apply {
            put("id",result.id);put("name",result.name);put("created_at",result.createdAt)
        })
        return result
    }

    fun list(query:String="", trash:Boolean=false, notebookId:String?=null): List<NoteRecord> {
        val conditions=mutableListOf(if(trash)"deleted=1" else "deleted=0")
        val args=mutableListOf<String>()
        if(notebookId!=null){conditions+="notebook_id=?";args+=notebookId}
        if(query.isNotBlank()) {
            val escaped=query.trim().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")
            conditions+="(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')"
            repeat(3){args+="%"+escaped+"%"}
        }
        val results=mutableListOf<NoteRecord>()
        readableDatabase.query("notes",columns,
            conditions.joinToString(" AND "),args.toTypedArray(),null,null,
            "pinned DESC,updated_at DESC","500").use { c ->
            while(c.moveToNext())results+=decode(c)
        }
        return results
    }

    /** SQL-paginated list metadata with a bounded body preview. Never send
     * previews into the editor or save() path; opening uses getNote(). */
    fun listPreviews(query:String="", trash:Boolean=false, notebookId:String?=null,
                     limit:Int=200, offset:Int=0): NotePreviewPage {
        require(limit in 1..200 && offset in 0..100_000) {
            "Invalid Notebook preview page"
        }
        val conditions=mutableListOf(if(trash)"deleted=1" else "deleted=0")
        val args=mutableListOf<String>()
        if(notebookId!=null){conditions+="notebook_id=?";args+=notebookId}
        if(query.isNotBlank()) {
            val escaped=query.trim().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")
            conditions+="(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')"
            repeat(3){args+="%"+escaped+"%"}
        }
        val previews=mutableListOf<NotePreview>()
        val fields=arrayOf(
            "id","notebook_id","title","substr(body,1,160) AS excerpt",
            "tags","pinned","parent_id","updated_at"
        )
        var hasMore=false
        readableDatabase.query("notes",fields,conditions.joinToString(" AND "),
            args.toTypedArray(),null,null,"pinned DESC,updated_at DESC,id",
            (limit+1).toString()+" OFFSET "+offset).use { c ->
            while(c.moveToNext()) {
                if(previews.size>=limit) {hasMore=true;break}
                previews+=NotePreview(
                    id=c.getString(0),notebookId=c.getString(1),title=c.getString(2),
                    excerpt=c.getString(3),tags=c.getString(4),pinned=c.getInt(5)!=0,
                    parentId=if(c.isNull(6))null else c.getString(6),
                    updatedAt=c.getLong(7)
                )
            }
        }
        return NotePreviewPage(previews,hasMore)
    }

    fun getNote(id:String):NoteRecord? = find(readableDatabase,id)

    fun create(notebookId:String=defaultNotebookId(),parentId:String?=null): NoteRecord {
        require(notebookId.isNotBlank())
        val db=writableDatabase
        db.beginTransaction()
        try {
            db.rawQuery("SELECT id FROM notebooks WHERE id=?",arrayOf(notebookId)).use {
                require(it.moveToFirst()) { "Unknown notebook" }
            }
            if(parentId!=null) {
                db.rawQuery("SELECT notebook_id,deleted FROM notes WHERE id=?",arrayOf(parentId)).use {
                    require(it.moveToFirst() && it.getString(0)==notebookId && it.getInt(1)==0) {
                        "Nested note parent must be active in this notebook"
                    }
                }
            }
            val stamp=System.currentTimeMillis()
            val note=NoteRecord(UUID.randomUUID().toString(),"Untitled note","",1,stamp,
                notebookId=notebookId,parentId=parentId,createdAt=stamp)
            db.insertOrThrow("notes",null,ContentValues().apply {
                put("id",note.id);put("notebook_id",note.notebookId);put("parent_id",note.parentId)
                put("title",note.title);put("body",note.body);put("version",note.version)
                put("created_at",stamp);put("updated_at",stamp)
            })
            db.setTransactionSuccessful()
            return note
        }finally{db.endTransaction()}
    }

    private fun find(db:SQLiteDatabase,id:String):NoteRecord? {
        db.query("notes",columns,"id=?",arrayOf(id),null,null,null).use { c ->
            if(!c.moveToFirst())return null
            return decode(c)
        }
    }

    /** Preserve the previous note in one SQLite transaction; reject stale writes. */
    fun save(note:NoteRecord,title:String,body:String,
             tags:String=note.tags,pinned:Boolean=note.pinned):NoteRecord? {
        val cleanedTags=tags.split(",").map { it.trim() }.filter { it.isNotEmpty() }
        require(title.length<=200 && body.length<=1_000_000 && tags.length<=500 &&
            cleanedTags.size<=20 && cleanedTags.all { it.length<=64 })
        val db=writableDatabase
        db.beginTransaction()
        try {
            val old=find(db,note.id)?:return null
            if(old.deleted || old.version!=note.version)return null
            val stamp=System.currentTimeMillis()
            db.execSQL("""INSERT INTO revisions(note_id,version,title,body,tags,pinned,saved_at)
                VALUES(?,?,?,?,?,?,?)""",arrayOf<Any>(old.id,old.version,old.title,old.body,
                old.tags,if(old.pinned)1 else 0,stamp))
            val changed=db.update("notes",ContentValues().apply {
                put("title",title.ifBlank{"Untitled note"});put("body",body)
                put("tags",tags);put("pinned",if(pinned)1 else 0)
                put("version",old.version+1);put("updated_at",stamp)
            },"id=? AND version=? AND deleted=0",arrayOf(note.id,note.version.toString()))
            if(changed!=1)return null
            db.setTransactionSuccessful()
            return old.copy(title=title.ifBlank{"Untitled note"},body=body,
                tags=tags,pinned=pinned,version=old.version+1,updatedAt=stamp)
        }finally{db.endTransaction()}
    }

    fun revisions(id:String): List<NoteRevision> {
        val results=mutableListOf<NoteRevision>()
        readableDatabase.query("revisions",
            arrayOf("version","title","body","tags","pinned","saved_at"),
            "note_id=?",arrayOf(id),null,null,"version DESC","200").use { c ->
            while(c.moveToNext())results+=NoteRevision(c.getInt(0),c.getString(1),
                c.getString(2),c.getString(3),c.getInt(4)!=0,c.getLong(5))
        }
        return results
    }

    /**
     * Explicit, plaintext JSON v2 export for user-directed Android Storage
     * Access Framework sharing. No filesystem, network or cloud write here.
     *
     * Historical revision tags/pins are not represented in JSON v2.
     * Unlike SQLite device snapshots, this file is a portable, lossy archive.
     */
    fun exportJsonV2():ByteArray {
        val books=notebooks()
        require(books.size in 1..200) { "Too many notebooks for JSON v2" }
        val notes=JSONArray()
        val revisions=JSONArray()
        val db=readableDatabase
        db.query("notes",columns,null,null,null,null,"id ASC").use { c ->
            while(c.moveToNext()) {
                require(notes.length()<2000) { "Export exceeds 2000 note limit" }
                val note=decode(c)
                val tags=note.tags.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                require(tags.size<=20 && tags.all { it.length<=64 }) {
                    "Edit tags longer than 64 characters before JSON export"
                }
                val entry=JSONObject()
                    .put("id",note.id)
                    .put("notebook_id",note.notebookId)
                    .put("parent_id",note.parentId ?: JSONObject.NULL)
                    .put("title",note.title)
                    .put("body",note.body)
                    .put("tags",JSONArray(tags))
                    .put("pinned",note.pinned)
                    .put("deleted_at",if(note.deleted) Instant.ofEpochMilli(note.updatedAt).toString() else JSONObject.NULL)
                    .put("version",note.version)
                    .put("created_at",Instant.ofEpochMilli(note.createdAt).toString())
                    .put("updated_at",Instant.ofEpochMilli(note.updatedAt).toString())
                notes.put(entry)
            }
        }
        db.rawQuery("SELECT note_id,version,title,body,saved_at FROM revisions ORDER BY note_id,version",
            null).use { c ->
            while(c.moveToNext()) {
                require(revisions.length()<10000) { "Export exceeds 10000 revisions" }
                revisions.put(JSONObject()
                    .put("note_id",c.getString(0)).put("version",c.getInt(1))
                    .put("title",c.getString(2)).put("body",c.getString(3))
                    .put("saved_at",Instant.ofEpochMilli(c.getLong(4)).toString())
                )
            }
        }
        val booksJson=JSONArray()
        books.forEach { book ->
            booksJson.put(JSONObject()
                .put("id",book.id).put("name",book.name)
                .put("created_at",Instant.ofEpochMilli(book.createdAt).toString()))
        }
        val result=JSONObject().put("format","goreecloud-notebook-v2")
            .put("notebooks",booksJson).put("notes",notes).put("revisions",revisions)
            .toString(2).toByteArray(Charsets.UTF_8)
        require(result.size<=8*1024*1024) {
            "Export exceeds 8 MiB; create a local SQLite snapshot instead"
        }
        return result
    }

    /**
     * Validates a Notebook v2 JSON archive independently of device contents.
     * Applying always appends fresh UUIDs in one SQLite transaction, leaving
     * existing notebooks, notes and revisions untouched.
     */
    fun importJsonV2(bytes:ByteArray,dryRun:Boolean=true):NotebookImportReport {
        val parsed=NotebookArchiveParser.parse(bytes)
        val report=NotebookImportReport(
            parsed.books.size,parsed.notes.size,parsed.revisions.size,dryRun
        )
        if(dryRun)return report
        val bookIds=parsed.books.associate { it.id to UUID.randomUUID().toString() }
        val noteIds=parsed.notes.associate { it.id to UUID.randomUUID().toString() }
        val db=writableDatabase
        db.beginTransaction()
        try {
            for(book in parsed.books){
                db.insertOrThrow("notebooks",null,ContentValues().apply{
                    put("id",bookIds.getValue(book.id))
                    put("name",book.name)
                    put("created_at",book.createdAt)
                })
            }
            // Parser supplies an acyclic, parent-first order.
            for(note in parsed.notes){
                db.insertOrThrow("notes",null,ContentValues().apply{
                    put("id",noteIds.getValue(note.id))
                    put("notebook_id",bookIds.getValue(note.notebookId))
                    put("parent_id",note.parentId?.let{noteIds.getValue(it)})
                    put("title",note.title)
                    put("body",note.body)
                    put("tags",note.tags)
                    put("pinned",if(note.pinned)1 else 0)
                    put("deleted",if(note.deleted)1 else 0)
                    put("version",note.version)
                    put("created_at",note.createdAt)
                    put("updated_at",note.updatedAt)
                })
            }
            for(revision in parsed.revisions){
                db.insertOrThrow("revisions",null,ContentValues().apply{
                    put("note_id",noteIds.getValue(revision.noteId))
                    put("version",revision.version)
                    put("title",revision.title)
                    put("body",revision.body)
                    // JSON v2 has no historic tags or pin fields.
                    put("tags","")
                    put("pinned",0)
                    put("saved_at",revision.savedAt)
                })
            }
            db.setTransactionSuccessful()
        }finally{db.endTransaction()}
        return report.copy(
            dryRun=false,
            firstImportedNotebookId=bookIds.getValue(parsed.books.first().id)
        )
    }

    fun restoreRevision(note:NoteRecord, version:Int):NoteRecord? {
        val old=revisions(note.id).firstOrNull{it.version==version}?:return null
        return save(note,old.title,old.body,old.tags,old.pinned)
    }

    /** Preserve linked children when moving a parent to Trash. The parent
     * can be restored without data loss, matching the local service API. */
    fun trash(note:NoteRecord):Boolean=writableDatabase.update("notes",ContentValues().apply {
        put("deleted",1);put("version",note.version+1)
        put("updated_at",System.currentTimeMillis())
    },"id=? AND version=? AND deleted=0",arrayOf(note.id,note.version.toString()))==1

    fun restore(note:NoteRecord):Boolean {
        val db=writableDatabase
        db.beginTransaction()
        try {
            val old=find(db,note.id)?:return false
            if(!old.deleted || old.version!=note.version)return false
            val parentId=old.parentId
            if(parentId!=null) {
                val parent=find(db,parentId)
                if(parent==null || parent.deleted || parent.notebookId!=old.notebookId)return false
            }
            val changed=db.update("notes",ContentValues().apply {
                put("deleted",0);put("version",old.version+1)
                put("updated_at",System.currentTimeMillis())
            },"id=? AND version=? AND deleted=1",arrayOf(note.id,note.version.toString()))
            if(changed==1)db.setTransactionSuccessful()
            return changed==1
        }finally{db.endTransaction()}
    }
}
