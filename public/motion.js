// Animações do "Pitty — Na sua ordem".
// Cada animação é ligada por uma classe no <html> (m-assinatura, m-luz, ...), então o CSS só anima o que estiver ligado.
// Modo laboratório: abra o site com ?lab=1 para ligar e desligar cada uma num painel.
// Fora do laboratório valem as animações listadas em ATIVAS (vazia = site sem animações extras).
// Quem configurou o aparelho para reduzir movimento não vê nenhuma animação.

const ANIMACOES = [
  ['assinatura', 'Assinatura sendo escrita', 'O logo aparece da esquerda para a direita e o raio pisca no fim.'],
  ['luz', 'Foco de luz no fundo', 'No computador, a luz segue o mouse e revela a foto.'],
  ['entrada', 'Entrada do conteúdo', 'Título, texto e formulário surgem em sequência.'],
  ['conferindo', 'Botão conferindo', 'Uma faixa de luz passa pelo botão enquanto a playlist é conferida.'],
  ['setlist', 'Setlist sendo escrito', 'Playlist aceita: as 13 faixas aparecem uma a uma, na ordem enviada.'],
  ['abas', 'Troca de abas', 'Fade curto entre Enviar, Playlists e Resultados.'],
  ['contagem', 'Números contando', 'Os totais dos resultados contam até o valor final.'],
  ['cascata', 'Mapa acendendo', 'As células do mapa acendem em cascata.'],
  ['detalhe', 'Detalhe do mapa', 'A caixinha da célula aparece com fade.'],
  ['cards', 'Cards das playlists', 'Os cards entram em sequência ao rolar a página.'],
  ['fotos', 'Fotos acendendo', 'A faixa de foto no topo das abas acende devagar ao abrir.'],
  ['card', 'Troca de foto no card', 'A prévia do card de stories troca com um fade ao escolher outra foto.'],
];
// Animações ligadas no site público. O foco de luz e o setlist ficam só no laboratório (?lab=1).
const ATIVAS = ['assinatura', 'entrada', 'conferindo', 'abas', 'contagem', 'cascata', 'detalhe', 'cards', 'fotos', 'card'];

const root = document.documentElement;
const reduz = matchMedia('(prefers-reduced-motion: reduce)');
const lab = new URLSearchParams(location.search).has('lab');
const STORE = 'pitty-motion-lab';
const on = key => root.classList.contains('m-' + key);

