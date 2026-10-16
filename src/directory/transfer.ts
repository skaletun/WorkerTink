import {request} from './client.ts';
export type TransferPublicKey={kty:'EC';crv:'P-256';x:string;y:string};
export type TransferSession={
 id:string;role:'target'|'source';createdAt:number;expiresAt:number;
 status:'waiting'|'paired'|'ready';targetPublicKey:TransferPublicKey;
 sourcePublicKey:TransferPublicKey|null;
 sourceConfirmed:boolean;targetConfirmed:boolean;payloadReady:boolean;
};
const bearer=(token:string)=>({Authorization:`Bearer ${token}`});
const path=(id:string)=>`/chat/e2e-transfer/${encodeURIComponent(id)}`;
export function createTransferSession(publicKey:TransferPublicKey,token:string){return request<{session:TransferSession}>('/chat/e2e-transfer',{method:'POST',headers:bearer(token),body:JSON.stringify({publicKey})})}
export function joinTransferSession(id:string,publicKey:TransferPublicKey,token:string){return request<{session:TransferSession}>(path(id),{method:'POST',headers:bearer(token),body:JSON.stringify({publicKey})})}
export function getTransferSession(id:string,token:string){return request<{session:TransferSession}>(path(id),{headers:bearer(token)})}
export function confirmTransferSession(id:string,token:string){return request<{session:TransferSession}>(path(id)+'/confirm',{method:'POST',headers:bearer(token)})}
export function sendTransferPayload(id:string,ciphertext:string,token:string){return request<{session:TransferSession}>(path(id)+'/payload',{method:'POST',headers:bearer(token),body:JSON.stringify({ciphertext})})}
export function receiveTransferPayload(id:string,token:string){return request<{ciphertext:string}>(path(id)+'/payload',{headers:bearer(token)})}
export function acknowledgeTransferPayload(id:string,token:string){return request<{ok:boolean}>(path(id)+'/ack',{method:'POST',headers:bearer(token)})}
export function revokeTransferSession(id:string,token:string){return request<{ok:boolean}>(path(id),{method:'DELETE',headers:bearer(token)})}
