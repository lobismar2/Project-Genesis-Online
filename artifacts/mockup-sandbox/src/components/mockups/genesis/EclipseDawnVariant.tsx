import { useState } from "react";
import { Compass, Gem, Map, Medal, Play, ScrollText, Shield, Sparkles, Swords, Trophy, UserRound, X, Zap } from "lucide-react";
import "./EclipseDawnVariant.css";

type Operative = {
  id: string;
  initial: string;
  name: string;
  role: string;
  color: string;
  hp: string;
  energy: string;
  passive: string;
};

const operatives: Operative[] = [
  { id: "moss", initial: "M", name: "Colosso de Musgo", role: "Vanguarda", color: "#668d63", hp: "145", energy: "70", passive: "Casca Antiga" },
  { id: "thorn", initial: "T", name: "Espreitador de Espinhos", role: "Atirador", color: "#ad5f76", hp: "94", energy: "115", passive: "Predador" },
  { id: "neon", initial: "N", name: "Lâmina Neon", role: "Duelista", color: "#a77b2f", hp: "96", energy: "105", passive: "Sobrecarga" },
  { id: "bio", initial: "B", name: "Engenheiro Biossonda", role: "Artífice", color: "#4f7c85", hp: "108", energy: "145", passive: "Circuito fechado" },
];

const navItems = [
  { id: "journal", label: "Diário", icon: ScrollText },
  { id: "arsenal", label: "Arsenal", icon: Swords },
  { id: "achievements", label: "Conquistas", icon: Trophy },
];

