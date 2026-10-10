import type {FriendRequest,UserProfile,State} from '../core';

export type SearchResult={profile:UserProfile};

export type DirectoryFriend={profile:UserProfile;addedAt:number;lastSeen:number;online:boolean};

export type ChatMute={peerId:string;mutedUntil:number|null};

export type AdminProfile=UserProfile & {createdAt:number;updatedAt:number;lastSeen:number;online:boolean};

export type VerificationRequest={id:string;profile:UserProfile;status:'pending'|'approved'|'rejected';note:string;createdAt:number;reviewedAt:number|null};

export type RegisterResult={profile:UserProfile;token:string;security?:{pinSet:boolean;onePassAvailable:boolean}};

export type SetupData={salary:number;taxRate:number;stage:number;vacTotal:number;startDate:string;scheduleType:State['scheduleType'];scheduleShift:State['scheduleShift'];scheduleVakhtaMonths:number;schedulePairType:State['schedulePairType'];holidayCoeff:number;nightExtraPercent:number};

export type LoginResult={profile:UserProfile;token:string;setup:SetupData|null;security:{pinSet:boolean;onePassAvailable:boolean}};

export type RequestResult={request:FriendRequest};

export type AuthSession={sessionId:string;deviceName:string;createdAt:number;expiresAt:number;lastSeen:number;current:boolean};

export type OnePassDevice={id:string;deviceType:string;backedUp:boolean;transports:string[];deviceName:string;createdAt:number;updatedAt:number};

export type PeerSession={id:string;from:UserProfile;to:UserProfile;offer:string;answer:string|null;status:'pending'|'answered'|'expired'|'cancelled';createdAt:number;updatedAt:number;expiresAt:number};

export type PushSubscriptionData={endpoint:string;expirationTime:number|null;keys:{p256dh:string;auth:string}};

export type PostAttachment={id:string;name:string;mime:string;size:number;data:string};

export type ShiftNote={date:string;shift:string;summary:string};

export type SocialPost={id:string;body:string;kind?:'post'|'announcement'|'question'|'shift';groupId?:string|null;visibility?:'network'|'friends';attachments?:PostAttachment[];shiftNote?:ShiftNote|null;createdAt:number;updatedAt:number;author:UserProfile;likes:number;comments:number;liked:boolean};

export type SocialComment={id:string;body:string;createdAt:number;author:UserProfile};

export type SocialNotification={id:string;kind:string;entityId:string|null;title:string;body:string;url:string;readAt:number|null;createdAt:number;actor:UserProfile|null};

export type SocialMessage={id:string;from:string;to:string;body:string;createdAt:number;readAt:number|null};

export type ChatKey={profileId:string;publicKey:JsonWebKey;updatedAt:number};

export type ChatServerMessage={id:string;from:string;to:string;body:string;kind:'text'|'voice'|'image'|'video'|'file'|'note';mime?:string|null;name?:string|null;createdAt:number;readAt:number|null;editedAt?:number|null;deletedAt?:number|null;replyToId?:string|null;replyPreview?:string|null;noteDate?:string|null;noteShift?:string|null;deletedForMe?:boolean};

export type ChatPin={messageId:string;pinnedBy:string;pinnedAt:number;message:ChatServerMessage};

export type ChatReaction={emoji:string;profileId:string};

export type GroupChat={id:string;name:string;description:string;avatar:string;ownerId:string;visibility:'public'|'private';members:number;role:string;createdAt:number};

export type GroupChatMember={profile:UserProfile;role:string;joinedAt:number};

export type GroupChatDetail={group:GroupChat;members:GroupChatMember[];key:{iv:string;data:string}|null};

export type GroupChatMessage=ChatServerMessage;

export type CompanyChannel={id:string;name:string;slug:string;description:string;companyName:string;ownerId:string;visibility:'public'|'private';members:number;roleId:string|null;createdAt:number;icon?:string;accent?:string;cover?:string;topic?:string};

export type ChannelRole={id:string;name:string;permissions:Record<string,boolean>};

export type ChannelPost={id:string;body:string;createdAt:number;updatedAt:number;author:UserProfile};

export type CompanyInvite={id:string;channelId:string;channelName:string;companyName:string;createdAt:number;sender:UserProfile};

export type NetworkGroup={id:string;name:string;slug:string;description:string;visibility:'public'|'private';icon?:string;accent?:string;cover?:string;rules?:string;owner:UserProfile;members:number;joined:boolean;role?:string;createdAt:number};

export type NetworkEvent={id:string;title:string;description:string;kind:string;startsAt:number;endsAt:number|null;location:string;owner:UserProfile;groupId:string|null;going:number;joined:boolean};

export type ShiftSwap={id:string;date:string;shift:string;requestedShift:string;note:string;status:'open'|'claimed'|'cancelled';owner:UserProfile;claimedBy:UserProfile|null;createdAt:number};

export type NetworkPerson={profile:UserProfile;online:boolean;mutualFriends:number;connected:boolean};

export type NetworkHome={groups:NetworkGroup[];events:NetworkEvent[];swaps:ShiftSwap[];people:NetworkPerson[]};

export type NetworkGroupDetail={group:NetworkGroup;members:{profile:UserProfile;role:string}[]};

export type WorkTeam={id:string;name:string;description:string;owner:UserProfile;members:number;role:string;createdAt:number};

export type WorkDocument={id:string;teamId:string;title:string;description:string;url:string;owner:UserProfile;createdAt:number;updatedAt:number};
