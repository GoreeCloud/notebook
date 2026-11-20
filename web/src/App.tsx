import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {ArchiveRestore,BookOpen,Check,ChevronDown,ChevronRight,Download,FilePlus2,FolderPlus,
  Hash,Link2,Menu,MoreHorizontal,PanelLeftClose,Pin,Plus,Search,Settings2,Trash2, X} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {apiClient,ApiError,type Note,type NoteSummary,type Notebook,type Revision,type NoteLinkGraph} from "./api";
import {accentOptions,preference,resolveTheme,themeOptions,type Accent,type ThemeMode} from "./theme";
import {plaintextJsonExportWarning,importUnsavedDraftWarning} from "./privacy";
import {isLocalNotebookEndpoint} from "./endpoint";

function ThemeControls({theme,accent,onTheme,onAccent}:{
  theme:ThemeMode;accent:Accent;
  onTheme:(mode:ThemeMode)=>void;onAccent:(value:Accent)=>void;
}){
  return <div className="theme-controls" aria-label="GoreeCloud UI preferences">
    <label>Appearance
      <select aria-label="Color theme" value={theme} onChange={e=>onTheme(e.target.value as ThemeMode)}>
        {themeOptions.map(value=><option key={value} value={value}>{value==="system"?"System":value==="dark"?"Dark":"Light"}</option>)}
      </select>
    </label>
    <label>Accent
      <select aria-label="Accent family" value={accent} onChange={e=>onAccent(e.target.value as Accent)}>
        {accentOptions.map(value=><option key={value} value={value}>{value[0].toUpperCase()+value.slice(1)}</option>)}
      </select>
    </label>
  </div>;
}

// List-only records deliberately carry truncated preview text, never
// writable full Markdown. The editor hydrates the full selected note first.
function toPreviewNote(summary:NoteSummary):Note {
  return {...summary,body:summary.preview,preview_only:true};
}

function sortTree(notes:Note[]) {
  const groups=new Map<string,Note[]>();
  for(const n of notes){const key=n.parent_id||"";groups.set(key,[...(groups.get(key)||[]),n]);}
  const seen=new Set<string>();
  const result:{note:Note;depth:number}[]=[];
  function visit(parent:string,depth:number){
    for(const n of (groups.get(parent)||[]).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||a.title.localeCompare(b.title))){
      if(seen.has(n.id))continue;
      seen.add(n.id);result.push({note:n,depth:Math.min(depth,8)});visit(n.id,depth+1);
    }
  }
  visit("",0);
  for(const n of notes){if(!seen.has(n.id))visit(n.parent_id||"",0);}
  return result;
}

