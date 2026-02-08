# Nova Arquitetura - Deep Mine

## Problema Atual
- Boneco e blocos nunca ficam alinhados
- Sistema de coordenadas confuso
- Trocar entre cenas causa problemas

## Solução Nova

### 1. Uma Única Cena
- Apenas MiningScene
- Buy/Sell aparecem como UI overlay quando y <= 5
- Sem SurfaceScene

### 2. Sistema de Coordenadas Simples
```
Posição do Boneco no Mundo: (x_blocks, y_blocks)
Posição do Boneco na Tela: SEMPRE (screen.width/2, screen.height/2) - FIXO

Offset do Mundo:
  offset_x = (screen.width/2) - (player_x_blocks * BLOCK_SIZE)
  offset_y = (screen.height/2) - (player_y_blocks * BLOCK_SIZE)

Renderização de Blocos:
  screen_x = (block_x * BLOCK_SIZE) + offset_x
  screen_y = (block_y * BLOCK_SIZE) + offset_y
```

### 3. Estrutura de Containers
```
app.stage
  ├── worldContainer (move com offset)
  │   └── blockSprites (posição = block_x * 40, block_y * 40)
  ├── playerContainer (fixo no centro)
  │   └── playerSprite (posição = screen.width/2, screen.height/2)
  └── uiContainer (fixo na tela)
      ├── HUD
      └── BuySellPanel (visível quando y <= 5)
```

### 4. Passos de Implementação
1. Limpar MiningScene
2. Criar worldContainer para blocos
3. Criar playerContainer fixo no centro
4. Calcular offset baseado em posição do player
5. Aplicar offset ao worldContainer
6. Adicionar UI de Buy/Sell como overlay

### 5. Movimento
- Setas movem a posição do player no mundo (x_blocks, y_blocks)
- Recalcula offset
- Aplica offset ao worldContainer
- Player na tela NÃO se move (sempre centro)
