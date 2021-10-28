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
  participants: IParticipants;
}

interface IStanding {
  placement: number;
  entrant: IEntrant;
}

interface IEvent {
  id: string;
  name: string;
  standings: {
    nodes: IStanding[];
  };
}

interface IConvertedEvent extends IEvent {
  endAt: number;
  tournamentName: string;
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
   * smashgg叩くところ
   */
  async function getJpr() {
    const smashggRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query TournamentsByCountry($perPage: Int!, $page: Int!) {
          tournaments(query: {
            perPage: $perPage
            page: $page
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
              endAt
              events {
                id
                name
                standings(query: {
                  perPage: 128
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
            }
          }
        },`,
        variables: {
          cCode: "JP",
          perPage: 10,
          page: 1,
        },
        operationName: "TournamentsByCountry",
      },
      {
        headers: {
          Authorization: `Bearer ${smashggAuthToken}`,
        },
      }
    );
    const tournaments: ITournament[] = smashggRes.data.data.tournaments.nodes;
    const jpr = tournaments
      .map((tournament: ITournament): IConvertedEvent[] => {
        const targetEvents = tournament.events.filter((event) => {
          return event.standings.nodes.length >= 128;
        });
        return targetEvents.map((event: IEvent): IConvertedEvent => {
          return {
            id: event.id,
            name: event.name,
            standings: event.standings,
            endAt: tournament.endAt,
            tournamentName: tournament.name,
          };
        });
      })
      .flat()
      .map((event: IConvertedEvent): IConvertedStanding[] => {
        return event.standings.nodes.map((standing: IStanding) => {
          const point = placementToPoint[standing.placement];
          return {
            id: standing.entrant.participants.player.user.id,
            name: standing.entrant.name,
            point,
            placement: standing.placement,
            tournamentName: event.tournamentName,
            eventName: event.name,
          };
        });
      })
      .flat()
      .reduce(
        (
          playerRankList: IPlayerRank[],
          convertedStanding: IConvertedStanding
        ): IPlayerRank[] => {
          const playerRank = playerRankList.find((pr) => {
            pr.id === convertedStanding.id;
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
    res.send(jpr);
  }
});
