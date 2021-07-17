import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { v4 as uuid } from "uuid";

export interface IUserData {
  twitter: {
    id: string;
    username: string;
    displayName: string;
    icon: string;
  };
}

export interface IUserSeasonData {
  userId: string;
  seasonId: string;
  rate: number;
}

export const INITIAL_RATE = 1500;

/**
 * Initialize firestore
 */
export function initialize(): void {
  admin.initializeApp(functions.config().firebase);
}

/**
 * Get exist user id
 * @param {string} twitterId
 * @return {Promise<string | null>}
 */
export async function getUserIdByTwitterId(
  twitterId: string
): Promise<string | null> {
  const db = admin.firestore();
  const usersRef = db.collection("users");
  const querySnapshot = await usersRef
    .where("twitter.id", "==", twitterId)
    .get();
  if (querySnapshot.docs.length > 0) {
    const doc = querySnapshot.docs[0];
    return doc.id;
  }
  return null;
}

/**
 * Save user data
 * @param {string} userId
 * @param {IUserData} userData
 * @return {Promise<void>}
 */
export async function saveUserData(
  userId: string,
  userData: IUserData
): Promise<string> {
  const db = admin.firestore();
  const usersRef = db.collection("users");
  await usersRef.doc(userId).set(userData);
  return userId;
}

/**
 * Get season
 * @param {Date} date
 * @return {Promise<string | null>}
 */
export async function getSeasonId(date: Date): Promise<string | null> {
  const db = admin.firestore();
  const seasonsRef = db.collection("seasons");
  const querySnapshot = await seasonsRef
    .where("startDate", "<", date)
    .orderBy("startDate", "desc")
    .get();
  if (querySnapshot.docs.length > 0) {
    const doc = querySnapshot.docs[0];
    return doc.id;
  }
  return null;
}

/**
 * Create season data
 * @param {Date} date
 * @return {Promise<string | null>}
 */
export async function createSeason(date: Date): Promise<string> {
  const db = admin.firestore();
  const seasonsRef = db.collection("seasons");
  const newSeasonId = (await seasonsRef.get()).size.toString();
  const seasonData = {
    startDate: date,
  };
  seasonsRef.doc(newSeasonId).set(seasonData);
  return newSeasonId;
}

/**
 * Get user season id
 * @param {string} userId
 * @param {string} seasonId
 * @return {Promise<string | null>}
 */
export async function getUserSeasonId(
  userId: string,
  seasonId: string
): Promise<string | null> {
  const db = admin.firestore();
  const userSeasonsRef = db.collection("userSeasons");
  const querySnapshot = await userSeasonsRef
    .where("userId", "==", userId)
    .where("seasonId", "==", seasonId)
    .get();
  if (querySnapshot.docs.length > 0) {
    const doc = querySnapshot.docs[0];
    return doc.id;
  }
  return null;
}

/**
 * Create user season data
 * @param {string} userId
 * @param {string} seasonId
 * @return {Promise<string | null>}
 */
export async function createUserSeason(
  userId: string,
  seasonId: string
): Promise<string> {
  const userSeasonId = uuid();
  const db = admin.firestore();
  const userSeasonsRef = db.collection("userSeasons");
  const userSeasonData: IUserSeasonData = {
    userId,
    seasonId,
    rate: INITIAL_RATE,
  };
  await userSeasonsRef.doc(userSeasonId).set(userSeasonData);
  return userSeasonId;
}