function lerEscolhas() {
  if (!lab) return ATIVAS;
  try { const v = JSON.parse(localStorage.getItem(STORE)); if (Array.isArray(v)) return v; } catch {}
  return ANIMACOES.map(a => a[0]);
}
function aplicar(lista) {
  ANIMACOES.forEach(([k]) => root.classList.toggle('m-' + k, !reduz.matches && lista.includes(k)));
}
function salvar() {
  const lista = ANIMACOES.map(a => a[0]).filter(on);
  try { localStorage.setItem(STORE, JSON.stringify(lista)); } catch {}
}
// Reinicia uma animação CSS removendo e devolvendo a classe.
function replay(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

aplicar(lerEscolhas());
reduz.addEventListener?.('change', () => aplicar(lerEscolhas()));

/* Assinatura + entrada: tocam ao carregar e quando se volta para "Enviar" */
function tocarAbertura() {
  replay(document.querySelector('.hero-logo'), 'm-run');
  replay(document.querySelector('#enviar.hero'), 'm-run');
}
// Experimental cinematic entrance; previous version is tagged in GitHub.
// It runs only on the initial Enviar page, never on deep links or tab changes.
async function aberturaCinema(){
 const hero=document.querySelector('#enviar'),heading=hero?.querySelector('h1'),logo=heading?.querySelector('img'),subtitle=heading?.querySelector('em');
 if(!hero||!heading||!logo||!subtitle||reduz.matches||!on('entrada')||!['','#enviar'].includes(location.hash)){tocarAbertura();return}
 root.classList.add('m-cinema');
 const curtain=document.createElement('div');curtain.className='opening-curtain';curtain.setAttribute('aria-hidden','true');
 const skip=document.createElement('button');skip.type='button';skip.className='opening-skip';skip.textContent='Pular abertura ↗';
 document.body.append(curtain,skip);
 const animations=[];let stopped=false,watchdog;const original=subtitle.textContent;
 function finish(){
  if(stopped)return;stopped=true;clearTimeout(watchdog);animations.forEach(a=>a.cancel());
  subtitle.textContent=original;subtitle.removeAttribute('aria-label');heading.style.removeProperty('transform');
  root.classList.remove('m-cinema');root.classList.add('m-cinema-done');curtain.remove();skip.remove();
  document.removeEventListener('keydown',keyboard);window.removeEventListener('resize',finish);reduz.removeEventListener?.('change',finish);
  if(location.hash&&location.hash!=='#enviar')return;
  const elements=[document.querySelector('header .wordmark'),document.querySelector('nav'),hero.querySelector('.lead'),hero.querySelector('.submit-card'),document.querySelector('footer')];
  if(!reduz.matches)elements.filter(Boolean).forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'none'}],{duration:500,delay:i*60,easing:'cubic-bezier(.16,1,.3,1)'}));
 }
 function keyboard(e){if(['Escape','Tab'].includes(e.key))finish()}
 skip.onclick=finish;document.addEventListener('keydown',keyboard);window.addEventListener('resize',finish);reduz.addEventListener?.('change',finish);
 window.addEventListener('hashchange',finish,{once:true});
 watchdog=setTimeout(finish,4800);
 try{
  await Promise.race([Promise.all([logo.decode().catch(()=>{}),document.fonts?.ready]),new Promise(resolve=>setTimeout(resolve,500))]);
  if(stopped)return;
  const rect=heading.getBoundingClientRect();
  const scale=Math.min(2.15,(innerWidth-40)/rect.width,(innerHeight*.56)/rect.height);
  const x=innerWidth/2-(rect.left+rect.width/2),y=innerHeight*.46-(rect.top+rect.height/2);
  const centered=`translate(${x}px,${y}px) scale(${scale})`;
  heading.style.transform=centered;
  animations.push(logo.animate([{clipPath:'inset(0 100% 0 0)',opacity:0},{clipPath:'inset(0 0% 0 0)',opacity:1}],{duration:1250,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'}));
  subtitle.setAttribute('aria-label',original);subtitle.replaceChildren();
  [...original].forEach((char,i)=>{const span=document.createElement('span');span.textContent=char===' '? '\u00a0':char;span.setAttribute('aria-hidden','true');span.className='opening-letter';subtitle.append(span);animations.push(span.animate([{opacity:0,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0 0 0)'}],{duration:230,delay:620+i*62,fill:'both'}))});
  await new Promise(resolve=>setTimeout(resolve,1750));if(stopped)return;
  const flight=heading.animate([{transform:centered},{transform:'translate(0,0) scale(1)'}],{duration:950,easing:'cubic-bezier(.76,0,.24,1)',fill:'forwards'});animations.push(flight);
  animations.push(curtain.animate([{opacity:1},{opacity:0}],{duration:650,delay:350,fill:'forwards'}));
  await flight.finished;finish();
 }catch{finish()}
}
void aberturaCinema();

/* Foco de luz */
let raf = 0, px = 0, py = 0;
const ponteiroFino = matchMedia('(hover: hover) and (pointer: fine)');
addEventListener('pointermove', e => {
  if (!on('luz') || !ponteiroFino.matches) return;
  px = e.clientX; py = e.clientY;
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; root.style.setProperty('--luz-x', px + 'px'); root.style.setProperty('--luz-y', py + 'px'); });
}, {passive: true});

/* Troca de abas */
function acenderFoto() {
  if (on('fotos')) replay(document.querySelector('.page:not([hidden]) .photo-band'), 'm-run');
}
setTimeout(acenderFoto, 0);
addEventListener('hashchange', () => {
  const page = document.querySelector('.page:not([hidden])');
  if (on('abas')) replay(page, 'm-tab');
  acenderFoto();
  if (page?.id === 'enviar') tocarAbertura();
});

/* Números contando (observa o que o site escreve nos totais) */
const contando = new WeakSet(), observadores = new WeakMap();
function escrever(el, texto) { el.textContent = texto; observadores.get(el)?.takeRecords(); }
function contar(el) {
  if (!on('contagem') || contando.has(el)) return;
  const final = el.textContent, alvo = Number(final.replace(/\D/g, ''));
  if (!Number.isFinite(alvo) || alvo === 0) return;
  contando.add(el);
  const inicio = performance.now(), dur = Math.min(1200, 500 + alvo * 4);
  const passo = agora => {
    const t = Math.min(1, (agora - inicio) / dur), e = 1 - Math.pow(1 - t, 3);
    escrever(el, t < 1 ? Math.round(alvo * e).toLocaleString('pt-BR') : final);
    if (t < 1) requestAnimationFrame(passo); else contando.delete(el);
  };
  requestAnimationFrame(passo);
}
function observarTotais() {
  document.querySelectorAll('.stats-top strong').forEach(el => {
    const obs = new MutationObserver(() => contar(el));
    observadores.set(el, obs);
    obs.observe(el, {childList: true, characterData: true, subtree: true});
  });
}
observarTotais();

/* Mapa acendendo em cascata */
const tabela = document.querySelector('#position-table');
if (tabela) new MutationObserver(muts => {
  if (!on('cascata') || !muts.some(m => [...m.addedNodes].some(n => n.nodeName === 'TBODY'))) return;
  tabela.querySelectorAll('button.map-cell').forEach(b => b.style.setProperty('--i', Number(b.dataset.r) + Number(b.dataset.c)));
  replay(tabela, 'm-cascata-run');
}).observe(tabela, {childList: true});

/* Cards das playlists */
const lista = document.querySelector('#playlist-list');
const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
  entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('m-visivel'); io.unobserve(en.target); } });
}, {rootMargin: '0px 0px -8% 0px'}) : null;
if (lista && io) new MutationObserver(muts => {
  if (!on('cards')) return;
  let n = 0;
  muts.forEach(m => m.addedNodes.forEach(card => {
    if (!(card instanceof HTMLElement) || !card.classList.contains('playlist-card')) return;
    card.style.setProperty('--n', n++ % 6);
    card.classList.add('m-pendente'); io.observe(card);
  }));
}).observe(lista, {childList: true});

