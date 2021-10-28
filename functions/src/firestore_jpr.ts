import * as admin from "firebase-admin";

import { IJprData } from "./jpr";
import { Moment } from "moment";

interface ISavedJprData {
  data: IJprData;
}

/**
 * Get jpr data
 * @param {Moment} date
 * @return {Promise<IJprData | null>}
 */
export async function getJprData(date: Moment): Promise<IJprData | null> {
  const db = admin.firestore();
  const jprsRef = db.collection("jprs");
  const jprDataDoc = await jprsRef.doc(date.unix().toString()).get();
  if (!jprDataDoc.exists) {
    return null;
  }
  const savedJprData = jprDataDoc.data() as ISavedJprData;
  return savedJprData.data;
}

/**
 * Create jpr data
 * @param {Moment} date
 * @param {IJprData} jprData
 * @return {Promise<string | null>}
 */
export async function setJprData(
  date: Moment,
  jprData: IJprData
): Promise<void> {
  const db = admin.firestore();
  const jprsRef = db.collection("jprs");
  const jprDataDoc = jprsRef.doc(date.unix().toString());
  await jprDataDoc.set({ data: jprData });
  return;
}
