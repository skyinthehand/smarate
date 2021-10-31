import * as functions from "firebase-functions";
import * as express from "express";
import axios from "axios";
import * as moment from "moment-timezone";
import { Moment } from "moment";
import * as ordinal from "ordinal";

import * as jprFirestore from "./firestore_jpr";

const config = functions.config();
const smashggAuthToken = config.smashgg.authtoken as string;

// eslint-disable-next-line new-cap
export const router = express.Router();

interface IPlacementToPoint {
  placement: number;
  point: number;
}

// entrantNumは参加最低人数
interface IPointByEntrantNum {
  numEntrants: number;
  placementToPointList: IPlacementToPoint[];
}

const minimumEntrantNum = 61;

const pointByEntrantNumList: IPointByEntrantNum[] = [
  {
    numEntrants: minimumEntrantNum,
    placementToPointList: [
      { placement: 1, point: 400 },
      { placement: 2, point: 350 },
      { placement: 3, point: 300 },
      { placement: 4, point: 250 },
      { placement: 5, point: 200 },
      { placement: 7, point: 144 },
      { placement: 9, point: 96 },
      { placement: 13, point: 64 },
      { placement: 17, point: 40 },
      { placement: 25, point: 20 },
      { placement: 33, point: 8 },
      { placement: 49, point: 4 },
      { placement: 65, point: 0 },
      { placement: 97, point: 0 },
    ],
  },
  {
    numEntrants: 121,
    placementToPointList: [
      { placement: 1, point: 800 },
      { placement: 2, point: 700 },
      { placement: 3, point: 600 },
      { placement: 4, point: 500 },
      { placement: 5, point: 400 },
      { placement: 7, point: 288 },
      { placement: 9, point: 192 },
      { placement: 13, point: 128 },
      { placement: 17, point: 80 },
      { placement: 25, point: 40 },
      { placement: 33, point: 16 },
      { placement: 49, point: 8 },
      { placement: 65, point: 4 },
      { placement: 97, point: 2 },
    ],
  },
  {
    numEntrants: 241,
    placementToPointList: [
      { placement: 1, point: 1600 },
      { placement: 2, point: 1400 },
      { placement: 3, point: 1200 },
      { placement: 4, point: 1000 },
      { placement: 5, point: 800 },
      { placement: 7, point: 576 },
      { placement: 9, point: 384 },
      { placement: 13, point: 256 },
      { placement: 17, point: 160 },
      { placement: 25, point: 80 },
      { placement: 33, point: 32 },
      { placement: 49, point: 16 },
      { placement: 65, point: 8 },
      { placement: 97, point: 4 },
    ],
  },
  {
    numEntrants: 481,
    placementToPointList: [
      { placement: 1, point: 3200 },
      { placement: 2, point: 2800 },
      { placement: 3, point: 2400 },
      { placement: 4, point: 2000 },
      { placement: 5, point: 1600 },
      { placement: 7, point: 1152 },
      { placement: 9, point: 768 },
      { placement: 13, point: 512 },
      { placement: 17, point: 320 },
      { placement: 25, point: 160 },
      { placement: 33, point: 64 },
      { placement: 49, point: 32 },
      { placement: 65, point: 16 },
      { placement: 97, point: 8 },
    ],
  },
  {
    numEntrants: 961,
    placementToPointList: [
      { placement: 1, point: 6400 },
      { placement: 2, point: 5600 },
      { placement: 3, point: 4800 },
      { placement: 4, point: 4000 },
      { placement: 5, point: 3200 },
      { placement: 7, point: 2304 },
      { placement: 9, point: 1536 },
      { placement: 13, point: 1024 },
      { placement: 17, point: 640 },
      { placement: 25, point: 320 },
      { placement: 33, point: 128 },
      { placement: 49, point: 64 },
      { placement: 65, point: 32 },
      { placement: 97, point: 16 },
    ],
  },
];

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

enum EActivityState {
  CREATED = "CREATED",
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  READY = "READY",
  INVALID = "INVALID",
  CALLED = "CALLED",
  QUEUED = "QUEUED",
}

