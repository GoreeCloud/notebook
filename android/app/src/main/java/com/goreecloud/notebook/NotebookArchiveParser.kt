package com.goreecloud.notebook

import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.time.OffsetDateTime
import java.util.UUID
import org.json.JSONArray
import org.json.JSONException
import org.json.JSONObject

internal data class ImportedBook(val id:String,val name:String,val createdAt:Long)
internal data class ImportedNote(
    val id:String,val notebookId:String,val parentId:String?,
    val title:String,val body:String,val tags:String,
    val pinned:Boolean,val deleted:Boolean,val version:Int,
    val createdAt:Long,val updatedAt:Long,val depth:Int
)
internal data class ImportedRevision(
    val noteId:String,val version:Int,val title:String,
    val body:String,val savedAt:Long
)
internal data class ParsedNotebookArchive(
    val books:List<ImportedBook>,
    val notes:List<ImportedNote>,
    val revisions:List<ImportedRevision>
)
data class NotebookImportReport(
    val notebooks:Int,val notes:Int,val revisions:Int,
    val dryRun:Boolean,val firstImportedNotebookId:String?=null
)

/**
 * Parse and validate a portable Notebook JSON v2 document entirely before
 * touching the writable SQLite database. This parser does not resolve links,
 * contact a network service, or access file system paths.
 */
internal object NotebookArchiveParser {
    const val MAX_BYTES=8*1024*1024
    private val maxBooks=200
    private val maxNotes=2000
    private val maxRevisions=10000

