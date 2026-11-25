/**
 * The message dictionaries, one namespace per area of the product. Dutch is
 * the source of truth; `MessageShape` makes the compiler reject an English
 * dictionary that misses a key.
 */
import type { Locale, MessageKeys, Translate } from "./core";
import { admin as adminEn } from "./messages/en/admin";
import { app as appEn } from "./messages/en/app";
import { board as boardEn } from "./messages/en/board";
import { auth as authEn } from "./messages/en/auth";
import { common as commonEn } from "./messages/en/common";
import { play as playEn } from "./messages/en/play";
import { pub as pubEn } from "./messages/en/pub";
import { admin } from "./messages/nl/admin";
import { app } from "./messages/nl/app";
import { board } from "./messages/nl/board";
import { auth } from "./messages/nl/auth";
import { common } from "./messages/nl/common";
import { play } from "./messages/nl/play";
import { pub } from "./messages/nl/pub";

const nl = { common, auth, app, play, admin, pub, board };
const en: typeof nl = { common: commonEn, auth: authEn, app: appEn, play: playEn, admin: adminEn, pub: pubEn, board: boardEn };

export type Messages = typeof nl;
export type MessageKey = MessageKeys<Messages>;
export type AppTranslate = Translate<MessageKey>;

export const dictionaries: Record<Locale, Messages> = { nl, en };
