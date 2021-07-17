import * as express from "express";
import * as passport from "passport";

// eslint-disable-next-line new-cap
export const router = express.Router();

router.get("/",
    passport.authenticate("twitter"),
);

router.get("/callback",
    passport.authenticate(
        "twitter", {failureRedirect: "/login"}
    ),
    (req, res) => {
      res.redirect("/my");
    }
);
