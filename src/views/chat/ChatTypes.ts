import type {ChatServerMessage} from '../../directory.ts';

export type Plain={kind:'text'|'voice'|'image'|'video'|'file'|'note';text?:string;url?:string;name?:string;mime?:string;noteDate?:string;noteShift?:string;note?:string;mediaId?:string;iv?:string;caption?:string};
export type LocalMessage=ChatServerMessage&{plain?:Plain;error?:boolean;reactions?:{emoji:string;profileId:string}[];pinned?:boolean};
