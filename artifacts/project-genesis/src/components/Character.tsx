import React, { useState, useEffect } from 'react'
import { CharacterProps, CharacterState, Position } from '../types/character'
import { moveCharacter } from '../utils/movement'

export const Character: React.FC<CharacterProps> = ({
  id,
  name,
  initialPosition,
  speed,
  spriteSheet,
}) => {
  const [state, setState] = useState<CharacterState>({
    position: initialPosition,
    direction: 'idle',
    isMoving: false,
    spriteFrame: 0,
  })

  const [keysPressed, setKeysPressed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeysPressed((prev) => ({
        ...prev,
        [e.key.toLowerCase()]: true,
      }))
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeysPressed((prev) => ({
        ...prev,
        [e.key.toLowerCase()]: false,
      }))
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useEffect(() => {
    const gameLoop = setInterval(() => {
      setState((prevState) => {
        let direction = prevState.direction
        let isMoving = false

        if (
          keysPressed['arrowleft'] ||
          keysPressed['a']
        ) {
          direction = 'left'
          isMoving = true
        } else if (
          keysPressed['arrowright'] ||
          keysPressed['d']
        ) {
          direction = 'right'
          isMoving = true
        } else if (
          keysPressed['arrowup'] ||
          keysPressed['w']
        ) {
          direction = 'up'
          isMoving = true
        } else if (
          keysPressed['arrowdown'] ||
          keysPressed['s']
        ) {
          direction = 'down'
          isMoving = true
        } else {
          direction = 'idle'
          isMoving = false
        }

        const newPosition = isMoving
          ? moveCharacter(
              prevState.position,
              direction,
              speed,
              window.innerWidth - 50,
              window.innerHeight - 50
            )
          : prevState.position

        const spriteFrame = isMoving ? (prevState.spriteFrame + 1) % 4 : 0

        return {
          ...prevState,
          position: newPosition,
          direction,
          isMoving,
          spriteFrame,
        }
      })
    }, 50)

    return () => clearInterval(gameLoop)
  }, [keysPressed, speed])

  const getRotation = (): number => {
    switch (state.direction) {
      case 'left':
        return 180
      case 'right':
        return 0
      case 'up':
        return -90
      case 'down':
        return 90
      default:
        return 0
    }
  }

  const getAnimationClass = (): string => {
    if (!state.isMoving) return 'idle'
    return `walk-frame-${state.spriteFrame}`
  }

  return (
    <div
      className={`character ${name} ${getAnimationClass()}`}
      style={{
        position: 'absolute',
        left: `${state.position.x}px`,
        top: `${state.position.y}px`,
        width: '50px',
        height: '50px',
        transform: `rotate(${getRotation()}deg)`,
        transition: state.isMoving ? 'none' : 'transform 0.2s ease-in-out',
        zIndex: 10,
      }}
      title={`${name} (${Math.round(state.position.x)}, ${Math.round(state.position.y)})`}
    >
      {spriteSheet ? (
        <img
          src={spriteSheet}
          alt={name}
          style={{
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#4CAF50',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'white',
            fontWeight: 'bold',
          }}
        >
          {name[0]}
        </div>
      )}
    </div>
  )
}
