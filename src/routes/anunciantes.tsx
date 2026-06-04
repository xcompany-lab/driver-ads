import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Target,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  BarChart3,
  Megaphone,
  Star,
  Users,
  Eye,
  Rocket,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import logoFull from "@/assets/driver-ads-logo-full.png.asset.json";
import kitComAnuncio from "@/assets/kit-traseiro-com-anuncio.png.asset.json";
import kitSuaMarca from "@/assets/kit-traseiro-sua-marca.png.asset.json";
import phoneCadastroMockup from "@/assets/phone-cadastro-mockup.png.asset.json";
import phoneCampanhaMockup from "@/assets/phone-campanha-mockup.png.asset.json";
import bgInteriorMotorista from "@/assets/bg-interior-motorista.png.asset.json";

export const Route = createFileRoute("/anunciantes")({
  head: () => ({
    meta: [
      { title: "Anuncie com a Driver Ads — Mídia em movimento que entrega resultado" },
      {
        name: "description",
        content:
          "Coloque sua marca dentro dos veículos que circulam pela cidade. Campanhas geolocalizadas, alto impacto e relatórios de comprovação — sem complicação.",
      },
      { property: "og:title", content: "Anuncie com a Driver Ads" },
      {
        property: "og:description",
        content:
          "Mídia em movimento de alto impacto. Sua marca dentro dos carros de aplicativo, com comprovação fotográfica e gestão completa pela Driver Ads.",
      },
    ],
    links: [
      { rel: "preload", as: "image", href: logoFull.url, fetchpriority: "high" },
    ],
  }),
  component: AdvertiserLanding,
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

function AdvertiserLanding() {
  return (
    <div className="dark min-h-screen bg-[#020617] text-white overflow-x-hidden">

      {/* HERO */}
      <section className="relative pt-20 pb-10 lg:pt-20 lg:pb-14 px-4 sm:px-6 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 18%, oklch(0.60 0.22 258 / 0.45), transparent 45%), radial-gradient(circle at 82% 60%, oklch(0.82 0.13 210 / 0.35), transparent 50%), radial-gradient(circle at 50% 100%, oklch(0.24 0.11 263 / 0.6), transparent 55%)",
          }}
        />
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
              Sua marca rodando pela <br className="hidden sm:block" />
              <span className="text-gradient-brand-flow">cidade inteira</span>, todos <br />
              os <span className="text-gradient-brand-flow">dias</span>.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-lg sm:text-xl text-white/75 max-w-3xl mx-auto mb-9 leading-relaxed"
            >
              Anuncie dentro de carros de aplicativo que circulam por toda a sua região. Alto impacto,
              público qualificado, comprovação fotográfica e gestão completa — você só pensa na campanha.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              className="hidden sm:flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70 mb-10"
            >
              {[
                "Campanhas geolocalizadas",
                "Comprovação fotográfica mensal",
                "Sem contratos longos",
                "Acompanhamento em tempo real",
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
                <Link to="/auth/anunciante">
                  Quero anunciar com a Driver Ads <ArrowRight />
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

            <motion.div
              variants={fadeUp}
              custom={5}
              className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-3xl mx-auto"
            >
              {[
                { v: "+1.000", l: "Veículos disponíveis" },
                { v: "100%", l: "Comprovação fotográfica" },
                { v: "Multi", l: "Cidades atendidas" },
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
        <img
          src={bgInteriorMotorista.url}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 z-0 h-full w-full object-cover object-center"
        />
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
              Mídia tradicional é cara, <span className="text-destructive">parada e difícil de medir</span>.
            </motion.h2>
            <motion.div
              variants={fadeUp}
              custom={1}
              className="space-y-4 text-lg text-white/85 max-w-2xl mx-auto drop-shadow-[0_2px_18px_rgba(0,0,0,0.6)]"
            >
              <p>
                Outdoor fica em um único ponto. Mídia digital é saturada e você disputa atenção com mil outras marcas.
                <br />
                E na hora de provar entrega, <strong className="text-white">você recebe um print e um relatório genérico</strong>.
              </p>
              <p>
                Enquanto isso, milhares de carros de aplicativo passam por pontos estratégicos da cidade —
                <strong className="text-white"> dentro deles, passageiros olham diretamente para o encosto do banco</strong>.
              </p>
              <p className="text-white font-medium">
                A Driver Ads transforma esse espaço em <span className="text-gradient-brand-flow">mídia de alto impacto comprovada</span>.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <div aria-hidden="true" className="relative h-px w-full">
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, oklch(0.60 0.22 258 / 0.6) 25%, oklch(0.82 0.13 210 / 0.9) 50%, oklch(0.60 0.22 258 / 0.6) 75%, transparent 100%)",
          }}
        />
      </div>

      {/* HOW IT WORKS */}
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
              Da ideia ao <span className="text-gradient-brand-flow">carro rodando</span> em poucos dias.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="text-lg text-white/70 text-center max-w-3xl mx-auto mb-14"
            >
              Você nos conta o objetivo da campanha e a região. A Driver Ads cuida da arte, da produção dos kits,
              da instalação nos motoristas parceiros e da comprovação mensal.
            </motion.p>

            <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
              {[
                {
                  step: "01",
                  title: "Briefing da campanha",
                  desc: "Crie sua conta de anunciante, conte o objetivo e a região-alvo. Nossa equipe monta a proposta ideal.",
                  icon: Megaphone,
                },
                {
                  step: "02",
                  title: "Produção e instalação",
                  desc: "A gente produz os kits e distribui aos motoristas parceiros da sua região com instalação validada.",
                  icon: Rocket,
                },
                {
                  step: "03",
                  title: "Comprovação e resultados",
                  desc: "Receba fotos de instalação, relatórios de circulação e acompanhe a campanha pelo painel.",
                  icon: BarChart3,
                },
              ].map(({ step, title, desc, icon: Icon }, i) => (
                <motion.div
                  key={step}
                  variants={fadeUp}
                  custom={i}
                  className="glass-panel metallic-beam relative isolate rounded-3xl p-7 pt-12 overflow-hidden group"
                >
                  <div
                    className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full blur-3xl opacity-60"
                    style={{
                      background:
                        "radial-gradient(circle, oklch(0.60 0.22 258) 0%, transparent 65%)",
                    }}
                  />
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
                  <span
                    className={`absolute -top-2 right-4 z-0 font-display text-[7rem] leading-none font-black tracking-tighter pointer-events-none select-none ${step === "01" || step === "02" ? "opacity-15" : ""}`}
                    style={{
                      WebkitTextStroke: "1.5px rgba(255,255,255,0.12)",
                      color: "transparent",
                    }}
                  >
                    {step}
                  </span>
                  <div className="relative z-10 inline-flex items-center gap-2 mb-6">
                    <span className="h-px w-8 bg-gradient-to-r from-transparent to-white/40" />
                    <span className="text-[10px] font-mono tracking-[0.32em] uppercase text-white/60">
                      Passo {step}
                    </span>
                  </div>
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

      {/* FORMAT */}
      <section id="formato" className="py-20 lg:py-28 px-4 sm:px-6 cv-auto">
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
                  Formato de mídia
                </span>
              </motion.div>
              <motion.h2
                variants={fadeUp}
                custom={1}
                className="font-display text-3xl sm:text-4xl font-bold mb-6"
              >
                Kit Traseiro:{" "}
                <span className="text-gradient-brand-flow">olho-no-olho com cada passageiro</span>.
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-white/70 mb-6">
                Sua marca é aplicada no <strong className="text-white">encosto dos bancos dianteiros</strong> —
                o ponto onde todo passageiro de aplicativo passa, em média, <strong className="text-white">15 a 30 minutos</strong> olhando.
                Atenção real, sem disputa de feed.
              </motion.p>
              <motion.ul variants={fadeUp} custom={3} className="space-y-3">
                {[
                  "Audiência cativa em ambiente fechado e silencioso",
                  "Formato padronizado: produção rápida e custo previsível",
                  "Comprovação fotográfica mensal de cada veículo ativo",
                  "Segmentação por cidade e região de circulação",
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {[
                    { src: kitSuaMarca.url, alt: "Espaço aguardando sua marca" },
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
                    { l: "Atenção", v: "Cativa" },
                    { l: "Tempo médio", v: "15-30 min" },
                    { l: "Comprovação", v: "Mensal" },
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

      {/* WHY DRIVER ADS */}
      <section
        id="por-que"
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
                  Por que Driver Ads
                </span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                Mídia que <span className="text-gradient-brand-flow">se mexe</span> e <span className="text-gradient-brand-flow">se comprova</span>
              </h2>
              <p className="text-white/70 max-w-2xl mx-auto">
                Tudo que você precisa para rodar uma campanha de mídia OOH moderna — sem agências longas e sem orçamentos opacos.
              </p>
            </motion.div>

            <motion.div
              variants={fadeUp}
              custom={3}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {[
                { icon: Target, title: "Segmentação por região", desc: "Escolha bairros e cidades onde sua marca precisa ser vista." },
                { icon: Users, title: "Público qualificado", desc: "Passageiros de aplicativo dentro de carros, em ambiente sem distração." },
                { icon: Eye, title: "Alto tempo de exposição", desc: "Cada passageiro fica em média 15-30 minutos olhando para a peça." },
                { icon: BarChart3, title: "Comprovação real", desc: "Fotos de instalação e relatórios mensais por veículo." },
                { icon: MapPin, title: "Cobertura urbana", desc: "Centenas de veículos rodando por dia em áreas estratégicas." },
                { icon: ShieldCheck, title: "Sem contratos longos", desc: "Modelo flexível por ciclo de campanha, sem fidelidade obrigatória." },
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
              Marcas que já estão <span className="text-gradient-brand-flow">rodando pela cidade</span>
            </motion.h2>
            <motion.div
              variants={fadeUp}
              custom={1}
              className="grid sm:grid-cols-3 gap-6"
            >
              {[
                {
                  quote:
                    "A comprovação fotográfica resolveu nossa maior dor com OOH. Saímos do achismo e fomos para o dado.",
                  name: "Mariana T.",
                  city: "Diretora de Marketing — Varejo",
                },
                {
                  quote:
                    "Conseguimos ativar só os bairros que importam para nosso lançamento. Custo controlado e foco total.",
                  name: "Eduardo P.",
                  city: "Head de Growth — SaaS",
                },
                {
                  quote:
                    "Equipe ágil, do briefing à instalação em poucos dias. Sem agência travando o processo.",
                  name: "Bianca L.",
                  city: "Gerente de Marca — Food",
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
              Pronto para colocar sua marca <span className="text-gradient-brand-flow">para rodar</span>?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="relative text-lg text-white/75 mb-10"
            >
              Cadastro gratuito. Em poucos minutos nosso time entra em contato para desenhar a sua primeira campanha.
            </motion.p>
            <motion.div variants={fadeUp} custom={2} className="relative">
              <Button size="xl" variant="hero" asChild>
                <Link to="/auth/anunciante">
                  Quero anunciar com a Driver Ads <ArrowRight />
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
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Comprovação fotográfica</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Sem fidelidade</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Gestão completa</span>
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
