import * as functions from "firebase-functions";
import axios from "axios";
import * as moment from "moment-timezone";
import { Moment } from "moment";

import * as prFirestore from "./firestore_pr";

const config = functions.config();
const smashggAuthToken = config.smashgg.authtoken as string;

interface IPlacementToPoint {
  placement: number;
  point: number;
}

export interface IPrSetting {
  countryCode: string;
  minimumEntrantNum: number;
  collectionName: string;
  expireColonaLimitation?: number;
  displaySetting: IPrDisplaySetting;
}

interface IPrDisplaySetting {
  countryName: string;
  prName: string;
  // 参考記録かどうか
  isRef: boolean;
}

export const placementToPointList: IPlacementToPoint[] = [
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
  type: number;
  videogame: {
    id: number;
  };
  standings?: IStandingWithEventInfo[];
}

interface IExpandedEvent extends IEvent {
  tournamentName: string;
  endAt: number;
}

interface ITournament {
  id: string;
  name: string;
  endAt: number;
  events?: IEvent[];
}

interface IStandingWithPoint {
  id: string;
  name: string;
  point: number;
  placement: number;
  eventId: string;
}

interface IStandingWithEventInfo extends IStandingWithPoint {
  tournamentName: string;
  eventName: string;
  endAt: number;
}

interface IPlayerRank {
  id: string;
  name: string;
  point?: number;
  standings: IStandingWithEventInfo[];
}

interface IPlayerRankWithPlacement extends Required<IPlayerRank> {
  placement: number;
}

/**
 * 順位データが見つからなかった時（なぜかsmashgg側でunknownエラーになる時）のエラー
 */
