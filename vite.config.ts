import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
export default defineConfig({base:'./',plugins:[react(),VitePWA({registerType:'autoUpdate',strategies:'injectManifest',srcDir:'src',filename:'sw.js',includeAssets:['icon.svg','icon-192.png','icon-512.png'],manifest:{name:'WorkerTink — рабочая сеть',short_name:'WorkerTink',start_url:'./',display:'standalone',theme_color:'#1557D6',background_color:'#1557D6',lang:'ru',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'}]},injectManifest:{globPatterns:['**/*.{js,css,html,svg,png,ico}']}})]});
