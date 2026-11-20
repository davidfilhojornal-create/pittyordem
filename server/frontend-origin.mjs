// Exact origins only. Keep the existing Cloudflare site working during transition.
export function acceptedOrigin(request,env){
 const origin=request.headers.get('Origin');if(!origin)return null;
 let normalized;try{normalized=new URL(origin).origin}catch{return null}
 if(origin!==normalized)return null;
 if(origin===new URL(request.url).origin)return origin;
 const allowed=String(env.FRONTEND_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 return allowed.includes(origin)?origin:null;
}
export function apiCors(request,env,response){
 const copy=new Response(response.body,response);const origin=acceptedOrigin(request,env);
 copy.headers.set('Vary',[copy.headers.get('Vary'),'Origin'].filter(Boolean).join(', '));
 if(origin)copy.headers.set('Access-Control-Allow-Origin',origin);
 return copy;
}
export function preflight(request,env){
 const origin=acceptedOrigin(request,env),method=request.headers.get('Access-Control-Request-Method');
 const fields=(request.headers.get('Access-Control-Request-Headers')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!origin||!['GET','POST'].includes(method)||fields.some(s=>s!=='content-type'))return new Response('Origin or method not authorized',{status:403,headers:{'Cache-Control':'no-store','Vary':'Origin'}});
 return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Max-Age':'600','Vary':'Origin'}});
}
