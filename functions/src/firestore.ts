import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

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
 * @param {object} userData
 * @return
 */
export async function saveUserData(
  userId: string,
  userData: object
): Promise<void> {
  const db = admin.firestore();
  const usersRef = db.collection("users");
  usersRef.doc(userId).set(userData);
}
