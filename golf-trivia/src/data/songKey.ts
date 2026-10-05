/** Normalised name used to tell whether a song was already played (the same song can sit in several sheets). */
export const songKey = (songName: string): string => songName.trim().toLowerCase().replace(/\s+/g, ' ');