interface IEvent {
  id: string;
  name: string;
  numEntrants: number;
  state: EActivityState;
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

export interface IPlayerRank {
  id: string;
  name: string;
  point?: number;
  standings: IConvertedStanding[];
}

export interface IPlayerRankWithPlacement extends Required<IPlayerRank> {
  placement: number;
}

export type IJprData = IPlayerRankWithPlacement[];

router.get("/:dateStr?", (req, res) => {
  renderJpr();

  /**
   * JPRのレンダリング
   */
  async function renderJpr() {
    const baseDate = getBaseDate();
    // 未来日時禁止
    if (baseDate.isAfter(moment().tz("Asia/Tokyo"))) {
      res.redirect(req.baseUrl);
    }
    const jpr = await getJpr(baseDate);

    res.render("jpr/index", {
      jpr,
      ordinal,
      baseDate,
      pointByEntrantNumList,
    });
  }

  /**
   * 算出基準時間の取得
   * @return {Moment}
   */
  function getBaseDate(): Moment {
    const dateStr = req.params.dateStr;
    if (dateStr) {
      return moment(dateStr).tz("Asia/Tokyo").startOf("day");
    }
    return moment.tz("Asia/Tokyo").startOf("day");
  }

  /**
   * キャッシュもしくは生成してjprDataを取得
   * @param {Moment} baseDate
   * @return {Promise<IJprData>}
   */
  async function getJpr(baseDate: Moment): Promise<IJprData> {
    const cachedJprData = await jprFirestore.getJprData(baseDate);
    if (cachedJprData) {
      return cachedJprData;
    }
    const jprData = await createJprData(baseDate);
    await jprFirestore.setJprData(baseDate, jprData);
    return jprData;
  }

  /**
   * 対象のevent取得
   * @param {Moment} baseDate
   */
  async function getEvents(baseDate: Moment): Promise<IEvent[]> {
    const afterDate = getAfterDateThreshold(baseDate);
    const beforeDate = baseDate.unix();
    const eventRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query TournamentsByCountry
        ($afterDate: Timestamp!, $beforeDate: Timestamp!) {
          tournaments(query: {
            perPage: 100
            page: 1
            filter: {
              countryCode: "JP"
              afterDate: $afterDate
              beforeDate: $beforeDate
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
                state
              }
            }
          }
        }`,
        variables: {
          afterDate,
          beforeDate,
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
     * @param {Moment} baseDate
     * @return {number}
     */
    function getAfterDateThreshold(baseDate: Moment): number {
      const oneYearBefore = baseDate.clone().subtract(1, "years");
      const oneYearBeforeUnix = oneYearBefore.unix();
      // コロナ禍明け前は無視する
      // NOTE: 1年超えたら判定を消す
      const expireColonaLimitation = 1633014000;
      if (oneYearBeforeUnix < expireColonaLimitation) {
        return expireColonaLimitation;
      }
      return oneYearBeforeUnix;
    }
  }

  /**
   * 対象のevent結果取得
   * @param {string} eventId
   * @param {Moment} baseDate
   */
  async function getEventStandings(
    eventId: string,
    baseDate: Moment
  ): Promise<IConvertedStanding[]> {
    const standingsRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query EventStandings($eventId: ID!) {
        event(id: $eventId) {
          id
          name
          numEntrants
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
    const numEntrants = standingsRes.data.data.event.numEntrants;
    const standings = standingsRes.data.data.event.standings.nodes;
    const placementToPointList = getPlacementToPointList(numEntrants);
    return standings
      .filter((standing: IStanding) => {
        return standing.entrant.participants[0].player.user;
      })
      .map((standing: IStanding) => {
        const point = placementToGradientPoint(
          standing.placement,
          placementToPointList,
          baseDate
        );
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
     * 参加人数からポイント表を引く
     * @param {number} numEntrants
     * @return {IPlacementToPoint[]}
     */
    function getPlacementToPointList(numEntrants: number): IPlacementToPoint[] {
      const filteredPointByEntrantNumList = pointByEntrantNumList
        .filter((placementToPointList) => {
          return placementToPointList.numEntrants <= numEntrants;
        })
        .sort((a, b) => {
          return -(a.numEntrants - b.numEntrants);
        });
      if (filteredPointByEntrantNumList.length < 1) {
        return [];
      }
      return filteredPointByEntrantNumList[0].placementToPointList;
    }

    /**
     * 順位をポイントに変換
     * @param {number} placement
     * @param {IPlacementToPoint[]} placementToPointList
     * @param {Moment} baseDate
     * @return {number}
     */
    function placementToGradientPoint(
      placement: number,
      placementToPointList: IPlacementToPoint[],
      baseDate: Moment
    ): number {
      const originalPoint = getPointFromPlacement(
        placement,
        placementToPointList
      );
      const oldGradient = (baseDate.unix() - endAt) / (365 * 24 * 60 * 60);
      return originalPoint * Math.pow(Math.E, 1 - oldGradient);
    }

    /**
     * 順位以下で最大のポイントを取得
     * @param {number} placement
     * @param {IPlacementToPoint[]} placementToPointList
     * @return {number}
     */
    function getPointFromPlacement(
      placement: number,
      placementToPointList: IPlacementToPoint[]
    ): number {
      const underStandingPoints = placementToPointList
        .filter((placementToPoint) => {
          return placementToPoint.placement >= placement;
        })
        .sort((a, b) => {
          return -(a.point - b.point);
        });
      if (underStandingPoints.length < 1) {
        return 0;
      }
      return underStandingPoints[0].point;
    }
  }

  /**
   * smashgg叩くところ
   * @param {Moment} baseDate
   */
  async function createJprData(baseDate: Moment): Promise<IJprData> {
    const events = await getEvents(baseDate);
    const targetEvents = events.filter((event) => {
      return (
        event.state === EActivityState.COMPLETED &&
        event.numEntrants >= minimumEntrantNum
      );
    });
    const standings = (
      await Promise.all(
        targetEvents.map(async (event) => {
          return await getEventStandings(event.id, baseDate);
        })
      )
    ).flat();

    let prevPlacement = 0;
    let prevPoint = 0;
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
      })
      .map((playerRank, index): IPlayerRankWithPlacement => {
        // TODO: マジックナンバーの削除
        // 0.01以内は同じ順位と見なす
        if (Math.abs(playerRank.point - prevPoint) < 0.01) {
          prevPoint = playerRank.point;
          return Object.assign(playerRank, {
            placement: prevPlacement,
          });
        }
        prevPoint = playerRank.point;
        prevPlacement = index + 1;
        return Object.assign(playerRank, {
          placement: prevPlacement,
        });
      });

    return jpr;

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
