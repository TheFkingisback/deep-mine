# Relatório de Deploy para Produção — Deep Mine

## Erro 1: `@shared/*` path aliases não resolvidos
**Sintoma**: `ERR_MODULE_NOT_FOUND: Cannot find package '@shared/equipment'`
**Causa**: TypeScript `paths` em `tsconfig.json` (`@shared/*`) são apenas para compilação — `tsc` não reescreve os imports no JS de saída.
**Fix**: Scripts pós-build que reescrevem os imports:
- `packages/shared/scripts/fix-extensions.js` — adiciona `.js` nos imports relativos (ESM exige extensão)
- `server/scripts/fix-imports.js` — troca `@shared/xyz` por `../../packages/shared/dist/xyz.js`

**Prevenção**: Sempre rodar `npm run build` (que inclui o pós-processamento), nunca `tsc` direto.

---

## Erro 2: Caminho do entry point errado
**Sintoma**: pm2 rodando `dist/server/src/main.js` em vez de `dist/main.js`
**Causa**: Build antigo com `rootDir` diferente gerava estrutura de pastas extra.
**Fix**: `pm2 delete deepmine && pm2 start dist/main.js --name deepmine`

**Prevenção**: Sempre usar `npm start` ou `pm2 start dist/main.js`. Verificar que `package.json` tem `"start": "node dist/main.js"`.

---

## Erro 3: CSP bloqueando WebSocket em produção
**Sintoma**: `Connecting to 'ws://107.155.122.86:9001/' violates Content Security Policy`
**Causa**: CSP tinha `ws://localhost:*` — só permitia localhost. Depois tentamos `ws://*` que não funciona com IPs (wildcards CSP só matcham domínios).
**Fix**: Usar scheme-source `ws:` (sem `//` nem `*`):
```
connect-src 'self' ws: wss: http: https:;
```

**Prevenção**: CSP wildcards (`*`) NÃO matcham endereços IP. Usar scheme-sources (`ws:`, `http:`) para permitir qualquer host.

---

## Erro 4: Service Worker servindo cache antigo
**Sintoma**: Mesmo após deploy, browser carrega JS antigo (mesmo hash no filename)
**Causa**: Service Worker (PWA) faz cache agressivo do HTML e assets.
**Fix**: Unregister todos os service workers + limpar caches:
```javascript
caches.keys().then(k => k.forEach(c => caches.delete(c)));
```

**Prevenção**: Em deploys, considerar versionamento do SW ou skip-waiting. Usuários podem precisar hard-refresh (Ctrl+Shift+R).

---

## Erro 5: `.env` com placeholders do template
**Sintoma**: `Can't reach database server at 'HOST:5432'`
**Causa**: `.env.example` foi copiado para `.env` sem editar os valores (`USER`, `PASSWORD`, `HOST`).
**Fix**:
```bash
echo 'DATABASE_URL="postgresql://deepmine:deepmine@localhost:5432/deepmine"' > server/.env
```

**Prevenção**: Sempre verificar o `.env` depois de copiar do `.env.example`. Nunca commitar `.env` no git.

---

## Erro 6: Prisma schema não encontrado
**Sintoma**: `Could not find Prisma Schema`
**Causa**: Rodar `npx prisma generate` fora da pasta `server/`.
**Fix**: Usar flag `--schema`:
```bash
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
```

**Prevenção**: Sempre rodar comandos Prisma de dentro de `server/`.

---

## Erro 7: Client não servido (porta 3000 vazia)
**Sintoma**: `ERR_CONNECTION_REFUSED` no browser
**Causa**: Ninguém subiu o client — só o server WebSocket rodava.
**Fix**:
```bash
cd client && npm run build
pm2 serve dist 3000 --name deepmine-client --spa
```

**Prevenção**: Deploy precisa de DOIS processos pm2: `deepmine` (server:9001) e `deepmine-client` (client:3000).

---

## Erro 8: Tela preta no logout
**Sintoma**: Clicar logout → tela preta
**Causa**: `switchScene('lobby')` não criava o lobby se `connection` era null.
**Fix**: Reconectar ao servidor antes de criar o lobby:
```typescript
if (!this.connection || !this.messageHandler) {
  await this.connectToServer();
}
```

**Prevenção**: Sempre ter fallback quando conexão é null.

---

## Erro 9: Erros de API mascarados
**Sintoma**: Todos os erros retornavam `{"error":"Invalid request"}` sem detalhes
**Causa**: `catch { }` sem logging.
**Fix**: `catch (err) { console.error('[API] Error:', err); ... }`

**Prevenção**: NUNCA engolir erros silenciosamente. Sempre logar `err` no catch.

---

## Checklist de Deploy (para o futuro)

```bash
# 1. Pull código
cd ~/deep-mine && git pull origin master

# 2. Build shared
cd packages/shared && npm install && npm run build

# 3. Build server
cd ../../server && npm install
npx prisma generate --schema=prisma/schema.prisma
npx prisma db push --schema=prisma/schema.prisma
npm run build

# 4. Verificar .env (NÃO pode ter placeholders!)
cat .env  # deve ter localhost, não HOST

# 5. Restart server
pm2 restart deepmine

# 6. Build client
cd ../client && npm install && npm run build

# 7. Restart client
pm2 restart deepmine-client

# 8. Verificar
curl http://localhost:9001/api/register -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"health@check.com","password":"test","firstName":"H","lastName":"C","nickname":"HC"}'
pm2 logs deepmine --lines 5
```
