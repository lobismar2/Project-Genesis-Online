# Project Genesis Online - Personagens com Movimento

Sistema de personagens com movimentação e animações para Project Genesis Online.

## 🎮 Features

✅ **Movimentação Suave** - Personagens se movem com setas ou WASD  
✅ **Animações** - Frames de caminhada durante movimento  
✅ **Sistema de Colisão Básico** - Limites de tela  
✅ **HUD Informativo** - Controles visíveis na tela  
✅ **Testes E2E** - Com Playwright para mobile e desktop  

## 🚀 Como Usar

```bash
# Instalar dependências
pnpm install

# Iniciar servidor de desenvolvimento
pnpm dev

# Rodar testes
pnpm test:e2e
```

## 🎯 Controles

- **Setas do Teclado** (↑ ↓ ← →) - Mover personagem
- **WASD** - Controles alternativos

## 📁 Estrutura

```
src/
├── components/
│   ├── Character.tsx       # Componente de personagem com animação
│   └── GameWorld.tsx       # Mundo do jogo e gerenciador
├── types/
│   └── character.ts        # Tipos e interfaces
└── utils/
    └── movement.ts         # Lógica de movimento
```

## 🎨 Animações

- **Idle Pulse** - Pulsação quando parado
- **Walk Steps** - 4 frames de caminhada
- **Direction Rotation** - Rotação baseada na direção

## 📱 Compatibilidade

- Desktop (Chromium, WebKit)
- Mobile (Chromium Mobile, WebKit Mobile)
- Touch Controls (suporte futuro)
