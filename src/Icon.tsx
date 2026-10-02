import type {SVGProps} from 'react';

export type IconName=
  |'home'|'social'|'people'|'communities'|'chat'|'friends'|'profile'|'calendar'|'pay'|'absence'|'work'|'notifications'|'settings'|'admin'
  |'search'|'bell'|'bellOff'|'lock'|'shield'|'image'|'video'|'paperclip'|'attachment'|'send'|'message'|'mail'|'comment'|'heart'|'share'
  |'more'|'mic'|'play'|'pause'|'refresh'|'download'|'close'|'check'|'chevronLeft'|'chevronRight'|'externalLink'|'chevronDown'|'star'|'pin';

const paths:Record<IconName,string[]>={
 home:['M3 11 12 3l9 8v9H3v-9Z','M9 20v-6h6v6'],
 social:['M4 6h16v10H8l-4 4V6Z','M8 10h8','M8 13h5'],
 people:['M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M22 21v-1a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'],
 communities:['M4 5h16v12H4Z','M8 9h8','M8 12h5','M12 17v4','M9 21h6'],
 chat:['M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
 friends:['M16 21v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M16 11h6','M19 8v6'],
 profile:['M20 21a8 8 0 0 0-16 0','M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8'],
 calendar:['M7 3v4','M17 3v4','M4 9h16','M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z'],
 pay:['M4 7h15a1 1 0 0 1 1 1v10H4a1 1 0 0 1-1-1V7Z','M4 7V5a2 2 0 0 1 2-2h11','M15 13h2'],
 absence:['M7 3v4','M17 3v4','M4 10h16','M6 5h12a2 2 0 0 1 2 2v11H4V7a2 2 0 0 1 2-2Z','M9 15h6'],
 work:['M4 6h16v13H4Z','M8 3v3','M16 3v3','M7 11h4','M7 15h7'],
 notifications:['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9','M10 21h4'],
 settings:['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z','M12 2v2','M12 20v2','m4.9 4.9 1.4 1.4','m17.7 17.7 1.4 1.4','M2 12h2','M20 12h2','m4.9 19.1 1.4-1.4','m17.7 6.3 1.4-1.4'],
 admin:['m12 3 8 4v5c0 4.4-3.4 7.8-8 9-4.6-1.2-8-4.6-8-9V7l8-4Z','M12 8v4','M12 16h.01'],
 search:['M11 4a7 7 0 1 0 4.9 12L21 21','m16 16 5 5'],
 bell:['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9','M10 21h4'],
 bellOff:['M13.7 21a2 2 0 0 1-3.4 0','M18 8a6 6 0 0 0-9.7-4.7','m3 3 18 18','M6 8c0 4.2-1.2 6.2-2 8h14'],
 lock:['M7 10V7a5 5 0 0 1 10 0v3','M6 10h12v10H6Z','M12 14v3'],
 shield:['m12 3 8 4v5c0 4.4-3.4 7.8-8 9-4.6-1.2-8-4.6-8-9V7Z','m9 12 2 2 4-5'],
 image:['M4 5h16v14H4Z','m5 16 4-4 3 3 2-2 5 5','M9 9h.01'],
 video:['M4 6h11v12H4Z','m15 10 5-3v10l-5-3'],
 paperclip:['m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5'],
 attachment:['M5 12h14','M12 5v14'],
 send:['m22 2-7 20-4-9-9-4Z','M22 2 11 13'],
 message:['M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
 mail:['M4 6h16v12H4Z','m4 7 8 6 8-6'],
 comment:['M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
 heart:['M20.8 8.6c0 5-8.8 10.3-8.8 10.3S3.2 13.6 3.2 8.6A4.6 4.6 0 0 1 12 6.2a4.6 4.6 0 0 1 8.8 2.4Z'],
 share:['M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7','M12 3v12','m7 8 5-5 5 5'],
 more:['M5 12h.01','M12 12h.01','M19 12h.01'],
 mic:['M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z','M19 11a7 7 0 0 1-14 0','M12 18v3','M8 21h8'],
 play:['m8 5 11 7-11 7Z'],
 pause:['M8 5v14','M16 5v14'],
 refresh:['M20 11a8 8 0 1 0 1 4','M20 4v7h-7'],
 download:['M12 3v12','m7 10 5 5 5-5','M5 21h14'],
 close:['M6 6l12 12','M18 6 6 18'],
 check:['m5 12 4 4L19 6'],
 chevronLeft:['m15 18-6-6 6-6'],
 chevronRight:['m9 18 6-6-6-6'],
 chevronDown:['m6 9 6 6 6-6'],
 externalLink:['M14 5h5v5','m19 5-8 8','M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4'],
 star:['m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z'],
 pin:['m15 4 5 5-3 3v5l-2 2-2-2v-5l-3-3','m7 7 5 5']
};

export function Icon({name,size=18,strokeWidth=1.8,className='',...props}:{name:IconName;size?:number;strokeWidth?:number;className?:string}&Omit<SVGProps<SVGSVGElement>,'name'>){
 return <svg {...props} className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name].map((d,i)=><path key={i} d={d}/>)}</svg>;
}
