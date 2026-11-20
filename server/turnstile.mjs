import {Rejection} from './album-order.mjs';
export function turnstileConfig(env){return {required:env.TURNSTILE_REQUIRED==='true'||!!(env.TURNSTILE_SITE_KEY||env.TURNSTILE_SECRET_KEY),siteKey:env.TURNSTILE_SITE_KEY||null}}
export async function verifyTurnstile(request,body,env,fetcher=fetch,expectedHostname=new URL(request.url).hostname){
 const config=turnstileConfig(env);if(!config.required)return;
 if(!config.siteKey||!env.TURNSTILE_SECRET_KEY)throw new Rejection('A proteção de envios está aguardando configuração. Avise a equipe do site.',503,{code:'TURNSTILE_CONFIGURATION'});
 const token=body.turnstileToken;if(typeof token!=='string'||!token||token.length>2048)throw new Rejection('Confirme que você é uma pessoa antes de enviar.',403,{code:'TURNSTILE_TOKEN_INVALID'});
 const form=new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token});const ip=request.headers.get('CF-Connecting-IP');if(ip)form.set('remoteip',ip);
 let response,result;
 try{
  response=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:form,signal:AbortSignal.timeout(10000)});
  // Siteverify also returns structured errors with HTTP 400. Read those before
  // classifying the failure; never log the secret, response token or request body.
  result=await response.json();
 }catch{throw new Rejection('O serviço de confirmação está temporariamente indisponível. Tente novamente.',503,{code:'TURNSTILE_UNAVAILABLE'})}
 if(!result||typeof result!=='object')throw new Rejection('O serviço de confirmação está temporariamente indisponível. Tente novamente.',503,{code:'TURNSTILE_UNAVAILABLE'});
 const errors=Array.isArray(result['error-codes'])?result['error-codes']:[];
 if(errors.some(code=>['missing-input-secret','invalid-input-secret'].includes(code))){
  console.warn('Turnstile server configuration rejected by Siteverify');
  throw new Rejection('A chave de servidor da proteção de envio está inválida. Avise a equipe do site.',503,{code:'TURNSTILE_CONFIGURATION'});
 }
 if(errors.includes('internal-error')||response.status>=500)throw new Rejection('O serviço de confirmação está temporariamente indisponível. Tente novamente.',503,{code:'TURNSTILE_UNAVAILABLE'});
 if(!response.ok||result.success!==true)throw new Rejection('A confirmação expirou ou não é válida. Confirme novamente antes de enviar.',403,{code:'TURNSTILE_TOKEN_INVALID'});
 if(result.hostname!==expectedHostname||result.action!=='playlist_submit')throw new Rejection('A confirmação não corresponde a esta página. Atualize a página e confirme novamente.',403,{code:'TURNSTILE_CONTEXT_INVALID'});
}
