import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Car,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  FileCheck,
  HandCoins,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import logoFull from "@/assets/driver-ads-logo-full.png.asset.json";
import kitComAnuncio from "@/assets/kit-traseiro-com-anuncio.png.asset.json";
import kitSuaMarca from "@/assets/kit-traseiro-sua-marca.png.asset.json";
import phoneCadastroMockup from "@/assets/phone-cadastro-mockup.png.asset.json";
import phoneCampanhaMockup from "@/assets/phone-campanha-mockup.png.asset.json";
import bgInteriorMotorista from "@/assets/bg-interior-motorista.png.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Seja motorista parceiro — Driver Ads" },
      {
        name: "description",
        content:
          "Transforme seu carro em uma renda extra. Aplique adesivos publicitários no seu veículo, rode normalmente e receba todo mês via PIX.",
      },
      { property: "og:title", content: "Seja motorista parceiro — Driver Ads" },
      {
        property: "og:description",
        content:
          "Ganhe uma renda extra rodando com o seu carro. Sem mensalidades, sem fidelidade — você dirige, a gente paga.",
      },
    ],
    links: [
      { rel: "preload", as: "image", href: logoFull.url, fetchpriority: "high" },
      { rel: "preconnect", href: "https://play.tynk.ai" },
      { rel: "dns-prefetch", href: "https://play.tynk.ai" },
      { rel: "prerender", href: "https://play.tynk.ai/p/2af09e51-b86a-49f9-8d61-01a677c00647" },
    ],
  }),
  component: DriverLanding,
});

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.6,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  }),
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

