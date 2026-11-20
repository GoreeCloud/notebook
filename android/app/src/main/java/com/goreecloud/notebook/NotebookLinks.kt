package com.goreecloud.notebook

import android.icu.lang.UCharacter
import java.util.UUID

/** Read-only local graph. No network, no URI dispatch, no persisted index. */
data class LinkedNote(val id: String, val notebookId: String, val title: String)
data class LocalLinkGraph(
    val incoming: List<LinkedNote>,
    val outgoing: List<LinkedNote>,
    val moreIncoming: Boolean,
    val moreOutgoing: Boolean
)

internal object WikiReferences {
    private val notation = Regex("""\[\[([^\[\]\r\n]{1,200})\]\]""")

    fun fold(value: String): String = UCharacter.foldCase(value, true)

    fun resolve(
        body: String,
        sourceBook: String,
        activeById: Map<String, LinkedNote>,
        titleIds: Map<Pair<String, String>, List<String>>
    ): List<String> {
        val result = LinkedHashSet<String>()
        for (found in notation.findAll(body)) {
            val inner = found.groupValues[1].trim()
            if (inner.isEmpty()) continue
            val target = if (inner.startsWith("note:", ignoreCase = true)) {
                val raw = inner.substring(5).substringBefore("|").trim()
                val normalized = try { UUID.fromString(raw).toString() }
                    catch (_: IllegalArgumentException) { continue }
                if (activeById.containsKey(normalized)) normalized else null
            } else {
                val matches = titleIds[sourceBook to fold(inner)].orEmpty()
                if (matches.size == 1) matches.first() else null
            }
            if (target != null) result.add(target)
        }
        return result.toList()
    }
}
