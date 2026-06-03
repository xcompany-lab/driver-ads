## Diagnóstico

### 1) Por que o background da seção "Você roda o dia todo" não aparece

Bug real encontrado em `src/routes/motoristas.tsx`:

```text
<div className="dark min-h-screen bg-[#020617] ...">   ← wrapper raiz com fundo sólido
  ...
  <section className="relative overflow-hidden">
    <img className="absolute inset-0 -z-20 ..." />     ← cai ATRÁS do bg do wrapper
    <div className="absolute inset-0 -z-10 ..." />     ← idem (overlay invisível)
    <div className="relative ...">…texto…</div>
  </section>
</div>
```

A section não cria stacking context próprio (sem `isolate` ou `z-index` positivo), então `-z-10`/`-z-20` "atravessam" a section e ficam **atrás do `bg-[#020617]` do wrapper raiz**. Resultado: a imagem é carregada (já confere na rede), mas é pintada embaixo da cor sólida e nunca aparece. Hard refresh não muda isso — é o pintor do navegador, não cache.

### 2) De onde vem a lentidão

A página tem muitos efeitos legítimos que vamos **manter** (texto com gradiente animado, metallic beam, glass panels, glow radiais). O custo extra vem de:

- **Animações pintando fora da tela**: `metallic-beam` (conic-gradient + `@property --beam-angle`), `text-gradient-brand-flow` e `border-gradient-brand-flow` rodam em loop infinito em cards e títulos mesmo quando estão fora do viewport, forçando repaint constante.
- **Imagens não otimizadas**: o novo PNG do interior (304KB) é carregado em `eager` mesmo abaixo da dobra; o mockup do celular também está `loading="eager"`.
- **Restos do template remixado**: vários componentes/dep `shadcn` instalados que nunca são usados na rota `/motoristas` (sidebar, carousel, calendar, chart/recharts, drawer/vaul, day-picker, input-otp, resizable, etc.). Em produção Vite faz tree-shake, mas em **dev** o pre-bundle infla a página com centenas de módulos.
- **`NotificationBell.tsx`** solto em `src/components/` — herdado do remix, precisa confirmar se ainda é referenciado.
- **Plugin CSS `tw-animate-css`** importado em `styles.css` mas o site não usa as classes que ele entrega.

## Plano

### Parte A — Consertar o background (visual)

Em `src/routes/motoristas.tsx`, na seção PROBLEM:

1. Adicionar `isolate` à `<section>` para criar stacking context próprio.
2. Trocar `-z-20` (img) por `z-0` e `-z-10` (overlay) por `z-[1]`.
3. Adicionar `relative z-10` ao container de texto para garantir que ele fica acima do overlay.
4. Trocar `loading=` da imagem para `lazy` + `decoding="async"` + `width/height` explícitos para evitar CLS.

### Parte B — Limpar o "lixo do remix"

1. Verificar se `src/components/NotificationBell.tsx` é importado em algum lugar. Se não for, remover o arquivo.
2. Remover `@import "tw-animate-css"` do `src/styles.css` (não usamos suas classes) e remover a dep do `package.json`.
3. Remover dependências do `package.json` que **não são importadas por nenhum arquivo da `src/`**: candidatos a checar e cortar — `recharts`, `embla-carousel-react`, `vaul`, `react-day-picker`, `input-otp`, `react-resizable-panels`, `cmdk`, `date-fns`, `@radix-ui/react-context-menu`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-aspect-ratio`. Só removo o que comprovar não estar em uso. Apago também os arquivos `src/components/ui/*.tsx` correspondentes (calendar, chart, carousel, drawer, etc.).
4. Resultado: menos módulos no pre-bundle do Vite → preview e build mais leves e responsivos.

### Parte C — Otimizações de runtime (sem cortar efeitos)

1. **Pausar animações fora do viewport**: adicionar regra CSS usando `@media (prefers-reduced-motion)` + utilitário `[data-anim-paused="true"] .metallic-beam::before { animation-play-state: paused }` e, nos cards/seções que usam `metallic-beam` e `text-gradient-brand-flow`, marcar `data-anim-paused` quando `IntersectionObserver` reportar `isIntersecting=false`. Sem isso elas continuam repintando o tempo todo.
2. **`content-visibility: auto`** nas seções abaixo da dobra (`PROBLEM`, `como-funciona`, `ganhos`, `verificacao`, `social-proof`, `cta`) — o navegador pula layout/paint até estarem perto da viewport. Adicionar `contain-intrinsic-size` para evitar saltos de scroll.
3. **Imagens**: trocar o asset `bg-interior-motorista.png` por uma versão `.webp` ou `.jpg` otimizada (manter qualidade visual; PNG não é necessário aqui — não tem transparência). Mesmo tratamento para a logo se aplicável. Para o mockup do celular: `loading="lazy"`, `decoding="async"`.
4. **Re-validação do preload da logo**: confirmar que ela é mesmo o LCP. Se não for, remover o `rel=preload fetchpriority=high` para não competir com o CSS.
5. **Divider gradient**: trocar `h-px` (que colapsa os filhos `absolute`) por `h-[1px]` com `position: relative` real, garantindo que as linhas apareçam consistentes.

### Parte D — Verificação

1. Rebuildar, navegar para `/motoristas` no browser interno, scroll por todas as seções.
2. Conferir no DOM que o `<img>` do bg agora tem bounding box visível e aparece atrás do texto.
3. Rodar `browser--performance_profile` antes/depois para mostrar ganho em scripting/painting/long-tasks.
4. Conferir Console: zero novos warnings/errors.

## Detalhes técnicos

- Stacking context: `position: relative` sozinho **não** cria contexto novo a menos que `z-index !== auto` ou `isolation: isolate`. `overflow:hidden` também não cria. Daí o bug.
- `content-visibility: auto` precisa de `contain-intrinsic-size: <h> <w>` em cada seção para o scrollbar não pular durante leitura.
- Animações CSS continuam consumindo GPU/CPU mesmo fora do viewport — é por isso que `animation-play-state: paused` é a alavanca certa, não reduzir efeitos.
- Em dev, cada dep do `package.json` que aparece em algum `import` (mesmo indireto) entra no `optimizeDeps` do Vite. Cortar componentes shadcn não usados realmente acelera o dev/preview.
- Não tocaremos em `styles.css` além de remover o `@import` órfão; todos os utilitários `.text-gradient-brand-flow`, `.metallic-beam`, `.glass-panel`, `.border-gradient-brand-flow` continuam intactos.

## Fora de escopo

- Não vou reduzir intensidade/quantidade de gradientes, glows, beams ou drop-shadows — eles ficam como estão. A otimização é em **quando** eles pintam, não em **o que** eles pintam.
- Não vou mexer em conteúdo, copy, posicionamento de seções nem em outras rotas além da `/motoristas`.
