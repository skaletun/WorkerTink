import {inlineBlob,needsInlineMedia} from './binary.ts';
import {BANDS,type Equalizer,type Track} from './model.ts';
type Events={state:(playing:boolean,buffering:boolean)=>void;time:(position:number,duration:number)=>void;ended:()=>void;error:(message:string)=>void;next:()=>void;previous:()=>void};
export class SoundEngine{
 readonly audio:HTMLAudioElement;
 private context:AudioContext|null=null;private source:MediaElementAudioSourceNode|null=null;private filters:BiquadFilterNode[]=[];private gain:GainNode|null=null;private limiter:DynamicsCompressorNode|null=null;
 private url='';private priming=false;private epoch=0;private objectURLs:string[]=[];private pendingSeek=0;private cleanups:(()=>void)[]=[];private disposed=false;
 constructor(private events:Events){
  this.audio=document.createElement('audio');this.audio.preload='auto';this.audio.setAttribute('playsinline','');this.audio.setAttribute('data-wtsound-audio','');document.body.append(this.audio);
  const on=(name:string,fn:EventListener)=>{this.audio.addEventListener(name,fn);this.cleanups.push(()=>this.audio.removeEventListener(name,fn))};
  on('playing',()=>this.state(false));on('pause',()=>this.state(false));on('waiting',()=>this.state(true));on('stalled',()=>this.state(true));
  on('timeupdate',()=>{if(this.priming)return;this.events.time(this.audio.currentTime,this.audio.duration);this.position()});
  on('loadedmetadata',()=>{if(this.priming)return;if(this.pendingSeek){this.audio.currentTime=Math.min(this.pendingSeek,Math.max(0,this.audio.duration-0.01));this.pendingSeek=0}this.events.time(this.audio.currentTime,this.audio.duration);this.position()});
  on('durationchange',()=>{if(this.priming)return;this.events.time(this.audio.currentTime,this.audio.duration);this.position()});
  on('ended',()=>{if(!this.priming)this.events.ended()});on('error',()=>{if(this.audio.error){this.state(false);this.events.error(this.audio.error.code===4?'Формат аудио не поддерживается этим браузером':'Не удалось воспроизвести трек. Проверьте файл или загрузите его заново')}});
  const media=navigator.mediaSession;
  if(media){
   const actions:Partial<Record<MediaSessionAction,(details:MediaSessionActionDetails)=>void>>={play:()=>{void this.play().catch(e=>this.events.error(String(e.message||e)))},pause:()=>this.pause(),nexttrack:events.next,previoustrack:events.previous,seekto:d=>this.seek(d.seekTime||0),seekbackward:d=>this.seek(this.audio.currentTime-(d.seekOffset||10)),seekforward:d=>this.seek(this.audio.currentTime+(d.seekOffset||10)),stop:()=>{this.pause();this.seek(0)}};
   for(const [action,handler] of Object.entries(actions)){try{media.setActionHandler(action as MediaSessionAction,handler);this.cleanups.push(()=>{try{media.setActionHandler(action as MediaSessionAction,null)}catch{}})}catch{}}
  }
  const visible=()=>{if(document.visibilityState==='visible'&&!this.audio.paused&&this.context&&this.context.state!=='running')void this.context.resume().catch(()=>{})};
  document.addEventListener('visibilitychange',visible);this.cleanups.push(()=>document.removeEventListener('visibilitychange',visible));
 }
 unlock(){
  const nav=navigator as Navigator&{audioSession?:{type:string}};if(nav.audioSession){try{nav.audioSession.type='playback'}catch{}}
  if(this.context&&this.context.state!=='running')void this.context.resume().catch(()=>{});
  if(this.audio.src)return;
  // Bless this persistent media element synchronously in the initiating gesture.
  // The real file can then arrive from IndexedDB without losing iOS activation.
  this.priming=true;this.audio.src='data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==';
  void this.audio.play().catch(()=>{});
 }
 private state(buffering:boolean){this.events.state(!this.audio.paused,buffering);if(navigator.mediaSession)navigator.mediaSession.playbackState=this.audio.paused?'paused':'playing'}
 private position(){const a=this.audio;if(navigator.mediaSession?.setPositionState&&Number.isFinite(a.duration)&&a.duration>0){try{navigator.mediaSession.setPositionState({duration:a.duration,position:Math.min(a.currentTime,a.duration),playbackRate:a.playbackRate})}catch{}}}
 async load(blob:Blob,track:Track,position=0,autoplay=true,artwork?:Blob){
  const epoch=++this.epoch;
  // Do not drop the active media element while reading the next file from IndexedDB.
  // Abruptly clearing src releases iOS lock-screen playback ownership.
  const previousURLs=this.objectURLs;this.objectURLs=[];
  // WebKit's network-offline mode can refuse a newly opened blob: media URL.
  // Inline bytes bypass that network path while keeping the original codec/data.
  const source=needsInlineMedia()?await inlineBlob(blob):URL.createObjectURL(blob);
  if(epoch!==this.epoch||this.disposed){if(source.startsWith('blob:'))URL.revokeObjectURL(source);return}
  this.audio.pause();this.url=source;if(source.startsWith('blob:'))this.objectURLs.push(source);this.pendingSeek=position;this.audio.src=source;this.priming=false;for(const old of previousURLs)URL.revokeObjectURL(old);
  if(navigator.mediaSession&&typeof MediaMetadata!=='undefined'){let cover='';if(artwork){cover=needsInlineMedia()?await inlineBlob(artwork):URL.createObjectURL(artwork);if(cover.startsWith('blob:'))this.objectURLs.push(cover)}if(epoch!==this.epoch||this.disposed)return;navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:track.artist,album:track.album,artwork:cover?[{src:cover,type:artwork!.type}]:[]})}
  if(autoplay){try{await this.play()}catch(error){if(epoch===this.epoch&&!this.disposed)throw error}}
 }
 async play(){
  const nav=navigator as Navigator&{audioSession?:{type:string}};if(nav.audioSession){try{nav.audioSession.type='playback'}catch{}}
  if(this.context&&this.context.state!=='running')await this.context.resume();
  await this.audio.play();
 }
 pause(){this.audio.pause()}
 seek(position:number){if(!Number.isFinite(position)||position<0)return;const duration=this.audio.duration;if(Number.isFinite(duration)&&duration>0&&this.audio.readyState>=1){this.audio.currentTime=Math.max(0,Math.min(position,duration));this.pendingSeek=0}else this.pendingSeek=position;this.position()}
 volume(value:number){this.audio.volume=value}
 equalizer(eq:Equalizer){
  if(!eq.enabled&&!this.context)return;
  if(!this.context){
   this.context=new AudioContext();this.source=this.context.createMediaElementSource(this.audio);this.gain=this.context.createGain();this.limiter=this.context.createDynamicsCompressor();
   this.limiter.threshold.value=-1;this.limiter.knee.value=0;this.limiter.ratio.value=20;this.limiter.attack.value=0.003;this.limiter.release.value=0.15;
   this.filters=BANDS.map((frequency,i)=>{const filter=this.context!.createBiquadFilter();filter.type=i===0?'lowshelf':i===BANDS.length-1?'highshelf':'peaking';filter.frequency.value=frequency;filter.Q.value=1;return filter});
   this.source.connect(this.gain);let previous:AudioNode=this.gain;for(const filter of this.filters){previous.connect(filter);previous=filter}previous.connect(this.limiter);this.limiter.connect(this.context.destination);
  }
  const now=this.context.currentTime;const headroom=eq.enabled?Math.max(0,...eq.gains)+3:0;
  this.gain!.gain.setTargetAtTime(10**(((eq.enabled?eq.preamp:0)-headroom)/20),now,0.025);
  this.filters.forEach((filter,i)=>filter.gain.setTargetAtTime(eq.enabled?eq.gains[i]:0,now,0.025));
  // Resume synchronously from the toggle gesture, including before the first track.
  if(this.context.state!=='running')void this.context.resume().catch(error=>this.events.error('Не удалось включить обработку звука: '+String(error.message||error)));
 }
 dispose(){this.disposed=true;++this.epoch;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();this.audio.remove();this.cleanups.forEach(fn=>fn());for(const url of this.objectURLs)URL.revokeObjectURL(url);if(this.context)void this.context.close().catch(()=>{});if(navigator.mediaSession){navigator.mediaSession.metadata=null;navigator.mediaSession.playbackState='none'}}
}