export function EclipseDawnVariant() {
  const [operative, setOperative] = useState(operatives[0]);
  const [drawer, setDrawer] = useState<"roster" | "journal" | "arsenal" | "achievements" | null>(null);
  const [selectedCard, setSelectedCard] = useState("mission");
  const [armed, setArmed] = useState(false);
  const [toast, setToast] = useState("");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const startExpedition = () => {
    setArmed(true);
    notify(`Expedição armada para ${operative.name}.`);
  };

  const openNav = (id: "journal" | "arsenal" | "achievements") => setDrawer(id);

  return (
    <main className="atlas-variant">
      <div className="atlas-frame">
        <header className="atlas-header">
          <div className="atlas-brand">
            <span className="atlas-brand-mark">G</span>
            <div className="atlas-brand-copy">
              Project Genesis
              <small>Field archive · 09</small>
            </div>
          </div>
          <div className="atlas-header-center">Vila do Limiar / 04.17</div>
          <div className="atlas-header-actions">
            <button className="atlas-profile" type="button" onClick={() => setDrawer("roster")} aria-label="Trocar explorador">
              <span className="atlas-avatar" style={{ backgroundColor: operative.color }}>{operative.initial}</span>
              <span className="atlas-profile-copy">
                <strong>{operative.name}</strong>
                <span>Nível 07 · {operative.role}</span>
              </span>
              <UserRound size={14} aria-hidden="true" />
            </button>
            <div className="atlas-currencies" aria-label="Recursos">
              <span className="atlas-currency"><Gem size={12} aria-hidden="true" /> 248</span>
              <span className="atlas-currency"><Zap size={12} aria-hidden="true" /> 64</span>
            </div>
          </div>
        </header>

        <section className="atlas-main">
          <section className="atlas-hero" aria-labelledby="atlas-title">
            <div className="atlas-kicker">Registro de expedição · fronteira norte</div>
            <h1 className="atlas-title" id="atlas-title">Genesis<em>Awake</em></h1>
            <p className="atlas-intro">
              O mundo não terminou. Ele mudou de forma. Reúna sua companhia, atravesse as quatro fronteiras e descubra o que acordou sob a vila.
            </p>
            <div className="atlas-action-row">
              <button className="atlas-primary" type="button" onClick={startExpedition}>
                {armed ? "Expedição armada" : "Continuar campanha"}
                <Play size={15} fill="currentColor" aria-hidden="true" />
              </button>
              <button className="atlas-secondary" type="button" onClick={() => setDrawer("roster")}>
                Trocar explorador
              </button>
            </div>

            <div className="atlas-map" aria-label="Mapa de rotas da campanha">
              <span className="atlas-map-label forest">Florestas brilhantes</span>
              <span className="atlas-map-label ice">Geleira do silêncio</span>
              <span className="atlas-map-label cinder">Caldeira rubra</span>
              <span className="atlas-map-label village">Vila do limiar</span>
              <span className="atlas-route" aria-hidden="true" />
              <span className="atlas-pin one">01</span>
              <span className="atlas-pin two">02</span>
              <span className="atlas-pin three">03</span>
              <span className="atlas-map-compass">N</span>
            </div>
          </section>

          <aside className="atlas-side" aria-label="Resumo da campanha">
            <div className="atlas-side-heading">
              <div>
                <div className="atlas-side-kicker">Caderno de bordo</div>
                <h2>O próximo passo</h2>
              </div>
              <span>03 / 12</span>
            </div>

            <div className="atlas-cards">
              <button className={`atlas-card ${selectedCard === "season" ? "selected" : ""}`} type="button" onClick={() => { setSelectedCard("season"); notify("Evento Eclipse: 12 dias restantes."); }}>
                <span>
                  <span className="atlas-card-kicker">Evento semanal</span>
                  <strong>Eclipse sobre o vale</strong>
                  <small>Caçe as Faíscas do Eclipse antes que a noite mude de lugar.</small>
                </span>
                <span className="atlas-card-icon"><Sparkles size={17} aria-hidden="true" /></span>
                <span className="atlas-card-meta"><span className="atlas-bar"><i /></span> 12 dias restantes</span>
              </button>

              <button className={`atlas-card mission ${selectedCard === "mission" ? "selected" : ""}`} type="button" onClick={() => { setSelectedCard("mission"); notify("Missão destacada: Mapa das quatro fronteiras."); }}>
                <span>
                  <span className="atlas-card-kicker">Missão ativa</span>
                  <strong>Mapa das quatro fronteiras</strong>
                  <small>Explore as Florestas Brilhantes e volte com uma rota segura.</small>
                </span>
                <span className="atlas-card-icon"><Map size={17} aria-hidden="true" /></span>
                <span className="atlas-card-meta"><span className="atlas-bar"><i /></span> 1 de 4 regiões</span>
              </button>

              <button className={`atlas-card rank ${selectedCard === "rank" ? "selected" : ""}`} type="button" onClick={() => { setSelectedCard("rank"); notify("Sua companhia está em 8º lugar."); }}>
                <span>
                  <span className="atlas-card-kicker">Companhias</span>
                  <strong>Oitavo lugar</strong>
                  <small>Faltam 420 XP para alcançar a próxima marca do mapa.</small>
                </span>
                <span className="atlas-card-icon"><Medal size={17} aria-hidden="true" /></span>
                <span className="atlas-card-meta"><span className="atlas-bar"><i /></span> posição 08 / 24</span>
              </button>
            </div>

            <div className="atlas-mission-footer">
              <span>Recompensa da próxima etapa</span>
              <strong>120 XP · título Cartógrafo</strong>
            </div>
            <nav className="atlas-nav" aria-label="Menu da campanha">
              {navItems.map(({ id, label, icon: Icon }) => (
                <button key={id} className={drawer === id ? "active" : ""} type="button" onClick={() => openNav(id as "journal" | "arsenal" | "achievements")}>
                  <Icon size={12} aria-hidden="true" /> {label}
                </button>
              ))}
            </nav>
            <div className="atlas-status"><i aria-hidden="true" /> <strong>Progresso salvo</strong> · último registro há 2 min</div>
          </aside>
        </section>
      </div>

      {drawer && (
        <div className="atlas-drawer" role="dialog" aria-modal="true" aria-label="Painel da campanha" onClick={(event) => { if (event.target === event.currentTarget) setDrawer(null); }}>
          <section className="atlas-drawer-panel">
            <button className="atlas-drawer-close" type="button" onClick={() => setDrawer(null)} aria-label="Fechar painel"><X size={18} /></button>
            {drawer === "roster" && (
              <>
                <div className="atlas-side-kicker">Arquivo de companhia</div>
                <h2>Escolha seu explorador</h2>
                <p className="atlas-drawer-lead">Cada classe lê a fronteira de um jeito. A campanha continua exatamente de onde você deixou.</p>
                <div className="atlas-roster">
                  {operatives.map((item) => (
                    <button key={item.id} className={operative.id === item.id ? "selected" : ""} type="button" onClick={() => { setOperative(item); setDrawer(null); notify(`${item.name} está pronto para partir.`); }}>
                      <span className="atlas-roster-mark" style={{ color: item.color }}>{item.initial}</span>
                      <strong>{item.name}</strong>
                      <small>{item.role}</small>
                    </button>
                  ))}
                </div>
                <div className="atlas-stats">
                  <div><span>Vida</span><strong>{operative.hp}</strong></div>
                  <div><span>Energia</span><strong>{operative.energy}</strong></div>
                  <div><span>Passiva</span><strong>{operative.passive}</strong></div>
                </div>
              </>
            )}
            {drawer === "journal" && (
              <>
                <div className="atlas-side-kicker">Registro 03 / 12</div>
                <h2>Diário de bordo</h2>
                <p className="atlas-drawer-lead">“As raízes apontam para o norte. O som que vem de baixo não é vento.”</p>
                <div className="atlas-mission-footer"><span>Missão atual</span><strong>Mapa das quatro fronteiras</strong></div>
                <div className="atlas-stats"><div><span>Floresta</span><strong>01 / 04</strong></div><div><span>XP</span><strong>420 / 840</strong></div></div>
              </>
            )}
            {drawer === "arsenal" && (
              <>
                <div className="atlas-side-kicker">Equipamento de campo</div>
                <h2>Arsenal</h2>
                <p className="atlas-drawer-lead">A ferrugem não é um problema quando o mapa é bom. Seu equipamento acompanha o nível 07.</p>
                <div className="atlas-stats"><div><span>Arma</span><strong>Lâmina de aço</strong></div><div><span>Armadura</span><strong>Cota de malha</strong></div></div>
              </>
            )}
            {drawer === "achievements" && (
              <>
                <div className="atlas-side-kicker">Marcas descobertas</div>
                <h2>Conquistas</h2>
                <p className="atlas-drawer-lead">Alguns lugares só existem depois que alguém os encontra.</p>
                <div className="atlas-stats"><div><span>Descobertas</span><strong>07 / 20</strong></div><div><span>Próxima</span><strong>O subterrâneo</strong></div></div>
              </>
            )}
          </section>
        </div>
      )}

      {toast && <div className="atlas-toast" role="status">{toast}</div>}
    </main>
  );
}

export default EclipseDawnVariant;