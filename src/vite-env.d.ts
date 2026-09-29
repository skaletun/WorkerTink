/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare global { interface Window { workertinkDesktop?: { notify?: (payload:{title:string;body?:string;url?:string;tag?:string})=>void } } }
export {};
