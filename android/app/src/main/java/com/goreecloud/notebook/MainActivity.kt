package com.goreecloud.notebook

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = NotebookStore(applicationContext)
        setContent {
            MaterialExpressiveTheme(colorScheme = lightColorScheme(
                primary = Color(0xFF5146C8),
                onPrimary = Color.White,
                background = Color(0xFFF6F7FB),
                surface = Color.White,
                onSurface = Color(0xFF1B2030),
                surfaceVariant = Color(0xFFEEF0F7)
            )) { NotebookScreen(store) }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotebookScreen(store: NotebookStore) {
    var search by rememberSaveable { mutableStateOf("") }
    var showTrash by rememberSaveable { mutableStateOf(false) }
    var notes by remember { mutableStateOf(store.list()) }
    var selected by remember { mutableStateOf<NoteRecord?>(null) }
    var title by rememberSaveable { mutableStateOf("") }
    var body by rememberSaveable { mutableStateOf("") }
    var tags by rememberSaveable { mutableStateOf("") }
    var pinned by rememberSaveable { mutableStateOf(false) }
    var status by remember { mutableStateOf("Local · offline") }
    var historyVisible by remember { mutableStateOf(false) }
    var confirmDiscard by remember { mutableStateOf(false) }
    val editing = selected != null
    val dirty = selected?.let {
        title != it.title || body != it.body || tags != it.tags || pinned != it.pinned
    } ?: false

    fun refresh() { notes = store.list(search,showTrash) }
    fun select(note:NoteRecord) {
        selected=note
        title=note.title; body=note.body
        tags=note.tags; pinned=note.pinned
        status="Revision ${note.version} · saved on device"
    }
    fun goBack() {
        if(dirty) confirmDiscard=true else { selected=null; refresh() }
    }
    fun save() {
        val old=selected?:return
        try {
            val result=store.save(old,title.trim(),body,tags,pinned)
            if(result==null)status="Conflict: note changed; reopen before saving."
            else { selected=result; refresh(); status="Saved · revision ${result.version}" }
        } catch (_:IllegalArgumentException) {
            status="Title, body or tags exceed size limits"
        }
    }

    BackHandler(enabled=editing){goBack()}
    if(confirmDiscard) AlertDialog(
        onDismissRequest={confirmDiscard=false},
        title={Text("Discard unsaved changes?")},
        text={Text("Edits in this note have not been saved.")},
        confirmButton={TextButton(onClick={
            confirmDiscard=false; selected=null;refresh()
        }){Text("Discard")}},
        dismissButton={TextButton(onClick={confirmDiscard=false}){Text("Keep editing")}}
    )
    if(historyVisible && selected!=null) {
        val history=remember(selected?.id,selected?.version){store.revisions(selected!!.id)}
        AlertDialog(
            onDismissRequest={historyVisible=false},
            title={Text("Version history")},
            text={
                Column {
                    Text("Restoring an earlier version creates a new revision.",
                        style=MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(12.dp))
                    LazyColumn(modifier=Modifier.heightIn(max=310.dp)) {
                        items(history,key={it.version}){ revision ->
                            TextButton(onClick={
                                val current=selected
                                if(current!=null){
                                    val restored=store.restoreRevision(current,revision.version)
                                    if(restored!=null){
                                        select(restored);refresh()
                                        status="Revision ${revision.version} restored"
                                    }else status="Could not restore; reopen the note."
                                }
                                historyVisible=false
                            }){Text("Restore revision ${revision.version} · ${revision.title}")}
                        }
                    }
                }
            },
            confirmButton={TextButton(onClick={historyVisible=false}){Text("Close")}}
        )
    }

    Scaffold(
        topBar={
            TopAppBar(
                title={
                    Column{
                        Text(if(editing)"Edit note" else if(showTrash)"Trash" else "Notebook",
                            fontWeight=FontWeight.Bold)
                        Text("GOREECLOUD / LOCAL FIRST",fontSize=10.sp,
                            letterSpacing=1.sp,color=MaterialTheme.colorScheme.primary)
                    }
                },
                navigationIcon={
                    if(editing) IconButton(onClick={goBack()}){
                        Icon(Icons.AutoMirrored.Filled.ArrowBack,"Back to notes")
                    }
                },
                actions={
                    if(editing){
                        val current=selected
                        if(current!=null && current.deleted){
                            TextButton(onClick={
                                if(store.restore(current)){
                                    selected=null;refresh();status="Restored from Trash"
                                } else status="Could not restore; reopen the note."
                            }){Text("Restore")}
                        } else if(current!=null) {
                            TextButton(onClick={historyVisible=true}){Text("History")}
                            IconButton(onClick={save()}){
                                Icon(Icons.Default.Save,"Save note")
                            }
                            IconButton(onClick={
                                if(dirty)status="Save or discard edits before moving to Trash"
                                else if(store.trash(current)){
                                    selected=null;refresh();status="Moved to Trash"
                                }else status="Could not move note; reopen it."
                            }){Icon(Icons.Default.DeleteOutline,"Move to Trash")}
                        }
                    }
                }
            )
        },
        floatingActionButton={
            if(!editing && !showTrash)ExtendedFloatingActionButton(
                text={Text("New note")},icon={Icon(Icons.Default.Add,null)},
                onClick={select(store.create());refresh()}
            )
        }
    ){padding->
        Column(Modifier.fillMaxSize().padding(padding).padding(horizontal=18.dp)){
            if(!editing){
                Spacer(Modifier.height(14.dp))
                Row(modifier=Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.SpaceBetween){
                    Text(if(showTrash)"Recently deleted" else "Your thinking space",
                        fontSize=24.sp,fontWeight=FontWeight.Bold)
                    TextButton(onClick={showTrash=!showTrash;refresh()}){
                        Text(if(showTrash)"All notes" else "Trash")
                    }
                }
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(value=search,onValueChange={search=it;refresh()},
                    modifier=Modifier.fillMaxWidth(),placeholder={Text("Search notes and tags")},
                    leadingIcon={Icon(Icons.Default.Search,null)},singleLine=true,
                    shape=RoundedCornerShape(18.dp))
                Spacer(Modifier.height(16.dp))
                Text("${notes.size} notes",color=MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                LazyColumn(verticalArrangement=Arrangement.spacedBy(10.dp)){
                    items(notes,key={it.id}){note->
                        ElevatedCard(onClick={select(note)},modifier=Modifier.fillMaxWidth()){
                            Column(Modifier.fillMaxWidth().padding(18.dp)){
                                Text((if(note.pinned)"★ " else "")+note.title,
                                    fontSize=17.sp,fontWeight=FontWeight.SemiBold,
                                    maxLines=1,overflow=TextOverflow.Ellipsis)
                                Spacer(Modifier.height(7.dp))
                                Text(note.body.ifBlank{"Start writing..."},
                                    fontSize=13.sp,maxLines=2,overflow=TextOverflow.Ellipsis,
                                    color=MaterialTheme.colorScheme.onSurfaceVariant)
                                if(note.tags.isNotBlank()){
                                    Spacer(Modifier.height(7.dp))
                                    Text(note.tags,fontSize=11.sp,
                                        color=MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                    }
                }
            }else{
                Spacer(Modifier.height(14.dp))
                Text("PERSONAL KNOWLEDGE / NOTE",fontSize=11.sp,fontWeight=FontWeight.Bold,
                    letterSpacing=1.sp,color=MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(value=title,onValueChange={title=it.take(200)},
                    label={Text("Title")},modifier=Modifier.fillMaxWidth(),singleLine=true,
                    shape=RoundedCornerShape(18.dp),enabled=selected?.deleted!=true)
                Spacer(Modifier.height(9.dp))
                OutlinedTextField(value=tags,onValueChange={tags=it.take(500)},
                    label={Text("Tags, separated by commas")},modifier=Modifier.fillMaxWidth(),
                    singleLine=true,enabled=selected?.deleted!=true,
                    shape=RoundedCornerShape(18.dp))
                Row(modifier=Modifier.fillMaxWidth(),verticalAlignment=androidx.compose.ui.Alignment.CenterVertically){
                    Checkbox(checked=pinned,onCheckedChange={pinned=it},enabled=selected?.deleted!=true)
                    Text("Pin this note")
                }
                OutlinedTextField(value=body,onValueChange={
                    if(it.length<=1_000_000)body=it
                },label={Text("Markdown note")},modifier=Modifier.fillMaxWidth().weight(1f),
                    enabled=selected?.deleted!=true,shape=RoundedCornerShape(18.dp))
                Spacer(Modifier.height(10.dp))
                if(selected?.deleted!=true)Button(onClick={save()},modifier=Modifier.fillMaxWidth()){
                    Icon(Icons.Default.Save,null);Spacer(Modifier.width(8.dp))
                    Text(if(dirty)"Save changes" else "Save note")
                }
            }
            Text(status,modifier=Modifier.padding(vertical=12.dp),fontSize=11.sp,
                color=MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
