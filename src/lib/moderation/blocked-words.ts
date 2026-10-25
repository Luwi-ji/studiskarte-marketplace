/**
 * Words a post may not contain: strong profanity, sexual slang, slurs and harassment, in English, Filipino and
 * Taglish. Kept short on purpose. Every entry is matched as a whole word (see explicit.ts), so a word that is only
 * unkind, or that has an everyday meaning, is left out. Not in the lists on purpose, because they are ordinary words in
 * listings: puto (a rice cake), leche (leche flan), cum (cum laude), dick (Moby Dick), coon (Maine Coon), nipple (baby
 * bottles), nude (a lipstick shade), butt, panties, escort, rape (rape alarms), nazi, gaga, puke, chupa, negro, bakla.
 *
 * English terms were chosen from the "List of Dirty, Naughty, Obscene, and Otherwise Bad Words" by Shutterstock
 * (https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words), licensed CC BY 4.0, keeping the
 * strong terms only; the Filipino terms start from its Filipino list and add common Filipino and Taglish profanity.
 * See THIRD_PARTY_NOTICES.md.
 */

const ENGLISH_PROFANITY = [
  "fuck", "fucks", "fucked", "fucker", "fuckers", "fucking", "fuckin", "fuckface", "fuckhead", "fuckwit", "motherfucker", "motherfuckers", "mofo",
  "shit", "shits", "shitty", "bullshit", "shithead", "shitface", "horseshit",
  "bitch", "bitches", "bastard", "bastards", "asshole", "assholes", "arsehole", "dickhead", "cunt", "cunts", "twat", "wanker", "bollocks",
  "pussy", "pussies", "cock", "cocks", "whore", "whores", "slut", "sluts", "tits", "titties",
];

const ENGLISH_SEXUAL = [
  "blowjob", "blowjobs", "handjob", "rimjob", "cumshot", "cumshots", "jizz", "dildo", "dildos", "porn", "porno", "pornography", "pornhub", "xvideos", "onlyfans",
  "masturbate", "masturbating", "masturbation", "orgy", "gangbang", "bukkake", "incest", "bestiality", "pedophile", "paedophile", "pedo", "pthc", "jailbait", "nsfw",
];

const ENGLISH_HATE = [
  "nigger", "niggers", "nigga", "niggas", "faggot", "faggots", "fag", "fags", "kike", "kikes", "spic", "spics", "chink", "chinks", "gook", "gooks", "wetback",
  "beaner", "beaners", "paki", "raghead", "towelhead", "tranny", "trannies", "retard", "retards", "retarded", "kys",
];

const FILIPINO = [
  "puta", "putang", "putangina", "putanginamo", "putragis", "tangina", "tanginamo", "puki", "pukinangina", "pekpek", "burat", "bayag", "titi", "tite", "etits",
  "kantot", "kantutan", "iyot", "iyutan", "hindot", "jakol", "jakulan", "salsal", "tamod", "libog", "malibog", "pokpok", "kupal",
  "gago", "gagong", "tarantado", "ulol", "bobo", "tanga", "nognog",
  "punyeta", "punyemas", "pakyu", "pakshet", "pakshit", "pakingshet", "pakingshit", "hinayupak",
];

/** Words blocked when they stand alone (or as a spaced-out, masked or stretched spelling of themselves). */
export const BLOCKED_WORDS: ReadonlySet<string> = new Set([...ENGLISH_PROFANITY, ...ENGLISH_SEXUAL, ...ENGLISH_HATE, ...FILIPINO]);

/** Beginnings that no ordinary word has, so a longer form (fuckboy, putanginamo, kantotan) is blocked too. */
export const BLOCKED_STEMS: readonly string[] = ["fuck", "putangin", "tangina", "pukinang", "kantot", "motherfuck"];

/** Blocked when the words come one after the other. */
export const BLOCKED_PHRASES: readonly (readonly string[])[] = [
  ["putang", "ina"],
  ["tang", "ina"],
  ["anak", "ng", "puta"],
  ["gago", "ka"],
  ["pak", "yu"],
  ["pak", "you"],
  ["kill", "yourself"],
  ["kill", "urself"],
  ["hang", "yourself"],
  ["go", "kill", "yourself"],
  ["blow", "job"],
  ["hand", "job"],
  ["jerk", "off"],
];
