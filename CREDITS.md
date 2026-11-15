# Crédits et licences

État au 15/11/2026 (phase 3). Chaque ressource sera revérifiée avant d'ouvrir la plateforme aux élèves.

Légende : ✓ licence claire · ⚠ à confirmer

## Texte coranique et mise en page

| Ressource | Source | Licence / conditions | Statut |
|---|---|---|---|
| Texte QPC Hafs mot à mot, mise en page des 604 pages, découpage juz/hizb | Complexe du Roi Fahd (KFGQPC), via l'API publique de quran.com (identique à [QUL](https://qul.tarteel.ai)) | Reproduction sans modification. QUL n'indique pas de licence explicite | ⚠ |
| Règles de tajwid par mot | quran.com (`text_uthmani_tajweed`) | Pas de licence explicite. Les règles sont reportées sur le texte QPC sans le modifier (alignement lettre par lettre, vérifié par les tests) | ⚠ |
| Police KFGQPC Uthmanic Hafs + 604 polices QPC V2 | Complexe du Roi Fahd, via le CDN de quran.com | « Gratuite mais propriétaire » : pas de reproduction ni de modification sans accord écrit. Usage privé en attendant ; solution de secours : Amiri Quran (SIL OFL) | ⚠ |

## Récitations

| Ressource | Source | Licence / conditions | Statut |
|---|---|---|---|
| Mahmoud Khalil Al-Husary (Mu'allim, Murattal), Muhammad Siddiq Al-Minshawi, Mishari Al-Afasy : audio et minutage mot à mot | quran.com / QUL (`download.quranicaudio.com`, `audio.qurancdn.com`) | Pas de licence explicite. Audio de Husary Mu'allim pour al-Fatiha et le Juz 'Amma hébergé chez nous ; le reste lu depuis la source | ⚠ |
| Minutage mot à mot (labos de la phase 0) | [cpfair/quran-align](https://github.com/cpfair/quran-align), © 2016 Collin Fair | **CC BY 4.0** : attribution requise | ✓ |

## Traductions et tafsirs

| Ressource | Source | Licence / conditions | Statut |
|---|---|---|---|
| Traduction de Rachid Maach (v1.0.3) | [QuranEnc](https://quranenc.com/fr/browse/french_rashid) | Republication autorisée sans modification, en citant QuranEnc et la version, avec mise à jour vers la dernière version, sans publicité inappropriée | ✓ |
| Traduction du Centre international Noor, Dr Nabil Rudwan (v1.0.0) | [QuranEnc](https://quranenc.com/fr/browse/french_montada) | Idem | ✓ |
| Traduction de Muhammad Hamidullah | [QuranEnc](https://quranenc.com/fr/browse/french_hameedullah) | Idem, mais n'apparaît plus dans la liste publique de QuranEnc | ⚠ |
| Al-Mukhtasar en français (Centre Tafsir pour les études coraniques) | [QuranEnc](https://quranenc.com/fr/browse/french_mokhtasar) | Idem, mais n'apparaît plus dans la liste publique de QuranEnc | ⚠ |
| Tafsir al-Muyassar (arabe) | Complexe du Roi Fahd, via quran.com | Pas de licence explicite | ⚠ |

## Bibliothèques

- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) — MIT
- livekit-client, @livekit/components-react, livekit-server-sdk — Apache 2.0 ; LiveKit (serveur, Apache 2.0 ; LiveKit Cloud : conditions de LiveKit Inc.)
- Playwright — Apache 2.0 (tests)
- supabase-js — MIT ; Supabase (service hébergé, conditions d'utilisation de Supabase Inc.)
- React, React Router, Zustand, i18next, Tailwind CSS, Vite, Vitest, shadcn/ui, Radix UI, Lucide — MIT
- Police d'interface Geist (via Fontsource) — SIL OFL
