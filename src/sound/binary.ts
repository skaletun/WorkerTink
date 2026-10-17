const bytesByBlob=new WeakMap<Blob,ArrayBuffer>();
export const isWebKit=()=>/AppleWebKit/i.test(navigator.userAgent)&&!/(Chrome|Chromium|Edg|OPR)\//i.test(navigator.userAgent);
export const needsInlineMedia=()=>!navigator.onLine&&isWebKit();
export function rememberBytes(blob:Blob,bytes:ArrayBuffer){bytesByBlob.set(blob,bytes);return blob}
export const blobBytes=(blob:Blob)=>bytesByBlob.has(blob)?Promise.resolve(bytesByBlob.get(blob)!):blob.arrayBuffer();
/** Encode known bytes directly: offline WebKit can refuse FileReader's Blob I/O. */
export async function inlineBlob(blob:Blob){const bytes=new Uint8Array(await blobBytes(blob));let binary='';for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));return `data:${blob.type||'application/octet-stream'};base64,${btoa(binary)}`}
