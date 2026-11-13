/**
 * URL d'un fichier de `public/`, préfixée par le chemin de base du site
 * (`/` en local, `/halaqa/` sur GitHub Pages).
 */
export const asset = (path: string): string => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`
