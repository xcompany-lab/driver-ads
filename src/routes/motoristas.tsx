import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Car,
  Wallet,
  MapPin,
  ShieldCheck,
  Clock,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Camera,
  FileCheck,
  HandCoins,
  Route as RouteIcon,
  Users,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/Logo";
import logoFull from "@/assets/driver-ads-logo-full.png.asset.json";

export const Route = createFileRoute("/motoristas")({
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
      {/* NAV */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#020617]/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
          <Logo variant="light" size={36} />
          <div className="hidden md:flex items-center gap-8 text-sm text-white/70">
            <a href="#como-funciona" className="hover:text-white transition-colors">Como funciona</a>
            <a href="#beneficios" className="hover:text-white transition-colors">Benefícios</a>
            <a href="#ganhos" className="hover:text-white transition-colors">Quanto ganho</a>
            <a href="#requisitos" className="hover:text-white transition-colors">Requisitos</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" asChild>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button size="sm" variant="hero" asChild>
              <Link to="/auth/motorista">
                Quero ser parceiro <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative pt-28 pb-16 lg:pt-32 lg:pb-24 px-4 sm:px-6 overflow-hidden">
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
            <motion.div variants={fadeUp} className="flex flex-col items-center mb-8">
              <img
                src={logoFull.url}
                alt="Driver Ads"
                className="h-20 sm:h-24 md:h-28 w-auto object-contain drop-shadow-[0_8px_30px_rgba(22,120,255,0.35)]"
              />
              <span className="mt-3 text-[0.7rem] sm:text-xs font-semibold tracking-[0.32em] uppercase text-white/70">
                Sua mídia em movimento
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              custom={1}
              className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[0.98] tracking-tight mb-7"
            >
              Seu carro pode pagar <br className="hidden sm:block" />
              o próprio <span className="text-gradient-brand">combustível</span> <br />
              <span className="text-gradient-brand">— e muito mais.</span>
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
              <Button size="xl" variant="hero" asChild>
                <Link to="/auth/motorista">
                  Quero ganhar com meu carro <ArrowRight />
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
              className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-3xl mx-auto"
            >
              {[
                { v: "+5.000", l: "Motoristas parceiros" },
                { v: "100%", l: "Pagamento via PIX" },
                { v: "0", l: "Taxa de inscrição" },
                { v: "30 dias", l: "Ciclo de repasse" },
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

      {/* PROBLEM */}
      <section className="py-20 lg:py-28 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl sm:text-4xl font-bold mb-8"
            >
              Você roda o dia todo e o <span className="text-destructive">combustível só sobe</span>.
            </motion.h2>
            <motion.div
              variants={fadeUp}
              custom={1}
              className="space-y-4 text-lg text-white/70 max-w-2xl mx-auto"
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
                A Driver Ads transforma essa visibilidade em <span className="text-gradient-brand">dinheiro no seu PIX</span>.
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* SOLUTION */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 bg-gradient-to-b from-transparent via-[#0a1428]/60 to-transparent">
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
              Sua mídia em <span className="text-gradient-brand">movimento</span>.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={1}
              className="text-lg text-white/70 text-center max-w-3xl mx-auto mb-12"
            >
              A Driver Ads conecta marcas a motoristas como você. A gente cuida de tudo:
              campanhas, materiais, instalação e repasse mensal.
            </motion.p>
            <motion.div
              variants={fadeUp}
              custom={2}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto"
            >
              {[
                { icon: Car, label: "Cadastra seu veículo na plataforma" },
                { icon: FileCheck, label: "Vinculamos você a uma campanha ativa" },
                { icon: Camera, label: "Você instala e envia as fotos pelo app" },
                { icon: RouteIcon, label: "Dirige normalmente pela sua cidade" },
                { icon: HandCoins, label: "Recebe via PIX no fim de cada ciclo" },
                { icon: ShieldCheck, label: "Plataforma segura e em conformidade com a LGPD" },
              ].map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="glass-panel metallic-beam metallic-beam-slow flex items-center gap-3 p-4 rounded-2xl"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-medium text-white">{label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="como-funciona" className="py-20 lg:py-28 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <div className="grid md:grid-cols-3 gap-6">
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
                  desc: "Aplique o adesivo, mande as fotos de comprovação e receba mensalmente via PIX.",
                  icon: HandCoins,
                },
              ].map(({ step, title, desc, icon: Icon }, i) => (
                <motion.div
                  key={step}
                  variants={fadeUp}
                  custom={i}
                  className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm overflow-hidden group"
                >
                  <span className="absolute right-5 top-4 font-display text-5xl font-extrabold text-gradient-brand opacity-30">
                    {step}
                  </span>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand mb-5">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-2">{title}</h3>
                  <p className="text-sm text-white/70 leading-relaxed">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* BENEFITS */}
      <section
        id="beneficios"
        className="py-20 lg:py-28 px-4 sm:px-6 bg-gradient-to-b from-transparent via-[#0a1428]/60 to-transparent"
      >
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={stagger}
          >
            <motion.h2
              variants={fadeUp}
              className="font-display text-3xl sm:text-4xl font-bold text-center mb-16"
            >
              Por que ser um <span className="text-gradient-brand">motorista parceiro</span>
            </motion.h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: Wallet, title: "Renda extra mensal", desc: "Receba todo mês via PIX, sem complicação. Quanto mais campanhas, mais você ganha." },
                { icon: Car, title: "Sem mudar sua rotina", desc: "Continue dirigindo como sempre — para trabalhar, estudar ou levar a família." },
                { icon: ShieldCheck, title: "Adesivos seguros", desc: "Material de alta qualidade, fácil remoção e sem danos à pintura do veículo." },
                { icon: Clock, title: "Sem fidelidade", desc: "Sem multa, sem mensalidade. Encerre sua participação quando quiser." },
                { icon: TrendingUp, title: "Acompanhe seus ganhos", desc: "Painel completo no app: campanhas ativas, comprovações enviadas e histórico de repasses." },
                { icon: Users, title: "Suporte humano", desc: "Equipe pronta para te ajudar do cadastro à instalação dos adesivos." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  custom={i}
                  className="p-6 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm hover:border-brand-cyan/40 hover:bg-white/[0.06] transition-all"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-brand mb-4">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-lg font-bold mb-2">{title}</h3>
                  <p className="text-sm text-white/70">{desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* EARNINGS */}
      <section id="ganhos" className="py-20 lg:py-28 px-4 sm:px-6">
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
                  Quanto você pode ganhar
                </span>
              </motion.div>
              <motion.h2
                variants={fadeUp}
                custom={1}
                className="font-display text-3xl sm:text-4xl font-bold mb-6"
              >
                Ganhos previsíveis, <span className="text-gradient-brand">mês após mês</span>.
              </motion.h2>
              <motion.p variants={fadeUp} custom={2} className="text-white/70 mb-6">
                O valor varia de acordo com o tipo de campanha, o tamanho do adesivo e a região onde você roda.
                Você sempre sabe exatamente quanto vai receber antes de aceitar.
              </motion.p>
              <motion.ul variants={fadeUp} custom={3} className="space-y-3">
                {[
                  "Valores claros antes de aceitar a campanha",
                  "Repasse mensal direto no seu PIX",
                  "Acumule mais de uma campanha quando possível",
                  "Histórico completo dentro do app",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                    <CheckCircle2 className="h-4 w-4 text-brand-cyan mt-0.5 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </motion.ul>
            </div>

            <motion.div variants={fadeUp} custom={2} className="relative">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 space-y-4">
                {[
                  { label: "Adesivo lateral pequeno", value: "R$ 150", color: "text-brand-cyan" },
                  { label: "Adesivo lateral grande", value: "R$ 300", color: "text-white" },
                  { label: "Envelopamento traseiro", value: "R$ 450", color: "text-warning" },
                  { label: "Carro envelopado (full)", value: "R$ 800", color: "text-brand-cyan" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between p-4 rounded-xl bg-[#020617]/60 border border-white/5"
                  >
                    <span className="text-sm text-white/70">{label}</span>
                    <span className={`font-display text-2xl font-bold ${color}`}>{value}</span>
                  </div>
                ))}
                <p className="text-[11px] text-white/50 px-1 pt-1">
                  Valores ilustrativos. Ofertas reais dependem da campanha, do veículo e da região.
                </p>
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-electric/20 to-brand-cyan/20 blur-xl -z-10" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* REQUIREMENTS */}
      <section
        id="requisitos"
        className="py-20 lg:py-28 px-4 sm:px-6 bg-gradient-to-b from-transparent via-[#0a1428]/60 to-transparent"
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 mb-6">
              <ShieldCheck className="h-5 w-5 text-brand-cyan" />
              <span className="text-xs uppercase tracking-[0.28em] text-brand-cyan font-semibold">
                Requisitos
              </span>
            </motion.div>
            <motion.h2
              variants={fadeUp}
              custom={1}
              className="font-display text-3xl sm:text-4xl font-bold text-center mb-4"
            >
              O que você precisa para <span className="text-gradient-brand">começar</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              custom={2}
              className="text-white/70 text-center max-w-3xl mx-auto mb-12"
            >
              Cadastro simples e 100% digital — feito direto pelo celular em poucos minutos.
            </motion.p>

            <motion.div
              variants={fadeUp}
              custom={3}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {[
                { icon: FileCheck, title: "CNH ativa", desc: "Habilitação válida e regular. Aceitamos CNH digital em PDF." },
                { icon: Car, title: "Veículo em bom estado", desc: "Carro próprio, lavável, em boas condições de pintura e funilaria." },
                { icon: MapPin, title: "Cidade com campanhas", desc: "Você roda em uma região onde temos campanhas ativas." },
              ].map(({ icon: Icon, title, desc }, i) => (
                <motion.div
                  key={title}
                  variants={fadeUp}
                  custom={i}
                  className="p-6 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm"
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
      <section className="py-20 lg:py-28 px-4 sm:px-6">
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
              Motoristas já estão <span className="text-gradient-brand">faturando</span> com o próprio carro
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
                  className="p-6 rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm text-left"
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
      <section className="py-20 lg:py-28 px-4 sm:px-6">
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
              Pronto para transformar seu carro em <span className="text-gradient-brand">renda extra</span>?
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
                <Link to="/auth/motorista">
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
