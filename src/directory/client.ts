const viteEnv=(import.meta as ImportMeta & {env?:Record<string,string|undefined>}).env;
export const DIRECTORY_URL=((globalThis as {__WTINK_DIRECTORY_URL?:string}).__WTINK_DIRECTORY_URL||viteEnv?.VITE_WTINK_DIRECTORY_URL||(viteEnv?.PROD?'https://workertink-directory.workertink-directory.workers.dev':'' )).replace(/\/$/,'');
export const directoryConfigured=Boolean(DIRECTORY_URL);

export async function request<T>(path:string,options:RequestInit={}):Promise<T>{
 if(!DIRECTORY_URL)throw new Error('DIRECTORY_NOT_CONFIGURED');
 const response=await fetch(`${DIRECTORY_URL}${path}`,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw new Error(typeof data?.error==='string'?data.error:`HTTP_${response.status}`);
 return data as T;
}
