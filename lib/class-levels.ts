export const CLASS_LEVELS = [
  '4. Klasse',
  '5. Klasse',
  '6. Klasse',
  '1. Sek',
  '2. Sek',
  '3. Sek',
  'Gymnasium',
] as const

export type ClassLevel = (typeof CLASS_LEVELS)[number]

export const CLASS_LEVEL_NAV_ITEMS: ReadonlyArray<{
  value: ClassLevel
  label: string
}> = [
  { value: '4. Klasse', label: '4.Kl' },
  { value: '5. Klasse', label: '5.Kl' },
  { value: '6. Klasse', label: '6.Kl' },
  { value: '1. Sek', label: '1.Sek' },
  { value: '2. Sek', label: '2.Sek' },
  { value: '3. Sek', label: '3.Sek' },
  { value: 'Gymnasium', label: 'Gymnasium' },
]

const CLASS_LEVEL_ALIASES: Record<string, ClassLevel> = {
  '4': '4. Klasse',
  '4. klasse': '4. Klasse',
  '5': '5. Klasse',
  '5. klasse': '5. Klasse',
  '6': '6. Klasse',
  '6. klasse': '6. Klasse',
  '7': '1. Sek',
  '1. sek': '1. Sek',
  '7. klasse (sek)': '1. Sek',
  '8': '2. Sek',
  '2. sek': '2. Sek',
  '8. klasse (sek)': '2. Sek',
  '9': '3. Sek',
  '3. sek': '3. Sek',
  '9. klasse (sek)': '3. Sek',
  gym: 'Gymnasium',
  gymnasium: 'Gymnasium',
}

export function normalizeClassLevel(value: string | null | undefined): ClassLevel | null {
  if (!value) return null
  return CLASS_LEVEL_ALIASES[value.trim().toLowerCase()] ?? null
}
