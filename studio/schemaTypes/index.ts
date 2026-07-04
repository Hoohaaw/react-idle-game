import { characterDef } from './characterDef'
import { enemyDef } from './enemyDef'
import { encounterDef } from './encounterDef'
import { itemDef } from './itemDef'
import { missionDef } from './missionDef'
import { statValue } from './objects/statValue'
import { statGrowth } from './objects/statGrowth'
import { nodeEffect } from './objects/nodeEffect'
import { blessingNode } from './objects/blessingNode'
import { encounterEnemy } from './objects/encounterEnemy'
import { itemStat } from './objects/itemStat'
import { lootDrop } from './objects/lootDrop'
import { missionReward } from './objects/missionReward'

export const schemaTypes = [
  characterDef,
  enemyDef,
  encounterDef,
  itemDef,
  missionDef,
  statValue,
  statGrowth,
  nodeEffect,
  blessingNode,
  encounterEnemy,
  itemStat,
  lootDrop,
  missionReward,
]
