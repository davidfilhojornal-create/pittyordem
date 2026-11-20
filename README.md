# Pitty — Na sua ordem

Código da campanha com setlists, cards de stories, fotos, animações e trechos de 30 segundos.

## Hospedagem

- **Vercel:** páginas estáticas e arquivos de imagem/áudio. Não recebe a Secret Key do Turnstile nem acesso ao banco.
- **Cloudflare Worker:** API de verificação, proteção Turnstile, limites por visitante e resultados.
- **Cloudflare D1:** mesmo banco existente; a migração para esta divisão não cria outro banco.
- **GitHub:** histórico e testes; a integração Git da Vercel publica o frontend.

O navegador consulta a API Cloudflare diretamente com CORS limitado a endereços exatos do projeto. Isso preserva o IP real visto pela Cloudflare. A API também verifica se o hostname do Turnstile corresponde ao frontend autorizado.

## Publicação da Vercel

Requisitos: Node 24 ou superior e npm. Build:

```sh
npm ci
npm test
npm run build
```

Configuração: `vercel.json`; saída `dist-vercel`; framework Other/nenhum. `PUBLIC_API_ORIGIN` é uma variável **pública** opcional de build (ao alterá-la, ajuste também `connect-src` em `vercel.json`); o padrão é `https://pitty-na-sua-ordem.david-filhojornal.workers.dev`.

Os 13 trechos preparados estão em `media/audio`, com cerca de 7,8 MB no total. O build confere o manifesto e os arquivos; nunca depende de uma pasta particular do computador do responsável. Não coloque as músicas inteiras no repositório. Arte e gravações não estão cobertas pela licença MIT do código.

A publicação depende do enquadramento permitido no plano Hobby e das cotas da conta. Este projeto não contrata plano ou banco pago automaticamente.

## Ativar o novo endereço na Cloudflare

1. Preserve o `wrangler.jsonc` da instalação atual. Ele não é versionado.
2. Copie os arquivos do projeto atualizado para essa instalação, mantendo sua configuração e suas chaves remotas.
3. Dentro de `vars`, acrescente `FRONTEND_ORIGINS` com o endereço **exato** aprovado da Vercel, por exemplo `https://pitty-na-sua-ordem.vercel.app`. Não use `*.vercel.app`. Para mais de um endereço, separe por vírgulas.
4. Mantenha `DEEZER_MODE`, `TURNSTILE_SITE_KEY`, `TURNSTILE_REQUIRED` e o binding D1 já configurados. O arquivo `wrangler.modelo.jsonc` é somente um exemplo.
5. Execute:

```sh
npm ci
npm run build:cloudflare
npx wrangler deploy --assets ./public/audio-assets
```

O build Cloudflare copia os trechos versionados para os assets. Não há nova migração nesta adaptação; quem ainda não instalou as migrações de agregação 0002/0003 deve aplicá-las antes, com `npx wrangler d1 migrations apply DB --remote`.

6. No widget Turnstile, adicione o hostname da Vercel, sem `https://` ou caminho. Mantenha o hostname antigo durante a transição. A Secret Key válida permanece no Worker; nunca a copie para o GitHub ou para o frontend.

O site antigo da Cloudflare continua funcionando no próprio domínio. Não configure redirecionamento nem remova o Worker antes de validar o novo site.

## Verificações

```sh
npm test
npm run build
npm run build:cloudflare
npm run check:hybrid
```

`check:hybrid` usa banco sintético em memória e respostas simuladas para música e Turnstile. Verifica preflight, origens, hostname, limites por visitante, envio, duplicidade e contadores. Não se conecta ao banco público.

Antes de liberar o endereço novo, confira no navegador: formulário Turnstile, um envio autorizado, nome e plataforma exibidos, resultados, áudio e download/compartilhamento do story. O preview pode renderizar antes da configuração Cloudflare, mas os envios só funcionarão após os passos de ativação acima. Previews aleatórios não ganham autorização automática para gravar no banco público.

Os segredos e backups não entram no Git. O diretório `dist-vercel` contém apenas arquivos públicos; servidor e migrações permanecem no repositório, fora da saída publicada pela Vercel.
