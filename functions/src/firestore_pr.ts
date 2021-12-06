import * as admin from "firebase-admin";

import { ISavedPrData } from "./pr";
import { Moment } from "moment";

/**
 * Get jpr data
 * @param {Moment} date
 * @param {string} collectionName
 * @return {Promise<ISavedPrData | null>}
 */
export async function getPrData(
  date: Moment,
  collectionName: string
): Promise<ISavedPrData | null> {
  const db = admin.firestore();
  // "jprs"
  const jprsRef = db.collection(collectionName);
  const jprDataDoc = await jprsRef.doc(date.unix().toString()).get();
  if (!jprDataDoc.exists) {
    return null;
  }
  const savedJprData = jprDataDoc.data() as ISavedPrData;
  return savedJprData;
}

/**
 * Create jpr data
 * @param {Moment} date
 * @param {ISavedPrData} savedPrData
 * @param {string} collectionName
 * @return {Promise<string | null>}
 */
export async function setPrData(
  date: Moment,
  savedPrData: ISavedPrData,
  collectionName: string
): Promise<void> {
  const db = admin.firestore();
  const jprsRef = db.collection(collectionName);
  const jprDataDoc = jprsRef.doc(date.unix().toString());
  await jprDataDoc.set(savedPrData);
  return;
}
