// Leitura de playlists públicas da Deezer pela API pública de leitura (api.deezer.com), sem chave.
// Ainda NÃO testada contra respostas reais: só habilite depois do teste em modo "verify" (ver README).
//
// Garantias, iguais às do Spotify e da Apple Music:
// - lê a lista inteira, página por página, e confere o total declarado com o total recebido;
// - preserva a ordem;
// - nunca transforma uma falha de leitura em lista vazia ou parcial;
// - não usa nomes de músicas para reconhecer faixas (a validação usa só os IDs do catálogo).
import {Rejection} from './album-order.mjs';

const API = 'https://api.deezer.com';
const PAGE_SIZE = 50;
const MAX_PAGES = 20;          // 1.000 faixas: muito acima das 13 exigidas
const MAX_BYTES = 2_000_000;

// Modo da integração: "off" (padrão), "verify" (só /api/verify, não conta) ou "on".
export function deezerMode(env) {
  const mode = String(env?.DEEZER_MODE ?? 'off').trim().toLowerCase();
  return ['off', 'verify', 'on'].includes(mode) ? mode : 'off';
}
export function deezerAllowed(mode, path) {
  if (mode === 'on') return true;
  if (mode === 'verify') return path === '/api/verify';
  return false;
}

async function readJson(url, fetcher, signal) {
  let response;
  try {
    response = await fetcher(url, {headers: {'Accept': 'application/json'}, redirect: 'manual', signal});
  } catch (e) {
    throw new Rejection('A Deezer não respondeu à consulta. Tente novamente; nenhum envio foi salvo.', 503);
  }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel();
    throw new Rejection('A Deezer redirecionou a consulta de forma inesperada. Nenhum envio foi salvo.', 503);
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Rejection('A Deezer recusou a consulta desta playlist. Nenhum envio foi salvo.', response.status === 429 ? 503 : 422);
  }
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  while (true) {
    const {value, done} = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Rejection('Não foi possível verificar a resposta da Deezer com segurança.'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
  let data;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Rejection('A Deezer retornou uma resposta que não conseguimos verificar. Nenhum envio foi salvo.', 503); }
  if (data && typeof data === 'object' && data.error) throw deezerError(data.error);
  if (!data || typeof data !== 'object') throw new Rejection('Formato de resposta da Deezer não reconhecido.', 503);
  return data;
}

// Erros documentados da API: 4 = limite de consultas; 800 = dado inexistente ou não público.
function deezerError(error) {
  const code = Number(error?.code);
  if (code === 4 || code === 700) return new Rejection('A Deezer está limitando as consultas agora. Tente de novo em alguns minutos; nenhum envio foi salvo.', 503);
  if (code === 800 || code === 801) return new Rejection('Não encontramos esta playlist na Deezer. Confira se o link está certo e se ela é pública.', 422);
  if (code === 200 || code === 300 || String(error?.type || '').includes('OAuth')) return new Rejection('A Deezer exigiu autenticação para ler esta playlist. Ela pode estar privada.', 422);
  return new Rejection('A Deezer não permitiu ler esta playlist. Nenhum envio foi salvo.', 422);
}

const isTrackId = id => (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) || (typeof id === 'string' && /^\d{1,20}$/.test(id));

export async function readDeezer(playlist, fetcher = fetch) {
  if (!/^\d{1,20}$/.test(String(playlist?.id))) throw new Rejection('Link de playlist da Deezer inválido.', 400);
  const signal = AbortSignal.timeout(20000);

  const meta = await readJson(`${API}/playlist/${playlist.id}`, fetcher, signal);
  if (String(meta.id) !== String(playlist.id) || meta.type !== 'playlist') throw new Rejection('A Deezer não retornou a playlist solicitada. Confira o link.', 422);
  if (meta.public !== true) throw new Rejection('Esta playlist não está pública na Deezer. Deixe-a pública e envie de novo.', 422);
  const declared = meta.nb_tracks;
  if (!Number.isInteger(declared) || declared < 0) throw new Rejection('Não conseguimos confirmar o total de músicas desta playlist. Nenhum envio foi salvo.', 422);
  if (declared !== 13) throw new Rejection(`Esta playlist tem ${declared} faixas. São necessárias exatamente 13: todas as músicas do álbum, sem extras nem repetições.`);

  const items = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const index = items.length;
    const data = await readJson(`${API}/playlist/${playlist.id}/tracks?index=${index}&limit=${PAGE_SIZE}`, fetcher, signal);
    if (!Array.isArray(data.data) || !Number.isInteger(data.total)) throw new Rejection('Formato de lista da Deezer não reconhecido. Nenhum envio foi salvo.', 503);
    if (data.total !== declared) throw new Rejection('O total de faixas da Deezer mudou durante a leitura. Tente novamente; nenhum envio foi salvo.', 422);
    for (const track of data.data) {
      if (!track || track.type !== 'track' || !isTrackId(track.id)) throw new Rejection('A Deezer retornou um item que não é uma faixa reconhecível. Nenhum envio foi salvo.', 422);
      items.push({id: String(track.id), title: typeof track.title === 'string' ? track.title.slice(0, 200) : `${items.length + 1}ª música da playlist`});
    }
    if (items.length >= declared) break;
    if (data.data.length === 0) throw new Rejection('A Deezer entregou uma lista incompleta. Nenhuma posição foi contabilizada.', 422);
  }
  if (items.length !== declared) throw new Rejection('A Deezer entregou uma lista incompleta. Nenhuma posição foi contabilizada.', 422);

  return {title: String(meta.title || 'Minha ordem de Pitty').slice(0, 200), items};
}
