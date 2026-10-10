import type {PeerSession} from './types.ts';
import {request} from './client.ts';

export function createPeerSession(target:string,offer:string,token:string){return request<{session:PeerSession}>('/peer-sessions',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({to:target,offer})})}

export function getIncomingPeerSessions(token:string){return request<{sessions:PeerSession[]}>(`/peer-sessions/incoming`,{headers:{Authorization:`Bearer ${token}`}})}

export function getOutgoingPeerSessions(token:string){return request<{sessions:PeerSession[]}>(`/peer-sessions/outgoing`,{headers:{Authorization:`Bearer ${token}`}})}

export function answerPeerSession(id:string,answer:string,token:string){return request<{session:PeerSession}>(`/peer-sessions/${encodeURIComponent(id)}/answer`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({answer})})}

export function declinePeerSession(id:string,token:string){return request<{session:PeerSession}>(`/peer-sessions/${encodeURIComponent(id)}/decline`,{method:'POST',headers:{Authorization:`Bearer ${token}`}})}

export function getIceServers(token:string){return request<{iceServers:RTCIceServer[]}>('/webrtc/ice-servers',{headers:{Authorization:`Bearer ${token}`}})}
