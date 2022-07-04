import * as functions from "firebase-functions";
import axios from "axios";

const config = functions.config();
const smashggAuthToken = config.smashgg.authtoken as string;

/**
 * smashggAPIを叩いて結果取得
 * @param {string} query
 * @param {Record<string, unknown>} variables
 * @return {any}
 */
export async function requestSmashgg(
  query: string,
  variables: Record<string, unknown>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const res = await axios.post(
    "https://api.smash.gg/gql/alpha",
    {
      query,
      variables,
    },
    {
      headers: {
        Authorization: `Bearer ${smashggAuthToken}`,
      },
    }
  );
  return res.data.data;
}
