import { useState } from "react";
import { Archive, ArrowUpRight, BookOpen, Check, ChevronRight, CircleDot, Coins, Compass, Gem, Package, Play, Shield, Sparkles, Swords, Trophy, UserRound, X, Zap } from "lucide-react";
import "./ThresholdCommandVariant.css";

type Hero = {
  id: string;
  initial: string;
  name: string;
  role: string;
  faction: string;
  color: string;
  hp: number;
  mana: number;
  passive: string;
};

type Panel = "campaign" | "journal" | "arsenal";

const heroes: Hero[] = [
  { id: "moss", initial: "M", name: "Colosso de Musgo", role: "Vanguarda", faction: "Despertos", color: "#77bd71", hp: 145, mana: 70, passive: "Casca Antiga · recebe menos dano" },
  { id: "thorn", initial: "T", name: "Espreitador de Espinhos", role: "Atirador", faction: "Despertos", color: "#d978a8", hp: 94, mana: 115, passive: "Predador · dano extra em alvos marcados" },
  { id: "neon", initial: "N", name: "Lâmina Neon", role: "Duelista", faction: "Consórcio", color: "#d0ee61", hp: 96, mana: 105, passive: "Sobrecarga · críticos restauram mana" },
  { id: "bio", initial: "B", name: "Engenheiro Biossonda", role: "Artífice", faction: "Consórcio", color: "#68d8cb", hp: 108, mana: 145, passive: "Circuito fechado · cooldowns mais rápidos" },
];

const missions = [
  { id: "frontiers", kicker: "Missão ativa", title: "Mapa das quatro fronteiras", body: "Explore as Florestas Brilhantes e volte com uma rota segura.", progress: 1, goal: 4, reward: "120 XP · título Cartógrafo", accent: "cyan" },
  { id: "eclipse", kicker: "Evento semanal", title: "Eclipse sobre o vale", body: "Caçe as Faíscas do Eclipse antes que a noite mude de lugar.", progress: 8, goal: 12, reward: "Título Vigia do Eclipse", accent: "gold" },
  { id: "ranking", kicker: "Companhias", title: "Oitavo lugar", body: "420 XP separam sua companhia da próxima marca do mapa.", progress: 8, goal: 24, reward: "Posição 08 / 24", accent: "violet" },
];

