import * as functions from "firebase-functions";
import * as express from "express";
import * as passport from "passport";
import { IStrategyOption, Strategy as TwitterStrategy } from "passport-twitter";
import * as session from "express-session";
import * as moment from "moment-timezone";

import * as firestore from "./firestore";
import { router as oauth } from "./oauth";
import { router as match } from "./match";

const config = functions.config();
const twitterConfig: IStrategyOption = {
  consumerKey: config.twitter.consumerkey as string,
  consumerSecret: config.twitter.consumersecret as string,
  callbackURL: "http://localhost:5000/oauth/callback",
};
const twitterStrategy = new TwitterStrategy(
  twitterConfig,
  (accessToken, refreshToken, profile, done) => {
    return done(null, { profile });
  }
);
passport.use(twitterStrategy);
passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, null);
});

declare module "express-session" {
  export interface SessionData {
    passport: {
      user: {
        profile: {
          id: string;
          username: string;
          displayName: string;
          photos: {
            value: string;
          }[];
        };
      };
    };
  }
}

const seasonChecker: express.Handler = (req, res, next) => {
  const currentTime = moment().toDate();

  firestore
    .getSeasonId(currentTime)
    .then((currentSeasonId) => {
      if (currentSeasonId !== null) {
        return currentSeasonId;
      }
      const nextSeasonStartTime = moment
        .tz("Asia/Tokyo")
        .subtract(5, "days")
        .startOf("month")
        .toDate();
      return firestore.createSeason(nextSeasonStartTime);
    })
    .then((seasonId) => {
      if (req.session) {
        req.session.seasonId = seasonId;
      }
      next();
    });
};

firestore.initialize();

const app = express();

app.use(passport.initialize());
app.set("trust proxy", 1);
app.use(
  session({
    secret: "secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.set("view engine", "ejs");

app.use(seasonChecker);

app.get("/", (req, res) => {
  if (!req.session || !req.session.userId) {
    res.render("index", {
      userId: null,
      seasonId: null,
    });
    return;
  }
  res.render("index", {
    userId: req.session.userId,
    seasonId: req.session.seasonId,
  });
});

app.use("/oauth", oauth);

app.get("/my", (req, res) => {
  if (!req.session || !req.session.passport) {
    res.redirect("/");
    return;
  }
  res.render("my", {
    user: req.session.passport.user,
  });
});

app.use("/match", match);

exports.app = functions.region("asia-northeast1").https.onRequest(app);
