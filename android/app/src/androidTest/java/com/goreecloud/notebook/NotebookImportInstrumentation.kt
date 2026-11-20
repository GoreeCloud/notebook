package com.goreecloud.notebook

import android.app.Activity
import android.app.Instrumentation
import android.content.Context
import android.os.Bundle
import java.util.UUID
import org.json.JSONObject

/**
 * Test-only native Android instrumentation, never compiled into the app APK.
 *
 * Uses a distinct per-run SQLite database name and removes it on completion,
 * never opening or modifying notebook.db (the normal user database).
 * Run only on a personally authorized Android test device.
 */
class NotebookImportInstrumentation:Instrumentation() {
    override fun onCreate(arguments: Bundle?) {
        super.onCreate(arguments)
        // Instrumentation.onStart is scheduled only after start() is called.
        // Without this, am instrument -w waits indefinitely.
        start()
    }

    override fun onStart() {
        val report=Bundle()
        val name="notebook-test-"+UUID.randomUUID().toString()+".db"
        val context=targetContext
        var store:NotebookStore?=null
        var exitStatus=Activity.RESULT_OK
        try {
            check(name.startsWith("notebook-test-") && name!="notebook.db")
            store=NotebookStore(context,name)
            val book=store.defaultNotebookId()
            val parent=store.create(book)
            val edited=store.save(parent,"Parent","Confidential synthetic content",tags="alpha")
                ?: error("Could not save synthetic parent note")
            val child=store.create(book,parent.id)
            val savedChild=store.save(child,"Child","Nested text",tags="beta")
                ?: error("Could not save synthetic child note")
            check(edited.version==2 && savedChild.version==2)
            val original=store.exportJsonV2()
            val preview=store.importJsonV2(original,dryRun=true)
            check(preview.dryRun && preview.notebooks==1 &&
                preview.notes==2 && preview.revisions==2)
            check(store.list(notebookId=book).size==2)
            check(store.notebooks().size==1)
            val applied=store.importJsonV2(original,dryRun=false)
            check(!applied.dryRun && applied.notebooks==1 && applied.notes==2)
            val importedBook=applied.firstImportedNotebookId ?: error("No imported notebook")
            check(importedBook!=book)
            val restored=store.list(notebookId=importedBook)
            check(restored.size==2)
            val importedParent=restored.single{it.title=="Parent"}
            val importedChild=restored.single{it.title=="Child"}
            check(importedChild.parentId==importedParent.id)
            check(importedChild.id!=savedChild.id)
            check(store.revisions(importedChild.id).size==1)
            check(store.revisions(importedParent.id).size==1)
            check(store.list().size==4)
            val malformed=JSONObject(String(original,Charsets.UTF_8))
            val notes=malformed.getJSONArray("notes")
            notes.getJSONObject(0).put("parent_id",UUID.randomUUID().toString())
            val bad=malformed.toString().toByteArray(Charsets.UTF_8)
            var rejected=false
            try { store.importJsonV2(bad,dryRun=false) }
            catch (_:IllegalArgumentException){rejected=true}
            check(rejected)
            check(store.notebooks().size==2 && store.list().size==4)

            // Deliberate SQLite trigger error after at least one INSERT must
            // roll back newly inserted notebook and parent as well.
            val rollback=JSONObject(String(original,Charsets.UTF_8))
            val items=rollback.getJSONArray("notes")
            for(i in 0 until items.length()) {
                val item=items.getJSONObject(i)
                if(!item.isNull("parent_id"))item.put("title","TRIGGER_ROLLBACK_TEST")
            }
            val writable=context.openOrCreateDatabase(name,Context.MODE_PRIVATE,null)
            writable.use { db ->
                db.execSQL("""CREATE TRIGGER synthetic_import_abort
                    BEFORE INSERT ON notes
                    WHEN NEW.title='TRIGGER_ROLLBACK_TEST'
                    BEGIN SELECT RAISE(ABORT,'synthetic rollback test'); END""")
            }
            var rolledBack=false
            try { store.importJsonV2(rollback.toString().toByteArray(Charsets.UTF_8),dryRun=false) }
            catch (_:Exception){rolledBack=true}
            check(rolledBack)
            check(store.notebooks().size==2 && store.list().size==4)

            // Test a library well beyond the legacy 500-record Android list
            // limit. All records exist ONLY in this temporary test database.
            val bulkDb=store.writableDatabase
            bulkDb.beginTransaction()
            try {
                for(i in 0 until 535) {
                    val id=UUID.randomUUID().toString()
                    bulkDb.execSQL(
                        """INSERT INTO notes
                           (id,notebook_id,title,body,version,created_at,updated_at,tags,pinned,deleted)
                           VALUES(?,?,?,?,?,?,?,?,?,?)""".trimIndent(),
                        arrayOf<Any>(id,book,"Synthetic paged "+i,
                            "x".repeat(400),1,1000L,1000L,"",0,0)
                    )
                }
                bulkDb.setTransactionSuccessful()
            } finally {bulkDb.endTransaction()}
            val first=store.listPreviews(notebookId=book,limit=200,offset=0)
            val second=store.listPreviews(notebookId=book,limit=200,offset=200)
            val third=store.listPreviews(notebookId=book,limit=200,offset=400)
            check(first.hasMore && second.hasMore && !third.hasMore)
            val all=first.results+second.results+third.results
            check(all.size==537 && all.map{it.id}.toSet().size==537)
            val bulk=all.first{it.title.startsWith("Synthetic paged ")}
            check(bulk.excerpt.length==160)
            check(store.getNote(bulk.id)?.body?.length==400)
            val trashed=store.create(book)
            check(store.trash(trashed))
            val deleted=store.listPreviews(trash=true,notebookId=book)
            check(deleted.results.map{it.id}==listOf(trashed.id) && !deleted.hasMore)
            var invalid=false
            try {store.listPreviews(notebookId=book,limit=201)}
            catch (_:IllegalArgumentException){invalid=true}
            check(invalid)

            report.putString("result","PASS: append-only JSON roundtrip, rollback, native preview paging beyond 500 and isolated Trash visibility")
        } catch (error:Throwable) {
            report.putString("result","FAIL: "+error.javaClass.simpleName+": "+(error.message?:"unknown test error"))
            exitStatus=Activity.RESULT_CANCELED
        } finally {
            try { store?.close() } catch (_:Exception) {}
            if(name.startsWith("notebook-test-"))context.deleteDatabase(name)
        }
        finish(exitStatus,report)
    }
}
