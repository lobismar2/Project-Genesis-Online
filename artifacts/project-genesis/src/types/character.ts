export interface Position {
  x: number
  y: number
}

export interface CharacterState {
  position: Position
  direction: 'left' | 'right' | 'up' | 'down' | 'idle'
  isMoving: boolean
  spriteFrame: number
}

export interface CharacterProps {
  id: string
  name: string
  initialPosition: Position
  speed: number
  spriteSheet?: string
}
