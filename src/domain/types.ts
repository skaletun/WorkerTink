export type ScheduleType='5/2'|'4/1'|'3/2'|'3/1'|'6/1'|'2/2'|'7/0';
export type ShiftType='day'|'night'|'full';
export type ShiftValue=ShiftType|'off';
export type PairType='day-day'|'day-night'|'night-night';
export interface Period {start:string; end:string}
export interface PaymentDates {advanceDate:string; remainderDate:string}
export interface IncomeHistory {[key:string]:number}
export interface UserProfile {profileId:string;name:string;position:string;avatar:string;banner?:string;username?:string|null;isDev?:boolean;isAdmin?:boolean;isOfficial?:boolean;isVerified?:boolean}
export interface Friend {profile:UserProfile;addedAt:number;lastSeen:number;connected?:boolean;online?:boolean}
export interface FriendRequest {id:string;from:UserProfile;to:UserProfile;createdAt:number;status:'pending'|'accepted'|'declined'}
export interface ChatMessage {id:string;from:string;at:number;type:'text'|'profile'|'note';text?:string;profile?:UserProfile;note?:{date:string;note:string;shift?:string}}
export interface NotificationSettings {enabled:boolean;friendRequests:boolean;friendAccepted:boolean;messages:boolean;groupMessages:boolean;channelInvites:boolean;social:boolean;events:boolean;shifts:boolean;absences:boolean;payroll:boolean}
export interface State {
  schemaVersion:number; setupComplete:boolean;
  salary:number; taxRate:number; stage:number; vacTotal:number; startDate:string;
  scheduleType:ScheduleType; scheduleShift:ShiftType; scheduleVakhtaMonths:number; schedulePairType:PairType;
  vacations:Period[]; sickLeaves:Period[]; holidayCoeff:number; nightExtraPercent:number;
  advances:Record<string,number>; paymentDates:Record<string,PaymentDates>; incomeHistory:IncomeHistory;
  shiftOverrides:Record<string,ShiftValue>; shiftNotes:Record<string,string>;
  theme:'auto'|'light'|'dark'; profile:UserProfile; directoryToken:string;
  friends:Record<string,Friend>; friendRequestsIncoming:FriendRequest[]; friendRequestsOutgoing:FriendRequest[];
  chats:Record<string,ChatMessage[]>; notifications:NotificationSettings; onePassEnabled:boolean;
}
