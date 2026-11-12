import en from "./en.js";
import ru from "./ru.js";
import uk from "./uk.js";
import { DEFAULT_LANGUAGE } from "../core/config.js";

const translations = { en, ru, uk };

let language = DEFAULT_LANGUAGE;

export function setLanguage(value) {
  if (Object.hasOwn(translations, value)) language = value;
}

export function getLanguage() {
  return language;
}

export function t(key) {
  return Object.hasOwn(translations[language], key)
    ? translations[language][key]
    : Object.hasOwn(translations[DEFAULT_LANGUAGE], key)
      ? translations[DEFAULT_LANGUAGE][key]
      : key;
}
