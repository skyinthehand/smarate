import * as express from "express";

import * as firestore from "./firestore";

// eslint-disable-next-line new-cap
export const router = express.Router();

router.get("/", (req, res, next) => {
  if (
    !req.session ||
    !req.session.passport ||
    !req.session.userId ||
    !req.session.seasonId
  ) {
    res.redirect("/");
    return;
  }

  const userId = req.session.userId;
  const seasonId = req.session.seasonId;

  const convertMatchDataToRender = async (matchData: firestore.IMatchData) => {
    const user0Data = await firestore.getUserData(
      matchData.user0MatchData.userId
    );
    if (!user0Data) {
      throw new Error("no user data");
    }
    if (!matchData.user1MatchData) {
      return {
        user0TwitterData: user0Data.twitter,
        matchData: matchData,
      };
    }
    const user1Data = await firestore.getUserData(
      matchData.user1MatchData.userId
    );
    if (!user1Data) {
      throw new Error("no user data");
    }
    return {
      user0TwitterData: user0Data.twitter,
      user1TwitterData: user1Data.twitter,
      matchData: matchData,
    };
  };

  firestore
    .getMatchByUserIdAndSeasonId(userId, seasonId)
    .then((matchData) => {
      if (!req.session) {
        throw new Error("no session");
      }
      if (matchData !== null) {
        convertMatchDataToRender(matchData).then((renderData) => {
          res.render("match/index", renderData);
        });
      }
      firestore.createMatch(userId, seasonId).then((matchData) => {
        if (matchData === null) {
          throw new Error("failed to create match data");
        }
        convertMatchDataToRender(matchData).then((renderData) => {
          res.render("match/index", renderData);
        });
      });
    })
    .catch((err) => {
      if (next) {
        next(err);
      }
    });
});

router.post("/room", (req, res) => {
  if (
    !req.session ||
    !req.session.passport ||
    !req.session.userId ||
    !req.session.seasonId
  ) {
    res.redirect("/");
    return;
  }

  const roomId = req.body.roomId;

  const roomIdRegExp = /^[a-zA-Z0-9]{5}$/;

  if (!roomIdRegExp.test(roomId)) {
    res.redirect("/match");
    return;
  }

  const userId = req.session.userId;
  const seasonId = req.session.seasonId;
  firestore.updateMatchRoomId(userId, seasonId, roomId).then(() => {
    res.redirect("/match");
  });
});