    fun parse(bytes:ByteArray):ParsedNotebookArchive {
        require(bytes.isNotEmpty() && bytes.size<=MAX_BYTES) {
            "Notebook JSON must be between 1 byte and 8 MiB"
        }
        // Hard-limit nested JSON before recursive org.json construction.
        var depth=0
        var quoted=false
        var escaped=false
        for(b in bytes) {
            val c=b.toInt().toChar()
            if(quoted) {
                if(escaped)escaped=false
                else if(c=='\\')escaped=true
                else if(c=='"')quoted=false
            } else if(c=='"')quoted=true
            else if(c=='[' || c=='{') {
                depth++
                require(depth<=64) { "Notebook JSON nesting exceeds 64 levels" }
            } else if(c==']' || c=='}') {
                depth--
                require(depth>=0) { "Malformed JSON nesting" }
            }
        }
        require(depth==0 && !quoted) { "Malformed JSON document" }
        val text=try {
            Charsets.UTF_8.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
                .decode(ByteBuffer.wrap(bytes)).toString()
        }catch(e:Exception) {
            throw IllegalArgumentException("Notebook import must use valid UTF-8",e)
        }
        val document=try { JSONObject(text) }
            catch(e:JSONException) {
                throw IllegalArgumentException("Invalid Notebook JSON document",e)
            }
        require(document.opt("format")=="goreecloud-notebook-v2") {
            "Only GoreeCloud Notebook JSON v2 archives are supported"
        }
        val bookItems=document.opt("notebooks") as? JSONArray
            ?: throw IllegalArgumentException("Missing notebooks array")
        val noteItems=document.opt("notes") as? JSONArray
            ?: throw IllegalArgumentException("Missing notes array")
        val revisionItems=if(document.has("revisions")) {
            document.opt("revisions") as? JSONArray
                ?: throw IllegalArgumentException("Invalid revisions array")
        }else JSONArray()
        require(bookItems.length() in 1..maxBooks) { "Invalid notebook count" }
        require(noteItems.length()<=maxNotes) { "Too many notes" }
        require(revisionItems.length()<=maxRevisions) { "Too many revisions" }

        val books=ArrayList<ImportedBook>(bookItems.length())
        val bookIds=HashSet<String>()
        for(i in 0 until bookItems.length()) {
            val obj=bookItems.opt(i) as? JSONObject
                ?: throw IllegalArgumentException("Malformed notebook")
            val id=uuid(requiredString(obj,"id",60))
            require(bookIds.add(id)) { "Duplicate notebook ID" }
            val name=requiredString(obj,"name",120,nonempty=true)
            val created=timestamp(obj,"created_at")
            books.add(ImportedBook(id,name,created))
        }

        data class Draft(val id:String,val notebookId:String,val parentId:String?,
                         val title:String,val body:String,val tags:String,
                         val pinned:Boolean,val deleted:Boolean,val version:Int,
                         val createdAt:Long,val updatedAt:Long)
        val drafts=ArrayList<Draft>(noteItems.length())
        val noteIds=HashSet<String>()
        for(i in 0 until noteItems.length()) {
            val obj=noteItems.opt(i) as? JSONObject
                ?: throw IllegalArgumentException("Malformed note")
            val id=uuid(requiredString(obj,"id",60))
            require(noteIds.add(id)) { "Duplicate note ID" }
            val book=uuid(requiredString(obj,"notebook_id",60))
            require(book in bookIds) { "Note refers to missing notebook" }
            val parent=optionalUuid(obj,"parent_id")
            require(parent!=id) { "Note cannot parent itself" }
            val title=requiredString(obj,"title",200,nonempty=true)
            val body=if(obj.has("body")) requiredString(obj,"body",1_000_000) else ""
            val tags=if(obj.has("tags")) {
                val values=obj.opt("tags") as? JSONArray
                    ?: throw IllegalArgumentException("Tags must be an array")
                require(values.length()<=20) { "Too many tags" }
                (0 until values.length()).map {
                    val value=values.opt(it)
                    require(value is String) { "Tag must be a string" }
                    val normalized=value.trim()
                    require(normalized.isNotBlank() && normalized.length<=64 && ',' !in normalized) {
                        "Android tags must be nonempty, at most 64 characters, and contain no commas"
                    }
                    normalized
                }.joinToString(", ")
            }else ""
            val pinned=if(obj.has("pinned")) {
                obj.opt("pinned") as? Boolean
                    ?: throw IllegalArgumentException("Pinned state must be boolean")
            }else false
            val version=if(obj.has("version")) obj.opt("version") as? Int
                ?: throw IllegalArgumentException("Invalid note version") else 1
            require(version in 1..1_000_000) { "Invalid note version range" }
            val deleted=when(val marker=obj.opt("deleted_at")){
                null,JSONObject.NULL -> false
                is String -> {
                    timestampValue(marker,"deleted_at")
                    true
                }
                else -> throw IllegalArgumentException("Invalid note deletion timestamp")
            }
            drafts.add(Draft(id,book,parent,title,body,tags,pinned,deleted,version,
                timestamp(obj,"created_at"),timestamp(obj,"updated_at")))
        }
        val byId=drafts.associateBy { it.id }
        val importedNotes=drafts.map { note ->
            var depth=0
            var cursor=note.parentId
            val visited=mutableSetOf(note.id)
            while(cursor!=null){
                require(visited.add(cursor)) { "Circular note hierarchy" }
                val parent=byId[cursor]
                    ?: throw IllegalArgumentException("Note references missing parent")
                require(parent.notebookId==note.notebookId){
                    "Child must have parent in the same notebook"
                }
                cursor=parent.parentId
                depth++
                require(depth<=32) { "Hierarchy exceeds 32 parent levels" }
            }
            ImportedNote(note.id,note.notebookId,note.parentId,
                note.title,note.body,note.tags,note.pinned,note.deleted,
                note.version,note.createdAt,note.updatedAt,depth)
        }.sortedWith(compareBy<ImportedNote>{it.depth}.thenBy{it.id})

        val revisions=ArrayList<ImportedRevision>(revisionItems.length())
        val revisionKeys=HashSet<Pair<String,Int>>()
        for(i in 0 until revisionItems.length()) {
            val obj=revisionItems.opt(i) as? JSONObject
                ?: throw IllegalArgumentException("Malformed revision")
            val id=uuid(requiredString(obj,"note_id",60))
            val note=byId[id]
                ?: throw IllegalArgumentException("Revision refers to missing note")
            val version=obj.opt("version") as? Int
                ?: throw IllegalArgumentException("Invalid revision version")
            require(version>=1 && version<note.version) {
                "Revision must precede current note version"
            }
            require(revisionKeys.add(id to version)) {
                "Duplicate note revision"
            }
            revisions.add(ImportedRevision(
                id,version,
                requiredString(obj,"title",200,nonempty=true),
                requiredString(obj,"body",1_000_000),
                timestamp(obj,"saved_at")
            ))
        }
        return ParsedNotebookArchive(books,importedNotes,revisions)
    }

    private fun requiredString(obj:JSONObject,key:String,max:Int,nonempty:Boolean=false):String {
        val value=obj.opt(key)
        require(value is String && value.length<=max && (!nonempty||value.isNotBlank())){
            "Invalid "+key
        }
        return value as String
    }
    private fun uuid(value:String):String {
        require(value.length==36){ "Invalid UUID length" }
        val id=try { UUID.fromString(value) }
            catch(e:IllegalArgumentException){ throw IllegalArgumentException("Invalid UUID",e) }
        require(id.toString().equals(value,ignoreCase=true)) { "Invalid UUID encoding" }
        return id.toString()
    }
    private fun optionalUuid(obj:JSONObject,key:String):String? {
        val raw=obj.opt(key)
        return if(raw==null || raw===JSONObject.NULL) null
            else uuid(raw as? String ?: throw IllegalArgumentException("Invalid "+key))
    }
    private fun timestamp(obj:JSONObject,key:String):Long =
        timestampValue(requiredString(obj,key,50,nonempty=true),key)
    private fun timestampValue(value:String,key:String):Long {
        return try { OffsetDateTime.parse(value).toInstant().toEpochMilli() }
        catch(e:Exception){ throw IllegalArgumentException("Invalid timezone-aware "+key,e) }
    }
}
