import {emptyLibrary,mergeImport,trackKey,type Equalizer,type ImportResult,type Library,type Track,type Playlist} from './model.ts';
import {audioIds,ensureSpace,persistStorage,readAudio,readArtwork,readLibrary,removeAudio,removeArtwork,writeArtwork,writeAudio,updateLibrary} from './storage.ts';
import {inspectAudio} from './metadata.ts';
import {SoundEngine} from './engine.ts';
import {cloudTracks,deleteCloud,downloadCloud,soundCapabilities,uploadCloud} from './api.ts';
export type SoundState={library:Library;ready:boolean;playing:boolean;buffering:boolean;time:number;duration:number;offline:Set<string>;error:string;busy:string;cloud:boolean;providers:{vk:boolean;yandex:boolean};online:boolean};
export class SoundController{
 private state:SoundState={library:emptyLibrary(),ready:false,playing:false,buffering:false,time:0,duration:0,offline:new Set(),error:'',busy:'',cloud:false,providers:{vk:false,yandex:false},online:navigator.onLine};
 private listeners=new Set<()=>void>();private engine:SoundEngine|null=null;private writes:Promise<unknown>=Promise.resolve();private mutation=0;private epoch=0;private loadEpoch=0;private lastCheckpoint=0;private prepared:{id:string;blob:Blob;artwork:Blob|null}|null=null;private channel:BroadcastChannel|null=null;
 constructor(readonly owner:string,private token:string){}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}};
 snapshot=()=>this.state;
 private emit(patch:Partial<SoundState>){this.state={...this.state,...patch};this.listeners.forEach(fn=>fn())}
 clearError=()=>this.emit({error:''});
 report=(error:unknown)=>this.emit({error:error instanceof Error?error.message:String(error),buffering:false});
 private mutate(fn:(library:Library)=>Library){
  const revision=++this.mutation;this.emit({library:fn(this.state.library)});
  const write=this.writes.then(()=>updateLibrary(this.owner,fn)).then(library=>{if(revision===this.mutation)this.emit({library});this.channel?.postMessage({type:'library'});return library});
  this.writes=write.catch(async error=>{this.report(error);if(revision===this.mutation){try{const library=await readLibrary(this.owner);if(revision===this.mutation)this.emit({library})}catch{}}});return write;
 }
 async init(){const epoch=++this.epoch;try{
  const [library,offline]=await Promise.all([readLibrary(this.owner),audioIds(this.owner)]);if(epoch!==this.epoch)return;
  let position=library.position;
  try{const saved=JSON.parse(localStorage.getItem('wtsound:resume:'+this.owner)||'null');if(saved&&saved.currentId===library.currentId&&Number.isFinite(saved.position)&&saved.position>=0&&Date.now()-Number(saved.savedAt)<24*60*60*1000)position=saved.position}catch{}
  this.emit({library:{...library,position},offline,ready:true,time:position});
  if(typeof BroadcastChannel!=='undefined'&&!this.channel){this.channel=new BroadcastChannel('wtsound:'+this.owner);this.channel.onmessage=e=>{if(e.data?.type==='play'){this.engine?.pause();return}if(e.data?.type==='library')void this.writes.then(async()=>{const [remote,offline]=await Promise.all([readLibrary(this.owner),audioIds(this.owner)]);if(epoch!==this.epoch)return;this.emit({library:{...this.state.library,tracks:remote.tracks,playlists:remote.playlists},offline})}).catch(this.report)}}
  void soundCapabilities(this.token).then(async caps=>{if(epoch!==this.epoch)return;this.emit({cloud:caps.cloud,providers:{vk:caps.vk,yandex:caps.yandex}});if(caps.cloud){const result=await cloudTracks(this.token);if(epoch!==this.epoch)return;const local=this.state.library;const merged=result.tracks.map(remote=>{const existing=local.tracks.find(t=>t.id===remote.id);return existing?{...existing,cloud:true}:remote});await this.mutate(current=>({...current,tracks:[...current.tracks.filter(t=>!merged.some(r=>r.id===t.id)),...merged]}))}}).catch(()=>{});
 }catch(e){if(epoch===this.epoch)this.emit({error:'Не удалось открыть музыкальную библиотеку: '+String(e),ready:false})}}
 dispose(){this.channel?.close();this.channel=null;++this.epoch;++this.loadEpoch;this.prepared=null;this.engine?.dispose();this.engine=null}
 connectivity=()=>this.emit({online:navigator.onLine});
 checkpoint=()=>{if(this.state.ready){const {time,library}=this.state;try{localStorage.setItem('wtsound:resume:'+this.owner,JSON.stringify({currentId:library.currentId,position:time,savedAt:Date.now()}))}catch{}void this.mutate(l=>({...l,position:time,currentId:library.currentId,queue:library.queue,queueIndex:library.queueIndex,originalQueue:library.originalQueue})).catch(()=>{})}};
 private getEngine(){if(!this.engine){this.engine=new SoundEngine({state:(playing,buffering)=>this.emit({playing,buffering}),time:(time,duration)=>{
  this.emit({time,duration:Number.isFinite(duration)?duration:0});if(this.state.playing&&document.visibilityState==='visible'&&Date.now()-this.lastCheckpoint>60000){this.lastCheckpoint=Date.now();this.checkpoint()}
 },ended:()=>{if(this.state.library.repeat==='one'){this.seek(0);void this.resume()}else void this.next(true)},error:this.report,next:()=>{void this.next()},previous:()=>{void this.previous()}});this.engine.volume(this.state.library.volume);this.engine.equalizer(this.state.library.eq)}return this.engine}
 playable=(t:Track)=>this.state.offline.has(t.id)||(this.state.online&&Boolean(t.cloud));
 async play(id:string,queue?:string[],index?:number,startPosition=0){
  const library=this.state.library,track=library.tracks.find(t=>t.id===id);if(!track||!this.playable(track)){this.report(new Error('Для этого трека нужен аудиофайл. Загрузите его в WTSound'));return}
  const epoch=++this.loadEpoch;this.emit({buffering:true,error:''});
  try{
   const engine=this.getEngine();engine.unlock();this.channel?.postMessage({type:'play'});
   const cached=this.prepared?.id===id?this.prepared:null;this.prepared=null;
   const blob=cached?.blob||await readAudio(this.owner,id)||track.cloud&&await downloadCloud(this.token,id);if(epoch!==this.loadEpoch)return;if(!blob)throw new Error('Аудиофайл не найден на устройстве');
   const artwork=cached?cached.artwork:await readArtwork(this.owner,id);if(epoch!==this.loadEpoch)return;
   let nextQueue=queue||library.queue;if(!nextQueue.includes(id))nextQueue=library.tracks.filter(this.playable).map(t=>t.id);if(!nextQueue.includes(id))nextQueue=[id];let queueIndex=Math.max(0,Math.min(nextQueue.length-1,index??nextQueue.indexOf(id)));
   if(queue&&library.shuffle){const rest=[...queue];rest.splice(queueIndex,1);nextQueue=[id,...this.shuffled(rest)];queueIndex=0}
   await this.mutate(current=>({...current,currentId:id,position:startPosition,queue:nextQueue,queueIndex,originalQueue:queue||current.originalQueue,tracks:current.tracks.map(t=>t.id===id?{...t,plays:t.plays+1,lastPlayed:Date.now()}:t)}));
   if(epoch!==this.loadEpoch)return;this.emit({time:startPosition,duration:track.duration});await engine.load(blob,track,startPosition,true,artwork||undefined);if(epoch===this.loadEpoch)void this.primeNext().catch(()=>{});
  }catch(e){if(epoch===this.loadEpoch)this.report(e)}finally{if(epoch===this.loadEpoch)this.emit({buffering:false})}
 }
 private shuffled(ids:string[]){const result=[...ids];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
 private async primeNext(){const library=this.state.library;const i=library.queueIndex+1;const id=library.queue[i]||(library.repeat==='all'?library.queue[0]:undefined);if(!id||id===library.currentId)return;const track=library.tracks.find(t=>t.id===id);if(!track||!this.state.offline.has(id)||Number(track.size||0)>20*1024*1024)return;const blob=await readAudio(this.owner,id);if(blob&&blob.size<=20*1024*1024&&this.state.library.currentId!==id)this.prepared={id,blob,artwork:(await readArtwork(this.owner,id))||null}}
 async resume(){try{if(!this.engine?.audio.src){const {currentId,queueIndex,position}=this.state.library;if(!currentId)return;await this.play(currentId,undefined,queueIndex,position)}else await this.engine.play()}catch(e){this.report(e)}}
 toggle=()=>{if(this.state.playing){this.engine?.pause();this.checkpoint()}else void this.resume()};
 seek=(value:number)=>{const duration=this.state.duration||this.state.library.tracks.find(t=>t.id===this.state.library.currentId)?.duration||0;const time=Math.max(0,Math.min(Number.isFinite(value)?value:0,duration||value));this.engine?.seek(time);this.emit({time});this.checkpoint()};
 private adjacent(direction:number,manual=false){const {library}=this.state;for(let step=1;step<=library.queue.length;step++){let index=library.queueIndex+step*direction;if(index<0||index>=library.queue.length){if(library.repeat==='off'&&!manual)return null;index=(index%library.queue.length+library.queue.length)%library.queue.length}const id=library.queue[index],track=library.tracks.find(t=>t.id===id);if(track&&this.playable(track))return {id,index}}return null}
 async next(ended=false){const next=this.adjacent(1,!ended);if(next)await this.play(next.id,undefined,next.index);else if(ended){this.engine?.pause();this.emit({playing:false,time:0});await this.mutate(l=>({...l,position:0}));this.checkpoint()}}
 async previous(){if(this.state.time>3){this.seek(0);return}const next=this.adjacent(-1,true);if(next)await this.play(next.id,undefined,next.index)}
 async settings(patch:Partial<Pick<Library,'volume'|'repeat'|'shuffle'>>){if(patch.volume!==undefined)this.engine?.volume(patch.volume);await this.mutate(l=>{let queue=l.queue,queueIndex=l.queueIndex,originalQueue=l.originalQueue;if(patch.shuffle===true&&!l.shuffle){originalQueue=[...queue];const rest=[...queue];rest.splice(queueIndex,1);queue=l.currentId?[l.currentId,...this.shuffled(rest)]:this.shuffled(rest);queueIndex=0}else if(patch.shuffle===false&&l.shuffle&&originalQueue.length){queue=[...originalQueue];queueIndex=Math.max(0,queue.indexOf(l.currentId))}return {...l,...patch,queue,queueIndex,originalQueue}})}
 async equalizer(eq:Equalizer){this.getEngine().equalizer(eq);await this.mutate(l=>({...l,eq}))}
 async like(id:string){await this.mutate(l=>({...l,tracks:l.tracks.map(t=>t.id===id?{...t,liked:!t.liked}:t)}))}
 async createPlaylist(title:string,firstTrackId?:string){if(!title.trim())throw new Error('Введите название плейлиста');const now=Date.now(),p:Playlist={id:crypto.randomUUID(),title:title.trim().slice(0,200),description:'',trackIds:firstTrackId&&this.state.library.tracks.some(t=>t.id===firstTrackId)?[firstTrackId]:[],createdAt:now,updatedAt:now};await this.mutate(l=>({...l,playlists:[p,...l.playlists]}));return p.id}
 async editPlaylist(id:string,patch:Partial<Pick<Playlist,'title'|'description'|'trackIds'>>){await this.mutate(l=>({...l,playlists:l.playlists.map(p=>p.id===id?{...p,...patch,updatedAt:Date.now()}:p)}))}
 async deletePlaylist(id:string){await this.mutate(l=>({...l,playlists:l.playlists.filter(p=>p.id!==id)}))}
 async addToPlaylist(playlistId:string,trackId:string){if(!this.state.library.tracks.some(t=>t.id===trackId))throw new Error('Трек отсутствует в коллекции');if(!this.state.library.playlists.some(p=>p.id===playlistId))throw new Error('Плейлист не найден');await this.mutate(l=>({...l,playlists:l.playlists.map(p=>p.id===playlistId&&!p.trackIds.includes(trackId)?{...p,trackIds:[...p.trackIds,trackId],updatedAt:Date.now()}:p)}))}
 async import(input:ImportResult){let result=mergeImport(this.state.library,input);await this.mutate(l=>{result=mergeImport(l,input);return result.library});return result}
 async upload(files:File[],targetId?:string,origin?:Partial<Pick<Track,'title'|'artist'|'album'|'source'|'license'|'licenseUrl'|'attribution'>>):Promise<{added:number;skipped:number;failed:string[]}>{
  if(this.state.busy)throw new Error('Дождитесь завершения текущей загрузки');
  const failed:string[]=[];let added=0,skipped=0;this.emit({error:'',busy:'Подготавливаем загрузку'});
  try{
   await persistStorage();for(let i=0;i<files.length;i++){
    this.emit({busy:`Загружаем ${i+1} из ${files.length}: ${files[i].name}`});
    try{
     await ensureSpace(files[i].size);const {track:inspected,cover}=await inspectAudio(files[i]);
     const track:Track=origin?{...inspected,title:origin.title?.trim().slice(0,300)||inspected.title,artist:origin.artist?.trim().slice(0,300)||inspected.artist,album:origin.album?.trim().slice(0,300)||inspected.album,source:origin.source,license:origin.license,licenseUrl:origin.licenseUrl,attribution:origin.attribution}:inspected;
     const duplicate=this.state.library.tracks.find(t=>t.fileHash===track.fileHash);
     if(duplicate&&this.state.offline.has(duplicate.id)&&!targetId){skipped++;continue}
     const target=targetId?this.state.library.tracks.find(t=>t.id===targetId):undefined;
     const match=target||duplicate||this.state.library.tracks.find(t=>!t.fileHash&&trackKey(t)===trackKey(track)&&(!t.duration||!track.duration||Math.abs(t.duration-track.duration)<3));
     const saved:Track=match?{...track,...(target?{title:target.title,artist:target.artist,album:target.album||track.album}:{}),id:match.id,liked:match.liked,source:match.source||track.source,license:match.license||track.license,licenseUrl:match.licenseUrl||track.licenseUrl,attribution:match.attribution||track.attribution,plays:match.plays,lastPlayed:match.lastPlayed,cloud:match.cloud}:track;
     await writeAudio(this.owner,saved.id,files[i]);if(cover)await writeArtwork(this.owner,saved.id,cover);
     await this.mutate(l=>({...l,tracks:[saved,...l.tracks.filter(t=>t.id!==saved.id)]}));this.emit({offline:new Set([...this.state.offline,saved.id])});added++;
    }catch(e){failed.push(e instanceof Error?e.message:String(e))}
   }
  }finally{this.emit({busy:'',error:failed.join('\n')})}
  return {added,skipped,failed};
 }
 async download(id:string){const track=this.state.library.tracks.find(t=>t.id===id);if(!track?.cloud||this.state.offline.has(id))return;this.emit({busy:'Сохраняем трек для офлайн-прослушивания'});try{await ensureSpace(track.size||0);const blob=await downloadCloud(this.token,id);await writeAudio(this.owner,id,blob);this.emit({offline:new Set([...this.state.offline,id])});this.channel?.postMessage({type:'library'});await persistStorage()}catch(e){this.report(e)}finally{this.emit({busy:''})}}
 async syncCloud(id:string){const track=this.state.library.tracks.find(t=>t.id===id);if(!track||!this.state.cloud)return;this.emit({busy:'Загружаем трек в облако'});try{const blob=await readAudio(this.owner,id);if(!blob)throw new Error('Сначала загрузите аудиофайл');await uploadCloud(this.token,track,blob);await this.mutate(l=>({...l,tracks:l.tracks.map(t=>t.id===id?{...t,cloud:true}:t)}))}catch(e){this.report(e)}finally{this.emit({busy:''})}}
 async removeOffline(id:string){const track=this.state.library.tracks.find(t=>t.id===id);if(!track?.cloud)throw new Error('Это единственная копия трека. Используйте «Удалить трек»');if(this.state.library.currentId===id){++this.loadEpoch;this.engine?.dispose();this.engine=null;this.emit({playing:false})}await removeAudio(this.owner,id);const offline=new Set(this.state.offline);offline.delete(id);this.emit({offline});this.channel?.postMessage({type:'library'})}
 async removeTrack(id:string){const track=this.state.library.tracks.find(t=>t.id===id);if(track?.cloud)await deleteCloud(this.token,id);if(this.state.library.currentId===id){++this.loadEpoch;this.engine?.dispose();this.engine=null;this.emit({playing:false})}await this.mutate(l=>({...l,currentId:l.currentId===id?'':l.currentId,tracks:l.tracks.filter(t=>t.id!==id),queue:l.queue.filter(x=>x!==id),queueIndex:Math.max(0,l.queue.slice(0,l.queueIndex).filter(x=>x!==id).length),originalQueue:l.originalQueue.filter(x=>x!==id),playlists:l.playlists.map(p=>({...p,trackIds:p.trackIds.filter(x=>x!==id)}))}));await Promise.all([removeAudio(this.owner,id),removeArtwork(this.owner,id)]);const offline=new Set(this.state.offline);offline.delete(id);this.emit({offline});this.channel?.postMessage({type:'library'})}
 async enqueue(id:string){await this.mutate(l=>({...l,queue:[...l.queue,id],originalQueue:[...l.originalQueue,id]}))}
 async removeQueue(index:number){await this.mutate(l=>({...l,queue:l.queue.filter((_,i)=>i!==index),queueIndex:index<=l.queueIndex?l.queueIndex-1:l.queueIndex,originalQueue:l.originalQueue.filter((_,i)=>i!==index)}))}
}
