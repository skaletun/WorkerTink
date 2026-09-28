import type {UserProfile} from './core.ts';

export type SignalPacket={kind:'offer'|'answer';sdp:string};
export type PeerPayload=
 | {type:'hello';profileId:string;profile:UserProfile}
 | {type:'chat';message:{id:string;from:string;at:number;text:string}}
 | {type:'profile';message:{id:string;from:string;at:number;profileId:string;profile:UserProfile}}
 | {type:'note';message:{id:string;from:string;at:number;date:string;note:string;shift?:string}};

export type ChatPayload=Extract<PeerPayload,{type:'chat'}>;
export type ProfilePayload=Extract<PeerPayload,{type:'profile'}>;
export type NotePayload=Extract<PeerPayload,{type:'note'}>;
export const DEFAULT_ICE_SERVERS:RTCIceServer[]=[
 {urls:'stun:stun.l.google.com:19302'},
 {urls:'stun:stun.cloudflare.com:3478'},
 {urls:'stun:stun1.l.google.com:19302'}
];
const rtcConfig=(iceServers?:RTCIceServer[]):RTCConfiguration=>({iceServers:iceServers?.length?iceServers:DEFAULT_ICE_SERVERS});
const uid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const waitIce=(pc:RTCPeerConnection)=>new Promise<void>(resolve=>{
 if(pc.iceGatheringState==='complete'){resolve();return}
 const timer=window.setTimeout(()=>{cleanup();resolve()},8000);
 const check=()=>{if(pc.iceGatheringState==='complete'){cleanup();resolve()}};
 const cleanup=()=>{window.clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check)};
 pc.addEventListener('icegatheringstatechange',check);
});
export const createPeerId=uid;
export function encodeSignal(packet:SignalPacket){return btoa(unescape(encodeURIComponent(JSON.stringify(packet))))}
export function decodeSignal(value:string):SignalPacket{const raw=decodeURIComponent(escape(atob(value.trim())));const packet=JSON.parse(raw);if(!packet||!['offer','answer'].includes(packet.kind)||typeof packet.sdp!=='string')throw new Error('Некорректный код подключения');return packet}

function wireChannel(channel:RTCDataChannel,onPayload:(payload:PeerPayload)=>void){
 channel.onmessage=e=>{try{onPayload(JSON.parse(String(e.data)) as PeerPayload)}catch{}};
}

export async function createOffer(onPayload:(payload:PeerPayload)=>void){
 const result=await createOfferDescription(onPayload);
 return {...result,code:encodeSignal({kind:'offer',sdp:result.sdp})};
}

export async function createOfferDescription(onPayload:(payload:PeerPayload)=>void,iceServers?:RTCIceServer[]){
 const pc=new RTCPeerConnection(rtcConfig(iceServers));
 const channel=pc.createDataChannel('workertink',{ordered:true});
 wireChannel(channel,onPayload);
 const offer=await pc.createOffer();
 await pc.setLocalDescription(offer);
 await waitIce(pc);
 if(!pc.localDescription?.sdp)throw new Error('Не удалось создать приглашение');
 return {pc,channel,sdp:pc.localDescription.sdp};
}

export async function acceptOffer(code:string,onPayload:(payload:PeerPayload)=>void){
 const offer=decodeSignal(code);
 if(offer.kind!=='offer')throw new Error('Нужен код-приглашение');
 const result=await acceptOfferDescription(offer.sdp,onPayload);
 return {...result,code:encodeSignal({kind:'answer',sdp:result.sdp}),getChannel:()=>result.channel};
}

export async function acceptOfferDescription(sdp:string,onPayload:(payload:PeerPayload)=>void,iceServers?:RTCIceServer[]){
 const pc=new RTCPeerConnection(rtcConfig(iceServers));
 let channel:RTCDataChannel|null=null;
 pc.ondatachannel=e=>{channel=e.channel;wireChannel(channel,onPayload)};
 await pc.setRemoteDescription({type:'offer',sdp});
 const answer=await pc.createAnswer();
 await pc.setLocalDescription(answer);
 await waitIce(pc);
 if(!pc.localDescription?.sdp)throw new Error('Не удалось создать ответ');
 return {pc,sdp:pc.localDescription.sdp,channel,getChannel:()=>channel};
}

export async function applyAnswer(pc:RTCPeerConnection,code:string){const answer=decodeSignal(code);if(answer.kind!=='answer')throw new Error('Нужен код-ответ');await applyAnswerSdp(pc,answer.sdp)}
export async function applyAnswerSdp(pc:RTCPeerConnection,sdp:string){await pc.setRemoteDescription({type:'answer',sdp})}
export function sendPayload(channel:RTCDataChannel|null,payload:PeerPayload){if(!channel||channel.readyState!=='open')return false;channel.send(JSON.stringify(payload));return true}
export function makeChat(from:string,text:string):ChatPayload{return {type:'chat',message:{id:uid(),from,at:Date.now(),text}}}
export function makeProfile(from:string,profileId:string,profile:UserProfile):ProfilePayload{return {type:'profile',message:{id:uid(),from,at:Date.now(),profileId,profile}}}
export function makeNote(from:string,date:string,note:string,shift?:string):NotePayload{return {type:'note',message:{id:uid(),from,at:Date.now(),date,note,shift}}}
