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
const RTC_CONFIG:RTCConfiguration={iceServers:[{urls:'stun:stun.l.google.com:19302'}]};
const uid=()=>typeof crypto!=='undefined'&&'randomUUID' in crypto?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const waitIce=(pc:RTCPeerConnection)=>new Promise<void>(resolve=>{
 if(pc.iceGatheringState==='complete'){resolve();return}
 const timer=window.setTimeout(()=>{cleanup();resolve()},7000);
 const check=()=>{if(pc.iceGatheringState==='complete'){cleanup();resolve()}};
 const cleanup=()=>{window.clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check)};
 pc.addEventListener('icegatheringstatechange',check);
});
export const createPeerId=uid;
export function encodeSignal(packet:SignalPacket){return btoa(unescape(encodeURIComponent(JSON.stringify(packet))))}
export function decodeSignal(value:string):SignalPacket{const raw=decodeURIComponent(escape(atob(value.trim())));const packet=JSON.parse(raw);if(!packet||!['offer','answer'].includes(packet.kind)||typeof packet.sdp!=='string')throw new Error('Некорректный код подключения');return packet}
export async function createOffer(onPayload:(payload:PeerPayload)=>void){
 const pc=new RTCPeerConnection(RTC_CONFIG);const channel=pc.createDataChannel('workertink');channel.onmessage=e=>{try{onPayload(JSON.parse(e.data) as PeerPayload)}catch{}};
 const offer=await pc.createOffer();await pc.setLocalDescription(offer);await waitIce(pc);if(!pc.localDescription?.sdp)throw new Error('Не удалось создать приглашение');return {pc,code:encodeSignal({kind:'offer',sdp:pc.localDescription.sdp}),channel};
}
export async function acceptOffer(code:string,onPayload:(payload:PeerPayload)=>void){
 const offer=decodeSignal(code);if(offer.kind!=='offer')throw new Error('Нужен код-приглашение');const pc=new RTCPeerConnection(RTC_CONFIG);let channel:RTCDataChannel|null=null;pc.ondatachannel=e=>{channel=e.channel;channel.onmessage=event=>{try{onPayload(JSON.parse(event.data) as PeerPayload)}catch{}}};
 await pc.setRemoteDescription({type:'offer',sdp:offer.sdp});const answer=await pc.createAnswer();await pc.setLocalDescription(answer);await waitIce(pc);if(!pc.localDescription?.sdp)throw new Error('Не удалось создать ответ');return {pc,code:encodeSignal({kind:'answer',sdp:pc.localDescription.sdp}),getChannel:()=>channel};
}
export async function applyAnswer(pc:RTCPeerConnection,code:string){const answer=decodeSignal(code);if(answer.kind!=='answer')throw new Error('Нужен код-ответ');await pc.setRemoteDescription({type:'answer',sdp:answer.sdp})}
export function sendPayload(channel:RTCDataChannel|null,payload:PeerPayload){if(!channel||channel.readyState!=='open')return false;channel.send(JSON.stringify(payload));return true}
export function makeChat(from:string,text:string):ChatPayload{return {type:'chat',message:{id:uid(),from,at:Date.now(),text}}}
export function makeProfile(from:string,profileId:string,profile:UserProfile):ProfilePayload{return {type:'profile',message:{id:uid(),from,at:Date.now(),profileId,profile}}}
export function makeNote(from:string,date:string,note:string,shift?:string):NotePayload{return {type:'note',message:{id:uid(),from,at:Date.now(),date,note,shift}}}
