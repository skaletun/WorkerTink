let ctx: AudioContext | null = null;
let unlocked = false;

function getContext(){
  if(typeof window==='undefined') return null;
  const AudioCtor=(window.AudioContext||((window as any).webkitAudioContext)) as typeof AudioContext|undefined;
  if(!AudioCtor) return null;
  ctx ??= new AudioCtor();
  if(ctx.state==='suspended') void ctx.resume();
  return ctx;
}

export function unlockSounds(){
  const c=getContext();
  if(!c)return;
  unlocked=true;
  const now=c.currentTime;
  const gain=c.createGain(); gain.gain.setValueAtTime(0.0001,now); gain.connect(c.destination);
  const osc=c.createOscillator(); osc.frequency.value=1; osc.connect(gain); osc.start(now); osc.stop(now+0.01);
}

function tone(freq:number,duration:number,volume=0.045,delay=0){
  const c=getContext();
  if(!c||(!unlocked && c.state!=='running'))return;
  const now=c.currentTime+delay;
  const osc=c.createOscillator(); const gain=c.createGain();
  osc.type='sine'; osc.frequency.setValueAtTime(freq,now);
  gain.gain.setValueAtTime(0.0001,now);
  gain.gain.exponentialRampToValueAtTime(volume,now+0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001,now+duration);
  osc.connect(gain); gain.connect(c.destination); osc.start(now); osc.stop(now+duration+0.02);
}

export const sounds={
  click:()=>tone(520,.055,.025),
  success:()=>{tone(660,.08,.035);tone(880,.11,.035,.07)},
  send:()=>tone(620,.07,.03),
  message:()=>{tone(740,.08,.035);tone(980,.12,.03,.075)},
  notification:()=>{tone(660,.08,.035);tone(520,.13,.028,.09)},
  error:()=>{tone(240,.11,.04);tone(180,.14,.035,.1)},
  recordStart:()=>tone(760,.08,.03),
  recordStop:()=>tone(420,.12,.03),
};
