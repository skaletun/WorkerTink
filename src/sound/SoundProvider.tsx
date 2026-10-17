import {createContext,useContext,useEffect,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import {SoundController} from './controller.ts';
const Context=createContext<SoundController|null>(null);
export function SoundProvider({owner,token,children}:{owner:string;token:string;children:ReactNode}){
 const controller=useMemo(()=>new SoundController(owner.toUpperCase(),token),[owner,token]);
 useEffect(()=>{void controller.init();window.addEventListener('online',controller.connectivity);window.addEventListener('offline',controller.connectivity);window.addEventListener('pagehide',controller.checkpoint);window.addEventListener('wtinker:before-update',controller.checkpoint);return()=>{window.removeEventListener('online',controller.connectivity);window.removeEventListener('offline',controller.connectivity);window.removeEventListener('pagehide',controller.checkpoint);window.removeEventListener('wtinker:before-update',controller.checkpoint);controller.dispose()}},[controller]);
 return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useSound(){const controller=useContext(Context);if(!controller)throw new Error('WTSound provider missing');const state=useSyncExternalStore(controller.subscribe,controller.snapshot);return {controller,...state}}
