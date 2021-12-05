import * as admin from "firebase-admin";

import { IPrData } from "./pr";
import { Moment } from "moment";

interface ISavedPrData {
  data: IPrData;
}

/**
 * Get jpr data
 * @param {Moment} date
 * @param {string} collectionName
 * @return {Promise<IJprData | null>}
 */
export async function getPrData(
  date: Moment,
  collectionName: string
): Promise<IPrData | null> {
  const db = admin.firestore();
  // "jprs"
  const jprsRef = db.collection(collectionName);
  const jprDataDoc = await jprsRef.doc(date.unix().toString()).get();
  if (!jprDataDoc.exists) {
    return null;
  }
  const savedJprData = jprDataDoc.data() as ISavedPrData;
  return savedJprData.data;
}

/**
 * Create jpr data
 * @param {Moment} date
 * @param {IPrData} prData
 * @param {string} collectionName
 * @return {Promise<string | null>}
 */
export async function setPrData(
  date: Moment,
  prData: IPrData,
  collectionName: string
): Promise<void> {
  const db = admin.firestore();
  const jprsRef = db.collection(collectionName);
  const jprDataDoc = jprsRef.doc(date.unix().toString());
  await jprDataDoc.set({ data: prData });
  return;
}
