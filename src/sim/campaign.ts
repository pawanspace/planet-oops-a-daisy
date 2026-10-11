// =============================================================================
// The campaign: 4 zones × 3 levels, in play order. Each level id matches a file in /levels (<id>.tmj).
// 🧪 TRY IT: add 'sandbox' to Suburbia's list and it becomes level 4 of zone 1 in the menu.
// =============================================================================
export interface Zone { name: string; part: string; levels: string[] }

export const CAMPAIGN: Zone[] = [
  { name: 'Suburbia', part: '⚡ Spark Plug', levels: ['1-1', '1-2', '1-3'] },
  { name: 'School', part: '🔋 Hyper-Battery', levels: ['2-1', '2-2', '2-3'] },
  { name: 'Market', part: '🛞 Steering Wheel', levels: ['3-1', '3-2', '3-3'] },
  { name: 'Spaceport', part: '🔑 Launch Key', levels: ['4-1', '4-2', '4-3'] },
];

export const CAMPAIGN_IDS = CAMPAIGN.flatMap(z => z.levels);
