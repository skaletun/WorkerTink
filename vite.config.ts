import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {VitePWA} from 'vite-plugin-pwa';
import {fileURLToPath,URL} from 'node:url';

export default defineConfig({
  define:{'import.meta.env.VITE_BUILD_ID':JSON.stringify(process.env.VITE_BUILD_ID||'dev')},
  base:'./',
  resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
  plugins:[
    react(),
    VitePWA({
      registerType:'prompt',
      strategies:'injectManifest',
      srcDir:'src',
      filename:'sw.js',
      includeAssets:['icon.svg','icon-256.png','apple-touch-icon.png'],
      manifest:{
        name:'WTinker — социальная сеть для работы',
        short_name:'WTinker',
        start_url:'./',
        display:'standalone',
        theme_color:'#18271f',
        background_color:'#18271f',
        lang:'ru',
        icons:[{src:'icon-256.png',sizes:'256x256',type:'image/png',purpose:'any maskable'},{src:'icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any'}]
      },
      injectManifest:{globPatterns:['**/*.{js,css,html,svg,png,ico}']}
    })
  ]
});
