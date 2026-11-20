/**
 * Reject unsafe remote bearer-token transport, URL-embedded credentials,
 * path rewriting and non-HTTP schemes before making any network request.
 *
 * This is a browser-side safety boundary, not GoreeCloud Identity.
 */
export function normalizeNotebookEndpoint(raw:string):string {
  const trimmed=raw.trim();
  if(!trimmed)throw new Error("Notebook service URL is required.");
  let url:URL;
  try{url=new URL(trimmed);}catch{throw new Error("Enter a valid Notebook service URL.");}
  if(!["http:","https:"].includes(url.protocol)) {
    throw new Error("Notebook endpoint must use HTTP or HTTPS.");
  }
  if(url.username||url.password||url.search||url.hash||!["","/"].includes(url.pathname)) {
    throw new Error("Do not include credentials, paths, query parameters or fragments in the service URL.");
  }
  const isLocal=["localhost","127.0.0.1","[::1]"].includes(url.hostname.toLowerCase());
  if(url.protocol==="http:"&&!isLocal) {
    throw new Error("Remote Notebook endpoints require HTTPS. Plaintext HTTP is allowed on loopback only.");
  }
  if(!url.hostname)throw new Error("Notebook service URL must identify a host.");
  return url.origin;
}

export function isLocalNotebookEndpoint(raw:string):boolean {
  const url=new URL(normalizeNotebookEndpoint(raw));
  return ["localhost","127.0.0.1","[::1]"].includes(url.hostname.toLowerCase());
}
