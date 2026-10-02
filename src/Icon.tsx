import type {SVGProps} from 'react';

export type IconName='search'|'pin'|'bellOff'|'lock'|'image'|'video'|'paperclip'|'send'|'message'|'more'|'mic'|'users'|'attachment'|'play'|'pause'|'refresh'|'download'|'close'|'check'|'calendar'|'settings'|'shield';

const paths:Record<IconName,string[]>={
 search:['M11 4a7 7 0 1 0 4.9 12L21 21','m16 16 5 5'],
 pin:['m15 4 5 5-3 3v5l-2 2-2-2v-5l-3-3','m7 7 5 5'],
 bellOff:['M13.7 21a2 2 0 0 1-3.4 0','M18 8a6 6 0 0 0-9.7-4.7','m3 3 18 18','M6 8c0 4.2-1.2 6.2-2 8h14'],
 lock:['M7 10V7a5 5 0 0 1 10 0v3','M6 10h12v10H6z','M12 14v3'],
 image:['M4 5h16v14H4z','m5 16 4-4 3 3 2-2 5 5','M9 9h.01'],
 video:['M4 6h11v12H4z','m15 10 5-3v10l-5-3'],
 paperclip:['m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5'],
 send:['m22 2-7 20-4-9-9-4Z','M22 2 11 13'],
 message:['M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'],
 more:['M5 12h.01','M12 12h.01','M19 12h.01'],
 mic:['M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Z','M19 11a7 7 0 0 1-14 0','M12 18v3','M8 21h8'],
 users:['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8','M22 21v-2a4 4 0 0 0-3-3.87','M16 3.13a4 4 0 0 1 0 7.75'],
 attachment:['M5 12h14','M12 5v14'],
 play:['m8 5 11 7-11 7Z'],
 pause:['M8 5v14','M16 5v14'],
 refresh:['M20 11a8 8 0 1 0 1 4','M20 4v7h-7'],
 download:['M12 3v12','m7 10 5 5 5-5','M5 21h14'],
 close:['M6 6l12 12','M18 6 6 18'],
 check:['m5 12 4 4L19 6'],
 calendar:['M7 3v4','M17 3v4','M4 9h16','M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z'],
 settings:['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z','M12 2v2','M12 20v2','m4.9 4.9 1.4 1.4','m17.7 17.7 1.4 1.4','M2 12h2','M20 12h2'],
 shield:['m12 3 8 4v5c0 4.4-3.4 7.8-8 9-4.6-1.2-8-4.6-8-9V7Z','m9 12 2 2 4-5']
};

export function Icon({name,size=18,strokeWidth=1.8,className='',...props}:{name:IconName;size?:number;strokeWidth?:number;className?:string}&Omit<SVGProps<SVGSVGElement>,'name'>){
 return <svg {...props} className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name].map((d,i)=><path key={i} d={d}/>)}</svg>;
}