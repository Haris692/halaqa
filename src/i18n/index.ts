import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import account from './fr/account.json'
import common from './fr/common.json'
import labs from './fr/labs.json'
import reader from './fr/reader.json'
import training from './fr/training.json'

export const resources = { fr: { account, common, labs, reader, training } } as const

void i18n.use(initReactI18next).init({
  resources,
  lng: 'fr',
  fallbackLng: 'fr',
  defaultNS: 'common',
  ns: ['account', 'common', 'labs', 'reader', 'training'],
  interpolation: { escapeValue: false },
})

export default i18n
