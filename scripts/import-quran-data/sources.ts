/**
 * Ressources importées, avec leur provenance. Toute ressource ajoutée ici doit
 * aussi être documentée dans CREDITS.md (licence + attribution).
 */

export interface ReciterSource {
  id: string
  /** identifiant du récitateur dans l'API de quran.com (= ressource QUL avec segments) */
  qdcId: number
  name: string
  nameAr: string
  style: string
  /** héberger chez nous l'audio des sourates MIRRORED_SURAHS (programme de lancement) */
  mirror: boolean
}

export const RECITERS: ReciterSource[] = [
  { id: 'husary-muallim', qdcId: 12, name: 'Mahmoud Khalil Al-Husary', nameAr: 'محمود خليل الحصري', style: "Mu'allim (pédagogique)", mirror: true },
  { id: 'husary', qdcId: 6, name: 'Mahmoud Khalil Al-Husary', nameAr: 'محمود خليل الحصري', style: 'Murattal', mirror: false },
  { id: 'minshawi', qdcId: 9, name: 'Muhammad Siddiq Al-Minshawi', nameAr: 'محمد صديق المنشاوي', style: 'Murattal', mirror: false },
  // Abdul Basit (qdcId 2) écarté : 1 834 mots sans minutage dans la source.
  { id: 'alafasy', qdcId: 7, name: 'Mishari Rashid Al-Afasy', nameAr: 'مشاري راشد العفاسي', style: 'Murattal', mirror: false },
]

/** al-Fatiha + Juz 'Amma : hébergés chez nous pour ne pas dépendre d'un CDN tiers. */
export const MIRRORED_SURAHS = [1, ...Array.from({ length: 37 }, (_, i) => 78 + i)]

export interface TranslationSource {
  key: string
  title: string
  author: string
  source: string
  url: string
  note?: string
}

export const TRANSLATIONS: TranslationSource[] = [
  {
    key: 'french_hameedullah',
    title: 'Traduction de Muhammad Hamidullah',
    author: 'Muhammad Hamidullah',
    source: 'QuranEnc.com',
    url: 'https://quranenc.com/fr/browse/french_hameedullah',
    note: "N'apparaît plus dans la liste publique de QuranEnc : statut à confirmer.",
  },
  {
    key: 'french_rashid',
    title: 'Traduction de Rachid Maach',
    author: 'Rachid Maach',
    source: 'QuranEnc.com (v1.0.3)',
    url: 'https://quranenc.com/fr/browse/french_rashid',
  },
  {
    key: 'french_montada',
    title: 'Traduction du Centre international Noor',
    author: 'Dr Nabil Rudwan — Centre international Noor',
    source: 'QuranEnc.com (v1.0.0)',
    url: 'https://quranenc.com/fr/browse/french_montada',
  },
]

export type TafsirSource =
  | (TranslationSource & { provider: 'quranenc'; lang: 'fr' | 'ar' })
  | (TranslationSource & { provider: 'qdc'; slug: string; lang: 'fr' | 'ar' })

export const TAFSIRS: TafsirSource[] = [
  {
    provider: 'quranenc',
    key: 'french_mokhtasar',
    lang: 'fr',
    title: "Al-Mukhtasar dans l'interprétation du Noble Coran",
    author: 'Centre Tafsir pour les études coraniques',
    source: 'QuranEnc.com',
    url: 'https://quranenc.com/fr/browse/french_mokhtasar',
    note: "N'apparaît plus dans la liste publique de QuranEnc : statut à confirmer.",
  },
  {
    provider: 'qdc',
    slug: 'ar-tafsir-muyassar',
    key: 'ar_muyassar',
    lang: 'ar',
    title: 'التفسير الميسر — Tafsir al-Muyassar',
    author: 'Complexe du Roi Fahd',
    source: 'quran.com',
    url: 'https://quran.com',
    note: 'Licence à confirmer.',
  },
]
