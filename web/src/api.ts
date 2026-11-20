export type Notebook = {id:string; name:string; created_at?:string};
export type Note = {id:string; notebook_id:string; parent_id:string|null; title:string;
  body:string; tags:string[]; pinned:boolean; deleted_at:string|null;
  version:number; created_at:string; updated_at:string};
export type Revision = {note_id:string;version:number;title:string;body:string;saved_at:string};

export class ApiError extends Error {
  constructor(public status:number, message:string) { super(message); }
}
export function apiClient(baseUrl:string,token:string) {
  async function request<T>(path:string, options:RequestInit={}):Promise<T> {
    const response = await fetch(baseUrl.replace(/\/$/,"")+"/api/v1"+path, {
      ...options,
      headers: {"Authorization": "Bearer "+token,
        "Content-Type":"application/json", ...options.headers}
    });
    if (!response.ok) {
      const detail = await response.json().catch(()=>null);
      throw new ApiError(response.status, detail?.detail || "Request failed");
    }
    return response.json() as Promise<T>;
  }
  const encode=(s:string)=>encodeURIComponent(s);
  return {
    notebooks:()=>request<Notebook[]>("/notebooks"),
    createNotebook:(name:string)=>request<Notebook>("/notebooks",{method:"POST",body:JSON.stringify({name})}),
    notes:(query="",deleted=false)=>request<Note[]>("/notes?q="+encode(query)+"&include_deleted="+deleted),
    createNote:(notebook_id:string,title:string,parent_id:string|null=null)=>request<Note>(
      "/notes",{method:"POST",body:JSON.stringify({notebook_id,title,parent_id})}),
    updateNote:(note:Note, changes:Partial<Note>)=>request<Note>("/notes/"+encode(note.id),{
      method:"PATCH",body:JSON.stringify({expected_version:note.version,...changes})}),
    trash:(note:Note)=>request<Note>("/notes/"+encode(note.id),{
      method:"DELETE",body:JSON.stringify({expected_version:note.version})}),
    untrash:(note:Note)=>request<Note>("/notes/"+encode(note.id)+"/restore",{
      method:"POST",body:JSON.stringify({expected_version:note.version})}),
    revisions:(id:string)=>request<Revision[]>("/notes/"+encode(id)+"/revisions"),
    restoreRevision:(note:Note,version:number)=>request<Note>(
      "/notes/"+encode(note.id)+"/revisions/"+version+"/restore",{
      method:"POST",body:JSON.stringify({expected_version:note.version})}),
    export:()=>request<{format:string;notebooks:Notebook[];notes:Note[];revisions?:Revision[]}>("/export"),
    importEnex:(xml:string,dry_run:boolean,skip_resources:boolean)=>request<{
      mode:string;dry_run:boolean;notebooks:number;notes:number;revisions:number;warnings:string[]
    }>("/import/enex",{method:"POST",body:JSON.stringify({xml,dry_run,skip_resources})}),
    importArchive:(document:unknown,dry_run:boolean)=>request<{
      mode:string;dry_run:boolean;notebooks:number;notes:number;revisions:number;warnings:string[]
    }>("/import",{method:"POST",body:JSON.stringify({document,dry_run})})
  };
}
