# Boraí — protótipo com BIA conectada ao Gemini

Este repositório contém o protótipo navegável do Boraí para GitHub Pages. A BIA conversa com o Gemini por meio de um Cloudflare Worker, mantendo a chave de API fora do site.

## Arquivos do site

- `index.html`: interface do aplicativo.
- `styles.css`: visual responsivo.
- `app.js`: navegação, rotas, preferências e conversa com a BIA.
- `manifest.webmanifest`, `sw.js` e `favicon.svg`: suporte básico a PWA.

## Publicar no GitHub Pages

1. Envie estes arquivos para a raiz da branch `main` (o `index.html` deve ficar na raiz, não dentro de uma subpasta).
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment**, selecione **Deploy from a branch**.
4. Em **Branch**, escolha `main` e a pasta `/(root)`, depois salve.
5. O endereço esperado é `https://borai992.github.io/borai-app/`.

## BIA e Cloudflare Worker

O site chama `https://borai-bia-api.contatoborai2026.workers.dev/chat`. A chave Gemini deve permanecer na Cloudflare como Secret `GEMINI_API_KEY`; nunca a coloque neste repositório nem no JavaScript do site.

O código atualizado do Worker é enviado em um arquivo TXT separado. Ele permite as origens `https://borai992.github.io` e `https://adriano277.github.io`. Após atualizar o Worker na Cloudflare, faça um teste na aba BIA.

Modelo configurado: `gemini-3.8-flash`, modelo estável documentado para a Gemini API. O protótipo não tem integração própria com bases oficiais de linhas, horários ou localização de veículos em tempo real; a BIA deve deixar isso claro e não inventar dados.

## Limites e privacidade

O uso da API está sujeito a cotas e condições do Google. Evite enviar dados pessoais ou sensíveis à BIA. Trajetos salvos e preferências ficam somente no armazenamento local deste navegador. Não há login ou cobrança real do Boraí+ nesta demonstração.
