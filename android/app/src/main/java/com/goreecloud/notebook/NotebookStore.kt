package com.goreecloud.notebook

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID

data class NoteRecord(
    val id: String, val title: String, val body: String, val version: Int,
    val updatedAt: Long, val tags: String = "", val pinned: Boolean = false,
    val deleted: Boolean = false
)

data class NoteRevision(
    val version: Int, val title: String, val body: String,
    val tags: String, val pinned: Boolean, val savedAt: Long
)

/** Offline, private SQLite. No app-level encryption or automatic backup yet. */
class NotebookStore(context: Context) : SQLiteOpenHelper(context, "notebook.db", null, 2) {
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

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("""CREATE TABLE notes(
            id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL,
            body TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1,
            updated_at INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0,
            tags TEXT NOT NULL DEFAULT '', pinned INTEGER NOT NULL DEFAULT 0
        )""".trimIndent())
        db.execSQL("CREATE INDEX notes_by_recent ON notes(deleted,pinned,updated_at)")
        makeRevisions(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if(oldVersion==1 && newVersion>=2) {
            db.execSQL("ALTER TABLE notes ADD COLUMN tags TEXT NOT NULL DEFAULT ''")
            db.execSQL("ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0")
            db.execSQL("DROP INDEX IF EXISTS notes_by_recent")
            db.execSQL("CREATE INDEX notes_by_recent ON notes(deleted,pinned,updated_at)")
            makeRevisions(db)
            return
        }
        error("No migration from schema $oldVersion to $newVersion")
    }

    private fun decode(c:android.database.Cursor):NoteRecord =
        NoteRecord(c.getString(0),c.getString(1),c.getString(2),c.getInt(3),
            c.getLong(4),c.getString(5),c.getInt(6)!=0,c.getInt(7)!=0)

    fun list(query:String="", trash:Boolean=false):List<NoteRecord> {
        val conditions=mutableListOf(if(trash)"deleted=1" else "deleted=0")
        val args=mutableListOf<String>()
        if(query.isNotBlank()){
            val escaped=query.trim().replace("\\","\\\\").replace("%","\\%").replace("_","\\_")
            conditions+="(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')"
            repeat(3){args+="%"+escaped+"%"}
        }
        val notes=mutableListOf<NoteRecord>()
        readableDatabase.query("notes",arrayOf("id","title","body","version",
            "updated_at","tags","pinned","deleted"),
            conditions.joinToString(" AND "),args.toTypedArray(),null,null,
            "pinned DESC,updated_at DESC","500").use { c ->
            while(c.moveToNext())notes+=decode(c)
        }
        return notes
    }

    fun create():NoteRecord{
        val item=NoteRecord(UUID.randomUUID().toString(),"Untitled note","",1,
            System.currentTimeMillis())
        writableDatabase.insertOrThrow("notes",null,ContentValues().apply{
            put("id",item.id);put("title",item.title);put("body",item.body)
            put("version",item.version);put("updated_at",item.updatedAt)
        })
        return item
    }

    private fun find(db:SQLiteDatabase,id:String):NoteRecord?{
        db.query("notes",arrayOf("id","title","body","version","updated_at",
            "tags","pinned","deleted"),"id=?",arrayOf(id),null,null,null).use { c ->
            if(!c.moveToFirst())return null
            return decode(c)
        }
    }

    /** Preserves the previous note inside one transaction; rejects stale writes. */
    fun save(note:NoteRecord,title:String,body:String,
             tags:String=note.tags,pinned:Boolean=note.pinned):NoteRecord? {
        require(title.length<=200 && body.length<=1_000_000 && tags.length<=500)
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

    fun revisions(id:String):List<NoteRevision>{
        val results=mutableListOf<NoteRevision>()
        readableDatabase.query("revisions",
            arrayOf("version","title","body","tags","pinned","saved_at"),
            "note_id=?",arrayOf(id),null,null,"version DESC","200").use { c ->
            while(c.moveToNext())results+=NoteRevision(c.getInt(0),c.getString(1),
                c.getString(2),c.getString(3),c.getInt(4)!=0,c.getLong(5))
        }
        return results
    }

    fun restoreRevision(note:NoteRecord, version:Int):NoteRecord?{
        val old=revisions(note.id).firstOrNull{it.version==version}?:return null
        return save(note,old.title,old.body,old.tags,old.pinned)
    }

    fun trash(note:NoteRecord):Boolean=writableDatabase.update("notes",ContentValues().apply{
        put("deleted",1);put("version",note.version+1);put("updated_at",System.currentTimeMillis())
    },"id=? AND version=? AND deleted=0",arrayOf(note.id,note.version.toString()))==1

    fun restore(note:NoteRecord):Boolean=writableDatabase.update("notes",ContentValues().apply{
        put("deleted",0);put("version",note.version+1);put("updated_at",System.currentTimeMillis())
    },"id=? AND version=? AND deleted=1",arrayOf(note.id,note.version.toString()))==1
}
