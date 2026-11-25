import type { MessageShape } from "../../core";
import type { pub as source } from "../nl/pub";

export const pub: MessageShape<typeof source> = {
  live: {
    readOnly: "You are watching",
    liveRound: "Live round",
    finalScore: "Final score",
    waiting: "The round is about to start",
    expiredTitle: "This link no longer works",
    expiredLead: "The link has expired or was withdrawn. Ask a player for a new one.",
    progress: "{done} of {total} scores",
    poweredBy: "Followed live with Fairway",
    openApp: "Open the app",
  },
  notFound: {
    title: "Out of bounds",
    lead: "This page does not exist or has moved.",
    home: "Back to the start",
  },
  error: {
    title: "That did not work",
    lead: "Something went wrong while loading this page.",
    retry: "Try again",
  },
  offline: {
    title: "You are offline",
    lead: "You can continue as soon as you are back online.",
  },
};
