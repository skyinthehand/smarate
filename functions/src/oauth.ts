import * as express from "express";
import * as passport from "passport";
import { v4 as uuid } from "uuid";
import * as moment from "moment-timezone";

import * as firestore from "./firestore";

// eslint-disable-next-line new-cap
export const router = express.Router();

router.get("/", passport.authenticate("twitter"));

router.get(
  "/callback",
  passport.authenticate("twitter", { failureRedirect: "/login" }),
  (req, res, next) => {
    if (req.user) {
      // TODO: 型安全
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const twitterUser = req.user as any;
      firestore
        .getUserIdByTwitterId(twitterUser.profile.id)
        .then((existUserId) => {
          const currentDate = moment.tz("Asia/Tokyo").toDate();
          const userData: firestore.IUserData = {
            twitter: {
              id: twitterUser.profile.id,
              username: twitterUser.profile.username,
              displayName: twitterUser.profile.displayName,
              icon: twitterUser.profile.photos[0].value,
            },
            updatedDate: currentDate,
          };
          if (existUserId) {
            return firestore.updateUserData(existUserId, userData);
          }
          const userUuid = uuid();
          userData.createdDate = currentDate;
          return firestore.createUserData(userUuid, userData);
        })
        .then((userId) => {
          if (!req.session || !req.session.seasonId) {
            res.redirect("/");
            return;
          }
          req.session.userId = userId;
          const seasonId = req.session.seasonId;
          firestore.getUserSeasonId(userId, seasonId).then((userSeasonId) => {
            if (userSeasonId) {
              return userSeasonId;
            }
            return firestore.createUserSeason(userId, seasonId);
          });
        })
        .then((userSeasonId) => {
          if (!req.session) {
            res.redirect("/");
            return;
          }
          req.session.userSeasonId = userSeasonId;
          res.redirect("/my");
        })
        .catch((err) => {
          if (next) {
            next(err);
          }
        });
    }
  }
);
