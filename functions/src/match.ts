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
  firestore
    .getMatchByUserIdAndSeasonId(userId, seasonId)
    .then((matchData) => {
      if (!req.session) {
        throw new Error("no session");
      }
      if (matchData !== null) {
        res.render("match/index", {
          twitterData: req.session.twitter,
          matchData: matchData,
        });
        return;
      }

      firestore.createMatch(userId, seasonId).then((matchData) => {
        if (matchData === null) {
          throw new Error("no match data");
        }
        if (!req.session) {
          throw new Error("no session");
        }
        res.render("match/index", {
          twitterData: req.session.twitter,
          matchData: matchData,
        });
        return;
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
