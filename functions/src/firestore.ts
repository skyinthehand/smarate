import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export interface IUserData {
  twitter: {
    id: string;
    username: string;
    displayName: string;
    icon: string;
  };
}

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
): Promise<void> {
  const db = admin.firestore();
  const usersRef = db.collection("users");
  usersRef.doc(userId).set(userData);
}
