import * as functions from "firebase-functions";
import * as express from "express";
import axios from "axios";

const config = functions.config();
const smashggAuthToken = config.smashgg.authtoken as string;

// eslint-disable-next-line new-cap
export const router = express.Router();

router.get("/", (req, res) => {
  getJpr();

  /**
   * smashgg叩くところ
   */
  async function getJpr() {
    const smashggRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query TournamentsByCountry {
          tournaments(query: {
            perPage: 4
            page: 2
            filter: {
              countryCode: "JP"
              past: true
              videogameIds: [
                1386
              ]
            }
          }) {
            nodes {
              id
              name
              countryCode
            }
          }
        },`,
        variables: {
          cCode: "JP",
          perPage: 4,
          page: 2,
        },
        operationName: "TournamentsByCountry",
      },
      {
        headers: {
          Authorization: `Bearer ${smashggAuthToken}`,
        },
      }
    );
    res.send(smashggRes.data);
  }
});
