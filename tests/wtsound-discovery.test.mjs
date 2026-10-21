import assert from 'node:assert/strict';
import {parseCatalog,searchCatalog,searchSources,safeUrl,CATALOGS} from '../src/sound/discovery.ts';
import {fetchSoundCatalog} from '../directory-api/src/soundSearch.js';
assert.deepEqual(CATALOGS,['deezer','itunes']);
for(const url of ['http://example.org','https://user:pass@example.org','https://127.0.0.1/a','https://10.1.2.3','https://localhost','https://[::1]','javascript:alert(1)'])assert.equal(safeUrl(url),'');
const deezer={data:[{id:1,title:'Faint',artist:{name:'Linkin Park'},album:{title:'Meteora',cover_big:'https://cdn-images.dzcdn.net/images/cover/demo/500x500.jpg'},link:'https://www.deezer.com/track/1',preview:'https://cdnt-preview.dzcdn.net/api/1/sample.mp3',duration:162,explicit_lyrics:true},{id:2,title:'Missing preview',artist:{name:'Artist'},link:'https://www.deezer.com/track/2',preview:'https://evil.example/a.mp3'},{id:3,title:'Unsafe',artist:{name:'Artist'},link:'https://deezer.com.evil.example/track/3'}],total:41};
const appleTrack=i=>({kind:'song',trackId:100+i,trackName:'Song '+i,artistName:'Artist',collectionName:'Album',trackViewUrl:'https://music.apple.com/us/album/song/100?i='+i,previewUrl:'https://audio-ssl.itunes.apple.com/sample.m4a',artworkUrl100:'https://is1-ssl.mzstatic.com/image/100x100bb.jpg',trackTimeMillis:161000,releaseDate:'2024-01-01',trackExplicitness:'explicit'});
const apple={resultCount:41,results:Array.from({length:41},(_,i)=>appleTrack(i))};
const dz=parseCatalog('deezer',deezer);assert.equal(dz.tracks.length,2);assert.equal(dz.tracks[0].artist,'Linkin Park');assert.equal(dz.tracks[0].duration,162);assert.equal(dz.tracks[0].explicit,true);assert.equal(dz.tracks[1].previewUrl,'');assert.equal(dz.hasMore,true);
const it=parseCatalog('itunes',apple,2);assert.equal(it.tracks.length,20);assert.equal(it.tracks[0].id,'itunes:120');assert.equal(it.tracks[0].year,2024);assert.equal(it.hasMore,true);
assert.equal(parseCatalog('itunes',{results:[{...appleTrack(1),kind:'music-video'}]}).tracks.length,0);
assert.throws(()=>parseCatalog('deezer',{error:{code:4}}));
let calls=0;const load=async(catalog,q,page,signal)=>{calls++;assert.equal(q,'Linkin Park');assert.equal(page,1);return catalog==='deezer'?deezer:apple};
const all=await searchSources('Linkin Park',CATALOGS,{load});assert.equal(all.tracks.length,22);assert.equal(all.tracks[0].catalog,'deezer');assert.equal(all.tracks[1].catalog,'itunes');assert.deepEqual(all.errors,[]);
const before=calls;assert.deepEqual(await searchCatalog('deezer','x',{load}),{tracks:[],hasMore:false});assert.equal(calls,before);
const partial=await searchSources('music',CATALOGS,{load:async c=>{if(c==='deezer')throw new Error('offline');return apple}});assert.equal(partial.tracks.length,20);assert.match(partial.errors[0],/Deezer/);
const abort=new AbortController();abort.abort();await assert.rejects(searchSources('music',CATALOGS,{signal:abort.signal,load:async()=>deezer}),{name:'AbortError'});
// The server constructs provider URLs itself; never follow client or provider next URLs.
for(const source of CATALOGS){
 const data=await fetchSoundCatalog(new URLSearchParams({source,q:'Faint & Linkin Park',page:'2'}),async(url,opts)=>{
  const u=new URL(url);assert.equal(opts.redirect,'error');assert.equal(opts.headers.Authorization,undefined);
  if(source==='deezer'){assert.equal(u.origin,'https://api.deezer.com');assert.equal(u.searchParams.get('index'),'20');assert.equal(u.searchParams.get('q'),'Faint & Linkin Park')}
  else{assert.equal(u.origin,'https://itunes.apple.com');assert.equal(u.searchParams.get('limit'),'41');assert.equal(u.searchParams.get('entity'),'song')}
  return Response.json(source==='deezer'?deezer:apple);
 });assert.ok(data);
}
for(const params of [{source:'https://evil.example',q:'music'},{source:'deezer',q:'x'},{source:'deezer',q:'music',page:'0'},{source:'itunes',q:'music',page:'11'},{source:'itunes',q:'music',country:'INVALID'}])await assert.rejects(fetchSoundCatalog(new URLSearchParams(params),()=>{throw Error('Must not fetch')}),e=>e.status===400);
await assert.rejects(fetchSoundCatalog(new URLSearchParams({source:'deezer',q:'music'}),async()=>Response.json({}, {status:429})),e=>e.status===429);
await assert.rejects(fetchSoundCatalog(new URLSearchParams({source:'deezer',q:'music'}),async()=>new Response('bad json')),/результаты/);
await assert.rejects(fetchSoundCatalog(new URLSearchParams({source:'deezer',q:'music'}),async()=>new Response('x',{headers:{'content-length':String(3*1024*1024)}})),/слишком большой/);
const huge=new ReadableStream({start(c){c.enqueue(new Uint8Array(2*1024*1024+1));c.close()}});
await assert.rejects(fetchSoundCatalog(new URLSearchParams({source:'deezer',q:'music'}),async()=>new Response(huge)),/слишком большой/);
console.log('WTSound Deezer/iTunes catalogs, preview boundaries, pagination, partial failure, cancellation and server URL/size validation: OK');
