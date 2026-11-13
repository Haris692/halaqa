import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import common from './fr/common.json'
import labs from './fr/labs.json'

export const resources = { fr: { common, labs } } as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS: 'common',
  ns: ['common', 'labs'],
  interpolation: { escapeValue: false },
})

export default i18n