class StandingDataNotFoundError extends Error {
  /**
   * コンストラクタ
   * @param {string} message
   */
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ISavedPrData {
  data: {
    events: IExpandedEvent[];
    scheduledEvents: IExpandedEvent[];
    prData: IPlayerRankWithPlacement[];
  };
}

export interface ISavedErrorData {
  data: {
    error: string;
  };
}

/**
 * 保存データがエラーデータかどうかを判定
 * @param {ISavedPrData | ISavedErrorData} savedData
 * @return {boolean}
 */
export function isSavedErrorData(
  savedData: ISavedPrData | ISavedErrorData
): savedData is ISavedErrorData {
  return (
    savedData !== null &&
    typeof savedData === "object" &&
    "error" in savedData.data
  );
}

/**
 * prSettingに対応したprDataを作成済みかどうか判定して返す
 * @param {IPrSetting} prSetting
 * @param {Moment} baseDate
 * @return {Promise<boolean>}
 */
export async function checkPrData(
  prSetting: IPrSetting,
  baseDate: Moment
): Promise<boolean> {
  const cachedPrData = await prFirestore.getPrData(
    baseDate,
    prSetting.collectionName
  );
  return !!cachedPrData;
}

/**
 * 算出基準時間の取得
 * @param {string?} dateStr
 * @return {Moment}
 */
export function getBaseDate(dateStr?: string): Moment {
  if (dateStr) {
    return moment(dateStr).tz("Asia/Tokyo").startOf("day");
  }
  return moment.tz("Asia/Tokyo").startOf("day");
}

/**
 * キャッシュもしくは生成してprDataを取得
 * @param {IPrSetting} prSetting
 * @param {Moment} baseDate
 * @return {Promise<IPrData>}
 */
export async function getPrDataFromCacheOrRunCreate(
  prSetting: IPrSetting,
  baseDate: Moment
): Promise<ISavedPrData | ISavedErrorData | null> {
  const cachedPrData = await prFirestore.getPrData(
    baseDate,
    prSetting.collectionName
  );
  if (!cachedPrData) {
    createPrDataAndSave(baseDate, prSetting);
  }
  return cachedPrData;
}

/**
 * prDataを作成してキャッシュに保存
 * @param {Moment} baseDate
 * @param {IPrSetting} prSetting
 * @return {Promise<IPrData | ISavedErrorData>}
 */
async function createPrDataAndSave(
  baseDate: Moment,
  prSetting: IPrSetting
): Promise<ISavedPrData | ISavedErrorData> {
  try {
    const prData = await createPrData(baseDate, prSetting);
    await prFirestore.setPrData(baseDate, prData, prSetting.collectionName);
    return prData;
  } catch (e) {
    if (e instanceof Error) {
      const errorData: ISavedErrorData = {
        data: { error: JSON.stringify(e, Object.getOwnPropertyNames(e)) },
      };
      await prFirestore.setPrData(
        baseDate,
        errorData,
        prSetting.collectionName
      );
      return errorData;
    }
    throw e;
  }
}
/**
 * 対象のevent取得
 * @param {number} afterDateUnixTime
 * @param {number} beforeDateUnixTime
 * @param {IPrSetting} prSetting
 * @return {IExpandedEvent[]}
 */
async function getEvents(
  afterDateUnixTime: number,
  beforeDateUnixTime: number,
  prSetting: IPrSetting
): Promise<IExpandedEvent[]> {
  const countryCode = prSetting.countryCode;

  /**
   * ページ内のevent取得
   * @param {number} page
   * @return {Promise<IExpandedEvent[]>}
   */
  async function getEventsInPage(page: number): Promise<IExpandedEvent[]> {
    const eventRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query TournamentsByCountry
        ($afterDate: Timestamp!, $beforeDate: Timestamp!,
          $countryCode: String!, $page: Int!) {
          tournaments(query: {
            perPage: 100
            page: $page
            filter: {
              countryCode: $countryCode
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
                type
                videogame {
                  id
                }
              }
            }
          }
        }`,
        variables: {
          afterDate: afterDateUnixTime,
          beforeDate: beforeDateUnixTime,
          countryCode,
          page,
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
        return tournament.events.map((event) => {
          const expandedEvent: IExpandedEvent = {
            ...event,
            tournamentName: tournament.name,
            endAt: tournament.endAt,
          };
          return expandedEvent;
        });
      })
      .flat();
  }

  const events: IExpandedEvent[] = [];
  // 最大でも100ページまで
  for (let page = 1; page <= 1000; page++) {
    const eventsInPage = await getEventsInPage(page);
    events.push(...eventsInPage);
    if (eventsInPage.length < 1) {
      break;
    }
  }

  return events.filter((event) => {
    return (
      event.videogame.id === 1386 &&
      !event.name.includes("Squad") &&
      !event.tournamentName.includes("ビギナーズ") &&
      !event.tournamentName.includes("マスターズ") &&
      event.type === 1
    );
  });
}

/**
 * 算出対象イベントの開始日時
 * @param {Moment} baseDate
 * @param {number?} expireColonaLimitation
 * @return {number}
 */
function getAfterDateThresholdUnixTime(
  baseDate: Moment,
  expireColonaLimitation?: number
): number {
  const oneYearBefore = baseDate.clone().subtract(1, "years");
  const oneYearBeforeUnix = oneYearBefore.unix();
  // コロナ禍明け前は無視する
  // NOTE: 1年超えたら判定を消す
  if (expireColonaLimitation && oneYearBeforeUnix < expireColonaLimitation) {
    return expireColonaLimitation;
  }
  return oneYearBeforeUnix;
}

/**
 * 対象のevent結果取得
 * @param {string} eventId
 * @param {Moment} baseDate
 * @return {IStandingWithEventInfo[]}
 */
async function getEventStandings(
  eventId: string,
  baseDate: Moment
): Promise<IStandingWithEventInfo[]> {
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
          videogame {
            id
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
  if (!standingsRes.data.data) {
    return Promise.reject(
      new StandingDataNotFoundError("data not found error")
    );
  }
  const tournamentName = standingsRes.data.data.event.tournament.name;
  const endAt = standingsRes.data.data.event.tournament.endAt;
  const eventName = standingsRes.data.data.event.name;
  const numEntrants = standingsRes.data.data.event.numEntrants;
  const standings = standingsRes.data.data.event.standings.nodes;
  return standings
    .filter((standing: IStanding) => {
      return standing.entrant.participants[0].player.user;
    })
    .map((standing: IStanding): IStandingWithEventInfo => {
      const point = placementToGradientPoint(
        standing.placement,
        placementToPointList,
        numEntrants,
        baseDate
      );
      return {
        id: standing.entrant.participants[0].player.user.id,
        name: standing.entrant.name,
        point,
        placement: standing.placement,
        tournamentName: tournamentName,
        eventId,
        eventName: eventName,
        endAt,
      };
    });

  /**
   * 順位をポイントに変換
   * @param {number} placement
   * @param {IPlacementToPoint[]} placementToPointList
   * @param {number} numEntrants
   * @param {Moment} baseDate
   * @return {number}
   */
  function placementToGradientPoint(
    placement: number,
    placementToPointList: IPlacementToPoint[],
    numEntrants: number,
    baseDate: Moment
  ): number {
    const originalPoint = getPointFromPlacement(
      placement,
      placementToPointList
    );
    const oldGradient = (baseDate.unix() - endAt) / (365 * 24 * 60 * 60);
    return originalPoint * numEntrants * Math.pow(Math.E, 1 - oldGradient);
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
 * @param {IPrSetting} prSetting
 * @return {ISavedPrData}
 */
async function createPrData(
  baseDate: Moment,
  prSetting: IPrSetting
): Promise<ISavedPrData> {
  const afterDateUnixTime = getAfterDateThresholdUnixTime(
    baseDate,
    prSetting.expireColonaLimitation
  );
  const beforeDateUnixTime = baseDate.unix();
  const targetEvents = (
    await getEvents(afterDateUnixTime, beforeDateUnixTime, prSetting)
  ).filter((event) => {
    return (
      event.numEntrants >= prSetting.minimumEntrantNum &&
      event.state === EActivityState.COMPLETED
    );
  });
  const scheduledEvents = await getEvents(
    baseDate.unix(),
    baseDate.clone().add(1, "years").unix(),
    prSetting
  );
  const eventStandingDict: Array<Required<IExpandedEvent>> = await Promise.all(
    targetEvents.map(async (event): Promise<Required<IExpandedEvent>> => {
      try {
        event.standings = await getEventStandings(event.id, baseDate);
      } catch (e) {
        if (e instanceof StandingDataNotFoundError) {
          event.standings = [];
        }
      }
      return event as Required<IExpandedEvent>;
    })
  );
  const standings = eventStandingDict
    .map((eventStanding) => {
      return eventStanding.standings;
    })
    .flat();

  let prevPlacement = 0;
  let prevPoint = 0;
  const prData = standings
    .reduce(
      (
        playerRankList: IPlayerRank[],
        convertedStanding: IStandingWithEventInfo
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
        .sort((a: IStandingWithEventInfo, b: IStandingWithEventInfo) => {
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

  return {
    data: { events: eventStandingDict, scheduledEvents, prData },
  };

  /**
   * 順位ポイントの合計を返す
   * @param {IStandingWithEventInfo[]} standings
   * @return {number}
   */
  function summerizePlayerPoint(standings: IStandingWithEventInfo[]): number {
    return standings.reduce((sumPoint, standing) => {
      return sumPoint + standing.point;
    }, 0);
  }
}
