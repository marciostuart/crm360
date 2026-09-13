# CRM360 Web App

Nova implementação segura do CRM360 em Next.js full-stack, isolada do PHP legado.

## Princípios de segurança

- O banco desta aplicação é novo; o dump PHP antigo não é importado.
- Segredos são fornecidos somente por variáveis de ambiente e nunca pelo Git.
- Sessões usam token opaco aleatório; somente o hash HMAC do token é salvo no banco.
- Senhas usam bcrypt com custo 12 e bloqueio após cinco falhas.
- Tokens da Evolution e segredos de webhooks são criptografados com AES-256-GCM.
- Webhooks de leads exigem HMAC-SHA256, timestamp, nonce e `Idempotency-Key`.
- Respostas e logs não incluem senha, token, chave API ou payload completo desnecessariamente.

## Desenvolvimento

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run db:migrate
npm run dev
```

O `.env` deve conter credenciais de um banco novo de desenvolvimento. Nunca copie o `.env` do projeto PHP.

## Hostinger

- Build: `npm run build`
- Start: `npm run start`
- Diretório de saída: `.next` (gerenciado pelo Next.js)
- Configure todas as variáveis do `.env.example` no painel da Hostinger.
- Execute a migração contra o banco novo antes do primeiro uso.

## Webhook de leads

Crie um endpoint autenticado com `POST /api/integrations/leads/endpoints`. O segredo retornado é exibido uma única vez.

Assine o corpo bruto:

```text
HMAC_SHA256(secret, timestamp + "." + nonce + "." + raw_body)
```

Envie a assinatura no formato `sha256=<hexadecimal>` no header `X-M7-Signature`.

## Webhook da Evolution

Cada conexão recebe um identificador público aleatório e um segredo independente. O segredo é enviado à Evolution somente como header customizado `X-M7-Evolution-Token`; nunca é colocado na URL, HTML ou resposta do CRM. O endpoint aceita somente eventos autenticados de mensagens e atualizações de conexão.

## Escopo desta fase

O Web App não executa agentes de IA, campanhas ou disparos em massa. O envio disponível é somente individual dentro de uma conversa autenticada.