/* Setlist sendo escrito: o site avisa quando uma playlist é aceita */
let catalogo = null;
addEventListener('pitty:accepted', async e => {
  if (!on('setlist') || !Array.isArray(e.detail?.order)) return;
  try { catalogo ||= (await (await fetch('/api/catalog')).json()).tracks; } catch { return; }
  const idx = new Map(catalogo.map((t, i) => [t.key, i]));
  const ol = document.createElement('ol'); ol.className = 'setlist-escrito'; ol.setAttribute('aria-label', 'Sua ordem registrada');
  e.detail.order.forEach((key, n) => {
    const i = idx.get(key); if (i === undefined) return;
    const li = document.createElement('li'); li.style.setProperty('--n', n);
    const art = document.createElement('span'); art.className = `track-lettering track-lettering-${i}`;
    const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = catalogo[i].name;
    art.append(sr); li.append(art); ol.append(li);
  });
  document.querySelector('#validation-details')?.prepend(ol);
});

/* Painel do laboratório */
if (lab) {
  const painel = document.createElement('details');
  painel.className = 'm-lab'; painel.open = matchMedia('(min-width: 701px)').matches;
  painel.innerHTML = '<summary>Animações</summary>';
  const corpo = document.createElement('div');
  if (reduz.matches) {
    const aviso = document.createElement('p');
    aviso.textContent = 'Seu aparelho está configurado para reduzir movimento, então as animações ficam desligadas.';
    corpo.append(aviso);
  }
  ANIMACOES.forEach(([k, nome, desc]) => {
    const label = document.createElement('label');
    const box = document.createElement('input'); box.type = 'checkbox'; box.checked = on(k); box.disabled = reduz.matches;
    box.onchange = () => { root.classList.toggle('m-' + k, box.checked); salvar(); };
    const txt = document.createElement('span'); txt.innerHTML = '<strong></strong><small></small>';
    txt.firstChild.textContent = nome; txt.lastChild.textContent = desc;
    label.append(box, txt); corpo.append(label);
  });
  const acoes = document.createElement('div'); acoes.className = 'm-lab-acoes';
  const botao = (texto, fn) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = texto; b.onclick = fn; acoes.append(b); };
  const todas = estado => { corpo.querySelectorAll('input').forEach((box, i) => { box.checked = estado; root.classList.toggle('m-' + ANIMACOES[i][0], estado); }); salvar(); };
  botao('Ligar todas', () => todas(true));
  botao('Desligar todas', () => todas(false));
  botao('Rever abertura', () => { location.hash = '#enviar'; tocarAbertura(); });
  botao('Simular setlist', () => {
    fetch('/api/catalog').then(r => r.json()).then(d => {
      const order = d.tracks.map(t => t.key).sort(() => Math.random() - .5);
      document.querySelector('#validation-details')?.replaceChildren();
      dispatchEvent(new CustomEvent('pitty:accepted', {detail: {order}}));
    }).catch(() => {});
  });
  corpo.append(acoes);
  painel.append(corpo);
  document.body.append(painel);
}

/* Troca de foto no card: fade na prévia sempre que a imagem muda */
new MutationObserver(muts => {
  if (!on('card')) return;
  for (const m of muts) if (m.target.classList?.contains('story-preview') && m.target.getAttribute('src')) replay(m.target, 'm-run');
}).observe(document.body, {subtree: true, attributes: true, attributeFilter: ['src']});
