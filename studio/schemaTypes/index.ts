import { characterDef } from './characterDef'
import { enemyDef } from './enemyDef'
import { encounterDef } from './encounterDef'
import { itemDef } from './itemDef'
import { mapDef } from './mapDef'
import { missionDef } from './missionDef'
import { traitDef } from './traitDef'
import { statValue } from './objects/statValue'
import { statGrowth } from './objects/statGrowth'
import { nodeEffect } from './objects/nodeEffect'
import { conditionTrigger } from './objects/conditionTrigger'
import { blessingChoice } from './objects/blessingChoice'
import { blessingRow } from './objects/blessingRow'
import { capstoneBlessing } from './objects/capstoneBlessing'
import { encounterEnemy } from './objects/encounterEnemy'
import { itemStat } from './objects/itemStat'
import { lootDrop } from './objects/lootDrop'
import { missionReward } from './objects/missionReward'

export const schemaTypes = [
  characterDef,
  enemyDef,
  encounterDef,
  itemDef,
  mapDef,
  missionDef,
  traitDef,
  statValue,
  statGrowth,
  nodeEffect,
  conditionTrigger,
  blessingChoice,
  blessingRow,
  capstoneBlessing,
  encounterEnemy,
  itemStat,
  lootDrop,
  missionReward,
]
