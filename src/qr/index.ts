import QRCode from './core.js';
export function renderQrSvg(value:string,scale=5){
 const qr=new QRCode(13,0); // M
 qr.addData(value);qr.make();
 const count=qr.getModuleCount();
 const quiet=4; const size=(count+quiet*2)*scale;
 let rects='';
 for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))rects+=`<rect x="${(c+quiet)*scale}" y="${(r+quiet)*scale}" width="${scale}" height="${scale}"/>`;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR-код"><rect width="100%" height="100%" fill="white"/>${rects}</svg>`;
}
