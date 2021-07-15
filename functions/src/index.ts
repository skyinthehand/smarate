import * as functions from "firebase-functions";
import * as express from "express";
import * as passport from "passport";
import {IStrategyOption, Strategy as TwitterStrategy} from "passport-twitter";
import * as session from "express-session";

import {router as oauth} from "./oauth";

const config = functions.config();
const twitterConfig: IStrategyOption = {
  consumerKey: config.twitter.consumerkey as string,
  consumerSecret: config.twitter.consumersecret as string,
  callbackURL: "http://localhost:5000/oauth/callback",
};
const twitterStrategy = new TwitterStrategy(
    twitterConfig,
    (accessToken, refreshToken, profile, done) => {
      return done(null, {profile});
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
          id: string,
          username: string,
          displayName: string,
          photos: {
            value: string,
          }[],
        }
      }
    }
  }
}

const app = express();

app.use(passport.initialize());
app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: false,
}));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

app.use("/oauth", oauth);

app.get("/my", (req, res) => {
  if (!req.session.passport) {
    res.redirect("/");
    return;
  }
  res.render("my", {
    user: req.session.passport.user,
  });
});

exports.app = functions.https.onRequest(app);
