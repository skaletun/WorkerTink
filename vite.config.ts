import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
export default defineConfig({base:'./',plugins:[react(),VitePWA({registerType:'autoUpdate',strategies:'injectManifest',srcDir:'src',filename:'sw.js',includeAssets:['icon.svg','icon-192.png','icon-512.png'],manifest:{name:'WorkerTink — рабочий календарь',short_name:'WorkerTink',start_url:'./',display:'standalone',theme_color:'#f5f7fa',background_color:'#f5f7fa',lang:'ru',icons:[{src:'icon-192.png',sizes:'192x192',type:'image/png'},{src:'icon-512.png',sizes:'512x512',type:'image/png'}]},injectManifest:{globPatterns:['**/*.{js,css,html,svg,png,ico}']}})]});
