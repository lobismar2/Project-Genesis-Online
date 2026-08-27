import React, { useState } from 'react'
import { Character } from './Character'
import { Position } from '../types/character'

export const GameWorld: React.FC = () => {
  const [characters] = useState([
    {
      id: 'player1',
      name: 'Player',
      initialPosition: { x: 100, y: 100 } as Position,
      speed: 5,
    },
    {
      id: 'npc1',
      name: 'NPC',
      initialPosition: { x: 300, y: 200 } as Position,
      speed: 2,
    },
  ])

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#87CEEB',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      {/* Background grid */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          opacity: 0.1,
        }}
      >
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="black" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      {/* HUD */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '15px',
          borderRadius: '5px',
          fontSize: '14px',
          zIndex: 100,
        }}
      >
        <h2 style={{ margin: '0 0 10px 0' }}>Project Genesis Online</h2>
        <p style={{ margin: '5px 0' }}>⬅️➡️⬆️⬇️ ou WASD para mover</p>
        <p style={{ margin: '5px 0' }}>🎮 Personagens em movimento</p>
      </div>

      {/* Characters */}
      {characters.map((char) => (
        <Character
          key={char.id}
          id={char.id}
          name={char.name}
          initialPosition={char.initialPosition}
          speed={char.speed}
        />
      ))}
    </div>
  )
}
