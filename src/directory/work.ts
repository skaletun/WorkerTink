import type {WorkTeam,WorkDocument} from './types';
import {request} from './client';

export function getWorkTeams(token:string){return request<{teams:WorkTeam[]}>('/work/teams',{headers:{Authorization:`Bearer ${token}`}})}

export function createWorkTeam(input:{name:string;description?:string},token:string){return request<{team:WorkTeam}>('/work/teams',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}

export function addWorkTeamMember(teamId:string,profileId:string,token:string){return request<{ok:boolean}>(`/work/teams/${encodeURIComponent(teamId)}/members`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}

export function removeWorkTeamMember(teamId:string,profileId:string,token:string){return request<{ok:boolean}>(`/work/teams/${encodeURIComponent(teamId)}/members`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify({profileId})})}

export function getWorkDocuments(teamId:string,token:string){return request<{documents:WorkDocument[]}>(`/work/teams/${encodeURIComponent(teamId)}/documents`,{headers:{Authorization:`Bearer ${token}`}})}

export function createWorkDocument(teamId:string,input:{title:string;description?:string;url:string},token:string){return request<{document:WorkDocument}>(`/work/teams/${encodeURIComponent(teamId)}/documents`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:JSON.stringify(input)})}

export function deleteWorkDocument(id:string,token:string){return request<{ok:boolean}>(`/work/documents/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})}
