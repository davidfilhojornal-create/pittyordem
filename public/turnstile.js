export function createTurnstileGate(){
 let required=false,id=null,failed=false;
 return {
  async configure(config){
   required=!!config?.required;if(!required)return;
   const holder=document.querySelector('#turnstile-container');holder.hidden=false;
   if(!config.siteKey){failed=true;throw new Error('A proteção do envio está aguardando configuração.')}
   try{
    if(!window.turnstile)await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('A confirmação demorou para carregar. Atualize a página para tentar novamente.')),15000);const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>{clearTimeout(timer);resolve()};script.onerror=()=>{clearTimeout(timer);reject(new Error('Não foi possível carregar a confirmação. Atualize a página para tentar novamente.'))};document.head.append(script)});
    id=window.turnstile.render(holder,{sitekey:config.siteKey,action:'playlist_submit',theme:'dark','error-callback':()=>{failed=true},callback:()=>{failed=false}});
   }catch(e){failed=true;throw e}
  },
  token(){if(!required)return '';if(failed||id===null)throw new Error('A confirmação não carregou. Atualize a página para tentar novamente.');const token=window.turnstile.getResponse(id);if(!token)throw new Error('Conclua a confirmação de segurança antes de enviar.');return token},
  reset(){if(id!==null)window.turnstile?.reset(id)}
 };
}
