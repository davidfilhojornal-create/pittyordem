# Atualizar a campanha no plano gratuito

Este pacote parte da versão com fotos e animações ligadas. Não crie outro banco.

## Conectar o endereço da Vercel

O frontend publicado está em `https://pittyordem.vercel.app`.

1. Baixe o código atualizado deste repositório (Code → Download ZIP) e copie os arquivos para a pasta atual do projeto, preservando seu `wrangler.jsonc` configurado.
2. No seu `wrangler.jsonc`, dentro do objeto `vars` já existente, adicione `"FRONTEND_ORIGINS": "https://pittyordem.vercel.app"`. Mantenha todas as outras variáveis e o mesmo banco D1. Confira as vírgulas entre as propriedades.
3. No painel Cloudflare → Turnstile → seu widget → Hostname Management, adicione `pittyordem.vercel.app`, sem `https://`. Preserve também o hostname antigo. Não é necessário gerar outra Secret Key.
4. Na pasta do projeto, execute um comando por vez:

```bat
npm ci
npm run build:cloudflare
npx wrangler deploy --assets ./public/audio-assets
```

A variável sozinha não basta se o Worker ainda estiver na versão antiga: publique também o código atualizado. Não crie outro banco nem cole o arquivo modelo sobre a configuração existente.

5. Abra a Vercel e recarregue a página. O catálogo e as playlists precisam carregar antes de testar um envio real. A validação Turnstile precisa terminar; não desative a proteção para contornar um erro.

## 1. Atualizar os arquivos

1. Extraia o ZIP e copie os arquivos para sua pasta atual do projeto.
2. Preserve seu `wrangler.jsonc` e `public/audio-assets/audio/`. O ZIP fornece `wrangler.modelo.jsonc`, portanto não substitui seu arquivo configurado.
3. Confira que seu `wrangler.jsonc` continua usando `name: pitty-na-sua-ordem`, o binding `DB` e o ID do banco já existente. Mantenha `DEEZER_MODE: on`.

## 2. Migrar e publicar

Abra `cmd` na pasta que contém `package.json`. Execute um comando por vez:

```bat
npm ci
npm test
npm run build:cloudflare
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy --assets ./public/audio-assets
```

A migração cria os contadores, gatilhos e índices. Não apaga os envios. Deve ser aplicada **antes** do novo código entrar no ar. Os envios antigos são incorporados automaticamente numa transação no primeiro acesso aos resultados ou primeiro envio aceito. Depois disso os gatilhos mantêm as contagens no mesmo salvamento da playlist, inclusive se o código anterior ainda estiver rodando durante uma atualização.

O build preserva os trechos de áudio e prepara scripts, fontes, imagens e ZIP como assets. Não coloque uma cópia do `index.html` ou arquivos de `/api/` dentro de `public/audio-assets`: HTML e API devem continuar no Worker.

Após publicar, abra `/api/results`. Deve responder com o total correto e `cacheSeconds: 60`. A aba Playlists mostra um envio aceito imediatamente; os resultados podem levar até um minuto. Não use novos envios de teste no banco público para medir carga.

## 3. Ativar Turnstile (requer configuração na sua conta)

Sem chaves o site mantém o limite por IP, mas a proteção Turnstile ainda não está ativa.

1. No painel Cloudflare, abra **Turnstile → Add widget / Adicionar widget**.
2. Nomeie como `Pitty — Na sua ordem`.
3. Adicione o hostname `pitty-na-sua-ordem.david-filhojornal.workers.dev`, sem `https://` nem caminho. Se usar outro domínio, adicione-o também.
4. Escolha **Managed / Gerenciado** e crie o widget.
5. Copie a **Site Key** (pública). Em `wrangler.jsonc`, mantenha as variáveis existentes e acrescente:

```json
"vars": {
  "DEEZER_MODE": "on",
  "TURNSTILE_SITE_KEY": "COLE_A_SITE_KEY_PUBLICA_AQUI",
  "TURNSTILE_REQUIRED": "true"
}
```

6. No terminal, execute:

```bat
npx wrangler secret put TURNSTILE_SECRET_KEY
```

Quando o Wrangler pedir o valor, cole a **Secret Key** direto no terminal e confirme. Não envie esse segredo pelo chat, não coloque em arquivos e não use chaves de teste para produção.

7. Publique novamente:

```bat
npx wrangler deploy --assets ./public/audio-assets
```

Se somente parte das chaves estiver configurada, o servidor bloqueia novos envios até a configuração estar completa. As playlists existentes e os resultados continuam acessíveis. O servidor confere o token com a Cloudflare e valida hostname e ação, além da origem, rate limit e duplicidade existentes.

## 4. Acompanhar limites reais

A otimização não remove as cotas gratuitas. Confira Workers e D1 no painel da sua conta, especialmente requisições diárias, linhas lidas e linhas escritas. Uma visita pode fazer várias chamadas à API; cada envio escreve a playlist, os contadores, os índices e o limite de tentativas. Cache e assets reduzem consumo, mas não garantem um número fixo de visitantes ou envios por dia.

O cache de resultados é de até 60 segundos por localidade da Cloudflare. Não é um cache global único; regiões diferentes podem consultar o banco separadamente. Assets só deixam de executar o Worker quando publicados com o argumento `--assets` e sem configurar `run_worker_first: true` para todos os caminhos.

## 5. Repetir o teste sem tocar no site público

```bat
npm run check:scale
```

Esse comando cria um banco SQLite somente na memória do computador, com 20 mil registros sintéticos e mil inserções adicionais. Compara as contagens com o cálculo antigo e exercita 200 requisições simultâneas atendidas pelo cache. Não usa login Cloudflare, não lê D1 remoto, não envia playlists e não é um teste de capacidade da rede Cloudflare. O tempo varia conforme o computador.
