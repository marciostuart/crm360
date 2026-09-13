# CRM360 Web App

Aplicação full-stack segura do CRM360 em Next.js, isolada do PHP legado.

## Segurança e privacidade

- O banco desta aplicação é novo; o dump PHP antigo não é importado.
- Segredos são fornecidos somente por variáveis de ambiente e nunca pelo Git.
- Sessões usam token opaco aleatório; somente o hash do token é salvo no banco.
- Senhas usam bcrypt com custo 12 e bloqueio após cinco falhas.
- Tokens da Evolution e segredos legados de webhooks são criptografados com AES-256-GCM.
- Todas as rotas de dados filtram pelo `tenant_id` da sessão.
- Imagens de marca são validadas, redimensionadas e convertidas para WebP antes do armazenamento.

## Desenvolvimento

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run db:migrate
npm run dev
```

Use um banco novo de desenvolvimento. Nunca copie o `.env` do projeto PHP.

## Hostinger

- Build: `npm run build`
- Start: `npm run start`
- Configure as variáveis do `.env.example` no painel da Hostinger.
- Execute `npm run db:migrate` contra o banco antes do primeiro uso e após cada nova migração.
- O build usa `next build --webpack` por compatibilidade com ambientes Hostinger antigos.

## Acesso e identidade

- Admin: gerencia usuários, permissões, identidade visual, endpoints e operação.
- Gerente: administra a operação, CRM e conexões WhatsApp.
- Operador: atua no atendimento e nos contatos do tenant.

## Master Admin

O painel privado fica em `/master`, sem cadastro público, link na aplicação ou conteúdo empresarial sem autenticação. `X-Robots-Tag`, `robots.txt` e `Cache-Control: no-store` são aplicados à área; a proteção real é a autenticação independente.

Após aplicar as migrações, crie o primeiro acesso pelo terminal, sem informar a senha na linha de comando:

```bash
npm run master:create -- master@seudominio.com "Master Admin"
```

O script solicita a senha sem exibi-la e o acesso usa uma sessão separada do login dos tenants.

## Webhook de leads

Cada endpoint inicia em **TESTE**. O administrador informa os domínios autorizados, envia um payload e mapeia os caminhos exibidos para Nome, Telefone, E-mail, origem, observações e campos personalizados. O payload de teste fica somente como amostra e não cria contato. Tags fixas podem ser definidas no endpoint.

Depois do mapeamento, o administrador ativa o endpoint em **produção**. Nome e Telefone são obrigatórios. Em produção, o lead é criado/atualizado dentro do tenant correto e as tags do endpoint são combinadas com as tags do payload.

O webhook sem HMAC usa política de origem: o CRM valida o domínio informado em `Origin`, `Referer` ou `X-CRM-Source-Host`. Para integrações servidor-servidor, envie `X-CRM-Source-Host: integrador.exemplo.com.br`; o `Host` da requisição não identifica o remetente. Essa trava é um filtro de origem e não uma autenticação criptográfica, portanto não substitui HMAC, API key, mTLS ou allowlist de IP quando a origem não é controlada.

Ainda são obrigatórios `Idempotency-Key` e `X-M7-Nonce` para evitar duplicidade e replay acidental. Endpoints antigos continuam aceitando o HMAC legado enquanto a migração de configuração não é concluída.

## Webhook da Evolution

Cada conexão recebe identificador público aleatório e segredo independente. O segredo é enviado à Evolution somente como header customizado `X-M7-Evolution-Token`; nunca é colocado na URL, HTML ou resposta do CRM.

## Escopo desta fase

O Web App não executa agentes de IA, campanhas ou disparos em massa. O envio disponível é somente individual dentro de uma conversa autenticada.
