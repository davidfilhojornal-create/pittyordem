// Teste real da leitura Deezer, sem banco e sem contador.
// Uso (em qualquer computador com Node 22+ e internet):
//   node scripts/deezer-check.mjs https://www.deezer.com/br/playlist/15975809523
// Também confere se as 13 faixas do álbum oficial batem com os IDs do catálogo.
import catalog from '../server/catalog/pitty.json' with {type: 'json'};
import {parsePlaylistLink} from '../server/recognition.mjs';
import {validateOrder} from '../server/album-order.mjs';
import {readDeezer} from '../server/deezer.mjs';

const link = process.argv[2] || 'https://www.deezer.com/br/playlist/15975809523';
const albumId = catalog.providers.deezer.albumIds[0];

console.log('1) Álbum oficial', albumId);
try {
  const r = await fetch(`https://api.deezer.com/album/${albumId}/tracks?limit=50`);
  const body = await r.json();
  if (body.error) console.log('   A API respondeu com erro:', JSON.stringify(body.error));
  else {
    const got = body.data.map(t => String(t.id));
    const want = catalog.tracks.map(t => t.ids.deezer);
    console.log(`   ${got.length} faixas recebidas (total declarado: ${body.total})`);
    console.log(got.length === 13 && got.every((id, i) => id === want[i]) ? '   OK: os 13 IDs batem com o catálogo, na ordem do disco.' : '   ATENÇÃO: IDs diferentes do catálogo:\n   ' + got.join(', '));
  }
} catch (e) { console.log('   Sem resposta da API:', e.message); }

console.log('2) Playlist', link);
try {
  const playlist = parsePlaylistLink(link);
  const page = await readDeezer(playlist);
  const order = validateOrder(page.items, catalog, 'deezer');
  const names = new Map(catalog.tracks.map(t => [t.key, t.name]));
  console.log(`   OK: "${page.title}" seria aceita. Ordem:`);
  order.forEach((k, i) => console.log(`   ${i + 1}. ${names.get(k)}`));
} catch (e) {
  console.log('   Recusada:', e.message);
  for (const k of ['missing', 'extra', 'repeated']) if (e.details?.[k]?.length) console.log(`   ${k}:`, e.details[k].join(', '));
}
