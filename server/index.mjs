import http from 'node:http';
import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';

const PORT=Number(process.env.PORT||8787);
const DATA_FILE=process.env.WTINK_DATA_FILE||new URL('./data.json',import.meta.url).pathname;
const CORS_ORIGIN=process.env.CORS_ORIGIN||'*';
const empty=()=>({profiles:{},requests:{}});
let db=empty();
if(existsSync(DATA_FILE)){try{db=JSON.parse(await readFile(DATA_FILE,'utf8'))||empty()}catch{db=empty()}}
if(!db.profiles)db.profiles={};if(!db.requests)db.requests={};
let writeQueue=Promise.resolve();
const persist=()=>{writeQueue=writeQueue.then(()=>writeFile(DATA_FILE,JSON.stringify(db,null,2),'utf8')).catch(()=>{});return writeQueue};
const json=(res,status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':CORS_ORIGIN,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Cache-Control':'no-store'});res.end(JSON.stringify(payload))};
const body=async req=>{const chunks=[];for await(const chunk of req)chunks.push(chunk);if(!chunks.length)return{};return JSON.parse(Buffer.concat(chunks).toString('utf8'))};
const cleanProfile=p=>({profileId:String(p?.profileId||'').trim().toUpperCase(),name:String(p?.name||'').trim().slice(0,80),position:String(p?.position||'').trim().slice(0,120),avatar:typeof p?.avatar==='string'&&p.avatar.startsWith('data:image/')?p.avatar:''});
const authToken=req=>String(req.headers.authorization||'').replace(/^Bearer\s+/i,'').trim();
const tokenEquals=(a,b)=>{const aa=Buffer.from(String(a));const bb=Buffer.from(String(b));return aa.length===bb.length&&timingSafeEqual(aa,bb)};
const findAuthed=(req)=>{const token=authToken(req);if(!token)return null;for(const p of Object.values(db.profiles)){if(tokenEquals(p.token,token))return p}return null};
const publicProfile=p=>p?({profileId:p.profile.profileId,name:p.profile.name,position:p.profile.position,avatar:p.profile.avatar}):null;
const requestView=r=>({id:r.id,from:publicProfile(db.profiles[r.from]),to:publicProfile(db.profiles[r.to]),createdAt:r.createdAt,status:r.status});
const okId=id=>/^WTINKID-\d{6}$/.test(String(id||'').trim().toUpperCase());

const server=http.createServer(async(req,res)=>{
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':CORS_ORIGIN,'Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'});return res.end()}
 try{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);const path=url.pathname;
  if(req.method==='GET'&&path==='/health')return json(res,200,{ok:true,profiles:Object.keys(db.profiles).length});
  if(req.method==='POST'&&path==='/profiles'){
   const p=cleanProfile((await body(req)).profile);if(!okId(p.profileId)||!p.name)return json(res,400,{error:'INVALID_PROFILE'});
   if(db.profiles[p.profileId])return json(res,409,{error:'WTINK_ID_TAKEN'});
   const token=randomBytes(24).toString('base64url');db.profiles[p.profileId]={profile:p,token,updatedAt:Date.now()};await persist();return json(res,201,{profile:p,token});
  }
  if(req.method==='PUT'&&path==='/profiles'){
   const owner=findAuthed(req);if(!owner)return json(res,401,{error:'UNAUTHORIZED'});const p=cleanProfile((await body(req)).profile);if(p.profileId!==owner.profile.profileId||!p.name)return json(res,400,{error:'INVALID_PROFILE'});owner.profile=p;owner.updatedAt=Date.now();await persist();return json(res,200,{profile:p});
  }
  const profileMatch=path.match(/^\/profiles\/([^/]+)$/);if(req.method==='GET'&&profileMatch){const id=decodeURIComponent(profileMatch[1]).toUpperCase();if(!okId(id)||!db.profiles[id])return json(res,404,{error:'USER_NOT_FOUND'});return json(res,200,{profile:publicProfile(db.profiles[id])})}
  if(req.method==='POST'&&path==='/friend-requests'){
   const owner=findAuthed(req);if(!owner)return json(res,401,{error:'UNAUTHORIZED'});const b=await body(req);const target=String(b.to||'').trim().toUpperCase();if(!okId(target)||!db.profiles[target])return json(res,404,{error:'USER_NOT_FOUND'});if(target===owner.profile.profileId)return json(res,400,{error:'SELF_REQUEST'});
   const duplicate=Object.values(db.requests).find(r=>(r.status==='pending')&&((r.from===owner.profile.profileId&&r.to===target)||(r.from===target&&r.to===owner.profile.profileId)));if(duplicate)return json(res,409,{error:'REQUEST_EXISTS',request:requestView(duplicate)});
   const id=randomUUID();const r={id,from:owner.profile.profileId,to:target,createdAt:Date.now(),status:'pending'};db.requests[id]=r;await persist();return json(res,201,{request:requestView(r)});
  }
  const incoming=path==='/friend-requests/incoming';
  const outgoing=path==='/friend-requests/outgoing';
  if(req.method==='GET'&&(incoming||outgoing)){const owner=findAuthed(req);if(!owner)return json(res,401,{error:'UNAUTHORIZED'});const user=String(url.searchParams.get('userId')||'').trim().toUpperCase();if(user!==owner.profile.profileId)return json(res,403,{error:'FORBIDDEN'});const list=Object.values(db.requests).filter(r=>incoming?r.to===user:r.from===user).sort((a,b)=>b.createdAt-a.createdAt).slice(0,100).map(requestView);return json(res,200,{requests:list})}
  const action=path.match(/^\/friend-requests\/([^/]+)\/(accept|decline)$/);if(req.method==='POST'&&action){const owner=findAuthed(req);if(!owner)return json(res,401,{error:'UNAUTHORIZED'});const r=db.requests[action[1]];if(!r)return json(res,404,{error:'REQUEST_NOT_FOUND'});if(r.to!==owner.profile.profileId)return json(res,403,{error:'FORBIDDEN'});if(r.status!=='pending')return json(res,409,{error:'REQUEST_ALREADY_HANDLED'});r.status=action[2]==='accept'?'accepted':'declined';r.updatedAt=Date.now();await persist();return json(res,200,{request:requestView(r)})}
  return json(res,404,{error:'NOT_FOUND'});
 }catch(error){return json(res,500,{error:'SERVER_ERROR',detail:process.env.NODE_ENV==='development'?String(error):undefined})}
});
server.listen(PORT,()=>console.log(`WorkerTink directory listening on :${PORT}`));
