const PAGE_SIZE=20,MAX_BYTES=2*1024*1024;
export class CatalogError extends Error{constructor(message,status=502){super(message);this.status=status}}
export async function fetchSoundCatalog(params,fetcher=fetch){
 const source=params.get('source'),term=(params.get('q')||'').trim(),page=Number(params.get('page')||1),country=params.get('country')||'US';
 if(!['deezer','itunes'].includes(source)||term.length<2||term.length>200||!Number.isInteger(page)||page<1||page>10||!['US','RU','GB','DE','FR'].includes(country))throw new CatalogError('Некорректные параметры поиска',400);
 // Fixed origins and paths: this endpoint cannot act as a general-purpose URL proxy.
 const url=new URL(source==='deezer'?'https://api.deezer.com/search/track':'https://itunes.apple.com/search');
 if(source==='deezer'){
  url.search=new URLSearchParams({q:term,index:String((page-1)*PAGE_SIZE),limit:String(PAGE_SIZE),order:'RANKING'}).toString();
 }else{
  url.search=new URLSearchParams({term,entity:'song',media:'music',country,limit:String(Math.min(200,page*PAGE_SIZE+1)),explicit:'Yes'}).toString();
 }
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{
  const response=await fetcher(url.href,{headers:{Accept:'application/json'},redirect:'error',signal:controller.signal});
  if(!response.ok)throw new CatalogError(response.status===429?'Каталог ограничил число запросов. Повторите позже.':'Каталог временно недоступен',response.status===429?429:502);
  if(Number(response.headers.get('content-length'))>MAX_BYTES)throw new CatalogError('Ответ каталога слишком большой');
  const reader=response.body?.getReader();if(!reader)throw new CatalogError('Пустой ответ каталога');
  const decoder=new TextDecoder();let bytes=0,body='';
  try{
   while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>MAX_BYTES){await reader.cancel();throw new CatalogError('Ответ каталога слишком большой')}body+=decoder.decode(value,{stream:true})}
   body+=decoder.decode();
  }finally{reader.releaseLock()}
  const data=JSON.parse(body);
  if(data.error||!Array.isArray(source==='deezer'?data.data:data.results))throw new CatalogError('Каталог вернул ошибку');
  return data;
 }catch(error){
  if(error instanceof CatalogError)throw error;
  throw new CatalogError(controller.signal.aborted?'Каталог не ответил вовремя. Повторите поиск.':'Не удалось получить результаты каталога');
 }finally{clearTimeout(timer)}
}
