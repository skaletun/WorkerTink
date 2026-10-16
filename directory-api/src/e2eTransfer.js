const ttl=5*60*1000;
const validKey=value=>{
 if(!value||value.kty!=='EC'||value.crv!=='P-256'||typeof value.x!=='string'||typeof value.y!=='string'||value.x.length<40||value.x.length>50||value.y.length<40||value.y.length>50||!/^[A-Za-z0-9_-]+$/.test(value.x)||!/^[A-Za-z0-9_-]+$/.test(value.y))return null;
 return {kty:'EC',crv:'P-256',x:value.x,y:value.y};
};
const view=(row,hash)=>({id:row.id,role:hash===row.target_session_hash?'target':'source',createdAt:Number(row.created_at),expiresAt:Number(row.expires_at),status:row.encrypted_payload?'ready':row.source_public_key?'paired':'waiting',targetPublicKey:JSON.parse(row.target_public_key),sourcePublicKey:row.source_public_key?JSON.parse(row.source_public_key):null,targetConfirmed:Boolean(row.target_confirmed_at),sourceConfirmed:Boolean(row.source_confirmed_at),payloadReady:Boolean(row.encrypted_payload)});
export async function handleE2ETransfer(request,env,origin,helpers){
 const {json,authProfile,sha256,bearer,body}=helpers;
 const path=new URL(request.url).pathname;
 const root=path==='/chat/e2e-transfer',match=path.match(/^\/chat\/e2e-transfer\/([a-f0-9-]{36})(?:\/(confirm|payload))?$/i);
 if(!root&&!match)return null;
 if(!['GET','POST','DELETE'].includes(request.method))return json({error:'NOT_FOUND'},404,origin);
 const owner=await authProfile(request,env);
 if(!owner)return json({error:'UNAUTHORIZED'},401,origin);
 const hash=await sha256(bearer(request)),now=Date.now();
 const record=async(id,event)=>env.DB.prepare('INSERT INTO e2e_transfer_audit(id,transfer_id,profile_id,event,created_at) VALUES(?1,?2,?3,?4,?5)').bind(crypto.randomUUID(),id,owner.wtink_id,event,Date.now()).run();
 if(root){
  if(request.method!=='POST')return json({error:'NOT_FOUND'},404,origin);
  const key=validKey((await body(request))?.publicKey);
  if(!key)return json({error:'INVALID_TRANSFER_PUBLIC_KEY'},400,origin);
  const count=await env.DB.prepare('SELECT COUNT(*) AS total FROM e2e_transfer_sessions WHERE profile_id=?1 AND expires_at>?2 AND cancelled_at IS NULL AND consumed_at IS NULL').bind(owner.wtink_id,now).first();
  if(Number(count?.total||0)>=3)return json({error:'TRANSFER_RATE_LIMIT'},429,origin);
  const id=crypto.randomUUID();
  await env.DB.prepare('INSERT INTO e2e_transfer_sessions(id,profile_id,target_session_hash,target_public_key,created_at,expires_at) VALUES(?1,?2,?3,?4,?5,?6)').bind(id,owner.wtink_id,hash,JSON.stringify(key),now,now+ttl).run();
  await record(id,'created');
  return json({session:{id,role:'target',createdAt:now,expiresAt:now+ttl,status:'waiting',targetPublicKey:key,sourcePublicKey:null,sourceConfirmed:false,targetConfirmed:false,payloadReady:false}},201,origin);
 }
 const id=match[1],action=match[2]||'';
 const session=await env.DB.prepare('SELECT * FROM e2e_transfer_sessions WHERE id=?1 AND profile_id=?2').bind(id,owner.wtink_id).first();
 if(!session)return json({error:'TRANSFER_NOT_FOUND'},404,origin);
 const target=session.target_session_hash===hash,source=session.source_session_hash===hash;
 if(!target&&!source&&!(request.method==='POST'&&!action))return json({error:'TRANSFER_FORBIDDEN'},403,origin);
 if(Number(session.expires_at)<=now)return json({error:'TRANSFER_EXPIRED'},410,origin);
 if(session.cancelled_at)return json({error:'TRANSFER_CANCELLED'},410,origin);
 if(session.consumed_at)return json({error:'TRANSFER_CONSUMED'},410,origin);
 if(request.method==='POST'&&!action){
  if(target)return json({error:'TRANSFER_REQUIRES_SECOND_DEVICE'},403,origin);
  if(session.source_session_hash)return json({error:'TRANSFER_ALREADY_PAIRED'},409,origin);
  const key=validKey((await body(request))?.publicKey);
  if(!key)return json({error:'INVALID_TRANSFER_PUBLIC_KEY'},400,origin);
  const updated=await env.DB.prepare('UPDATE e2e_transfer_sessions SET source_session_hash=?1,source_public_key=?2 WHERE id=?3 AND source_session_hash IS NULL AND cancelled_at IS NULL AND expires_at>?4').bind(hash,JSON.stringify(key),id,now).run();
  if(!updated.meta?.changes)return json({error:'TRANSFER_ALREADY_PAIRED'},409,origin);
  await record(id,'joined');
 }else if(request.method==='POST'&&action==='confirm'){
  if(!session.source_session_hash||!session.source_public_key)return json({error:'TRANSFER_NOT_PAIRED'},409,origin);
  const column=target?'target_confirmed_at':'source_confirmed_at';
  const updated=await env.DB.prepare(`UPDATE e2e_transfer_sessions SET ${column}=?1 WHERE id=?2 AND ${column} IS NULL AND cancelled_at IS NULL AND consumed_at IS NULL AND expires_at>?3`).bind(now,id,now).run();
  if(updated.meta?.changes)await record(id,target?'target_confirmed':'source_confirmed');
 }else if(request.method==='POST'&&action==='payload'){
  if(!source)return json({error:'TRANSFER_SOURCE_ONLY'},403,origin);
  if(!session.source_confirmed_at||!session.target_confirmed_at)return json({error:'TRANSFER_CONFIRMATION_REQUIRED'},409,origin);
  const payload=(await body(request))?.ciphertext;
  if(typeof payload!=='string'||payload.length<24||payload.length>170000||!/^[A-Za-z0-9+/]+={0,2}$/.test(payload))return json({error:'TRANSFER_INVALID_CIPHERTEXT'},400,origin);
  const updated=await env.DB.prepare('UPDATE e2e_transfer_sessions SET encrypted_payload=?1,payload_created_at=?2 WHERE id=?3 AND encrypted_payload IS NULL AND cancelled_at IS NULL AND consumed_at IS NULL AND expires_at>?2 AND source_confirmed_at IS NOT NULL AND target_confirmed_at IS NOT NULL').bind(payload,now,id).run();
  if(!updated.meta?.changes)return json({error:'TRANSFER_PAYLOAD_ALREADY_SUBMITTED'},409,origin);
  await record(id,'encrypted_payload_ready');
 }else if(request.method==='GET'&&action==='payload'){
  if(!target)return json({error:'TRANSFER_TARGET_ONLY'},403,origin);
  if(!session.source_confirmed_at||!session.target_confirmed_at||!session.encrypted_payload)return json({error:'TRANSFER_PAYLOAD_NOT_READY'},409,origin);
  const updated=await env.DB.prepare('UPDATE e2e_transfer_sessions SET consumed_at=?1 WHERE id=?2 AND consumed_at IS NULL AND cancelled_at IS NULL AND expires_at>?1 AND encrypted_payload IS NOT NULL').bind(now,id).run();
  if(!updated.meta?.changes)return json({error:'TRANSFER_CONSUMED'},410,origin);
  await record(id,'consumed');
  return json({ciphertext:session.encrypted_payload},200,origin);
 }else if(request.method==='DELETE'&&!action){
  if(!source&&!target)return json({error:'TRANSFER_FORBIDDEN'},403,origin);
  const updated=await env.DB.prepare('UPDATE e2e_transfer_sessions SET cancelled_at=?1 WHERE id=?2 AND cancelled_at IS NULL AND consumed_at IS NULL').bind(now,id).run();
  if(updated.meta?.changes)await record(id,'cancelled');
  return json({ok:true},200,origin);
 }else if(!(request.method==='GET'&&!action)){
  return json({error:'NOT_FOUND'},404,origin);
 }
 const updated=await env.DB.prepare('SELECT * FROM e2e_transfer_sessions WHERE id=?1').bind(id).first();
 return json({session:view(updated,hash)},200,origin);
}
