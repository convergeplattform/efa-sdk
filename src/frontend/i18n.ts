import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

/**
 * initI18n – Initialisiert i18next für eine Converge-App.
 * Jede App ruft dies einmal beim Start auf (z.B. in main.tsx).
 *
 * Translation files: public/locales/{lng}/translation.json
 */
export function initI18n(defaultLanguage = 'de'): typeof i18n {
  i18n
    .use(HttpBackend)
    .use(initReactI18next)
    .init({
      lng: defaultLanguage,
      fallbackLng: 'de',
      interpolation: { escapeValue: false },
      backend: { loadPath: '/locales/{{lng}}/translation.json' },
    });
  return i18n;
}

export { i18n };