function DriverLanding() {
  return (
    <div className="dark min-h-screen bg-[#020617] text-white overflow-x-hidden">

      {/* HERO */}
      <section className="relative pt-20 pb-10 lg:pt-20 lg:pb-14 px-4 sm:px-6 overflow-hidden">
        {/* Brand glows */}
        <div
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 18%, oklch(0.60 0.22 258 / 0.45), transparent 45%), radial-gradient(circle at 82% 60%, oklch(0.82 0.13 210 / 0.35), transparent 50%), radial-gradient(circle at 50% 100%, oklch(0.24 0.11 263 / 0.6), transparent 55%)",
          }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={stagger}>
            <motion.div variants={fadeUp} className="flex flex-col items-center mb-3">
              <img
                src={logoFull.url}
                alt="Driver Ads"
                width={720}
                height={288}
                fetchPriority="high"
                decoding="async"
                className="h-56 sm:h-64 md:h-72 lg:h-80 w-auto object-contain drop-shadow-[0_14px_50px_rgba(22,120,255,0.45)] -my-8 sm:-my-10 md:-my-12"
              />
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[0.98] tracking-tight mb-7"
            >
              Ganhe dinheiro exibindo <br className="hidden sm:block" />
              <span className="text-gradient-brand-flow">anúncios</span> durante <br />
              suas <span className="text-gradient-brand-flow">corridas</span>.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg sm:text-xl text-white/75 max-w-3xl mx-auto mb-9 leading-relaxed"
            >
              Aplique adesivos de campanhas publicitárias no seu veículo, dirija normalmente pela cidade
              e receba todo mês via PIX. Sem mensalidades, sem fidelidade.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              className="hidden sm:flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70 mb-10"
            >
              {[
                "Cadastro 100% online",
                "Instalação rápida",
                "Pagamento mensal via PIX",
                "Você continua rodando como sempre",
              ].map((item) => (
                <span key={item} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-brand-cyan" /> {item}
                </span>
              ))}
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={4}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Button
                size="xl"
                variant="hero"
                className="bg-gradient-brand-flow shadow-brand border-gradient-brand-flow"
                asChild
              >
                <Link to="/login">
                  Quero ganhar dinheiro com meu carro <ArrowRight />
                </Link>
              </Button>
              <Button
                size="xl"
                variant="outline"
                className="border-white/30 bg-white/5 text-white hover:bg-white hover:text-brand-night"
                asChild
              >
                <a href="#como-funciona">Ver como funciona</a>
              </Button>
            </motion.div>

            {/* Stat strip */}
            <motion.div
              variants={fadeUp}
              custom={5}
              className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto"
            >
              {[
                { v: "+1.000", l: "Motoristas parceiros" },
                { v: "100%", l: "Pagamento via PIX" },
                { v: "Grátis", l: "Taxa de inscrição" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="glass-panel metallic-beam metallic-beam-slow rounded-2xl p-4"
                >
                  <div className="font-display text-2xl sm:text-3xl font-bold text-gradient-brand">
                    {s.v}
                  </div>
                  <div className="text-[11px] sm:text-xs text-white/60 mt-1 uppercase tracking-wider">
                    {s.l}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Brand gradient divider */}
      <div aria-hidden="true" className="relative h-px w-full">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(0.60 0.22 258 / 0.6) 25%, oklch(0.82 0.13 210 / 0.9) 50%, oklch(0.60 0.22 258 / 0.6) 75%, transparent 100%)",
          }}
        />
        <div
          className="absolute inset-x-0 -top-2 h-4 blur-md opacity-70"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(0.60 0.22 258 / 0.5) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* PROBLEM */}
      <section className="relative isolate py-20 lg:py-28 px-4 sm:px-6 overflow-hidden cv-auto">
        {/* Background photo */}
        <img
          src={bgInteriorMotorista.url}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        />
        {/* Dark gradient overlay for legibility */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[1]"
          style={{
            background:
              "linear-gradient(180deg, #020617 0%, rgba(2,6,23,0.55) 25%, rgba(2,6,23,0.55) 75%, #020617 100%), linear-gradient(90deg, rgba(2,6,23,0.85) 0%, rgba(2,6,23,0.35) 50%, rgba(2,6,23,0.85) 100%)",
          }}
        />

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl sm:text-4xl font-bold mb-8 drop-shadow-[0_4px_30px_rgba(0,0,0,0.6)]"
            >
              Você roda o dia todo e o <span className="text-destructive">combustível só sobe</span>.
            </motion.h2>
            <motion.div
              variants={fadeUp}
              custom={1}
              className="space-y-4 text-lg text-white/85 max-w-2xl mx-auto drop-shadow-[0_2px_18px_rgba(0,0,0,0.6)]"
            >
              <p>
                Cada quilômetro rodado é um custo: gasolina, manutenção, desgaste.
                <br />
                Mas o seu carro também é <strong className="text-white">visto por milhares de pessoas</strong> todos os dias.
              </p>
              <p>
                Marcas pagam caro para aparecer nesses lugares — e quem deveria estar ganhando com isso é você.
              </p>
              <p className="text-white font-medium">
                A Driver Ads transforma essa visibilidade em <span className="text-gradient-brand-flow">dinheiro no seu PIX</span>.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Brand gradient divider */}
      <div aria-hidden="true" className="relative h-px w-full">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(0.60 0.22 258 / 0.6) 25%, oklch(0.82 0.13 210 / 0.9) 50%, oklch(0.60 0.22 258 / 0.6) 75%, transparent 100%)",
          }}
        />
      </div>

      {/* SOLUTION + HOW IT WORKS */}
      <section
        id="como-funciona"
        className="py-20 lg:py-28 px-4 sm:px-6 bg-gradient-to-b from-transparent via-[#0a1428]/60 to-transparent cv-auto"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl sm:text-4xl font-bold text-center mb-6"
            >
              Sua mídia em <span className="text-gradient-brand-flow">movimento</span>.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="text-lg text-white/70 text-center max-w-3xl mx-auto mb-14"
            >
              A Driver Ads conecta marcas a motoristas como você. A gente cuida de tudo:
              campanhas, materiais, instalação e repasse mensal.
            </motion.p>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {[
                {
                  step: "01",
                  title: "Cadastre-se",
                  desc: "Crie sua conta de motorista e envie os documentos do CNH e do veículo pelo app.",
                  icon: FileCheck,
                },
                {
                  step: "02",
                  title: "Receba sua campanha",
                  desc: "Nossa equipe vincula você a uma campanha ativa compatível com a sua cidade.",
                  icon: MapPin,
                },
                {
                  step: "03",
                  title: "Instale, rode e ganhe",
                  desc: "Aplique o kit, mande as fotos de comprovação e receba mensalmente via PIX.",
                  icon: HandCoins,
                },
              ].map(({ step, title, desc, icon: Icon }, i) => (
                <motion.div
                  key={step}
                  variants={fadeUp}
                  custom={i}
                  className="glass-panel metallic-beam relative isolate rounded-3xl p-7 pt-12 overflow-hidden group"
                >
                  {/* Inner radial accent tint — brand blue */}
                  <div
                    className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl opacity-60"
                    style={{
                      background:
                        "radial-gradient(circle, oklch(0.60 0.22 258) 0%, transparent 65%)",
                    }}
                  />
                  {/* Phone mockup decoration (steps 01 and 02) */}
                  {(step === "01" || step === "02") && (
                    <img
                      src={step === "01" ? phoneCadastroMockup.url : phoneCampanhaMockup.url}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="pointer-events-none select-none absolute top-4 right-4 z-0 w-1/2 max-w-[170px] opacity-60 brightness-125 contrast-125 saturate-125 drop-shadow-[0_10px_34px_rgba(56,189,248,0.65)] rotate-[8deg]"
                    />
                  )}
                  {/* Outlined giant step number watermark */}
                  <span
                    className={`absolute -top-2 right-4 z-0 font-display text-[7rem] leading-none font-black tracking-tighter pointer-events-none select-none ${step === "01" || step === "02" ? "opacity-15" : ""}`}
                    style={{
                      WebkitTextStroke: "1.5px rgba(255,255,255,0.12)",
                      color: "transparent",
                    }}
                  >
                    {step}
                  </span>
                  {/* Step pill */}
                  <div className="relative z-10 inline-flex items-center gap-2 mb-6">
                    <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/40" />
                    <span className="text-[10px] font-mono tracking-[0.32em] uppercase text-white/60">
                      Passo {step}
                    </span>
                  </div>
                  {/* Icon with dashed halo + glow — brand identity */}
                  <div className="relative z-10 mb-6 h-16 w-16">
                    <div className="absolute inset-0 rounded-full blur-2xl opacity-70 bg-brand-electric" />
                    <div className="absolute -inset-2 rounded-full border border-dashed border-brand-cyan/50 opacity-70 [animation:spin_20s_linear_infinite]" />
                    <div
                      className="relative h-16 w-16 rounded-2xl rotate-[8deg] ring-1 ring-inset ring-white/20 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.6)] flex items-center justify-center bg-gradient-brand"
                    >
                      <Icon className="h-7 w-7 text-white -rotate-[8deg]" strokeWidth={2.25} />
                    </div>
                  </div>
                  <h3 className="relative z-10 font-display text-xl font-bold mb-2 text-white">{title}</h3>
                  <p className="relative z-10 text-sm text-white/70 leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>





      {/* EARNINGS */}
      <section id="ganhos" className="py-20 lg:py-28 px-4 sm:px-6 cv-auto">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
            className="grid lg:grid-cols-2 gap-12 items-center"
          >
            <div>
              <motion.div variants={fadeUp} className="flex items-center gap-2 mb-6">
                <Sparkles className="h-3.5 w-3.5 text-brand-cyan" />
                <span className="text-xs uppercase tracking-[0.28em] text-brand-cyan font-semibold">
                  Modelo de exposição
                </span>
              </motion.div>
              <motion.h2
                variants={fadeUp}
                custom={1}
                className="font-display text-3xl sm:text-4xl font-bold mb-6"
              >
                Um único formato,{" "}
                <span className="text-gradient-brand-flow">simples e padronizado</span>.
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-white/70 mb-6">
                A Driver Ads trabalha com o <strong className="text-white">Kit Traseiro</strong>:
                adesivos aplicados no encosto dos bancos do motorista e do carona.
                A campanha é vista por cada passageiro que entra no veículo — alto impacto,
                instalação rápida e sem interferir no exterior do carro.
              </motion.p>
              <motion.ul variants={fadeUp} custom={3} className="space-y-3">
                {[
                  "Padrão único: sem confusão sobre tamanho ou posição",
                  "Instalação rápida, fácil remoção, sem dano ao tecido",
                  "Pagamento mensal via PIX assim que a comprovação é aprovada",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                    <CheckCircle2 className="h-4 w-4 text-brand-cyan mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </motion.ul>
            </div>

            <motion.div variants={fadeUp} custom={2} className="relative">
              <div className="glass-panel-strong metallic-beam rounded-3xl p-7 sm:p-9 overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-mono tracking-[0.32em] uppercase text-brand-cyan/90">
                    KIT.TRASEIRO / V1
                  </span>
                  <span className="text-[10px] font-mono tracking-[0.28em] uppercase text-white/40">
                    DRIVER ADS
                  </span>
                </div>

                {/* Two real kit-traseiro photos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {[
                    { src: kitSuaMarca.url, alt: "Kit traseiro sem anunciante" },
                    { src: kitComAnuncio.url, alt: "Kit traseiro com anunciante" },
                  ].map(({ src, alt }) => (
                    <div
                      key={alt}
                      className="relative aspect-square rounded-2xl overflow-hidden border border-white/15 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)]"
                    >
                      <img
                        src={src}
                        alt={alt}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { l: "Visualizações", v: "Alta" },
                    { l: "Instalação", v: "~10 min" },
                    { l: "Repasse", v: "Mensal" },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center"
                    >
                      <div className="font-display text-base font-bold text-white">{s.v}</div>
                      <div className="text-[10px] uppercase tracking-wider text-white/55 mt-0.5">
                        {s.l}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-brand-electric/20 to-brand-cyan/20 blur-xl -z-10" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section
        id="requisitos"
        className="py-20 lg:py-28 px-4 sm:px-6 bg-gradient-to-b from-transparent via-[#0a1428]/60 to-transparent cv-auto"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="text-center mb-12">
              <div className="inline-flex items-center gap-2 mb-4">
                <Sparkles className="h-3.5 w-3.5 text-brand-cyan" />
                <span className="text-xs uppercase tracking-[0.28em] text-brand-cyan font-semibold">
                  Cadastro descomplicado
                </span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                Verificação <span className="text-gradient-brand-flow">rápida</span> de cadastro
              </h2>
              <p className="text-white/70 max-w-2xl mx-auto">
                Em até <strong className="text-white">30 minutos</strong> nossa equipe analisa seu cadastro
                e libera você para receber a primeira campanha.
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={3}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {[
                { icon: FileCheck, title: "CNH ativa", desc: "Habilitação válida e regular. Aceitamos CNH digital em PDF." },
                { icon: Car, title: "Veículo com licenciamento em dia", desc: "CRLV atualizado e em nome do proprietário do cadastro." },
                { icon: ShieldCheck, title: "Comprovação de motorista", desc: "Print do app de mobilidade ou documento que confirme sua atividade como motorista." },
                { icon: HandCoins, title: "Horas dirigidas a trabalho", desc: "Comprovação das horas que você roda como motorista profissional." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  custom={i}
                  className="glass-panel metallic-beam p-6 rounded-2xl"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold mb-2">{title}</h3>
                  <p className="text-sm text-white/70">{desc}</p>
                </motion.div>
              ))}
            </motion.div>

            <motion.p
              variants={fadeUp}
              custom={4}
              className="text-sm text-white/60 text-center mt-10"
            >
              Seus dados são tratados conforme nossa{" "}
              <Link to="/privacidade" className="text-brand-cyan hover:underline">
                Política de Privacidade
              </Link>
              . O uso da plataforma está sujeito aos nossos{" "}
              <Link to="/termos" className="text-brand-cyan hover:underline">
                Termos de Uso
              </Link>
              .
            </motion.p>
          </motion.div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 cv-auto">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl sm:text-4xl font-bold mb-10"
            >
              Motoristas já estão <span className="text-gradient-brand-flow">faturando</span> com o próprio carro
            </motion.h2>
            <motion.div
              variants={fadeUp}
              custom={1}
              className="grid sm:grid-cols-3 gap-6"
            >
              {[
                {
                  quote:
                    "Coloquei o adesivo, segui minha rotina de motorista de app e no fim do mês veio um extra que pagou meu IPVA.",
                  name: "Rafael S.",
                  city: "São Paulo / SP",
                },
                {
                  quote:
                    "Cadastro foi tudo pelo celular, sem burocracia. O pagamento caiu certinho via PIX.",
                  name: "Juliana M.",
                  city: "Belo Horizonte / MG",
                },
                {
                  quote:
                    "Eu uso o carro pra trabalho e família. Não mudei nada na minha rotina e ainda ganho por mês.",
                  name: "Carlos D.",
                  city: "Curitiba / PR",
                },
              ].map((t) => (
                <div
                  key={t.name}
                  className="glass-panel metallic-beam metallic-beam-slow p-6 rounded-2xl text-left"
                >
                  <div className="flex gap-0.5 mb-3 text-brand-cyan">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed mb-4">"{t.quote}"</p>
                  <div className="text-sm font-semibold text-white">{t.name}</div>
                  <div className="text-xs text-white/55">{t.city}</div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 cv-auto">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
            className="relative rounded-3xl border border-white/10 bg-gradient-night p-10 sm:p-14 text-center overflow-hidden"
          >
            <div className="absolute inset-0 opacity-30 pointer-events-none [background-image:radial-gradient(circle_at_20%_20%,oklch(0.82_0.13_210/_0.5),transparent_45%),radial-gradient(circle_at_80%_80%,oklch(0.60_0.22_258/_0.6),transparent_50%)]" />
            <motion.h2
              variants={fadeUp}
              className="relative font-display text-3xl sm:text-4xl font-bold mb-6"
            >
              Pronto para transformar seu carro em <span className="text-gradient-brand-flow">renda extra</span>?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="relative text-lg text-white/75 mb-10"
            >
              Cadastro gratuito e 100% online. Em poucos minutos você está pronto para receber sua primeira campanha.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="relative">
              <Button size="xl" variant="hero" asChild>
                <Link to="/login">
                  Quero ser parceiro Driver Ads <ArrowRight />
                </Link>
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/10 py-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <Logo variant="light" size={32} />
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/60">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Sem mensalidade</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Sem fidelidade</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Pagamento via PIX</span>
            </div>
            <div className="flex gap-4 text-xs text-white/60">
              <Link to="/termos" className="hover:text-white transition-colors">Termos de Uso</Link>
              <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 text-center">
            <p className="text-xs text-white/50">
              © {new Date().getFullYear()} Driver Ads — Sua mídia em movimento.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
