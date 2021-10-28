import * as functions from "firebase-functions";
import * as express from "express";
import axios from "axios";

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
  events: IEvent[];
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
  point: number;
  standings: IConvertedStanding[];
}

router.get("/", (req, res) => {
  getJpr();

  /**
   * 対象のevent取得
   */
  async function getEvents(): Promise<IEvent[]> {
    const eventRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query TournamentsByCountry {
          tournaments(query: {
            perPage: 100
            page: 1
            filter: {
              countryCode: "JP"
              past: true
              afterDate: 1633014000
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
      },
      {
        headers: {
          Authorization: `Bearer ${smashggAuthToken}`,
        },
      }
    );
    const tournaments: ITournament[] = eventRes.data.data.tournaments.nodes;
    return tournaments
      .map((tournament) => {
        return tournament.events;
      })
      .flat();
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
            name
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
    const eventName = standingsRes.data.data.event.name;
    const standings = standingsRes.data.data.event.standings.nodes;
    return standings
      .filter((standing: IStanding) => {
        return standing.entrant.participants[0].player.user;
      })
      .map((standing: IStanding) => {
        const point = placementToPoint[standing.placement];
        return {
          id: standing.entrant.participants[0].player.user.id,
          name: standing.entrant.name,
          point,
          placement: standing.placement,
          tournamentName: tournamentName,
          eventName: eventName,
        };
      });
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
            playerRank.point += convertedStanding.point;
            playerRank.standings.push(convertedStanding);
            return playerRankList;
          }
          playerRankList.push({
            id: convertedStanding.id,
            name: convertedStanding.name,
            point: convertedStanding.point,
            standings: [convertedStanding],
          });
          return playerRankList;
        },
        []
      )
      .sort((a: IPlayerRank, b: IPlayerRank) => {
        return -(a.point - b.point);
      });

    res.render("jpr/index", {
      jpr,
    });
  }
});
