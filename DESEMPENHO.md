# Ensaio local — otimização para a campanha

Banco SQLite em memória, sem acesso ao banco público. Medidas em uma máquina de desenvolvimento; não são capacidade garantida na Cloudflare, nem consumo faturado do D1.

- Registros sintéticos: 21,000.
- Incorporação inicial dos 20 mil registros existentes: 814.54 ms.
- Inserção com contadores transacionais: média 0.36 ms em mil inserções locais.
- Resultado pelo método anterior (leitura completa + cálculo): 391.96 ms.
- Resultado pelos contadores: 1.23 ms.
- 200 requisições à lógica de cache em paralelo: 23.79 ms no total e zero consultas ao banco.
- Resposta dos resultados: 6960 bytes.
- Contadores de posições: 169; de pares: 156.
- Sequências devolvidas: no máximo 10.

As distribuições e médias foram comparadas com o cálculo anterior para toda a base. Os testes incluem duplicidade, rollback, edição e exclusão, incorporação de dados antigos, paginação por índice, aquecimento concorrente e indisponibilidade do cache. Tokens Turnstile rejeitados não passam para a leitura da plataforma nem para a gravação da playlist.

Para repetir: `npm run check:scale`. O banco é criado somente em memória e descartado. Não há chamadas à Cloudflare nesse comando.

## Limites da verificação

Este ensaio não mede rede, múltiplos data centers, bloqueios de Spotify/Apple/Deezer, cache real da Cloudflare, widget Turnstile real nem cotas de Workers e D1. Ative o widget em produção e faça a verificação do fluxo no navegador depois de configurar as chaves. As chaves de teste dos testes automatizados são simuladas e não são usadas em produção.

A migração e o novo Worker foram verificados com banco local; a publicação na conta Cloudflare do responsável deve aplicar as migrações antes do código. O primeiro acesso aos resultados pode demorar mais enquanto incorpora dados antigos.
