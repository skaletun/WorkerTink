import {Icon,type IconName} from './Icon';
import {useState} from 'react';

const ICONS=['#','briefcase','megaphone','message','rocket','tools','brain','target','palette','flame','clipboard','building','star','puzzle','announce','settings'] as const;
const THEMES=[
  {id:'default',label:'Классика',accent:'#2563eb'},
  {id:'ocean',label:'Океан',accent:'#0ea5e9'},
  {id:'violet',label:'Фиолет',accent:'#7c3aed'},
  {id:'forest',label:'Лес',accent:'#16a34a'},
  {id:'sunset',label:'Закат',accent:'#ea580c'},
  {id:'graphite',label:'Графит',accent:'#475569'},
];

export function SpaceIconPicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [open,setOpen]=useState(false);
 return <div className="space-control"><button type="button" className="space-picker-button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="true"><span className="space-picker-preview">{value||'#'}</span><span>Иконка</span></button>{open&&<div className="space-picker-popover" role="menu">{ICONS.map(icon=><button type="button" key={icon} className={value===icon?'active':''} onClick={()=>{onChange(icon);setOpen(false)}} aria-label={'Выбрать иконку '+icon}>{icon}</button>)}<button type="button" className="space-picker-reset" onClick={()=>{onChange('#');setOpen(false)}}>Сбросить</button></div>}</div>
}

export function SpaceThemePicker({value,onChange}:{value:string;onChange:(accent:string)=>void}){
 const [open,setOpen]=useState(false);
 const current=THEMES.find(theme=>theme.accent.toLowerCase()===String(value||'').toLowerCase())||null;
 return <div className="space-control"><button type="button" className="space-picker-button" onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-haspopup="true"><span className="space-theme-swatch" style={{background:current?.accent||value||'#2563eb'}}/><span>{current?'Тема · '+current.label:'Тема'}</span></button>{open&&<div className="space-theme-popover" role="menu">{THEMES.map(theme=><button type="button" key={theme.id} className={value.toLowerCase()===theme.accent.toLowerCase()?'active':''} onClick={()=>{onChange(theme.accent);setOpen(false)}}><i style={{background:theme.accent}}/><span>{theme.label}</span></button>)}</div>}</div>
}