export function ThresholdCommandVariant() {
  const [hero, setHero] = useState(heroes[0]);
  const [panel, setPanel] = useState<Panel>("campaign");
  const [selectedMission, setSelectedMission] = useState(missions[0]);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [notice, setNotice] = useState("");

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const selectMission = (mission: typeof missions[number]) => {
    setSelectedMission(mission);
    notify(`${mission.title} agora está em foco.`);
  };

  return (
    <main className="threshold-command">
      <div className="threshold-shell">
        <header className="threshold-topbar">
          <div className="threshold-brand">
            <span className="threshold-mark">G</span>
            <div>
              <strong>PROJECT GENESIS</strong>
              <small>Arquivo de fronteira · 09</small>
            </div>
          </div>
          <div className="threshold-location">
            <span className="status-dot" />
            Vila do Limiar
            <small>04.17 · noite 12</small>
          </div>
          <div className="threshold-account">
            <button className="threshold-profile" type="button" onClick={() => setRosterOpen(true)} aria-label="Trocar explorador">
              <span className="threshold-avatar" style={{ borderColor: hero.color, color: hero.color }}>{hero.initial}</span>
              <span>
                <strong>{hero.name}</strong>
                <small>Nível 07 · {hero.role}</small>
              </span>
              <UserRound size={14} aria-hidden="true" />
            </button>
            <div className="threshold-wallet" aria-label="Recursos">
              <span><Gem size={13} aria-hidden="true" />248</span>
              <span><Zap size={13} aria-hidden="true" />64</span>
            </div>
          </div>
        </header>

        <nav className="threshold-nav" aria-label="Navegação de campanha">
          <button className={panel === "campaign" ? "active" : ""} type="button" onClick={() => setPanel("campaign")}><Compass size={14} aria-hidden="true" /> Comando</button>
          <button className={panel === "journal" ? "active" : ""} type="button" onClick={() => setPanel("journal")}><BookOpen size={14} aria-hidden="true" /> Diário <span>03</span></button>
          <button className={panel === "arsenal" ? "active" : ""} type="button" onClick={() => setPanel("arsenal")}><Swords size={14} aria-hidden="true" /> Arsenal</button>
          <button className="threshold-nav-season" type="button" onClick={() => notify("Eclipse semanal · 12 dias restantes.")}><Sparkles size={13} aria-hidden="true" /> Eclipse semanal <ChevronRight size={13} aria-hidden="true" /></button>
        </nav>

        {panel === "campaign" ? (
          <div className="threshold-content">
            <section className="threshold-hero">
              <div className="threshold-eyebrow"><span>Registro de expedição</span><i /> fronteira norte</div>
              <h1>O mundo não<br /><em>terminou.</em></h1>
              <p className="threshold-lede">Ele mudou de forma. Reúna sua companhia, atravesse as quatro fronteiras e descubra o que acordou sob a vila.</p>
              <div className="threshold-hero-actions">
                <button className="threshold-primary" type="button" onClick={() => { setArmed(true); notify(`Expedição armada para ${hero.name}.`); }}>
                  {armed ? "Expedição armada" : "Continuar campanha"} <Play size={15} fill="currentColor" aria-hidden="true" />
                </button>
                <button className="threshold-text-button" type="button" onClick={() => setRosterOpen(true)}>Trocar explorador <ArrowUpRight size={14} aria-hidden="true" /></button>
              </div>

              <div className="threshold-map">
                <div className="map-grid" aria-hidden="true" />
                <div className="map-rings" aria-hidden="true" />
                <span className="map-label map-label-forest">Florestas brilhantes</span>
                <span className="map-label map-label-ice">Geleira do silêncio</span>
                <span className="map-label map-label-cinder">Caldeira rubra</span>
                <span className="map-label map-label-village">Vila do limiar</span>
                <span className="map-route map-route-a" aria-hidden="true" />
                <span className="map-route map-route-b" aria-hidden="true" />
                <button className="map-node node-village" type="button" onClick={() => notify("Vila do Limiar · refúgio seguro")}><CircleDot size={12} aria-hidden="true" /><span>01</span></button>
                <button className="map-node node-forest" type="button" onClick={() => { setSelectedMission(missions[0]); notify("Rota focada: Florestas Brilhantes."); }}><span>02</span></button>
                <button className="map-node node-ice" type="button" onClick={() => notify("Geleira do Silêncio · região bloqueada")}><span>03</span></button>
                <button className="map-node node-cinder" type="button" onClick={() => notify("Caldeira Rubra · região bloqueada")}><span>04</span></button>
                <div className="map-compass"><span>N</span><i /></div>
                <div className="map-caption"><span>Rota regional</span><strong>01 / 04 regiões</strong></div>
              </div>
            </section>

            <aside className="threshold-rail" aria-label="Resumo da campanha">
              <div className="rail-heading">
                <div><span>Próximo passo</span><h2>O caderno de bordo</h2></div>
                <strong>03 <small>/ 12</small></strong>
              </div>
              <div className="mission-list">
                {missions.map((mission) => (
                  <button key={mission.id} className={`mission-tile ${selectedMission.id === mission.id ? "selected" : ""} ${mission.accent}`} type="button" onClick={() => selectMission(mission)}>
                    <span className="mission-topline"><span>{mission.kicker}</span><i>{mission.progress} / {mission.goal}</i></span>
                    <strong>{mission.title}</strong>
                    <small>{mission.body}</small>
                    <span className="mission-progress"><i style={{ width: `${(mission.progress / mission.goal) * 100}%` }} /></span>
                  </button>
                ))}
              </div>
              <div className="rail-reward">
                <span>Recompensa da próxima etapa</span>
                <strong>{selectedMission.reward}</strong>
              </div>
              <div className="rail-status"><span className="status-dot" /> <strong>Progresso salvo</strong> · último registro há 2 min</div>
            </aside>
          </div>
        ) : (
          <section className="threshold-utility">
            <div className="utility-heading"><span>{panel === "journal" ? "Registro 03 / 12" : "Equipamento de campo"}</span><h1>{panel === "journal" ? "Diário de bordo" : "Arsenal"}</h1><p>{panel === "journal" ? "As raízes apontam para o norte. O som que vem de baixo não é vento." : "A ferrugem não é um problema quando o mapa é bom. Seu equipamento acompanha o nível 07."}</p></div>
            <div className="utility-grid">
              {panel === "journal" ? (
                <>
                  <article className="utility-card utility-card-wide"><span>Missão atual</span><strong>Mapa das quatro fronteiras</strong><small>Explore as Florestas Brilhantes e volte com uma rota segura.</small><div className="utility-bar"><i style={{ width: "25%" }} /></div></article>
                  <article className="utility-card"><span>Descobertas</span><strong>07 / 20</strong><small>Alguns lugares só existem depois que alguém os encontra.</small></article>
                  <article className="utility-card"><span>Próximo destino</span><strong>Florestas Brilhantes</strong><small>Rota segura disponível · 120 XP</small></article>
                </>
              ) : (
                <>
                  <article className="utility-card utility-card-wide"><span>Arma equipada</span><strong>Lâmina de aço <b>III</b></strong><small>Incomum · poder +3 · pronta para a próxima fronteira.</small><div className="item-line"><Swords size={16} aria-hidden="true" /><i /><i /><i /></div></article>
                  <article className="utility-card"><span>Armadura</span><strong>Cota de malha</strong><small>Incomum · armadura +3</small><div className="item-line"><Shield size={16} aria-hidden="true" /><i /><i /><i /></div></article>
                  <article className="utility-card"><span>Frascos</span><strong>04</strong><small>Poção de vida · cura 45 HP</small><div className="item-line"><Archive size={16} aria-hidden="true" /><i /><i /></div></article>
                </>
              )}
            </div>
          </section>
        )}

        <footer className="threshold-footer">
          <span><span className="threshold-footer-mark" /> Project Genesis · campanha local sincronizada</span>
          <span>Vila do Limiar <i /> latitude 04.17 · <button type="button" onClick={() => notify("Todos os sistemas estão operacionais.")}>sistemas operacionais</button></span>
        </footer>
      </div>

      {rosterOpen && (
        <div className="threshold-modal" role="dialog" aria-modal="true" aria-label="Escolher explorador" onClick={(event) => { if (event.target === event.currentTarget) setRosterOpen(false); }}>
          <section className="roster-panel">
            <button className="roster-close" type="button" onClick={() => setRosterOpen(false)} aria-label="Fechar"><X size={18} /></button>
            <span className="threshold-eyebrow">Arquivo de companhia</span>
            <h2>Escolha seu explorador</h2>
            <p>Cada classe lê a fronteira de um jeito. A campanha continua exatamente de onde você deixou.</p>
            <div className="roster-grid">
              {heroes.map((item) => (
                <button key={item.id} className={hero.id === item.id ? "selected" : ""} type="button" onClick={() => { setHero(item); setRosterOpen(false); notify(`${item.name} está pronto para partir.`); }}>
                  <span className="roster-initial" style={{ color: item.color, borderColor: item.color }}>{item.initial}</span>
                  <strong>{item.name}</strong>
                  <small>{item.role} · {item.faction}</small>
                  <span className="roster-check">{hero.id === item.id ? <Check size={13} aria-hidden="true" /> : null}</span>
                </button>
              ))}
            </div>
            <div className="roster-stats"><span>Vida <strong>{hero.hp}</strong></span><span>Energia <strong>{hero.mana}</strong></span><span>Passiva <strong>{hero.passive}</strong></span></div>
          </section>
        </div>
      )}

      {notice && <div className="threshold-notice" role="status"><span className="status-dot" />{notice}</div>}
    </main>
  );
}

export default ThresholdCommandVariant;