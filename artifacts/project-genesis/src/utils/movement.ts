import { Position } from '../types/character'

export const moveCharacter = (
  current: Position,
  direction: string,
  speed: number,
  maxX: number,
  maxY: number
): Position => {
  const newPosition = { ...current }

  switch (direction) {
    case 'left':
      newPosition.x = Math.max(0, current.x - speed)
      break
    case 'right':
      newPosition.x = Math.min(maxX, current.x + speed)
      break
    case 'up':
      newPosition.y = Math.max(0, current.y - speed)
      break
    case 'down':
      newPosition.y = Math.min(maxY, current.y + speed)
      break
  }

  return newPosition
}

export const calculateDistance = (pos1: Position, pos2: Position): number => {
  const dx = pos2.x - pos1.x
  const dy = pos2.y - pos1.y
  return Math.sqrt(dx * dx + dy * dy)
}

export const getDirectionToTarget = (
  current: Position,
  target: Position
): 'left' | 'right' | 'up' | 'down' | 'idle' => {
  const dx = target.x - current.x
  const dy = target.y - current.y

  if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return 'idle'

  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left'
  }
  return dy > 0 ? 'down' : 'up'
}
