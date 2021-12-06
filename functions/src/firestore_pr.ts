import * as admin from "firebase-admin";

import { ISavedPrData } from "./pr";
import { Moment } from "moment";

/**
 * Get pr data
 * @param {Moment} date
 * @param {string} collectionName
 * @return {Promise<ISavedPrData | null>}
 */
export async function getPrData(
  date: Moment,
  collectionName: string
): Promise<ISavedPrData | null> {
  const db = admin.firestore();
  const prsRef = db.collection(collectionName);
  const prDataDoc = await prsRef.doc(date.unix().toString()).get();
  if (!prDataDoc.exists) {
    return null;
  }
  const savedPrData = prDataDoc.data() as ISavedPrData;
  return savedPrData;
}

/**
 * Create pr data
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
  const prsRef = db.collection(collectionName);
  const prDataDoc = prsRef.doc(date.unix().toString());
  await prDataDoc.set(savedPrData);
  return;
}
