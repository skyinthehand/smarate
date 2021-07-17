import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { v4 as uuid } from "uuid";
import * as moment from "moment-timezone";

export interface IUserData {
  createdDate?: Date;
  updatedDate: Date;
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

const EMatchResult = {
  Win: 1,
  Lose: 0,
  Cancel: -1,
};
export type EMatchResult = typeof EMatchResult[keyof typeof EMatchResult];

export interface IUserMatchData {
  userId: string;
  reportedResult?: EMatchResult;
  startRate: number;
  diffRate: number;
}

const EMatchStatus = {
  Completion: 1,
  New: 0,
  Cancel: -1,
  Wait: 2,
  Progress: 3,
};
export type EMatchStatus = typeof EMatchStatus[keyof typeof EMatchStatus];

export interface IMatchData {
  seasonId: string;
  user0MatchData: IUserMatchData;
  user1MatchData?: IUserMatchData;
  roomId?: string;
  createdDate: Date;
  updatedDate: Date;
  status: EMatchStatus;
  resetCount: number;
}

export const INITIAL_RATE = 1500;

/**
 * Initialize firestore
 */
export function initialize(): void {
  admin.initializeApp(functions.config().firebase);
}

/**
 * Get user data
 * @param {string} userId
 * @return {Promise<IUserData | null>}
 */
export async function getUserData(userId: string): Promise<IUserData | null> {
  const db = admin.firestore();
  const usersRef = db.collection("users");
  return (await usersRef.doc(userId).get()).data() as IUserData;
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
 * Create user data
 * @param {string} userId
 * @param {IUserData} userData
 * @return {Promise<string>}
 */
export async function createUserData(
  userId: string,
  userData: IUserData
): Promise<string> {
  const db = admin.firestore();
  const usersRef = db.collection("users");
  await usersRef.doc(userId).set(userData);
  return userId;
}

/**
 * Update user data
 * @param {string} userId
 * @param {IUserData} userData
 * @return {Promise<string>}
 */
export async function updateUserData(
  userId: string,
  userData: IUserData
): Promise<string> {
  const db = admin.firestore();
  const usersRef = db.collection("users");
  await usersRef.doc(userId).update(userData);
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
 * Get user season data
 * @param {string} userId
 * @param {string} seasonId
 * @return {Promise<IUserSeasonData | null>}
 */
export async function getUserSeasonData(
  userId: string,
  seasonId: string
): Promise<IUserSeasonData | null> {
  const db = admin.firestore();
  const userSeasonsRef = db.collection("userSeasons");
  const querySnapshot = await userSeasonsRef
    .where("userId", "==", userId)
    .where("seasonId", "==", seasonId)
    .get();
  if (querySnapshot.docs.length > 0) {
    const doc = querySnapshot.docs[0];
    return doc.data() as IUserSeasonData;
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

/**
 * Get match data
 * @param {string} userId
 * @param {string} seasonId
 * @return {Promise<IMatchData | null>}
 */
export async function getMatchByUserIdAndSeasonId(
  userId: string,
  seasonId: string
): Promise<IMatchData | null> {
  const db = admin.firestore();
  const matchsRef = db.collection("matchs");
  const query1Snapshot = await matchsRef
    .where("user0MatchData.userId", "==", userId)
    .where("seasonId", "==", seasonId)
    .get();
  if (query1Snapshot.docs.length > 0) {
    const doc = query1Snapshot.docs[0];
    return doc.data() as IMatchData;
  }
  const query2Snapshot = await matchsRef
    .where("user1MatchData.userId", "==", userId)
    .where("seasonId", "==", seasonId)
    .get();
  if (query2Snapshot.docs.length > 0) {
    const doc = query2Snapshot.docs[0];
    return doc.data() as IMatchData;
  }
  return null;
}

/**
 * Create match data
 * @param {string} userId
 * @param {string} seasonId
 * @param {Date} date
 * @return {Promise<string | null>}
 */
export async function createMatch(
  userId: string,
  seasonId: string
): Promise<IMatchData | null> {
  const db = admin.firestore();

  const userSeasonData = await getUserSeasonData(userId, seasonId);
  if (userSeasonData === null) {
    return null;
  }

  const matchsRef = db.collection("matchs");
  const userMatchData: IUserMatchData = {
    userId,
    startRate: userSeasonData.rate,
    diffRate: 0,
  };
  const currentTime = moment.tz("Asia/Tokyo").toDate();
  const matchData: IMatchData = {
    seasonId,
    user0MatchData: userMatchData,
    createdDate: currentTime,
    updatedDate: currentTime,
    status: EMatchStatus.New,
    resetCount: 0,
  };
  const matchId = uuid();
  await matchsRef.doc(matchId).set(matchData);
  return matchData;
}

/**
 * Update match room id
 * @param {string} userId
 * @param {string} seasonId
 * @param {string} roomId
 * @return {Promise<string | null>}
 */
export async function updateMatchRoomId(
  userId: string,
  seasonId: string,
  roomId: string
): Promise<string | null> {
  const db = admin.firestore();
  const matchsRef = db.collection("matchs");
  const query1Snapshot = await matchsRef
    .where("user0MatchData.userId", "==", userId)
    .where("seasonId", "==", seasonId)
    .get();
  const currentTime = moment.tz("Asia/Tokyo").toDate();
  const roomData = {
    roomId,
    updatedDate: currentTime,
    status: EMatchStatus.Wait,
  };
  if (query1Snapshot.docs.length <= 0) {
    return null;
  }
  const doc = query1Snapshot.docs[0];
  const matchId = doc.id;
  await matchsRef.doc(matchId).update(roomData);
  return matchId;
}
