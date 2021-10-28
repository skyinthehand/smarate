import * as functions from "firebase-functions";
import * as express from "express";
import axios from "axios";
import * as moment from "moment-timezone";

const config = functions.config();
const smashggAuthToken = config.smashgg.authtoken as string;

// eslint-disable-next-line new-cap
export const router = express.Router();

const placementToPoint: { [key: number]: number } = {
  1: 800,
  2: 700,
  3: 600,
  4: 500,
  5: 400,
  7: 288,
  9: 192,
  13: 128,
  17: 80,
  25: 40,
  33: 16,
  49: 8,
  65: 4,
  97: 2,
};

interface IUser {
  id: string;
}

interface IPlayer {
  user: IUser;
}

interface IParticipants {
  player: IPlayer;
}

interface IEntrant {
  id: string;
  name: string;
  participants: IParticipants[];
}

interface IStanding {
  placement: number;
  entrant: IEntrant;
}

interface IEvent {
  id: string;
  name: string;
  numEntrants: number;
  standings?: {
    nodes: IStanding[];
  };
}

interface ITournament {
  id: string;
  name: string;
  endAt: number;
  events?: IEvent[];
}

interface IConvertedStanding {
  id: string;
  name: string;
  point: number;
  placement: number;
  tournamentName: string;
  eventName: string;
}

interface IPlayerRank {
  id: string;
  name: string;
  point?: number;
  standings: IConvertedStanding[];
}

router.get("/", (req, res) => {
  getJpr();

  /**
   * 対象のevent取得
   */
  async function getEvents(): Promise<IEvent[]> {
    const afterDate = getAfterDateThreshold();
    const eventRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query TournamentsByCountry ($afterDate: Timestamp!) {
          tournaments(query: {
            perPage: 100
            page: 1
            filter: {
              countryCode: "JP"
              past: true
              afterDate: $afterDate
              videogameIds: [
                1386
              ]
            }
          }) {
            nodes {
              id
              name
              countryCode
              endAt
              events {
                id
                name
                numEntrants
              }
            }
          }
        }`,
        variables: {
          afterDate,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${smashggAuthToken}`,
        },
      }
    );
    const tournaments: Required<ITournament>[] =
      eventRes.data.data.tournaments.nodes;
    return tournaments
      .map((tournament) => {
        return tournament.events;
      })
      .flat();

    /**
     * 算出対象イベントの開始日時
     * @return {number}
     */
    function getAfterDateThreshold(): number {
      const oneYearBefore = moment
        .tz("Asia/Tokyo")
        .subtract(1, "years")
        .startOf("day")
        .unix();
      return oneYearBefore;
    }
  }

  /**
   * 対象のevent結果取得
   * @param {string} eventId
   */
  async function getEventStandings(
    eventId: string
  ): Promise<IConvertedStanding[]> {
    const standingsRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query EventStandings($eventId: ID!) {
        event(id: $eventId) {
          id
          name
          tournament {
            id
            name
            endAt
          }
          standings(query: {
            perPage: 128,
            page: 1
          }){
            nodes {
              placement
              entrant {
                id
                name
                participants {
                  player {
                    user {
                      id
                    }
                  }
                }
              }
            }
          }
        }
      }`,
        variables: {
          eventId,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${smashggAuthToken}`,
        },
      }
    );
    const tournamentName = standingsRes.data.data.event.tournament.name;
    const endAt = standingsRes.data.data.event.tournament.endAt;
    const eventName = standingsRes.data.data.event.name;
    const standings = standingsRes.data.data.event.standings.nodes;
    return standings
      .filter((standing: IStanding) => {
        return standing.entrant.participants[0].player.user;
      })
      .map((standing: IStanding) => {
        const point = placementToGradientPoint(standing.placement);
        return {
          id: standing.entrant.participants[0].player.user.id,
          name: standing.entrant.name,
          point,
          placement: standing.placement,
          tournamentName: tournamentName,
          eventName: eventName,
        };
      });

    /**
     * 順位をポイントに変換
     * @param {number} placement
     * @return {number}
     */
    function placementToGradientPoint(placement: number): number {
      const originalPoint = getPointFromPlacement(placement);
      const oldGradient =
        (moment.tz("Asia/Tokyo").startOf("day").unix() - endAt) /
        (365 * 24 * 60 * 60);
      return Math.round(originalPoint * Math.pow(Math.E, -oldGradient));
    }

    /**
     * 順位以下で最大のポイントを取得
     * @param {number} placement
     * @return {number}
     */
    function getPointFromPlacement(placement: number): number {
      const underStandingPoints = Object.entries(placementToPoint)
        .filter(([key]) => {
          return Number.parseInt(key) >= placement;
        })
        .sort((a, b) => {
          return -(a[1] - b[1]);
        });
      if (underStandingPoints.length < 1) {
        return 0;
      }
      return underStandingPoints[0][1];
    }
  }

  /**
   * smashgg叩くところ
   */
  async function getJpr() {
    const events = await getEvents();
    const targetEvents = events.filter((event) => {
      return event.numEntrants >= 128;
    });
    const standings = (
      await Promise.all(
        targetEvents.map(async (event) => {
          return await getEventStandings(event.id);
        })
      )
    ).flat();

    const jpr = standings
      .reduce(
        (
          playerRankList: IPlayerRank[],
          convertedStanding: IConvertedStanding
        ): IPlayerRank[] => {
          const playerRank = playerRankList.find((pr) => {
            return pr.id === convertedStanding.id;
          });
          if (playerRank) {
            playerRank.standings.push(convertedStanding);
            return playerRankList;
          }
          playerRankList.push({
            id: convertedStanding.id,
            name: convertedStanding.name,
            standings: [convertedStanding],
          });
          return playerRankList;
        },
        []
      )
      .map((playerRank: IPlayerRank): Required<IPlayerRank> => {
        const topTournamentsNum = 4;
        if (playerRank.standings.length < topTournamentsNum) {
          return Object.assign(playerRank, {
            point: summerizePlayerPoint(playerRank.standings),
          });
        }
        const topStandings = playerRank.standings
          .sort((a: IConvertedStanding, b: IConvertedStanding) => {
            return -(a.point - b.point);
          })
          .slice(0, topTournamentsNum);
        playerRank.standings = topStandings;
        return Object.assign(playerRank, {
          point: summerizePlayerPoint(playerRank.standings),
        });
      })
      .sort((a: Required<IPlayerRank>, b: Required<IPlayerRank>) => {
        return -(a.point - b.point);
      });

    res.render("jpr/index", {
      jpr,
    });

    /**
     * 順位ポイントの合計を返す
     * @param {IConvertedStanding[]} standings
     * @return {number}
     */
    function summerizePlayerPoint(standings: IConvertedStanding[]): number {
      return standings.reduce((sumPoint, standing) => {
        return sumPoint + standing.point;
      }, 0);
    }
  }
});
