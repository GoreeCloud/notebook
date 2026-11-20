import {useCallback,useEffect,useMemo,useState} from "react";
import {ArchiveRestore,BookOpen,Check,ChevronDown,ChevronRight,Download,FilePlus2,FolderPlus,
  Hash,Link2,Menu,MoreHorizontal,PanelLeftClose,Pin,Plus,Search,Settings2,Trash2, X} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {apiClient,ApiError,type Note,type Notebook,type Revision} from "./api";

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
  const [endpoint,setEndpoint]=useState("http://127.0.0.1:8000");
  const [key,setKey]=useState("");
  const [connected,setConnected]=useState(false);
  const [notebooks,setNotebooks]=useState<Notebook[]>([]);
  const [notes,setNotes]=useState<Note[]>([]);
  const [selected,setSelected]=useState("");
  const [activeBook,setActiveBook]=useState("");
  const [query,setQuery]=useState("");
  const [draft,setDraft]=useState<{title:string;body:string;tags:string}>({title:"",body:"",tags:""});
  const [preview,setPreview]=useState(false);
  const [trash,setTrash]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [toast,setToast]=useState("");
  const [collapsed,setCollapsed]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [revisions,setRevisions]=useState<Revision[]>([]);
  const api=useMemo(()=>apiClient(endpoint,key),[endpoint,key]);
  const chosen=notes.find(n=>n.id===selected);
  const dirty=Boolean(chosen&&(draft.title!==chosen.title||draft.body!==chosen.body||
    draft.tags!==chosen.tags.join(", ")));
  const visible=notes.filter(n=>(trash?!!n.deleted_at:!n.deleted_at)&&
    (!activeBook||n.notebook_id===activeBook)&&
    (!query||[n.title,n.body,n.tags.join(" ")].some(s=>s.toLowerCase().includes(query.toLowerCase()))));
  const shown=sortTree(visible);
  const selectedBook=notebooks.find(n=>n.id===activeBook);

  const load=useCallback(async (preferSelected?:string)=>{
    const [books,items]=await Promise.all([api.notebooks(),api.notes("",true)]);
    setNotebooks(books);setNotes(items);
    setActiveBook(current=>current||books[0]?.id||"");
    setSelected(current=>{
      const requested=preferSelected||current;
      return items.some(n=>n.id===requested)?requested:(items.find(n=>!n.deleted_at)?.id||"");
    });
  },[api]);

  useEffect(()=>{if(!connected)return;
    load().catch(e=>setError(String(e.message||e)));},[connected,load]);

  useEffect(()=>{
    if(!chosen){setDraft({title:"",body:"",tags:""});setRevisions([]);return;}
    setDraft({title:chosen.title,body:chosen.body,tags:chosen.tags.join(", ")});
    setRevisions([]);
  },[selected,chosen?.version,chosen?.id]);

  const selectedNote=chosen;
  const save=async()=>{
    if(!selectedNote||!dirty||saving)return;
    setSaving(true);setError("");
    try{
      const updated=await api.updateNote(selectedNote,{
        title:draft.title.trim()||"Untitled",body:draft.body,
        tags:draft.tags.split(",").map(t=>t.trim()).filter(Boolean).slice(0,20)});
      setNotes(items=>items.map(n=>n.id===updated.id?updated:n));
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
    const data=JSON.stringify(await api.export(),null,2);
    const objectUrl=URL.createObjectURL(new Blob([data],{type:"application/json"}));
    const anchor=document.createElement("a");anchor.href=objectUrl;anchor.download="goreecloud-notebook-export.json";
    anchor.click();URL.revokeObjectURL(objectUrl);setToast("Export downloaded");
  }catch(e){setError(String(e));}};
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
        try{const client=apiClient(endpoint,key);await client.notebooks();setConnected(true);}
        catch(e){setError("Connection failed: "+String(e));}}}>
        <label htmlFor="endpoint">Service URL</label>
        <input id="endpoint" value={endpoint} onChange={e=>setEndpoint(e.target.value)} required/>
        <label htmlFor="token">Access token</label>
        <input id="token" type="password" autoComplete="off" value={key}
          onChange={e=>setKey(e.target.value)} required minLength={24}/>
        {error&&<p role="alert" className="error">{error}</p>}
        <button className="button primary" type="submit">Open Notebook <ChevronRight size={18}/></button>
      </form>
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
          <button className="nav-item" onClick={download}><Download size={18}/> Export JSON</button>
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
        onChange={e=>setQuery(e.target.value)}/><kbd>⌘ K</kbd></label>
      <div className="list-meta">{visible.length} {visible.length===1?"note":"notes"} <span>· Markdown workspace</span></div>
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
      </div></div></>:<div className="no-selection"><div className="blank-logo"><BookOpen size={34}/></div>
        <h2>Your space to think.</h2><p>Select a note to read or edit, or start a new idea.</p>
        <button className="button primary" disabled={trash} onClick={()=>addNote()}><Plus size={18}/> Create a note</button></div>}
    </main>
    {error&&<div className="notice error" role="alert"><span>{error}</span><button onClick={()=>setError("")} aria-label="Dismiss error"><X size={17}/></button></div>}
    {toast&&<div className="notice success" role="status" onClick={()=>setToast("")}>{toast} <X size={14}/></div>}
  </div>;
}
