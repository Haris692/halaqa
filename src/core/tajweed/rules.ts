/**
 * Règles de tajwid présentes dans les données (classes de quran.com), regroupées
 * en familles pédagogiques : c'est à ce niveau que le prof choisit
 * « la règle de la semaine ».
 */
export const TAJWEED_FAMILIES = ['madd', 'ghunna', 'qalqala', 'ikhfa', 'idgham', 'iqlab', 'silent'] as const
export type TajweedFamily = (typeof TAJWEED_FAMILIES)[number]

const FAMILY_OF: Record<string, TajweedFamily> = {
  madda_normal: 'madd',
  madda_permissible: 'madd',
  madda_necessary: 'madd',
  madda_obligatory_mottasel: 'madd',
  madda_obligatory_monfasel: 'madd',
  ghunnah: 'ghunna',
  qalaqah: 'qalqala',
  ikhafa: 'ikhfa',
  ikhafa_shafawi: 'ikhfa',
  idgham_ghunnah: 'idgham',
  idgham_wo_ghunnah: 'idgham',
  idgham_shafawi: 'idgham',
  idgham_mutajanisayn: 'idgham',
  idgham_mutaqaribayn: 'idgham',
  iqlab: 'iqlab',
  ham_wasl: 'silent',
  laam_shamsiyah: 'silent',
  slnt: 'silent',
}

export const familyOf = (rule: string): TajweedFamily | null => FAMILY_OF[rule] ?? null

export const RULES_BY_FAMILY: Record<TajweedFamily, string[]> = TAJWEED_FAMILIES.reduce(
  (acc, f) => ({ ...acc, [f]: Object.keys(FAMILY_OF).filter((r) => FAMILY_OF[r] === f) }),
  {} as Record<TajweedFamily, string[]>,
)

/** Filtre de règles : toutes, ou seulement celles d'une famille. */
export function ruleFilterFor(onlyFamily: TajweedFamily | null): ((rule: string) => boolean) | undefined {
  if (!onlyFamily) return undefined
  return (rule) => FAMILY_OF[rule] === onlyFamily
}
