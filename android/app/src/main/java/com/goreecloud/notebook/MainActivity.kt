package com.goreecloud.notebook

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DeleteOutline
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Save
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
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
            MaterialExpressiveTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF5146C8),
                    onPrimary = Color.White,
                    background = Color(0xFFF6F7FB),
                    surface = Color.White,
                    onSurface = Color(0xFF1B2030),
                    surfaceVariant = Color(0xFFEEF0F7)
                )
            ) {
                NotebookScreen(store)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotebookScreen(store: NotebookStore) {
    var search by rememberSaveable { mutableStateOf("") }
    var notes by remember { mutableStateOf(store.list()) }
    var selected by remember { mutableStateOf<NoteRecord?>(null) }
    var title by rememberSaveable { mutableStateOf("") }
    var body by rememberSaveable { mutableStateOf("") }
    var status by remember { mutableStateOf("Local · offline") }
    val editing = selected != null

    fun refresh() { notes = store.list(search) }
    fun select(note: NoteRecord) {
        selected = note
        title = note.title
        body = note.body
        status = "Revision ${note.version} · saved on device"
    }
    fun save() {
        val original = selected ?: return
        try {
            val saved = store.save(original, title.trim(), body)
            if (saved == null) {
                status = "Conflict: note changed. Reopen before saving."
            } else {
                selected = saved
                refresh()
                status = "Saved on device · revision ${saved.version}"
            }
        } catch (e: IllegalArgumentException) {
            status = "Note exceeds the size limit"
        }
    }
    BackHandler(enabled = editing) { selected = null; refresh() }
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(if (editing) "Edit note" else "Notebook", fontWeight = FontWeight.Bold)
                        Text("GOREECLOUD  /  LOCAL FIRST", fontSize = 10.sp,
                            letterSpacing = 1.sp, color = MaterialTheme.colorScheme.primary)
                    }
                },
                navigationIcon = {
                    if (editing) IconButton(onClick = { selected = null; refresh() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back to notes")
                    }
                },
                actions = {
                    if (editing) {
                        IconButton(onClick = { save() }) {
                            Icon(Icons.Default.Save, "Save note")
                        }
                        IconButton(onClick = {
                            val current = selected
                            if (current != null && store.trash(current)) {
                                selected = null
                                refresh()
                                status = "Moved to Trash"
                            } else status = "Could not move note; reload."
                        }) {
                            Icon(Icons.Default.DeleteOutline, "Move to Trash")
                        }
                    }
                }
            )
        },
        floatingActionButton = {
            if (!editing) ExtendedFloatingActionButton(
                text = { Text("New note") },
                icon = { Icon(Icons.Default.Add, null) },
                onClick = { select(store.create()); refresh() }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 18.dp)
        ) {
            if (!editing) {
                Spacer(Modifier.height(14.dp))
                Text("Your thinking space", fontSize = 26.sp, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(14.dp))
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it; refresh() },
                    modifier = Modifier.fillMaxWidth(),
                    placeholder = { Text("Search notes") },
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    singleLine = true, shape = RoundedCornerShape(18.dp)
                )
                Spacer(Modifier.height(18.dp))
                Text("${notes.size} notes", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(12.dp))
                LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(notes, key = { it.id }) { note ->
                        ElevatedCard(
                            onClick = { select(note) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(Modifier.fillMaxWidth().padding(18.dp)) {
                                Text(note.title, fontWeight = FontWeight.SemiBold,
                                    fontSize = 17.sp, maxLines = 1,
                                    overflow = TextOverflow.Ellipsis)
                                Spacer(Modifier.height(6.dp))
                                Text(note.body.ifBlank { "Start writing..." },
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    fontSize = 13.sp, maxLines = 2,
                                    overflow = TextOverflow.Ellipsis)
                            }
                        }
                    }
                }
            } else {
                Spacer(Modifier.height(22.dp))
                Text("A SPACE FOR IDEAS", fontSize = 11.sp, fontWeight = FontWeight.Bold,
                    letterSpacing = 1.sp, color = MaterialTheme.colorScheme.primary)
                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = title,
                    onValueChange = { title = it.take(200) },
                    label = { Text("Title") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(18.dp)
                )
                Spacer(Modifier.height(16.dp))
                OutlinedTextField(
                    value = body,
                    onValueChange = { if (it.length <= 1_000_000) body = it },
                    label = { Text("Markdown note") },
                    modifier = Modifier.fillMaxWidth().weight(1f),
                    shape = RoundedCornerShape(18.dp)
                )
                Spacer(Modifier.height(16.dp))
                Button(onClick = { save() }, modifier = Modifier.fillMaxWidth()) {
                    Icon(Icons.Default.Save, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Save note")
                }
            }
            Text(status, modifier = Modifier.padding(vertical = 14.dp),
                fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
