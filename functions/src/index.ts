import * as functions from "firebase-functions";
import * as express from "express";
import * as passport from "passport";
import { IStrategyOption, Strategy as TwitterStrategy } from "passport-twitter";
import * as session from "express-session";
import * as moment from "moment-timezone";
import axios from "axios";

import * as firestore from "./firestore";
import { router as oauth } from "./oauth";
import { router as match } from "./match";

const config = functions.config();
const twitterConfig: IStrategyOption = {
  consumerKey: config.twitter.consumerkey as string,
  consumerSecret: config.twitter.consumersecret as string,
  callbackURL: "http://localhost:5000/oauth/callback",
};
const smashggAuthToken = config.smashgg.authtoken as string;
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

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(seasonChecker);

app.get("/", (req, res) => {
  if (!req.session || !req.session.userId || !req.session.twitter) {
    res.render("index", {
      twitter: undefined,
    });
    return;
  }
  res.render("index", {
    twitter: req.session.twitter,
  });
});

app.get("/jpr", (req, res) => {
  getJpr();

  /**
   * smashgg叩くところ
   */
  async function getJpr() {
    const smashggRes = await axios.post(
      "https://api.smash.gg/gql/alpha",
      {
        query: `query TournamentsByCountry {
          tournaments(query: {
            perPage: 4
            page: 2
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
            }
          }
        },`,
        variables: {
          cCode: "JP",
          perPage: 4,
          page: 2,
        },
        operationName: "TournamentsByCountry",
      },
      {
        headers: {
          Authorization: `Bearer ${smashggAuthToken}`,
        },
      }
    );
    res.send(smashggRes.data);
  }
});

app.use("/oauth", oauth);

app.get("/my", (req, res) => {
  if (!req.session || !req.session.passport) {
    res.redirect("/");
    return;
  }
  res.render("my/index", {
    user: req.session.passport.user,
  });
});

app.use("/match", match);

exports.app = functions.region("asia-northeast1").https.onRequest(app);
