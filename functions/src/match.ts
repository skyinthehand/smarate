import * as express from "express";

import * as firestore from "./firestore";

// eslint-disable-next-line new-cap
export const router = express.Router();

router.get("/", (req, res) => {
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
  firestore.getMatchByUserIdAndSeasonId(userId, seasonId).then((matchData) => {
    if (matchData !== null) {
      res.render("match", {
        matchData: matchData,
      });
      return;
    }

    firestore.createMatch(userId, seasonId).then((matchData) => {
      res.render("match", {
        matchData: matchData,
      });
      return;
    });
  });
});
