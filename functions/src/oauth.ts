import * as express from "express";
import * as passport from "passport";
import { v4 as uuid } from "uuid";

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
          const userUuid = existUserId ?? uuid();
          const userData = {
            twitter: {
              id: twitterUser.profile.id,
              username: twitterUser.profile.username,
              displayName: twitterUser.profile.displayName,
              icon: twitterUser.profile.photos[0].value,
            },
          };
          firestore.saveUserData(userUuid, userData);
        })
        .then(() => {
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