export default function App(){
  // Only design preferences are saved locally; credentials and notes stay memory/API-bound.
  const [themeMode,setThemeMode]=useState<ThemeMode>(()=>{
    try{return preference(window.localStorage.getItem("gc-notebook-theme"),themeOptions,"system");}
    catch{return "system";}
  });
  const [accent,setAccent]=useState<Accent>(()=>{
    try{return preference(window.localStorage.getItem("gc-notebook-accent"),accentOptions,"iris");}
    catch{return "iris";}
  });
  const [prefersDark,setPrefersDark]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia("(prefers-color-scheme: dark)");
    setPrefersDark(media.matches);
    const update=(event:MediaQueryListEvent)=>setPrefersDark(event.matches);
    media.addEventListener("change",update);
    return()=>media.removeEventListener("change",update);
  },[]);
  useEffect(()=>{
    const root=document.documentElement;
    root.dataset.gcTheme=resolveTheme(themeMode,prefersDark);
    root.dataset.gcAccent=accent;
    root.style.colorScheme=resolveTheme(themeMode,prefersDark);
    try{
      window.localStorage.setItem("gc-notebook-theme",themeMode);
      window.localStorage.setItem("gc-notebook-accent",accent);
    }catch{/* Private browsing or restricted storage: keep in-memory selections. */}
  },[themeMode,accent,prefersDark]);
  const [endpoint,setEndpoint]=useState("http://127.0.0.1:8000");
  const [key,setKey]=useState("");
  const [connected,setConnected]=useState(false);
  const [notebooks,setNotebooks]=useState<Notebook[]>([]);
  const [notes,setNotes]=useState<Note[]>([]);
  const [noteNextOffset,setNoteNextOffset]=useState(0);
  const [noteHasMore,setNoteHasMore]=useState(false);
  const [loadingMoreNotes,setLoadingMoreNotes]=useState(false);
  const [selected,setSelected]=useState("");
  const [activeBook,setActiveBook]=useState("");
  const [query,setQuery]=useState("");
  const [searchResults,setSearchResults]=useState<Note[]|null>(null);
  const [searchEpoch,setSearchEpoch]=useState(0);
  const [searchMore,setSearchMore]=useState(false);
  const [draft,setDraft]=useState<{title:string;body:string;tags:string}>({title:"",body:"",tags:""});
  const [preview,setPreview]=useState(false);
  const [trash,setTrash]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [toast,setToast]=useState("");
  const [collapsed,setCollapsed]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [revisions,setRevisions]=useState<Revision[]>([]);
  const [linkGraph,setLinkGraph]=useState<NoteLinkGraph|null>(null);
  const [hydrateFailure,setHydrateFailure]=useState("");
  const [hydrateRetry,setHydrateRetry]=useState(0);
  const api=useMemo(()=>apiClient(endpoint,key),[endpoint,key]);
  const fileInput=useRef<HTMLInputElement>(null);
  const chosen=notes.find(n=>n.id===selected);
  const dirty=Boolean(chosen&&!chosen.preview_only&&
    (draft.title!==chosen.title||draft.body!==chosen.body||
    draft.tags!==chosen.tags.join(", ")));
  const ranked=Boolean(query.trim()&&!trash&&searchResults!==null);
  const visible=(ranked?searchResults||[]:notes).filter(n=>
    (trash?!!n.deleted_at:!n.deleted_at)&&(!activeBook||n.notebook_id===activeBook)&&
    (ranked||!query||[n.title,n.body,n.tags.join(" ")].some(s=>s.toLowerCase().includes(query.toLowerCase()))));
  const shown=ranked?visible.map(note=>({note,depth:0})):sortTree(visible);
  const selectedBook=notebooks.find(n=>n.id===activeBook);

  const load=useCallback(async (preferSelected?:string)=>{
    const [books,page]=await Promise.all([api.notebooks(),api.notesPageSummary("",true,500,0)]);
    const items=page.results.map(toPreviewNote);
    setNotebooks(books);setNotes(items);
    setNoteNextOffset(page.next_offset);
    setNoteHasMore(page.has_more);
    setActiveBook(current=>current||books[0]?.id||"");
    setSelected(current=>{
      const requested=preferSelected||current;
      return items.some(n=>n.id===requested)?requested:(items.find(n=>!n.deleted_at)?.id||"");
    });
  },[api]);

  useEffect(()=>{if(!connected)return;
    load().catch(e=>setError(String(e.message||e)));},[connected,load]);

  // Cursor is derived exclusively from backend page offsets; ranked-search
  // additions or link-navigation results must not advance the list cursor.
  const loadMoreNotes=async()=>{
    if(loadingMoreNotes||!noteHasMore)return;
    setLoadingMoreNotes(true);setError("");
    try{
      const page=await api.notesPageSummary("",true,500,noteNextOffset);
      setNotes(existing=>{
        const seen=new Set(existing.map(item=>item.id));
        return [...existing,...page.results.filter(item=>!seen.has(item.id)).map(toPreviewNote)];
      });
      setNoteNextOffset(page.next_offset);
      setNoteHasMore(page.has_more);
    }catch(e){setError("Could not load more notes: "+String(e));}
    finally{setLoadingMoreNotes(false);}
  };

  // Debounced server-ranked FTS results; local filtering remains available
  // until the request returns and for Trash, which is deliberately not indexed.
  useEffect(()=>{
    if(!connected||trash||!query.trim()){
      setSearchResults(null);setSearchMore(false);return;
    }
    let current=true;
    setSearchResults(null);
    const timeout=setTimeout(()=>{
      api.rankedSearch(query.trim(),200,activeBook).then(result=>{
        if(!current)return;
        setSearchResults(result.results);
        setSearchMore(result.has_more);
        setNotes(existing=>{
          const seen=new Set(existing.map(n=>n.id));
          const newNotes=result.results.filter(n=>!seen.has(n.id));
          return newNotes.length?[...existing,...newNotes]:existing;
        });
      }).catch(error=>{
        if(!current)return;
        setSearchResults(null);setSearchMore(false);
        setError("Full-text search unavailable: "+String(error));
      });
    },220);
    return()=>{current=false;clearTimeout(timeout);};
  },[api,connected,query,trash,activeBook,searchEpoch]);

  // Never allow an abbreviated sidebar preview to become an editable body.
  // A full authenticated detail GET must complete before mounting the editor.
  useEffect(()=>{
    if(!connected||!chosen?.preview_only)return;
    let current=true;
    setHydrateFailure("");
    api.getNote(chosen.id,Boolean(chosen.deleted_at)).then(detail=>{
      if(!current)return;
      setNotes(existing=>existing.map(item=>item.id===detail.id?detail:item));
    }).catch(e=>{
      if(current)setHydrateFailure("Could not load full note: "+String(e));
    });
    return()=>{current=false;};
  },[api,connected,chosen?.id,chosen?.preview_only,hydrateRetry]);

  useEffect(()=>{
    if(!chosen||chosen.preview_only){setDraft({title:"",body:"",tags:""});setRevisions([]);return;}
    setDraft({title:chosen.title,body:chosen.body,tags:chosen.tags.join(", ")});
    setRevisions([]);
  },[selected,chosen?.version,chosen?.id,chosen?.preview_only]);

  useEffect(()=>{
    if(!connected||!chosen||chosen.deleted_at){setLinkGraph(null);return;}
    let current=true;
    setLinkGraph(null);
    api.noteLinks(chosen.id).then(graph=>{if(current)setLinkGraph(graph);})
      .catch(()=>{if(current)setLinkGraph(null);});
    return()=>{current=false;};
  },[connected,api,chosen?.id,chosen?.version,chosen?.deleted_at,searchEpoch]);

  const openLinkedNote=(target:Note)=>{
    if(dirty&&!confirm("Discard unsaved edits before following this note link?"))return;
    setNotes(items=>items.some(n=>n.id===target.id)?
      items.map(item=>item.id===target.id?target:item):[...items,target]);
    setActiveBook(target.notebook_id);
    setQuery("");setTrash(false);setPreview(false);setSelected(target.id);
  };

  const selectedNote=chosen?.preview_only?undefined:chosen;
  const save=async()=>{
    if(!selectedNote||!dirty||saving)return;
    setSaving(true);setError("");
    try{
      const updated=await api.updateNote(selectedNote,{
        title:draft.title.trim()||"Untitled",body:draft.body,
        tags:draft.tags.split(",").map(t=>t.trim()).filter(Boolean).slice(0,20)});
      setNotes(items=>items.map(n=>n.id===updated.id?updated:n));
      setSearchResults(items=>items?.map(n=>n.id===updated.id?updated:n)||null);
      setSearchEpoch(value=>value+1);
      setToast("Saved · revision "+updated.version);
    }catch(e){setError(e instanceof ApiError&&e.status===409?
      "This note changed elsewhere. Copy your draft and reload before saving.":String(e));}
    finally{setSaving(false);}
  };
  const addNote=async(parent_id:string|null=null)=>{
    try{
      const note=await api.createNote(activeBook||notebooks[0].id,"Untitled note",parent_id);
      await load(note.id);setTrash(false);setPreview(false);
    }catch(e){setError(String(e));}
  };
  const addNotebook=async()=>{
    const name=prompt("Name of the new notebook");
    if(!name?.trim())return;
    try{const book=await api.createNotebook(name.trim());await load();setActiveBook(book.id);setSelected("");}
    catch(e){setError(String(e));}
  };
  const moveToTrash=async()=>{
    if(!selectedNote||!confirm("Move this note to Trash?"))return;
    try{await api.trash(selectedNote);await load();setSelected("");setToast("Moved to Trash");}
    catch(e){setError(String(e));}
  };
  const restore=async()=>{if(!selectedNote)return;
    try{await api.untrash(selectedNote);await load(selectedNote.id);setTrash(false);}
    catch(e){setError(String(e));}
  };
  const history=async()=>{if(!selectedNote)return;
    try{setRevisions(await api.revisions(selectedNote.id));}catch(e){setError(String(e));}
  };
  const restoreVersion=async(version:number)=>{if(!selectedNote||!confirm("Restore this version?"))return;
    try{const note=await api.restoreRevision(selectedNote,version);await load(note.id);setRevisions([]);setToast("Revision restored");}
    catch(e){setError(String(e));}
  };
  const download=async()=>{try{
    if(!confirm(plaintextJsonExportWarning))return;
    const data=JSON.stringify(await api.export(),null,2);
    const objectUrl=URL.createObjectURL(new Blob([data],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=objectUrl;anchor.download="goreecloud-notebook-export.json";
    anchor.click();URL.revokeObjectURL(objectUrl);setToast("Export downloaded");
  }catch(e){setError(String(e));}};
  const downloadMarkdownZip=async()=>{try{
    if(!confirm("Download active notes as a PLAINTEXT Markdown ZIP? Tags, revisions, Trash and attachment metadata are NOT included. Use JSON for full recovery."))return;
    const blob=await api.exportMarkdownZip();
    const objectUrl=URL.createObjectURL(blob);
    const anchor=document.createElement("a");anchor.href=objectUrl;
    anchor.download="goreecloud-notebook-markdown.zip";anchor.click();
    URL.revokeObjectURL(objectUrl);setToast("Plaintext Markdown ZIP downloaded");
  }catch(e){setError(String(e));}};
  const importFile=async (file:File)=>{
    setError("");
    if(dirty&&!confirm(importUnsavedDraftWarning))return;
    if(file.size>8*1024*1024){setError("Archive exceeds the 8 MiB import limit.");return;}
    try{
      const isZip=/\.zip$/i.test(file.name);
      if(isZip){
        const array=new Uint8Array(await file.arrayBuffer());
        const pieces:string[]=[];
        for(let i=0;i<array.length;i+=32768){
          pieces.push(String.fromCharCode(...array.subarray(i,i+32768)));
        }
        const archive_base64=btoa(pieces.join(""));
        let skip=false;
        let report;
        try{report=await api.importMarkdownZip(archive_base64,true,false);}
        catch(error){
          if(!(error instanceof ApiError&&error.status===422&&
               error.message.includes("skip_unsupported")))throw error;
          if(!confirm("This ZIP contains non-Markdown files or Trilium metadata. Those files CANNOT be preserved. Continue as a TEXT-ONLY import and omit them?"))return;
          skip=true;
          report=await api.importMarkdownZip(archive_base64,true,true);
        }
        if(!confirm(`Validated ${report.notes} notes including folder placeholders. ${report.warnings.join(" ")} Import without overwriting existing content?`))return;
        const result=await api.importMarkdownZip(archive_base64,false,skip);
        await load();
        setToast(`Imported ${result.notes} Markdown notes and folders`);
        return;
      }
      const content=await file.text();
      const isEnex=/\.enex$/i.test(file.name);
      if(isEnex){
        let skipResources=false;
        let report;
        try{report=await api.importEnex(content,true,false);}
        catch(error){
          if(!(error instanceof ApiError&&error.status===422&&
               error.message.includes("skip_resources")))throw error;
          if(!confirm("This ENEX has attachments or embedded media. GoreeCloud cannot import those files. Import text only and OMIT all media?"))return;
          skipResources=true;
          report=await api.importEnex(content,true,true);
        }
        if(!confirm(`Review: ${report.notes} notes. ${report.warnings.join(" ")} Import as NEW notes?`))return;
        const result=await api.importEnex(content,false,skipResources);
        await load();
        setToast(`Imported ${result.notes} ENEX text notes`);
      }else{
        const document:unknown=JSON.parse(content);
        const report=await api.importArchive(document,true);
        if(!confirm(`Validated ${report.notes} notes, ${report.notebooks} notebooks and ${report.revisions} revisions. Import as new records without overwriting existing notes?`))return;
        const result=await api.importArchive(document,false);
        await load();
        setToast(`Imported ${result.notes} notes into new notebooks`);
      }
    }catch(e){setError("Import failed; no changes were applied: "+String(e));}
  };
  useEffect(()=>{
    const keydown=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="s"){e.preventDefault();void save();}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){
        e.preventDefault();document.querySelector<HTMLInputElement>("#note-search")?.focus();}
    };
    window.addEventListener("keydown",keydown);return()=>window.removeEventListener("keydown",keydown);
  });

  if(!connected) return <main className="connect-screen">
    <div className="connect-card">
      <div className="mark">G<span>✦</span></div>
      <p className="eyebrow">GOREECLOUD / LOCAL WORKSPACE</p>
      <h1>Every thought has a place.</h1>
      <p className="muted">Connect to your self-hosted Notebook service. The API token stays in this browser tab's memory.</p>
      <form onSubmit={async e=>{e.preventDefault();setError("");
        try{
          if(!isLocalNotebookEndpoint(endpoint)&&!confirm(
            "You are connecting to a REMOTE HTTPS Notebook endpoint. Your access token will be sent to this server. " +
            "Only continue if you personally trust its operator and its TLS configuration. " +
            "The preview API has no per-user Identity authorization or production remote security review."
          ))return;
          const client=apiClient(endpoint,key);await client.notebooks();setConnected(true);
        }
        catch(e){setError("Connection failed: "+String(e));}}}>
        <label htmlFor="endpoint">Service URL</label>
        <input id="endpoint" value={endpoint} onChange={e=>setEndpoint(e.target.value)} required/>
        <label htmlFor="token">Access token</label>
        <input id="token" type="password" autoComplete="off" value={key}
          onChange={e=>setKey(e.target.value)} required minLength={24}/>
        {error&&<p role="alert" className="error">{error}</p>}
        <button className="button primary" type="submit">Open Notebook <ChevronRight size={18}/></button>
      </form>
      <ThemeControls theme={themeMode} accent={accent} onTheme={setThemeMode} onAccent={setAccent}/>
      <p className="fineprint">Development preview · No cloud sync or account sign-in yet</p>
    </div>
  </main>;

  return <div className="app-shell">
    <aside className={"sidebar "+(sidebarOpen?"sidebar-open":"")+(collapsed?" sidebar-collapsed":"")}>
      <header className="brand"><div className="mark small">G<span>✦</span></div><div><strong>Notebook</strong><small>GOREECLOUD</small></div>
        <button aria-label="Close sidebar" className="icon-only mobile-only" onClick={()=>setSidebarOpen(false)}><X size={20}/></button>
      </header>
      <div className="sidebar-body">
        <div className="nav-heading">WORKSPACE <button title="Create notebook" aria-label="Create notebook" onClick={addNotebook}><Plus size={17}/></button></div>
        <button className={"nav-item "+(!activeBook?"active":"")} onClick={()=>{setActiveBook("");setTrash(false);setSidebarOpen(false);}}>
          <BookOpen size={18}/> All notes <span className="count">{notes.filter(n=>!n.deleted_at).length}</span></button>
        {notebooks.map(b=><button key={b.id} className={"nav-item "+(activeBook===b.id&&!trash?"active":"")}
          onClick={()=>{setActiveBook(b.id);setTrash(false);setSidebarOpen(false);}}>
          <span className="book-dot"/> {b.name} <span className="count">{notes.filter(n=>n.notebook_id===b.id&&!n.deleted_at).length}</span>
        </button>)}
        <div className="nav-heading lower">LIBRARY</div>
        <button className={"nav-item "+(trash?"active":"")} onClick={()=>{setTrash(true);setSelected("");setSidebarOpen(false);}}><Trash2 size={18}/> Trash</button>
        <div className="sidebar-bottom">
          <ThemeControls theme={themeMode} accent={accent} onTheme={setThemeMode} onAccent={setAccent}/>
          <input ref={fileInput} type="file" accept=".json,.enex,.zip,application/json,text/xml,application/xml,application/zip" hidden
            aria-label="Select Notebook JSON, ENEX or Markdown ZIP archive"
            onChange={e=>{const file=e.target.files?.[0];if(file)void importFile(file);e.currentTarget.value="";}}/>
          <button className="nav-item" onClick={()=>fileInput.current?.click()}>
            <ArchiveRestore size={18}/> Import JSON / ENEX / ZIP</button>
          <button className="nav-item" onClick={download}><Download size={18}/> Export JSON</button>
          <button className="nav-item" onClick={downloadMarkdownZip}>
            <Download size={18}/> Export Markdown ZIP</button>
          <button className="nav-item" onClick={()=>{setConnected(false);setKey("");}}><Settings2 size={18}/> Disconnect</button>
        </div>
      </div>
    </aside>
    <section className="list-panel">
      <div className="list-heading"><button className="icon-only mobile-only" aria-label="Open menu" onClick={()=>setSidebarOpen(true)}><Menu size={20}/></button>
        <div><div className="eyebrow">YOUR COLLECTION</div><h2>{trash?"Trash":selectedBook?.name||"All notes"}</h2></div>
        <button className="icon-only" aria-label="New note" title="New note" onClick={()=>addNote()} disabled={trash}><FilePlus2 size={21}/></button>
      </div>
      <label className="search"><Search size={18}/><input id="note-search" placeholder="Search your notes" value={query}
        maxLength={200} onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label>
      <div className="list-meta">{visible.length} {visible.length===1?"note":"notes"} <span>· {ranked?"Ranked full-text results":"Markdown workspace"}{ranked&&searchMore?" · first 200 matches":""}</span></div>
      <div className="note-list">
        {shown.map(({note,depth})=><button key={note.id}
          className={"note-list-item "+(selected===note.id?"selected":"")}
          style={{paddingLeft:16+depth*12}} onClick={()=>{if(dirty&&!confirm("Discard unsaved edits?"))return;setSelected(note.id);}}>
          <div className="list-item-head"><span>{note.pinned&&<Pin size={13} aria-label="Pinned"/>}{note.title}</span>
            <small>{new Date(note.updated_at).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</small></div>
          <p>{note.body.slice(0,115).replace(/[#*\[\]]/g,"")||"Start writing..."}</p>
          <div className="tag-row">{note.tags.slice(0,3).map(t=><span className="tag" key={t}>#{t}</span>)}</div>
        </button>)}
        {shown.length===0&&<div className="empty">Nothing here yet.<p>{trash?"Trash is empty.":"Create a note to start collecting ideas."}</p></div>}
        {noteHasMore&&<button className="load-more-notes" onClick={loadMoreNotes}
          disabled={loadingMoreNotes} aria-label="Load more stored notes">
          {loadingMoreNotes?"Loading notes…":"Load more notes from this device"}
        </button>}
      </div>
      {!trash&&<button className="new-note" onClick={()=>addNote()}><Plus size={18}/> New note</button>}
    </section>
    <main className="editor-panel">
      {selectedNote?<><div className="editor-toolbar">
        <div className="breadcrumbs">{selectedBook?.name||notebooks.find(n=>n.id===selectedNote.notebook_id)?.name||"Notebook"} <ChevronRight size={14}/> <span>Note</span></div>
        <div className="toolbar-actions">
          <button className={"toggle "+(preview?"on":"")} onClick={()=>setPreview(!preview)}>{preview?"Edit":"Preview"}</button>
          <button className="icon-only" title="Version history" aria-label="Version history" onClick={history}><ArchiveRestore size={19}/></button>
          {!trash&&<button className="icon-only" title="Create nested note" aria-label="Create nested note" onClick={()=>addNote(selectedNote.id)}><FolderPlus size={19}/></button>}
          {!trash&&<button className="icon-only" title="Move to Trash" aria-label="Move to Trash" onClick={moveToTrash}><Trash2 size={19}/></button>}
          {trash&&<button className="button" onClick={restore}>Restore</button>}
          <button className="button primary save" disabled={!dirty||saving||!!selectedNote.deleted_at} onClick={save}>
            <Check size={17}/>{saving?"Saving":dirty?"Save changes":"Saved"}</button>
        </div>
      </div>
      <div className="editor-scroll"><div className="editor-content">
        <div className="document-eyebrow"><span className="document-icon">✦</span> PERSONAL KNOWLEDGE <span className="separator">/</span> NOTE</div>
        <input className="title-input" aria-label="Note title" value={draft.title}
          onChange={e=>setDraft(d=>({...d,title:e.target.value}))} disabled={!!selectedNote.deleted_at}/>
        <div className="note-details"><span>{new Date(selectedNote.updated_at).toLocaleDateString(undefined,{month:"long",day:"numeric",year:"numeric"})}</span>
          <span>·</span><span>Revision {selectedNote.version}</span><span>·</span><span>{draft.body.trim().split(/\s+/).filter(Boolean).length} words</span>
        </div>
        <label className="tag-editor"><Hash size={16}/><input aria-label="Comma separated tags" placeholder="Add tags (comma separated)"
          value={draft.tags} onChange={e=>setDraft(d=>({...d,tags:e.target.value}))} disabled={!!selectedNote.deleted_at}/></label>
        {preview?<article className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.body}</ReactMarkdown></article>:
          <textarea className="body-editor" aria-label="Note body in Markdown" spellCheck
            placeholder={"Start writing something meaningful…\n\nUse Markdown for headings, links, lists and checkboxes. Link to notes with [[Note Title]]."}
            value={draft.body} onChange={e=>setDraft(d=>({...d,body:e.target.value}))}
            disabled={!!selectedNote.deleted_at}/>}
        <div className="editor-foot">{dirty?"● Unsaved changes":"All changes saved"} <span>Markdown · Ctrl/⌘+S to save</span></div>
        {revisions.length>0&&<section className="history"><div className="history-title"><h3>Version history</h3>
          <button className="icon-only" aria-label="Close version history" onClick={()=>setRevisions([])}><X size={18}/></button></div>
          {revisions.map(r=><div className="history-row" key={r.version}><div>Revision {r.version}<small>{new Date(r.saved_at).toLocaleString()}</small></div>
            <button className="button subtle" onClick={()=>restoreVersion(r.version)}>Restore</button></div>)}</section>}
        {linkGraph&&<section className="history link-graph" aria-label="Note links">
          <div className="history-title"><h3><Link2 size={17} aria-hidden="true"/> Linked notes</h3>
            <small>Title links match unique notes in the same notebook; ID links can cross notebooks.</small></div>
          {(["outgoing","incoming"] as const).map(direction=><div key={direction} className="link-group">
            <h4>{direction==="outgoing"?"References in this note":"Notes referencing this note"}</h4>
            {linkGraph[direction].results.length===0&&<p>No resolved links</p>}
            {linkGraph[direction].results.map(target=><button key={target.id}
              className="button subtle link-target" onClick={()=>openLinkedNote(target)}
              title={target.title}>{target.title}</button>)}
            {linkGraph[direction].has_more&&<p>More results exist beyond the first {linkGraph.limit} links.</p>}
          </div>)}
        </section>}
      </div></div></>:chosen?.preview_only?<div className="no-selection" role="status">
        <h2>{hydrateFailure?"Could not load the full note":"Loading full note…"}</h2>
        <p>{hydrateFailure||"The editor stays locked until all Markdown is retrieved."}</p>
        {hydrateFailure&&<button className="button" onClick={()=>setHydrateRetry(v=>v+1)}>Retry loading</button>}
      </div>:<div className="no-selection"><div className="blank-logo"><BookOpen size={34}/></div>
        <h2>Your space to think.</h2><p>Select a note to read or edit, or start a new idea.</p>
        <button className="button primary" disabled={trash} onClick={()=>addNote()}><Plus size={18}/> Create a note</button></div>}
    </main>
    {error&&<div className="notice error" role="alert"><span>{error}</span><button onClick={()=>setError("")} aria-label="Dismiss error"><X size={17}/></button></div>}
    {toast&&<div className="notice success" role="status" onClick={()=>setToast("")}>{toast} <X size={14}/></div>}
  </div>;
}
