import * as express from "express";
import * as passport from "passport";
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {v4 as uuid} from "uuid";

// eslint-disable-next-line new-cap
export const router = express.Router();

admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

router.get("/",
    passport.authenticate("twitter"),
);

router.get("/callback",
    passport.authenticate(
        "twitter", {failureRedirect: "/login"}
    ),
    (req, res, next) => {
      if (req.user) {
        // TODO: 型安全
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const twitterUser = req.user as any;

        const usersRef = db.collection("users");
        const getUserId = async () => {
          try {
            const querySnapshot = await
            usersRef.where("twitter.id", "==", twitterUser.profile.id).get();
            if (querySnapshot.docs.length > 0) {
              const doc = querySnapshot.docs[0];
              return doc.id;
            }
          } catch (err) {
            next(err);
          }
          return null;
        };
        getUserId().then((existUserId) => {
          const userUuid = existUserId ?? uuid();
          const userData = {
            twitter: {
              id: twitterUser.profile.id,
              username: twitterUser.profile.username,
              displayName: twitterUser.profile.displayName,
              icon: twitterUser.profile.photos[0].value,
            },
          };
          usersRef.doc(userUuid).set(userData)
              .then(() => {
                res.redirect("/my");
              })
              .catch((error) => {
                next(error);
              });
        });
      }
    }
);
