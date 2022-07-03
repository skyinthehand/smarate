import * as admin from "firebase-admin";

import { ISavedErrorData, ISavedPrData, isSavedErrorData } from "./pr";
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
): Promise<ISavedPrData | ISavedErrorData | null> {
  const db = admin.firestore();
  const prsRef = db.collection(collectionName);
  const prDataDoc = await prsRef.doc(date.unix().toString()).get();
  if (!prDataDoc.exists) {
    return null;
  }
  const savedData = prDataDoc.data() as ISavedPrData | ISavedErrorData;
  if (isSavedErrorData(savedData)) {
    return savedData as ISavedErrorData;
  }
  return savedData as ISavedPrData;
}

/**
 * Create pr data
 * @param {Moment} date
 * @param {ISavedPrData | ISavedErrorData} savedData
 * @param {string} collectionName
 * @return {Promise<string | null>}
 */
export async function setPrData(
  date: Moment,
  savedData: ISavedPrData | ISavedErrorData,
  collectionName: string
): Promise<void> {
  const db = admin.firestore();
  const prsRef = db.collection(collectionName);
  const prDataDoc = prsRef.doc(date.unix().toString());
  await prDataDoc.set(savedData);
  return;
}

/**
 * Get slug data
 * @param {string} collectionName
 * @return {Promise<string[]>}
 */
export async function getSlugData(collectionName: string): Promise<string[]> {
  const db = admin.firestore();
  const slugsRef = db.collection(collectionName);
  const slugs = await slugsRef.get();
  return slugs.docs.map((slugDoc) => slugDoc.data().slug);
}
